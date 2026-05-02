const db = require("../config/db");
const { sendSuccess } = require("../utils/apiResponse");

function httpError(message, statusCode) {
    const err = new Error(message);
    err.statusCode = statusCode;
    return err;
}

exports.getMyUsage = async (req, res) => {
    const email = req.user && req.user.email;

    if (!email) {
        throw httpError("Customer email missing. Please login again.", 400);
    }

    const customers = await db.executeQuery(
        "SELECT id FROM customers WHERE email = ? LIMIT 1",
        [email]
    );

    if (customers.length === 0) {
        throw httpError("Customer profile not found", 404);
    }

    const usage = await db.executeQuery(
        `SELECT usage_date, used_gb, total_gb
         FROM data_usage
         WHERE customer_id = ?
         ORDER BY usage_date ASC`,
        [customers[0].id]
    );

    return sendSuccess(res, "Usage loaded", usage);
};
