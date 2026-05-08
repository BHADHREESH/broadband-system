const { sendDueDateMessage, sendPaidMessage } = require("./whatsappService");
const { sendDueDateEmail, sendPaidEmail } = require("./emailService");
const { sendDueDateSms, sendPaidSms } = require("./smsService");
const db = require("../config/db");

const logFailure = (channel, err) => {
    console.error(`${channel} notification failed:`, err.message);
    console.error(err);
};

const recordNotification = async (customer, bill, channel, type, status, message) => {
    try {
        await db.executeQuery(
            `INSERT INTO notification_logs (bill_id, customer_id, channel, notification_type, status, message)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                bill && bill.id ? bill.id : null,
                customer && customer.customer_id ? customer.customer_id : customer && customer.id ? customer.id : null,
                channel,
                type,
                status,
                String(message || "").slice(0, 255)
            ]
        );
    } catch (err) {
        console.error("Notification log failed:", err.message);
    }
};

const sendAndLog = (promise, customer, bill, channel, type) => {
    promise
        .then((result) => {
            const status = result && result.skipped ? "skipped" : "sent";
            if (status === "skipped") {
                console.log(`${channel} ${type} notification skipped:`, result && result.reason);
            }
            return recordNotification(customer, bill, channel, type, status, result && result.reason);
        })
        .catch((err) => {
            logFailure(`${channel} ${type}`, err);
            return recordNotification(customer, bill, channel, type, "failed", err.message);
        });
};

const notifyBillDue = (customer, bill) => {
    sendAndLog(sendDueDateMessage(customer, bill), customer, bill, "whatsapp", "due");
    sendAndLog(sendDueDateSms(customer, bill), customer, bill, "sms", "due");
    sendAndLog(sendDueDateEmail(customer, bill), customer, bill, "email", "due");
};

const notifyBillPaid = (customer, bill) => {
    sendAndLog(sendPaidMessage(customer, bill), customer, bill, "whatsapp", "paid");
    sendAndLog(sendPaidSms(customer, bill), customer, bill, "sms", "paid");
    sendAndLog(sendPaidEmail(customer, bill), customer, bill, "email", "paid");
};

module.exports = {
    notifyBillDue,
    notifyBillPaid
};
