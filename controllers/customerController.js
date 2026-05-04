const bcrypt = require("bcrypt");
const db = require("../config/db");
const env = require("../config/env");
const { sendSuccess } = require("../utils/apiResponse");

function httpError(message, statusCode) {
    const err = new Error(message);
    err.statusCode = statusCode;
    return err;
}

exports.addCustomer = async (req, res) => {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const phone = String(req.body.phone || "").trim();
    const address = String(req.body.address || "").trim();
    const plan_id = req.body.plan_id;
    const password = String(req.body.password || "");

    if (!name || !email || !plan_id) {
        throw httpError("Name, email and plan are required", 400);
    }

    if (password && password.length < 6) {
        throw httpError("Password must be at least 6 characters", 400);
    }

    const plans = await db.executeQuery("SELECT id FROM plans WHERE id = ? LIMIT 1", [plan_id]);
    if (plans.length === 0) {
        throw httpError("Plan ID not found. Please choose an existing plan.", 400);
    }

    const customers = await db.executeQuery("SELECT id FROM customers WHERE email = ? LIMIT 1", [email]);
    if (customers.length > 0) {
        throw httpError("Customer email already exists", 400);
    }

    await db.executeQuery(
        "INSERT INTO customers (name, email, phone, address, plan_id) VALUES (?, ?, ?, ?, ?)",
        [name, email, phone, address, plan_id]
    );

    if (password) {
        const hashedPassword = await bcrypt.hash(password, env.bcryptRounds);
        await db.executeQuery(
            `INSERT INTO users (name, email, password, role)
             VALUES (?, ?, ?, 'customer')
             ON DUPLICATE KEY UPDATE name = VALUES(name), password = VALUES(password), role = 'customer'`,
            [name, email, hashedPassword]
        );
    }

    return sendSuccess(
        res,
        password ? "Customer and login account added successfully" : "Customer added successfully",
        {},
        201
    );
};

exports.getCustomers = async (req, res) => {
    const customers = await db.executeQuery("SELECT * FROM customers ORDER BY id DESC");
    return sendSuccess(res, "Customers loaded", customers);
};

exports.getMyCustomerProfile = async (req, res) => {
    const email = req.user && req.user.email;

    if (!email) {
        throw httpError("Customer email missing. Please login again.", 400);
    }

    const rows = await db.executeQuery(
        `SELECT customers.id,
                customers.name,
                customers.email,
                customers.phone,
                customers.address,
                customers.status,
                plans.id AS plan_id,
                plans.name AS plan_name,
                plans.speed,
                plans.price,
                plans.validity
         FROM customers
         JOIN plans ON customers.plan_id = plans.id
         WHERE customers.email = ?
         LIMIT 1`,
        [email]
    );

    if (rows.length === 0) {
        throw httpError("Customer profile not found", 404);
    }

    return sendSuccess(res, "Customer profile loaded", rows[0]);
};

exports.updateMyCustomerProfile = async (req, res) => {
    const email = req.user && req.user.email;
    const name = req.body.name ? String(req.body.name).trim() : null;
    const phone = req.body.phone ? String(req.body.phone).trim() : null;
    const address = req.body.address ? String(req.body.address).trim() : null;

    if (!email) {
        throw httpError("Customer email missing. Please login again.", 400);
    }

    const result = await db.executeQuery(
        `UPDATE customers
         SET name = COALESCE(?, name),
             phone = COALESCE(?, phone),
             address = COALESCE(?, address)
         WHERE email = ?`,
        [name, phone, address, email]
    );

    if (result.affectedRows === 0) {
        throw httpError("Customer profile not found", 404);
    }

    if (name) {
        await db.executeQuery("UPDATE users SET name = ? WHERE email = ? AND role = 'customer'", [name, email]);
    }

    return sendSuccess(res, "Profile updated");
};

exports.updateCustomer = async (req, res) => {
    const { id } = req.params;
    const { name, email, phone, address, plan_id, status } = req.body;

    if (status && !["pending", "active", "suspended"].includes(status)) {
        throw httpError("Invalid customer status", 400);
    }

    const existing = await db.executeQuery("SELECT email FROM customers WHERE id = ? LIMIT 1", [id]);
    if (existing.length === 0) {
        throw httpError("Customer not found", 404);
    }

    const result = await db.executeQuery(
        `UPDATE customers
         SET name = COALESCE(?, name),
             email = COALESCE(?, email),
             phone = COALESCE(?, phone),
             address = COALESCE(?, address),
             plan_id = COALESCE(?, plan_id),
             status = COALESCE(?, status)
         WHERE id = ?`,
        [name, email, phone, address, plan_id, status, id]
    );

    if (name || email) {
        const rows = await db.executeQuery("SELECT email, name FROM customers WHERE id = ? LIMIT 1", [id]);
        if (rows.length > 0) {
            await db.executeQuery(
                "UPDATE users SET name = ?, email = ? WHERE role = 'customer' AND email = ?",
                [rows[0].name, rows[0].email, existing[0].email]
            );
        }
    }

    return sendSuccess(res, "Customer updated");
};

exports.approveCustomer = async (req, res) => {
    const { id } = req.params;
    const result = await db.executeQuery(
        "UPDATE customers SET status = 'active' WHERE id = ? AND status = 'pending'",
        [id]
    );

    if (result.affectedRows === 0) {
        throw httpError("Pending customer not found", 404);
    }

    return sendSuccess(res, "Customer approved");
};

exports.rejectCustomer = async (req, res) => {
    const { id } = req.params;
    const results = await db.executeQuery(
        "SELECT email FROM customers WHERE id = ? AND status = 'pending' LIMIT 1",
        [id]
    );

    if (results.length === 0) {
        throw httpError("Pending customer not found", 404);
    }

    const email = results[0].email;
    await db.executeQuery("DELETE FROM customers WHERE id = ? AND status = 'pending'", [id]);
    await db.executeQuery("DELETE FROM users WHERE email = ? AND role = 'customer'", [email]);

    return sendSuccess(res, "Customer registration rejected");
};

exports.deleteCustomer = async (req, res) => {
    const { id } = req.params;
    const results = await db.executeQuery("SELECT email FROM customers WHERE id = ? LIMIT 1", [id]);

    if (results.length === 0) {
        throw httpError("Customer not found", 404);
    }

    const email = results[0].email;

    await db.executeQuery("DELETE FROM bills WHERE customer_id = ?", [id]);
    await db.executeQuery("DELETE FROM customers WHERE id = ?", [id]);
    await db.executeQuery("DELETE FROM users WHERE email = ? AND role = 'customer'", [email]);

    return sendSuccess(res, "Customer deleted");
};
