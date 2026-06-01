const bcrypt = require("bcrypt");
const db = require("../config/db");
const env = require("../config/env");
const { sendSuccess } = require("../utils/apiResponse");

exports.getStaff = async (req, res) => {
    const staff = await db.executeQuery(
        "SELECT id, name, email, role FROM users WHERE role IN ('admin', 'staff') ORDER BY FIELD(role, 'admin', 'staff'), id DESC"
    );
    return sendSuccess(res, "Team users loaded", staff);
};

exports.addStaff = async (req, res) => {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const role = String(req.body.role || "staff").trim().toLowerCase();

    if (!name || !email || !password) {
        const err = new Error("Name, email and password are required");
        err.statusCode = 400;
        throw err;
    }

    if (!["admin", "staff"].includes(role)) {
        const err = new Error("Role must be admin or staff");
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
        "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
        [name, email, hashedPassword, role]
    );

    return sendSuccess(res, `${role === "admin" ? "Admin" : "Staff"} user added successfully`, {}, 201);
};

exports.deleteStaff = async (req, res) => {
    if (Number(req.params.id) === Number(req.user && req.user.id)) {
        const err = new Error("You cannot remove your own active account");
        err.statusCode = 400;
        throw err;
    }

    const result = await db.executeQuery(
        "DELETE FROM users WHERE id = ? AND role IN ('admin', 'staff')",
        [req.params.id]
    );

    if (result.affectedRows === 0) {
        const err = new Error("Team user not found");
        err.statusCode = 404;
        throw err;
    }

    return sendSuccess(res, "Team user removed");
};
