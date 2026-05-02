const db = require("../config/db");
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
            SELECT bills.*, customers.name AS customer_name
            FROM bills
            JOIN customers ON bills.customer_id = customers.id
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
        `SELECT bills.*, customers.name AS customer_name
         FROM bills
         JOIN customers ON bills.customer_id = customers.id
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

const streamBillPdf = async (id, res) => {
    const results = await db.executeQuery(
        `SELECT bills.*, customers.name, customers.email,
                payments.provider_payment_id,
                payments.receipt_number,
                payments.method,
                payments.paid_at
         FROM bills
         JOIN customers ON bills.customer_id = customers.id
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
    const doc = new PDFDocument({ margin: 50 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=invoice.pdf");

    doc.pipe(res);

    doc.fontSize(20).fillColor("#333").text("NETWAVE BROADBAND", 50, 50);
    doc.fontSize(10).fillColor("gray")
        .text("Karur, Tamil Nadu", 50, 70)
        .text("Email: support@netwave.com", 50, 85);

    doc.fontSize(18).fillColor("black").text("INVOICE", 400, 50);
    doc.moveTo(50, 110).lineTo(550, 110).stroke();

    doc.fontSize(12).fillColor("black")
        .text(`Customer Name: ${bill.name}`, 50, 130)
        .text(`Email: ${bill.email}`, 50, 150)
        .text(`Invoice ID: ${bill.id}`, 400, 130)
        .text(`Date: ${bill.bill_date}`, 400, 150);

    const tableTop = 200;

    doc.fontSize(12)
        .text("Description", 50, tableTop)
        .text("Amount", 400, tableTop);
    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

    doc.fontSize(11)
        .text("Broadband Plan Charges", 50, tableTop + 25)
        .text(`Rs. ${bill.amount}`, 400, tableTop + 25);

    doc.fontSize(12)
        .text("Total:", 350, tableTop + 80)
        .text(`Rs. ${bill.amount}`, 400, tableTop + 80);

    doc.fillColor(bill.status === "paid" ? "green" : "red")
        .text(`Status: ${String(bill.status).toUpperCase()}`, 50, tableTop + 120);

    doc.fillColor("black").text(`Due Date: ${bill.due_date}`, 50, tableTop + 140);
    if (bill.paid_at) {
        doc.text(`Paid At: ${bill.paid_at}`, 50, tableTop + 160);
        doc.text(`Receipt: ${bill.receipt_number || "--"}`, 50, tableTop + 180);
        doc.text(`Transaction: ${bill.provider_payment_id || bill.method || "--"}`, 50, tableTop + 200);
    }
    doc.fontSize(10).fillColor("gray")
        .text("This is a system-generated invoice. No signature required.", { align: "center" });

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
