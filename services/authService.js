const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const env = require("../config/env");
const db = require("../config/db");
const userModel = require("../models/userModel");

const VALID_ROLES = new Set(["admin", "staff", "customer"]);

function normalizeRole(role) {
    const normalized = String(role || "customer").trim().toLowerCase();
    return VALID_ROLES.has(normalized) ? normalized : "customer";
}

function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
}

function createHttpError(message, statusCode) {
    const err = new Error(message);
    err.statusCode = statusCode;
    return err;
}

function validatePassword(password) {
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[a-zA-Z\d@$!%*?&]{12,}$/;
    return passwordRegex.test(password);
}

async function hashPassword(password) {
    return bcrypt.hash(password, env.bcryptRounds);
}

async function passwordMatches(password, user) {
    if (!user || !user.password) return false;

    const storedPassword = String(user.password);
    const looksHashed = storedPassword.startsWith("$2");

    if (looksHashed) {
        return bcrypt.compare(password, storedPassword);
    }

    const matched = password === storedPassword;

    if (matched) {
        await userModel.updatePassword(user.id, await hashPassword(password));
    }

    return matched;
}

function signToken(user) {
    const role = normalizeRole(user.role);
    return jwt.sign(
        { id: user.id, name: user.name, email: user.email, role },
        env.jwtSecret,
        { expiresIn: env.jwtExpiresIn }
    );
}

async function registerCustomer({ name, email, phone, address, plan_id, password }) {
    const cleanName = String(name || "").trim();
    const cleanEmail = normalizeEmail(email);
    const cleanPhone = String(phone || "").trim();
    const cleanAddress = String(address || "").trim();
    const planId = Number(plan_id);
    const cleanPassword = String(password || "");

    if (!cleanName || !cleanEmail || !cleanPhone || !cleanAddress || !planId || !cleanPassword) {
        throw createHttpError("All fields required", 400);
    }

    if (!validatePassword(cleanPassword)) {
        throw createHttpError("Password must be at least 12 characters with uppercase, lowercase, number, and special character", 400);
    }

    const existingUser = await userModel.findByEmail(cleanEmail);
    if (existingUser) {
        throw createHttpError("Email already exists", 400);
    }

    const existingCustomer = await db.executeQuery("SELECT id FROM customers WHERE email = ? LIMIT 1", [cleanEmail]);
    if (existingCustomer.length > 0) {
        throw createHttpError("Customer email already exists", 400);
    }

    const plans = await db.executeQuery("SELECT id FROM plans WHERE id = ? LIMIT 1", [planId]);
    if (plans.length === 0) {
        throw createHttpError("Plan ID not found. Please choose an existing plan.", 400);
    }

    const hashedPassword = await hashPassword(cleanPassword);

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        await connection.query(
            "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'customer')",
            [cleanName, cleanEmail, hashedPassword]
        );

        await connection.query(
            "INSERT INTO customers (name, email, phone, address, plan_id) VALUES (?, ?, ?, ?, ?)",
            [cleanName, cleanEmail, cleanPhone, cleanAddress, planId]
        );

        await connection.commit();
    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }

    return { role: "customer" };
}

async function login({ username, email, password, role }) {
    const identifier = normalizeEmail(username || email);
    const cleanPassword = String(password || "");
    const requestedRole = normalizeRole(role);

    if (!identifier || !cleanPassword) {
        throw createHttpError("Enter email and password", 400);
    }

    const user = await userModel.findByEmailAndRole(identifier, requestedRole);
    if (!user) {
        throw createHttpError("User not found for selected role", 400);
    }

    const isMatch = await passwordMatches(cleanPassword, user);
    if (!isMatch) {
        throw createHttpError("Invalid password", 400);
    }

    const safeUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: normalizeRole(user.role)
    };

    return {
        token: signToken(safeUser),
        user: safeUser,
        role: safeUser.role,
        name: safeUser.name
    };
}

async function changePassword(userId, currentPassword, newPassword) {
    if (!currentPassword || !newPassword) {
        throw createHttpError("Current and new password are required", 400);
    }

    if (!validatePassword(String(newPassword))) {
        throw createHttpError("New password must be at least 12 characters with uppercase, lowercase, number, and special character", 400);
    }

    const user = await userModel.findPasswordById(userId);
    if (!user) {
        throw createHttpError("User not found", 404);
    }

    const isMatch = await passwordMatches(String(currentPassword), user);
    if (!isMatch) {
        throw createHttpError("Current password is incorrect", 400);
    }

    await userModel.updatePassword(user.id, await hashPassword(String(newPassword)));
}

module.exports = {
    normalizeRole,
    registerCustomer,
    login,
    changePassword
};
