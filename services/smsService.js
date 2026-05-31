const firstValue = (...values) => values.find((value) => String(value || "").trim());

const SMS_API_URL = process.env.SMS_API_URL;
const SMS_API_KEY = process.env.SMS_API_KEY;
const SMS_FROM = process.env.SMS_FROM;
const MSG91_AUTHKEY = firstValue(process.env.MSG91_AUTHKEY, process.env.MSG91_SMS_AUTHKEY);
const MSG91_FLOW_ID = firstValue(process.env.MSG91_FLOW_ID, process.env.MSG91_SMS_FLOW_ID, process.env.MSG91_TEMPLATE_ID);
const MSG91_SENDER = firstValue(process.env.MSG91_SENDER, process.env.MSG91_SMS_SENDER, process.env.MSG91_SENDER_ID);
const MSG91_MESSAGE_VAR = process.env.MSG91_MESSAGE_VAR || "message";
const MSG91_ROUTE = process.env.MSG91_ROUTE;
const MSG91_SMS_API_URL = process.env.MSG91_SMS_API_URL || "https://api.msg91.com/api/v5/flow/";
const SMS_DUPLICATE_WINDOW_MS = Number(process.env.SMS_DUPLICATE_WINDOW_MS || 12000);
const recentSmsRequests = new Map();

const hasRealValue = (value) => {
    const text = String(value || "").trim();
    return Boolean(text && !text.startsWith("your-"));
};

const isMsg91Configured = () => Boolean(hasRealValue(MSG91_AUTHKEY) && hasRealValue(MSG91_FLOW_ID));

const isConfigured = () => Boolean(hasRealValue(SMS_API_URL) || isMsg91Configured());

const getMissingMsg91Fields = () => [
    ["MSG91_AUTHKEY", MSG91_AUTHKEY],
    ["MSG91_FLOW_ID", MSG91_FLOW_ID]
]
    .filter(([, value]) => !hasRealValue(value))
    .map(([key]) => key);

const formatPhone = (phone) => {
    if (!phone) return "";

    const digits = String(phone).replace(/\D/g, "");

    if (digits.length === 10) {
        return `91${digits}`;
    }

    return digits;
};

const formatE164Phone = (phone) => {
    if (/x/i.test(String(phone || ""))) return "";

    const digits = formatPhone(phone);

    if (!digits) return "";
    return digits.startsWith("+") ? digits : `+${digits}`;
};

const isE164Phone = (phone) => /^\+[1-9]\d{7,14}$/.test(String(phone || ""));

const getMsg91Diagnostics = () => ({
    authkeyPresent: Boolean(MSG91_AUTHKEY),
    flowId: MSG91_FLOW_ID || "",
    sender: MSG91_SENDER || "",
    route: MSG91_ROUTE || "",
    apiUrl: MSG91_SMS_API_URL,
    messageVariable: MSG91_MESSAGE_VAR,
    missingFields: getMissingMsg91Fields(),
    configured: isMsg91Configured(),
    nodeVersion: process.version
});

const logMsg91Diagnostics = () => {
    console.log("MSG91_AUTHKEY present:", Boolean(MSG91_AUTHKEY));
    console.log("MSG91_FLOW_ID:", MSG91_FLOW_ID);
    console.log("MSG91_SENDER:", MSG91_SENDER);
    console.log("MSG91_ROUTE:", MSG91_ROUTE);
    console.log("MSG91_MESSAGE_VAR:", process.env.MSG91_MESSAGE_VAR || "message");
    console.log("MSG91 runtime diagnostics:", getMsg91Diagnostics());
};

const getSmsDiagnostics = () => ({
    msg91: getMsg91Diagnostics(),
    genericSmsApiConfigured: Boolean(SMS_API_URL)
});

const formatDate = (date) => {
    if (!date) return "--";

    return new Date(date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
};

const isOverdue = (bill) => {
    if (!bill || !bill.due_date) return false;

    const dueDate = new Date(bill.due_date);
    const today = new Date();

    dueDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    return dueDate < today;
};

const getDuplicateSmsKey = (phone, message) => `${formatPhone(phone)}:${String(message || "").trim()}`;

const getDuplicateSmsSkip = (phone, message) => {
    if (!SMS_DUPLICATE_WINDOW_MS) return null;

    const key = getDuplicateSmsKey(phone, message);
    const lastSentAt = recentSmsRequests.get(key);

    if (!lastSentAt) return null;

    const elapsed = Date.now() - lastSentAt;
    if (elapsed >= SMS_DUPLICATE_WINDOW_MS) return null;

    const waitSeconds = Math.ceil((SMS_DUPLICATE_WINDOW_MS - elapsed) / 1000);
    return {
        skipped: true,
        reason: `Duplicate SMS suppressed. Retry after ${waitSeconds} seconds.`
    };
};

const rememberSmsRequest = (phone, message) => {
    if (!SMS_DUPLICATE_WINDOW_MS) return;

    const now = Date.now();
    recentSmsRequests.set(getDuplicateSmsKey(phone, message), now);

    for (const [key, sentAt] of recentSmsRequests) {
        if (now - sentAt > SMS_DUPLICATE_WINDOW_MS) {
            recentSmsRequests.delete(key);
        }
    }
};

const sendMsg91Sms = async (phone, message, variables = {}) => {
    const to = formatPhone(phone);

    if (!to) {
        return { skipped: true, reason: "Customer phone missing" };
    }

    if (!isMsg91Configured()) {
        return {
            skipped: true,
            reason: `MSG91 SMS not configured. Missing: ${getMissingMsg91Fields().join(", ")}`
        };
    }

    const recipient = {
        mobiles: to,
        [MSG91_MESSAGE_VAR]: message,
        message,
        var: message,
        var1: message,
        ...variables
    };

    const body = {
        flow_id: MSG91_FLOW_ID,
        recipients: [recipient],
        ...(MSG91_SENDER ? { sender: MSG91_SENDER } : {}),
        ...(MSG91_ROUTE ? { route: MSG91_ROUTE } : {})
    };

    const response = await fetch(MSG91_SMS_API_URL, {
        method: "POST",
        headers: {
            authkey: MSG91_AUTHKEY,
            accept: "application/json",
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.type === "error") {
        console.error("MSG91 SMS API error response:", {
            status: response.status,
            statusText: response.statusText,
            request: {
                flowId: MSG91_FLOW_ID,
                sender: MSG91_SENDER || undefined,
                route: MSG91_ROUTE || undefined,
                to,
                variables: Object.keys(recipient)
            },
            response: data
        });

        const err = new Error(data.message || data.error || "MSG91 SMS failed");
        err.status = response.status;
        err.statusText = response.statusText;
        err.response = data;
        throw err;
    }

    console.log("MSG91 SMS sent:", {
        to,
        flowId: MSG91_FLOW_ID,
        requestId: data.request_id,
        response: data
    });

    return data;
};

const sendSms = async (phone, message, variables = {}) => {
    if (!isConfigured()) {
        console.log("SMS not configured. Skipped SMS:", message);
        return { skipped: true, reason: "SMS not configured" };
    }

    const duplicateSkip = getDuplicateSmsSkip(phone, message);
    if (duplicateSkip) {
        console.log("Duplicate SMS skipped:", {
            to: formatPhone(phone),
            waitMs: SMS_DUPLICATE_WINDOW_MS
        });
        return duplicateSkip;
    }

    if (isMsg91Configured()) {
        const result = await sendMsg91Sms(phone, message, variables);
        rememberSmsRequest(phone, message);
        return result;
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

    rememberSmsRequest(phone, message);
    return data;
};

const sendDueDateSms = (customer, bill) => sendSms(
    customer.phone,
    isOverdue(bill)
        ? `NetWave overdue reminder: your broadband bill of Rs. ${bill.amount} was due on ${formatDate(bill.due_date)} and is still pending. Please pay now to avoid service interruption.`
        : `NetWave reminder: your broadband bill of Rs. ${bill.amount} is pending. Last date for payment: ${formatDate(bill.due_date)}. Please pay before this date.`,
    {
        name: customer.name || "Customer",
        customer_name: customer.name || "Customer",
        amount: String(bill.amount),
        due_date: formatDate(bill.due_date),
        bill_id: String(bill.id || "")
    }
);

const sendPaidSms = (customer, bill) => sendSms(
    customer.phone,
    `NetWave payment received. We received Rs. ${bill.amount} for bill #${bill.id}. Thank you.`,
    {
        name: customer.name || "Customer",
        customer_name: customer.name || "Customer",
        amount: String(bill.amount),
        bill_id: String(bill.id || "")
    }
);

const sendCustomerApprovedSms = (customer) => sendSms(
    customer.phone,
    `NetWave: your broadband account is approved. You can now log in and use your customer dashboard.`,
    {
        name: customer.name || "Customer",
        customer_name: customer.name || "Customer"
    }
);

const sendCustomerRejectedSms = (customer) => sendSms(
    customer.phone,
    `NetWave: your broadband registration could not be approved. Please contact support for help.`,
    {
        name: customer.name || "Customer",
        customer_name: customer.name || "Customer"
    }
);

module.exports = {
    sendSms,
    sendMsg91Sms,
    sendDueDateSms,
    sendPaidSms,
    sendCustomerApprovedSms,
    sendCustomerRejectedSms,
    getSmsDiagnostics,
    getMsg91Diagnostics,
    logMsg91Diagnostics,
    formatE164Phone,
    isE164Phone
};
