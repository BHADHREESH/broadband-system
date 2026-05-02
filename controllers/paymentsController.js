const db = require("../config/db");
const { sendSuccess } = require("../utils/apiResponse");

exports.getPayments = async (req, res) => {
    const user = req.user || {};
    let sql = `
        SELECT payments.id,
               payments.bill_id,
               payments.amount,
               payments.status,
               payments.method,
               payments.provider,
               payments.provider_order_id,
               payments.provider_payment_id,
               payments.receipt_number,
               payments.paid_at,
               bills.bill_date,
               customers.name AS customer_name,
               customers.email AS customer_email
        FROM payments
        JOIN bills ON payments.bill_id = bills.id
        JOIN customers ON payments.customer_id = customers.id
    `;
    const params = [];

    if (user.role === "customer") {
        sql += " WHERE customers.email = ?";
        params.push(user.email);
    }

    sql += " ORDER BY payments.id DESC";

    const payments = await db.executeQuery(sql, params);
    return sendSuccess(res, "Payments loaded", payments);
};

exports.getNotificationLogs = async (req, res) => {
    const logs = await db.executeQuery(
        `SELECT notification_logs.*, customers.name AS customer_name
         FROM notification_logs
         LEFT JOIN customers ON notification_logs.customer_id = customers.id
         ORDER BY notification_logs.id DESC
         LIMIT 100`
    );

    return sendSuccess(res, "Notification logs loaded", logs);
};
