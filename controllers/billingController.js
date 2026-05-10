const db = require("../config/db");
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const { notifyBillDue, notifyBillPaid } = require("../services/notificationService");
const { sendSuccess } = require("../utils/apiResponse");
const { isValidBillDownloadToken } = require("../utils/billDownloadToken");

function httpError(message, statusCode) {
    const err = new Error(message);
    err.statusCode = statusCode;
    return err;
}

exports.generateBill = async (req, res) => {
    const { customer_id } = req.body;

    if (!customer_id) {
        throw httpError("Customer ID is required", 400);
    }

    const customers = await db.executeQuery(
        `SELECT customers.id, customers.name, customers.email, customers.phone, plans.price
         FROM customers
         JOIN plans ON customers.plan_id = plans.id
         WHERE customers.id = ?
         LIMIT 1`,
        [customer_id]
    );

    if (customers.length === 0) {
        throw httpError("Customer not found", 400);
    }

    const customer = customers[0];
    const billDate = new Date();
    const dueDate = new Date();
    dueDate.setDate(billDate.getDate() + 7);

    const result = await db.executeQuery(
        "INSERT INTO bills (customer_id, amount, bill_date, due_date) VALUES (?, ?, ?, ?)",
        [customer_id, customer.price, billDate, dueDate]
    );

    await db.executeQuery(
        "INSERT INTO bill_items (bill_id, description, amount, item_type) VALUES (?, ?, ?, 'subscription')",
        [result.insertId, "Broadband subscription charges", customer.price]
    );

    notifyBillDue(customer, {
        id: result.insertId,
        amount: customer.price,
        due_date: dueDate
    });

    return sendSuccess(res, "Bill generated successfully", { id: result.insertId }, 201);
};

exports.getBills = async (req, res) => {
    const user = req.user;

    if (user.role === "admin" || user.role === "staff") {
        const bills = await db.executeQuery(`
            SELECT bills.*,
                   customers.name AS customer_name,
                   COALESCE(items.item_count, 0) AS item_count,
                   items.item_summary
            FROM bills
            JOIN customers ON bills.customer_id = customers.id
            LEFT JOIN (
                SELECT bill_id,
                       COUNT(*) AS item_count,
                       GROUP_CONCAT(description ORDER BY id SEPARATOR ', ') AS item_summary
                FROM bill_items
                GROUP BY bill_id
            ) items ON items.bill_id = bills.id
            ORDER BY bills.id DESC
        `);

        return sendSuccess(res, "Bills loaded", bills);
    }

    let email = user.email;

    if (!email) {
        const users = await db.executeQuery("SELECT email FROM users WHERE id = ? LIMIT 1", [user.id]);
        email = users[0] && users[0].email;
    }

    if (!email) {
        throw httpError("Customer email missing. Please login again.", 400);
    }

    const bills = await db.executeQuery(
        `SELECT bills.*,
                customers.name AS customer_name,
                COALESCE(items.item_count, 0) AS item_count,
                items.item_summary
         FROM bills
         JOIN customers ON bills.customer_id = customers.id
         LEFT JOIN (
            SELECT bill_id,
                   COUNT(*) AS item_count,
                   GROUP_CONCAT(description ORDER BY id SEPARATOR ', ') AS item_summary
            FROM bill_items
            GROUP BY bill_id
         ) items ON items.bill_id = bills.id
         WHERE customers.email = ?
         ORDER BY bills.id DESC`,
        [email]
    );

    return sendSuccess(res, "Bills loaded", bills);
};

exports.markPaid = async (req, res) => {
    const { id } = req.params;
    const result = await db.executeQuery("UPDATE bills SET status = 'paid' WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
        throw httpError("Bill not found", 404);
    }

    const rows = await db.executeQuery(
        `SELECT bills.id, bills.customer_id, bills.amount, customers.name, customers.email, customers.phone
         FROM bills
         JOIN customers ON bills.customer_id = customers.id
         WHERE bills.id = ?
         LIMIT 1`,
        [id]
    );

    if (rows.length > 0) {
        const bill = rows[0];
        await db.executeQuery(
            `INSERT INTO payments (bill_id, customer_id, amount, status, method, provider, receipt_number)
             VALUES (?, ?, ?, 'paid', 'manual', 'staff', ?)`,
            [bill.id, bill.customer_id, bill.amount, `NW-${bill.id}-${Date.now()}`]
        );
        notifyBillPaid(bill, bill);
    }

    return sendSuccess(res, "Payment updated");
};

exports.sendReminders = async (req, res) => {
    const { sendPendingBillReminders } = require("../services/reminderService");
    const count = await sendPendingBillReminders();
    return sendSuccess(res, "Bill reminders processed", { count });
};

exports.addBillItem = async (req, res) => {
    const { id } = req.params;
    const description = String(req.body && req.body.description || "").trim();
    const amount = Number(req.body && req.body.amount);
    const itemType = String(req.body && req.body.item_type || "hardware").trim().toLowerCase();

    if (!description) {
        throw httpError("Hardware or service description is required", 400);
    }

    if (!Number.isFinite(amount) || amount <= 0) {
        throw httpError("Valid charge amount is required", 400);
    }

    const rows = await db.executeQuery("SELECT id, amount, status FROM bills WHERE id = ? LIMIT 1", [id]);
    if (rows.length === 0) {
        throw httpError("Bill not found", 404);
    }

    const bill = rows[0];

    if (String(bill.status || "").toLowerCase() === "paid") {
        throw httpError("Cannot add charges to a paid bill", 400);
    }

    const existingItems = await db.executeQuery("SELECT COUNT(*) AS count FROM bill_items WHERE bill_id = ?", [id]);
    if (Number(existingItems[0] && existingItems[0].count || 0) === 0) {
        await db.executeQuery(
            "INSERT INTO bill_items (bill_id, description, amount, item_type) VALUES (?, ?, ?, 'subscription')",
            [id, "Broadband subscription charges", bill.amount]
        );
    }

    await db.executeQuery(
        "INSERT INTO bill_items (bill_id, description, amount, item_type) VALUES (?, ?, ?, ?)",
        [id, description, amount, itemType || "hardware"]
    );

    await db.executeQuery("UPDATE bills SET amount = amount + ? WHERE id = ?", [amount, id]);

    return sendSuccess(res, "Charge added to bill", { bill_id: Number(id), description, amount });
};

exports.sendBillNotification = async (req, res) => {
    const { id } = req.params;
    const requestedType = String(req.body && req.body.notification_type || "").toLowerCase();

    const rows = await db.executeQuery(
        `SELECT bills.id, bills.customer_id, bills.amount, bills.status, bills.due_date,
                customers.name, customers.email, customers.phone
         FROM bills
         JOIN customers ON bills.customer_id = customers.id
         WHERE bills.id = ?
         LIMIT 1`,
        [id]
    );

    if (rows.length === 0) {
        throw httpError("Bill not found", 404);
    }

    const bill = rows[0];
    const notificationType = requestedType || (String(bill.status).toLowerCase() === "paid" ? "paid" : "due");

    let results;

    if (notificationType === "paid") {
        results = await notifyBillPaid(bill, bill);
    } else if (notificationType === "due") {
        results = await notifyBillDue(bill, bill);
    } else {
        throw httpError("Notification type must be due or paid", 400);
    }

    return sendSuccess(res, "Notification processed", { notification_type: notificationType, results });
};

const streamBillPdf = async (id, res) => {
    const results = await db.executeQuery(
        `SELECT bills.*, customers.name, customers.email, customers.phone, customers.address,
                plans.name AS plan_name, plans.speed AS plan_speed,
                payments.provider_payment_id,
                payments.receipt_number,
                payments.method,
                payments.paid_at
         FROM bills
         JOIN customers ON bills.customer_id = customers.id
         LEFT JOIN plans ON customers.plan_id = plans.id
         LEFT JOIN payments ON payments.bill_id = bills.id
         WHERE bills.id = ?
         ORDER BY payments.id DESC
         LIMIT 1`,
        [id]
    );

    if (results.length === 0) {
        throw httpError("Bill not found", 404);
    }

    const bill = results[0];
    const lineItems = await db.executeQuery(
        "SELECT description, amount, item_type FROM bill_items WHERE bill_id = ? ORDER BY id ASC",
        [id]
    );
    const billItems = lineItems.length > 0
        ? lineItems
        : [{ description: "Broadband subscription charges", amount: bill.amount, item_type: "subscription" }];

    if (String(bill.status || "").toLowerCase() !== "paid") {
        throw httpError("Bill can be downloaded only after payment", 403);
    }

    const doc = new PDFDocument({ margin: 42, size: "A4" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=netwave-bill-${bill.id}.pdf`);

    doc.pipe(res);

    const page = {
        left: 42,
        right: 553,
        width: 511
    };
    const brandBlue = "#0B5ED7";
    const deepBlue = "#083B8A";
    const cyan = "#16C7D9";
    const border = "#D7E0EA";
    const muted = "#65758B";
    const dark = "#172033";
    const light = "#F4F8FC";
    const success = "#138A36";
    const logoPath = path.join(__dirname, "..", "Frontend", "logo.png");
    const formatDate = (value) => value
        ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
        : "--";
    const formatDateTime = (value) => value
        ? new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
        : "--";
    const money = (value) => `Rs. ${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const drawLabelValue = (label, value, x, y, width = 230) => {
        doc.fontSize(8).fillColor(muted).text(label.toUpperCase(), x, y, { width });
        doc.fontSize(10).fillColor(dark).text(value || "--", x, y + 13, { width });
    };

    doc.rect(0, 0, 595.28, 112).fill(deepBlue);
    doc.rect(0, 104, 595.28, 8).fill(cyan);

    if (fs.existsSync(logoPath)) {
        doc.image(logoPath, page.left, 20, { width: 58, height: 58, fit: [58, 58] });
    }

    doc.fontSize(20).fillColor("#FFFFFF").font("Helvetica-Bold").text("NetWave Broadband", 112, 28);
    doc.fontSize(9).fillColor("#DCEBFF").font("Helvetica")
        .text("Connecting You. Powering Possibilities.", 112, 53)
        .text("Karur, Tamil Nadu | support@netwave.com", 112, 70);

    doc.roundedRect(414, 26, 139, 54, 6).fill("#FFFFFF");
    doc.fontSize(8).fillColor(muted).text("COMPANY BILL", 428, 38, { width: 112, align: "center" });
    doc.fontSize(16).fillColor(deepBlue).font("Helvetica-Bold")
        .text(`INV-${String(bill.id).padStart(5, "0")}`, 428, 52, { width: 112, align: "center" });

    doc.font("Helvetica");
    doc.fontSize(9).fillColor(muted).text("BILL TO", page.left, 137);
    doc.fontSize(16).fillColor(dark).font("Helvetica-Bold").text(bill.name || "Customer", page.left, 153, { width: 250 });
    doc.font("Helvetica").fontSize(10).fillColor(dark)
        .text(bill.email || "--", page.left, 178, { width: 250 })
        .text(bill.phone || "--", page.left, 194, { width: 250 });
    if (bill.address) {
        doc.text(bill.address, page.left, 210, { width: 250 });
    }

    doc.roundedRect(338, 134, 215, 96, 8).fill(light).stroke(border);
    drawLabelValue("Bill Date", formatDate(bill.bill_date), 356, 151, 82);
    drawLabelValue("Due Date", formatDate(bill.due_date), 454, 151, 82);
    drawLabelValue("Status", String(bill.status || "paid").toUpperCase(), 356, 193, 82);
    drawLabelValue("Customer ID", `#${bill.customer_id || "--"}`, 454, 193, 82);

    const tableTop = 275;
    doc.roundedRect(page.left, tableTop, page.width, 34, 6).fill(deepBlue);
    doc.fontSize(9).fillColor("#FFFFFF").font("Helvetica-Bold")
        .text("Description", page.left + 16, tableTop + 12, { width: 230 })
        .text("Plan", 308, tableTop + 12, { width: 90 })
        .text("Amount", 444, tableTop + 12, { width: 82, align: "right" });

    let rowTop = tableTop + 34;
    billItems.forEach((item) => {
        const rowHeight = 46;
        doc.rect(page.left, rowTop, page.width, rowHeight).fill("#FFFFFF").stroke(border);
        doc.font("Helvetica").fontSize(10).fillColor(dark)
            .text(item.description || "Bill charge", page.left + 16, rowTop + 14, { width: 230 });
        doc.fontSize(9).fillColor(muted)
            .text(item.item_type === "subscription" ? (bill.plan_name || "NetWave Broadband") : "Hardware / service", 308, rowTop + 11, { width: 100 })
            .text(item.item_type === "subscription" ? (bill.plan_speed || "") : "", 308, rowTop + 27, { width: 100 });
        doc.fontSize(10).fillColor(dark).text(money(item.amount), 444, rowTop + 14, { width: 82, align: "right" });
        rowTop += rowHeight;
    });

    const totalTop = rowTop + 22;
    doc.roundedRect(340, totalTop, 213, 78, 8).fill(light).stroke(border);
    doc.font("Helvetica").fontSize(10).fillColor(muted)
        .text("Subtotal", 358, totalTop + 17, { width: 90 })
        .text(money(bill.amount), 444, totalTop + 17, { width: 82, align: "right" });
    doc.moveTo(358, totalTop + 43).lineTo(535, totalTop + 43).strokeColor(border).stroke();
    doc.font("Helvetica-Bold").fontSize(13).fillColor(deepBlue)
        .text("Total Paid", 358, totalTop + 53, { width: 90 })
        .text(money(bill.amount), 444, totalTop + 53, { width: 82, align: "right" });

    doc.roundedRect(page.left, totalTop, 245, 78, 8).fill("#FFFFFF").stroke(border);
    doc.font("Helvetica-Bold").fontSize(11).fillColor(dark).text("Payment Details", page.left + 16, totalTop + 14);
    doc.font("Helvetica").fontSize(9).fillColor(muted)
        .text(`Paid At: ${formatDateTime(bill.paid_at)}`, page.left + 16, totalTop + 34, { width: 210 })
        .text(`Receipt: ${bill.receipt_number || "--"}`, page.left + 16, totalTop + 49, { width: 210 })
        .text(`Transaction: ${bill.provider_payment_id || bill.method || "--"}`, page.left + 16, totalTop + 64, { width: 210 });

    doc.roundedRect(page.left, 500, page.width, 64, 8).fill("#F9FBFD").stroke(border);
    doc.font("Helvetica-Bold").fontSize(10).fillColor(dark).text("Notes", page.left + 16, 515);
    doc.font("Helvetica").fontSize(9).fillColor(muted)
        .text("Thank you for choosing NetWave Broadband. Please keep this bill for your records.", page.left + 16, 533, { width: 470 })
        .text("For billing corrections or payment queries, contact NetWave support with your bill ID.", page.left + 16, 548, { width: 470 });

    doc.moveTo(page.left, 716).lineTo(page.right, 716).strokeColor(border).stroke();
    doc.fontSize(8).fillColor(muted)
        .text("This is a system-generated company bill and does not require a signature.", page.left, 728, { width: page.width, align: "center" })
        .text("(c) 2026 NetWave Broadband. All rights reserved.", page.left, 742, { width: page.width, align: "center" });

    doc.end();
};

exports.downloadBill = async (req, res) => {
    return streamBillPdf(req.params.id, res);
};

exports.downloadBillByToken = async (req, res) => {
    const { id, expiresAt, token } = req.params;

    if (!isValidBillDownloadToken(id, expiresAt, token)) {
        throw httpError("Invalid or expired bill download link", 403);
    }

    return streamBillPdf(id, res);
};
