const {
    sendDueDateMessage,
    sendPaidMessage,
    sendCustomerApprovedMessage,
    sendCustomerRejectedMessage
} = require("./whatsappService");
const {
    sendDueDateEmail,
    sendPaidEmail,
    sendCustomerApprovedEmail,
    sendCustomerRejectedEmail
} = require("./emailService");
const {
    sendDueDateSms,
    sendPaidSms,
    sendCustomerApprovedSms,
    sendCustomerRejectedSms
} = require("./smsService");
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

const sendAndLog = async (promise, customer, bill, channel, type) => {
    try {
        const result = await promise;
        const status = result && result.skipped ? "skipped" : "sent";
        const message = result && result.reason;

        if (status === "skipped") {
            console.log(`${channel} ${type} notification skipped:`, message);
        }

        await recordNotification(customer, bill, channel, type, status, message);
        return { channel, type, status, message };
    } catch (err) {
        logFailure(`${channel} ${type}`, err);
        await recordNotification(customer, bill, channel, type, "failed", err.message);
        return { channel, type, status: "failed", message: err.message };
    }
};

const notifyBillDue = (customer, bill) => {
    return Promise.all([
        sendAndLog(sendDueDateMessage(customer, bill), customer, bill, "whatsapp", "due"),
        sendAndLog(sendDueDateSms(customer, bill), customer, bill, "sms", "due"),
        sendAndLog(sendDueDateEmail(customer, bill), customer, bill, "email", "due")
    ]);
};

const notifyBillPaid = (customer, bill) => {
    return Promise.all([
        sendAndLog(sendPaidMessage(customer, bill), customer, bill, "whatsapp", "paid"),
        sendAndLog(sendPaidSms(customer, bill), customer, bill, "sms", "paid"),
        sendAndLog(sendPaidEmail(customer, bill), customer, bill, "email", "paid")
    ]);
};

const notifyCustomerApproved = (customer) => {
    return Promise.all([
        sendAndLog(sendCustomerApprovedMessage(customer), customer, null, "whatsapp", "approved"),
        sendAndLog(sendCustomerApprovedSms(customer), customer, null, "sms", "approved"),
        sendAndLog(sendCustomerApprovedEmail(customer), customer, null, "email", "approved")
    ]);
};

const notifyCustomerRejected = (customer) => {
    return Promise.all([
        sendAndLog(sendCustomerRejectedMessage(customer), customer, null, "whatsapp", "rejected"),
        sendAndLog(sendCustomerRejectedSms(customer), customer, null, "sms", "rejected"),
        sendAndLog(sendCustomerRejectedEmail(customer), customer, null, "email", "rejected")
    ]);
};

module.exports = {
    notifyBillDue,
    notifyBillPaid,
    notifyCustomerApproved,
    notifyCustomerRejected
};
