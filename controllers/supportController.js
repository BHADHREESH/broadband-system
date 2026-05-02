const db = require("../config/db");
const { sendSuccess } = require("../utils/apiResponse");

function httpError(message, statusCode) {
    const err = new Error(message);
    err.statusCode = statusCode;
    return err;
}

const ensureSupportTable = async () => {
    await db.executeQuery(`
        CREATE TABLE IF NOT EXISTS support_tickets (
            id INT AUTO_INCREMENT PRIMARY KEY,
            customer_id INT NULL,
            name VARCHAR(100) NULL,
            email VARCHAR(100) NULL,
            issue TEXT NOT NULL,
            status VARCHAR(30) NOT NULL DEFAULT 'open',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_support_customer_id (customer_id),
            INDEX idx_support_email (email),
            INDEX idx_support_status (status)
        )
    `);
};

exports.getTickets = async (req, res) => {
    await ensureSupportTable();

    const user = req.user || {};
    const tickets = user.role === "customer"
        ? await db.executeQuery(
            "SELECT * FROM support_tickets WHERE email = ? OR customer_id = ? ORDER BY id DESC",
            [user.email, user.id]
        )
        : await db.executeQuery("SELECT * FROM support_tickets ORDER BY id DESC");

    return sendSuccess(res, "Support tickets loaded", tickets);
};

exports.createTicket = async (req, res) => {
    const issue = String(req.body.issue || "").trim();
    const user = req.user || {};

    if (!issue) {
        throw httpError("Issue is required", 400);
    }

    await ensureSupportTable();

    const result = await db.executeQuery(
        `INSERT INTO support_tickets (customer_id, name, email, issue, status)
         VALUES (?, ?, ?, ?, 'open')`,
        [user.id || null, user.name || null, user.email || null, issue]
    );

    return sendSuccess(res, "Ticket submitted", { id: result.insertId }, 201);
};

exports.updateTicket = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const allowedStatuses = ["open", "in-progress", "resolved"];

    if (!allowedStatuses.includes(status)) {
        throw httpError("Invalid ticket status", 400);
    }

    await ensureSupportTable();

    const result = await db.executeQuery(
        "UPDATE support_tickets SET status = ? WHERE id = ?",
        [status, id]
    );

    if (result.affectedRows === 0) {
        throw httpError("Ticket not found", 404);
    }

    return sendSuccess(res, "Ticket updated");
};
