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
        `SELECT MIN(notification_logs.id) AS id,
                notification_logs.bill_id,
                notification_logs.customer_id,
                customers.name AS customer_name,
                notification_logs.notification_type,
                DATE(MAX(notification_logs.created_at)) AS notification_date,
                MAX(notification_logs.created_at) AS created_at,
                MAX(notification_logs.created_at) AS last_created_at,
                COUNT(*) AS attempt_count,
                GROUP_CONCAT(DISTINCT notification_logs.channel ORDER BY notification_logs.channel SEPARATOR ', ') AS channels,
                GROUP_CONCAT(DISTINCT CASE WHEN notification_logs.status = 'sent' THEN notification_logs.channel END ORDER BY notification_logs.channel SEPARATOR ', ') AS sent_channels,
                GROUP_CONCAT(DISTINCT CASE WHEN notification_logs.status = 'failed' THEN notification_logs.channel END ORDER BY notification_logs.channel SEPARATOR ', ') AS failed_channels,
                GROUP_CONCAT(DISTINCT CASE WHEN notification_logs.status = 'skipped' THEN notification_logs.channel END ORDER BY notification_logs.channel SEPARATOR ', ') AS skipped_channels,
                CASE
                    WHEN SUM(notification_logs.status = 'sent') > 0
                         AND SUM(notification_logs.status IN ('failed', 'skipped')) = 0 THEN 'sent'
                    WHEN SUM(notification_logs.status = 'sent') > 0 THEN 'partial'
                    WHEN SUM(notification_logs.status = 'failed') > 0 THEN 'failed'
                    ELSE 'skipped'
                END AS status,
                GROUP_CONCAT(
                    DISTINCT CASE
                        WHEN notification_logs.status IN ('failed', 'skipped')
                        THEN NULLIF(notification_logs.message, '')
                    END
                    ORDER BY notification_logs.channel SEPARATOR ' | '
                ) AS message
         FROM notification_logs
         LEFT JOIN customers ON notification_logs.customer_id = customers.id
         GROUP BY notification_logs.bill_id,
                  notification_logs.customer_id,
                  customers.name,
                  notification_logs.notification_type,
                  DATE(notification_logs.created_at)
         ORDER BY MAX(notification_logs.created_at) DESC
         LIMIT 100`
    );

    return sendSuccess(res, "Notification logs loaded", logs);
};
