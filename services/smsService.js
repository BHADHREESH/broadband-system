const SMS_API_URL = process.env.SMS_API_URL;
const SMS_API_KEY = process.env.SMS_API_KEY;
const SMS_FROM = process.env.SMS_FROM;
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER;
const TWILIO_MESSAGING_SERVICE_SID = process.env.TWILIO_MESSAGING_SERVICE_SID;

class TwilioSmsError extends Error {
    constructor(message, details) {
        super(message);
        this.name = "TwilioSmsError";
        this.status = details.status;
        this.statusText = details.statusText;
        this.response = details.response;
        this.request = details.request;
    }
}

const isTwilioConfigured = () => Boolean(
    TWILIO_ACCOUNT_SID
    && TWILIO_AUTH_TOKEN
    && (TWILIO_FROM_NUMBER || TWILIO_MESSAGING_SERVICE_SID)
);

const isConfigured = () => Boolean(SMS_API_URL || isTwilioConfigured());

const formatPhone = (phone) => {
    if (!phone) return "";

    const digits = String(phone).replace(/\D/g, "");

    if (digits.length === 10) {
        return `91${digits}`;
    }

    return digits;
};

const formatTwilioPhone = (phone) => {
    const digits = formatPhone(phone);

    if (!digits) return "";
    return digits.startsWith("+") ? digits : `+${digits}`;
};

const isE164Phone = (phone) => /^\+[1-9]\d{7,14}$/.test(String(phone || ""));

const getTwilioDiagnostics = () => ({
    accountSid: TWILIO_ACCOUNT_SID || "",
    authTokenPresent: Boolean(TWILIO_AUTH_TOKEN),
    fromNumber: TWILIO_FROM_NUMBER || "",
    messagingServiceSid: TWILIO_MESSAGING_SERVICE_SID || "",
    configured: isTwilioConfigured(),
    fromNumberE164: TWILIO_FROM_NUMBER ? isE164Phone(formatTwilioPhone(TWILIO_FROM_NUMBER)) : null,
    nodeVersion: process.version
});

const logTwilioDiagnostics = () => {
    console.log("TWILIO_ACCOUNT_SID:", process.env.TWILIO_ACCOUNT_SID);
    console.log("TWILIO_FROM_NUMBER:", process.env.TWILIO_FROM_NUMBER);
    console.log("TWILIO_MESSAGING_SERVICE_SID:", process.env.TWILIO_MESSAGING_SERVICE_SID);
    console.log("TWILIO_AUTH_TOKEN present:", Boolean(process.env.TWILIO_AUTH_TOKEN));
    console.log("TWILIO runtime diagnostics:", getTwilioDiagnostics());
};

const formatDate = (date) => {
    if (!date) return "--";

    return new Date(date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
};

const sendTwilioSms = async (phone, message) => {
    const to = formatTwilioPhone(phone);

    if (!to) {
        return { skipped: true, reason: "Customer phone missing" };
    }

    if (!isE164Phone(to)) {
        return { skipped: true, reason: `Invalid E.164 destination phone number: ${to}` };
    }

    const from = formatTwilioPhone(TWILIO_FROM_NUMBER);
    if (!TWILIO_MESSAGING_SERVICE_SID && !isE164Phone(from)) {
        return { skipped: true, reason: `Invalid E.164 Twilio from number: ${from}` };
    }

    const params = new URLSearchParams({
        To: to,
        Body: message
    });

    if (TWILIO_MESSAGING_SERVICE_SID) {
        params.set("MessagingServiceSid", TWILIO_MESSAGING_SERVICE_SID);
    } else {
        params.set("From", from);
    }

    const credentials = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");
    const requestSummary = {
        accountSid: TWILIO_ACCOUNT_SID,
        to,
        from: TWILIO_MESSAGING_SERVICE_SID ? undefined : from,
        messagingServiceSid: TWILIO_MESSAGING_SERVICE_SID || undefined
    };

    const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
        {
            method: "POST",
            headers: {
                Authorization: `Basic ${credentials}`,
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: params.toString()
        }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        console.error("Twilio SMS API error response:", {
            status: response.status,
            statusText: response.statusText,
            request: requestSummary,
            response: data
        });

        throw new TwilioSmsError(data.message || data.error_message || "Twilio SMS failed", {
            status: response.status,
            statusText: response.statusText,
            request: requestSummary,
            response: data
        });
    }

    console.log("Twilio SMS sent:", {
        sid: data.sid,
        status: data.status,
        to,
        from: data.from || requestSummary.from || requestSummary.messagingServiceSid
    });

    return data;
};

const sendSms = async (phone, message) => {
    if (!isConfigured()) {
        console.log("SMS not configured. Skipped SMS:", message);
        return { skipped: true, reason: "SMS not configured" };
    }

    if (isTwilioConfigured()) {
        return sendTwilioSms(phone, message);
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
    `NetWave reminder: your broadband bill of Rs. ${bill.amount} is pending. Last date for payment: ${formatDate(bill.due_date)}. Please pay before this date.`
);

const sendPaidSms = (customer, bill) => sendSms(
    customer.phone,
    `NetWave payment received. We received Rs. ${bill.amount} for bill #${bill.id}. Thank you.`
);

module.exports = {
    sendSms,
    sendDueDateSms,
    sendPaidSms,
    getTwilioDiagnostics,
    logTwilioDiagnostics,
    formatTwilioPhone,
    isE164Phone
};
