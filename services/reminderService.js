const db = require("../config/db");
const { notifyBillDue } = require("./notificationService");

async function sendPendingBillReminders() {
    const bills = await db.executeQuery(
        `SELECT bills.id, bills.customer_id, bills.amount, bills.due_date,
                customers.name, customers.email, customers.phone
         FROM bills
         JOIN customers ON bills.customer_id = customers.id
         LEFT JOIN bill_reminders
            ON bill_reminders.bill_id = bills.id
            AND bill_reminders.reminder_date = CURDATE()
            AND bill_reminders.reminder_type = 'due'
         WHERE LOWER(TRIM(COALESCE(bills.status, 'unpaid'))) <> 'paid'
           AND bill_reminders.id IS NULL
           AND bills.due_date < CURDATE()
           AND NOT EXISTS (
                SELECT 1
                FROM payments
                WHERE payments.bill_id = bills.id
                  AND LOWER(TRIM(COALESCE(payments.status, ''))) = 'paid'
           )
         ORDER BY bills.due_date ASC`
    );

    let sentCount = 0;

    for (const bill of bills) {
        const paidRows = await db.executeQuery(
            `SELECT bills.status,
                    COUNT(payments.id) AS paid_payment_count
             FROM bills
             LEFT JOIN payments
                ON payments.bill_id = bills.id
                AND LOWER(TRIM(COALESCE(payments.status, ''))) = 'paid'
             WHERE bills.id = ?
             GROUP BY bills.id, bills.status`,
            [bill.id]
        );
        const currentBill = paidRows[0] || {};
        const paidPaymentCount = Number(currentBill.paid_payment_count || 0);
        const isBillMarkedPaid = String(currentBill.status || "").trim().toLowerCase() === "paid";
        const isPaid = isBillMarkedPaid || paidPaymentCount > 0;

        if (isPaid) {
            if (!isBillMarkedPaid && paidPaymentCount > 0) {
                await db.executeQuery("UPDATE bills SET status = 'paid' WHERE id = ?", [bill.id]);
            }

            console.log(`Skipped paid bill reminder for bill #${bill.id}`);
            continue;
        }

        const reminder = await db.executeQuery(
            "INSERT IGNORE INTO bill_reminders (bill_id, reminder_date, reminder_type) VALUES (?, CURDATE(), 'due')",
            [bill.id]
        );

        if (reminder.affectedRows === 0) {
            console.log(`Skipped duplicate daily reminder for bill #${bill.id}`);
            continue;
        }

        await notifyBillDue(bill, bill);
        sentCount += 1;
    }

    return sentCount;
}

function startReminderScheduler() {
    const everySixHours = 6 * 60 * 60 * 1000;

    setTimeout(() => {
        sendPendingBillReminders().catch((err) => {
            console.error("Scheduled bill reminders failed:", err.message);
        });
    }, 15000);

    setInterval(() => {
        sendPendingBillReminders().catch((err) => {
            console.error("Scheduled bill reminders failed:", err.message);
        });
    }, everySixHours);
}

module.exports = {
    sendPendingBillReminders,
    startReminderScheduler
};
