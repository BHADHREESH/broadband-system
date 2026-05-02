const SMS_API_URL = process.env.SMS_API_URL;
const SMS_API_KEY = process.env.SMS_API_KEY;
const SMS_FROM = process.env.SMS_FROM;

const isConfigured = () => Boolean(SMS_API_URL);

const formatPhone = (phone) => {
    if (!phone) return "";

    const digits = String(phone).replace(/\D/g, "");

    if (digits.length === 10) {
        return `91${digits}`;
    }

    return digits;
};

const formatDate = (date) => {
    if (!date) return "--";

    return new Date(date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
};

const sendSms = async (phone, message) => {
    if (!isConfigured()) {
        console.log("SMS not configured. Skipped SMS:", message);
        return { skipped: true, reason: "SMS not configured" };
    }

    const to = formatPhone(phone);

    if (!to) {
        return { skipped: true, reason: "Customer phone missing" };
    }

    const response = await fetch(SMS_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(SMS_API_KEY ? { Authorization: `Bearer ${SMS_API_KEY}` } : {})
        },
        body: JSON.stringify({
            to,
            phone: to,
            message,
            sender: SMS_FROM || "NetWave"
        })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.message || data.error || "SMS failed");
    }

    return data;
};

const sendDueDateSms = (customer, bill) => sendSms(
    customer.phone,
    `NetWave reminder: your broadband bill of Rs. ${bill.amount} is due on ${formatDate(bill.due_date)}. Please pay the amount before the due date to keep your service active.`
);

const sendPaidSms = (customer, bill) => sendSms(
    customer.phone,
    `NetWave payment complete. We received Rs. ${bill.amount} for bill #${bill.id}. Thank you.`
);

module.exports = {
    sendDueDateSms,
    sendPaidSms
};
