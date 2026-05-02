const db = require("../config/db");

async function findByEmailAndRole(email, role) {
    const rows = await db.executeQuery(
        "SELECT id, name, email, password, role FROM users WHERE email = ? AND role = ? LIMIT 1",
        [email, role]
    );
    return rows[0] || null;
}

async function findByEmail(email) {
    const rows = await db.executeQuery(
        "SELECT id, name, email, password, role FROM users WHERE email = ? LIMIT 1",
        [email]
    );
    return rows[0] || null;
}

async function findPasswordById(id) {
    const rows = await db.executeQuery(
        "SELECT id, password FROM users WHERE id = ? LIMIT 1",
        [id]
    );
    return rows[0] || null;
}

async function createUser({ name, email, password, role }) {
    const result = await db.executeQuery(
        "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
        [name, email, password, role]
    );
    return result.insertId;
}

async function updatePassword(id, password) {
    await db.executeQuery("UPDATE users SET password = ? WHERE id = ?", [password, id]);
}

module.exports = {
    findByEmailAndRole,
    findByEmail,
    findPasswordById,
    createUser,
    updatePassword
};
