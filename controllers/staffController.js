const bcrypt = require("bcrypt");
const db = require("../config/db");
const env = require("../config/env");
const { sendSuccess } = require("../utils/apiResponse");

exports.getStaff = async (req, res) => {
    const staff = await db.executeQuery(
        "SELECT id, name, email, role FROM users WHERE role = 'staff' ORDER BY id DESC"
    );
    return sendSuccess(res, "Staff loaded", staff);
};

exports.addStaff = async (req, res) => {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!name || !email || !password) {
        const err = new Error("Name, email and password are required");
        err.statusCode = 400;
        throw err;
    }

    if (password.length < 6) {
        const err = new Error("Password must be at least 6 characters");
        err.statusCode = 400;
        throw err;
    }

    const hashedPassword = await bcrypt.hash(password, env.bcryptRounds);

    await db.executeQuery(
        "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'staff')",
        [name, email, hashedPassword]
    );

    return sendSuccess(res, "Staff added successfully", {}, 201);
};

exports.deleteStaff = async (req, res) => {
    const result = await db.executeQuery(
        "DELETE FROM users WHERE id = ? AND role = 'staff'",
        [req.params.id]
    );

    if (result.affectedRows === 0) {
        const err = new Error("Staff user not found");
        err.statusCode = 404;
        throw err;
    }

    return sendSuccess(res, "Staff deleted");
};
