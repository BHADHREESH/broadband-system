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
         WHERE bills.status <> 'paid'
           AND bill_reminders.id IS NULL
           AND bills.due_date <= DATE_ADD(CURDATE(), INTERVAL 3 DAY)
         ORDER BY bills.due_date ASC`
    );

    for (const bill of bills) {
        notifyBillDue(bill, bill);
        await db.executeQuery(
            "INSERT INTO bill_reminders (bill_id, reminder_date, reminder_type) VALUES (?, CURDATE(), 'due')",
            [bill.id]
        );
    }

    return bills.length;
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
