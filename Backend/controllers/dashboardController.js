const db = require("../config/db");
const { sendSuccess } = require("../utils/apiResponse");

exports.getStats = async (req, res) => {
    const [revenueRows, customerRows, paymentRows] = await Promise.all([
        db.executeQuery("SELECT COALESCE(SUM(amount), 0) AS revenue FROM bills WHERE status = 'paid'"),
        db.executeQuery("SELECT COUNT(*) AS customers FROM customers"),
        db.executeQuery("SELECT status, COUNT(*) AS count FROM bills GROUP BY status")
    ]);

    return sendSuccess(res, "Dashboard stats loaded", {
        revenue: revenueRows[0].revenue || 0,
        customers: customerRows[0].customers || 0,
        payments: paymentRows
    });
};
