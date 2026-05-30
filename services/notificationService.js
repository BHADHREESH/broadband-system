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

const getProviderMessage = (result) => {
    if (!result || typeof result !== "object") return "";
    if (result.reason) return result.reason;
    if (result.request_id) return `Provider accepted request ${result.request_id}`;
    if (result.message) return result.message;
    if (result.sid) return `Provider accepted message ${result.sid}`;
    if (Array.isArray(result.accepted) && result.accepted.length > 0) {
        return `Accepted: ${result.accepted.join(", ")}`;
    }
    if (result.type === "success") return "Provider accepted notification request";
    return "";
};

const getCustomerId = (customer) => {
    if (!customer) return null;
    return customer.customer_id || customer.id || null;
};

const isOverdue = (bill) => {
    if (!bill || !bill.due_date) return false;

    const dueDate = new Date(bill.due_date);
    const today = new Date();

    dueDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    return dueDate < today;
};

const getBillReminderText = (bill) => {
    if (isOverdue(bill)) {
        return `Your broadband bill of Rs. ${bill.amount} is overdue. Please pay now to avoid service interruption.`;
    }

    return `Your broadband bill of Rs. ${bill.amount} is pending. Please pay before the due date to keep your service active.`;
};

const createInAppNotification = async (customer, bill, type, title, message) => {
    const customerId = getCustomerId(customer);

    if (!customerId) {
        return { skipped: true, reason: "Customer ID missing" };
    }

    const result = await db.executeQuery(
        `INSERT INTO customer_notifications (customer_id, bill_id, notification_type, title, message)
         VALUES (?, ?, ?, ?, ?)`,
        [
            customerId,
            bill && bill.id ? bill.id : null,
            type,
            title,
            String(message || "").slice(0, 500)
        ]
    );

    return { id: result.insertId };
};

const sendAndLog = async (promise, customer, bill, channel, type) => {
    try {
        const result = await promise;
        const status = result && result.skipped ? "skipped" : "sent";
        const message = getProviderMessage(result);

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
    const reminderText = getBillReminderText(bill);

    return Promise.all([
        sendAndLog(createInAppNotification(
            customer,
            bill,
            "due",
            isOverdue(bill) ? "Overdue bill reminder" : "Bill payment reminder",
            reminderText
        ), customer, bill, "app", "due"),
        sendAndLog(sendDueDateMessage(customer, bill), customer, bill, "whatsapp", "due"),
        sendAndLog(sendDueDateSms(customer, bill), customer, bill, "sms", "due"),
        sendAndLog(sendDueDateEmail(customer, bill), customer, bill, "email", "due")
    ]);
};

const notifyBillPaid = (customer, bill) => {
    return Promise.all([
        sendAndLog(createInAppNotification(
            customer,
            bill,
            "paid",
            "Payment received",
            `Payment received for bill #${bill.id}. Thank you for paying your NetWave broadband bill.`
        ), customer, bill, "app", "paid"),
        sendAndLog(sendPaidMessage(customer, bill), customer, bill, "whatsapp", "paid"),
        sendAndLog(sendPaidSms(customer, bill), customer, bill, "sms", "paid"),
        sendAndLog(sendPaidEmail(customer, bill), customer, bill, "email", "paid")
    ]);
};

const notifyCustomerApproved = (customer) => {
    return Promise.all([
        sendAndLog(createInAppNotification(
            customer,
            null,
            "approved",
            "Account approved",
            "Your NetWave broadband account is approved. You can now use your customer dashboard."
        ), customer, null, "app", "approved"),
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

const summarizeNotificationResults = (results) => {
    const items = Array.isArray(results) ? results : [];
    const sent = items.filter((result) => result.status === "sent");
    const failed = items.filter((result) => result.status === "failed");
    const skipped = items.filter((result) => result.status === "skipped");

    return {
        sent: sent.map((result) => result.channel),
        failed: failed.map((result) => ({
            channel: result.channel,
            message: result.message || ""
        })),
        skipped: skipped.map((result) => ({
            channel: result.channel,
            message: result.message || ""
        })),
        hasSent: sent.length > 0,
        allFailedOrSkipped: items.length > 0 && sent.length === 0
    };
};

module.exports = {
    notifyBillDue,
    notifyBillPaid,
    notifyCustomerApproved,
    notifyCustomerRejected,
    summarizeNotificationResults
};
