const nodemailer = require("nodemailer");
const { getBillDownloadUrl } = require("../utils/billDownloadToken");

const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    SMTP_FROM,
    EMAIL_FROM,
    SMTP_SECURE,
    SMTP_FORCE_IPV4,
    SMTP_CONNECTION_TIMEOUT_MS,
    SMTP_GREETING_TIMEOUT_MS,
    SMTP_SOCKET_TIMEOUT_MS
} = process.env;

const isConfigured = () => Boolean(SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS);
const isTrue = (value) => ["1", "true", "yes"].includes(String(value || "").trim().toLowerCase());
const isSecureSmtp = () => isTrue(SMTP_SECURE) || Number(SMTP_PORT) === 465;
const shouldForceIpv4 = () => !["0", "false", "no"].includes(String(SMTP_FORCE_IPV4 || "true").trim().toLowerCase());
const numberFromEnv = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};
const smtpTimeouts = () => ({
    connectionTimeout: numberFromEnv(SMTP_CONNECTION_TIMEOUT_MS, 15000),
    greetingTimeout: numberFromEnv(SMTP_GREETING_TIMEOUT_MS, 10000),
    socketTimeout: numberFromEnv(SMTP_SOCKET_TIMEOUT_MS, 20000)
});
const getFromAddress = () => {
    const from = String(SMTP_FROM || EMAIL_FROM || "").trim();

    if (!from) return SMTP_USER;

    return from.includes("<") && !from.includes(" <") ? from.replace("<", " <") : from;
};

const getEmailDiagnostics = () => ({
    smtpHost: SMTP_HOST || "",
    smtpPort: SMTP_PORT || "",
    smtpUser: SMTP_USER || "",
    smtpFrom: SMTP_FROM || EMAIL_FROM || "",
    smtpPassPresent: Boolean(SMTP_PASS),
    configured: isConfigured(),
    secure: isSecureSmtp(),
    forceIpv4: shouldForceIpv4(),
    timeouts: smtpTimeouts(),
    nodeVersion: process.version
});

const logEmailDiagnostics = () => {
    console.log("SMTP_HOST:", process.env.SMTP_HOST);
    console.log("SMTP_PORT:", process.env.SMTP_PORT);
    console.log("SMTP_USER:", process.env.SMTP_USER);
    console.log("SMTP_FROM:", process.env.SMTP_FROM || process.env.EMAIL_FROM);
    console.log("SMTP_PASS present:", Boolean(process.env.SMTP_PASS));
    console.log("Email runtime diagnostics:", getEmailDiagnostics());
};

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

const getTransporter = () => nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: isSecureSmtp(),
    requireTLS: !isSecureSmtp(),
    ...(shouldForceIpv4() ? { family: 4 } : {}),
    ...smtpTimeouts(),
    tls: {
        servername: SMTP_HOST
    },
    auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
    }
});

const normalizeEmailError = (err) => {
    const message = String(err && err.message ? err.message : "");
    const lowerMessage = message.toLowerCase();
    const response = String(err && err.response ? err.response : "");
    const lowerResponse = response.toLowerCase();
    const code = err && err.code;
    const responseCode = err && err.responseCode;
    let friendlyMessage = message || "Email send failed";
    const isAuthError = code === "EAUTH"
        || responseCode === 535
        || lowerMessage.includes("invalid login")
        || lowerMessage.includes("username and password not accepted")
        || lowerMessage.includes("application-specific password")
        || lowerResponse.includes("username and password not accepted")
        || lowerResponse.includes("application-specific password");
    const providerName = String(SMTP_HOST || "").toLowerCase().includes("gmail") ? "Gmail" : "SMTP provider";

    if (isAuthError) {
        friendlyMessage = `${providerName} authentication failed. Check SMTP_USER, SMTP_PASS, and whether SMTP is enabled for this sender.`;
    } else if (code === "ETIMEDOUT" || lowerMessage.includes("timeout")) {
        friendlyMessage = "SMTP connection timed out. Check whether the server/network allows outbound SMTP on port 587 or 465.";
    } else if (code === "ESOCKET" || code === "ECONNECTION" || code === "EACCES") {
        friendlyMessage = "SMTP connection failed. Check SMTP_HOST, SMTP_PORT, firewall/network rules, and whether your host blocks outbound SMTP.";
    }

    const normalized = new Error(friendlyMessage);
    normalized.originalMessage = message;
    normalized.code = code;
    normalized.command = err && err.command;
    normalized.response = err && err.response;
    normalized.responseCode = responseCode;
    normalized.stack = err && err.stack ? err.stack : normalized.stack;
    return normalized;
};

const sendEmail = async ({ to, subject, text, html }) => {
    if (!isConfigured()) {
        console.log("Email not configured. Skipped email:", subject);
        return { skipped: true, reason: "Email not configured" };
    }

    if (!to) {
        return { skipped: true, reason: "Customer email missing" };
    }

    try {
        const result = await getTransporter().sendMail({
            from: getFromAddress(),
            to,
            subject,
            text,
            html
        });

        console.log("Email sent:", {
            accepted: result.accepted,
            rejected: result.rejected,
            response: result.response,
            messageId: result.messageId
        });

        return result;
    } catch (err) {
        const normalized = normalizeEmailError(err);
        console.error("Email send failed:", normalized.message);
        if (normalized.originalMessage && normalized.originalMessage !== normalized.message) {
            console.error("Original email error:", normalized.originalMessage);
        }
        console.error(err);
        throw normalized;
    }
};

const sendDueDateEmail = (customer, bill) => {
    const downloadUrl = getBillDownloadUrl(bill.id);
    const supportLine = "If you have already paid, please ignore this reminder or contact NetWave support with your receipt details.";
    const overdue = isOverdue(bill);
    const subject = overdue ? "NetWave overdue bill reminder" : "NetWave bill payment reminder";
    const textLine = overdue
        ? `your NetWave broadband bill of Rs. ${bill.amount} was due on ${formatDate(bill.due_date)} and is still pending. Please pay now to avoid service interruption.`
        : `your NetWave broadband bill of Rs. ${bill.amount} is pending. Last date for payment: ${formatDate(bill.due_date)}. Please pay before this date to keep your service active.`;
    const htmlLine = overdue
        ? `Your NetWave broadband bill of <strong>Rs. ${bill.amount}</strong> was due on <strong>${formatDate(bill.due_date)}</strong> and is still pending.`
        : `Your NetWave broadband bill of <strong>Rs. ${bill.amount}</strong> is pending.`;

    return sendEmail({
        to: customer.email,
        subject,
        text: `Hi ${customer.name || "Customer"}, ${textLine} ${supportLine} Download bill: ${downloadUrl}`,
        html: `
            <p>Hi ${customer.name || "Customer"},</p>
            <p>${htmlLine}</p>
            <p><strong>${overdue ? "Please pay now to avoid service interruption." : `Last date for payment: ${formatDate(bill.due_date)}`}</strong></p>
            ${overdue ? "" : "<p>Please pay before this date to keep your service active.</p>"}
            <p>${supportLine}</p>
            <p><a href="${downloadUrl}">Download your bill</a></p>
        `
    });
};

const sendPaidEmail = (customer, bill) => {
    const downloadUrl = getBillDownloadUrl(bill.id);
    const receiptLine = "Please keep this receipt for your records. No further action is required for this bill.";
    const supportLine = "For any correction or payment query, contact NetWave support with your bill ID.";

    return sendEmail({
        to: customer.email,
        subject: "NetWave payment received",
        text: `Hi ${customer.name || "Customer"}, payment received. We received Rs. ${bill.amount} for NetWave bill ID ${bill.id}. ${receiptLine} ${supportLine} Download bill: ${downloadUrl}`,
        html: `
            <p>Hi ${customer.name || "Customer"},</p>
            <p>Payment received. We received <strong>Rs. ${bill.amount}</strong> for NetWave bill ID <strong>${bill.id}</strong>.</p>
            <p>${receiptLine}</p>
            <p>${supportLine}</p>
            <p><a href="${downloadUrl}">Download your bill</a></p>
            <p>Thank you.</p>
        `
    });
};

const sendCustomerApprovedEmail = (customer) => sendEmail({
    to: customer.email,
    subject: "NetWave account approved",
    text: `Hi ${customer.name || "Customer"}, your NetWave broadband account is approved. You can now log in and use your customer dashboard.`,
    html: `
        <p>Hi ${customer.name || "Customer"},</p>
        <p>Your NetWave broadband account is approved.</p>
        <p>You can now log in and use your customer dashboard.</p>
    `
});

const sendCustomerRejectedEmail = (customer) => sendEmail({
    to: customer.email,
    subject: "NetWave registration update",
    text: `Hi ${customer.name || "Customer"}, your NetWave broadband registration could not be approved. Please contact support for help.`,
    html: `
        <p>Hi ${customer.name || "Customer"},</p>
        <p>Your NetWave broadband registration could not be approved.</p>
        <p>Please contact support for help.</p>
    `
});

module.exports = {
    sendEmail,
    sendDueDateEmail,
    sendPaidEmail,
    sendCustomerApprovedEmail,
    sendCustomerRejectedEmail,
    getEmailDiagnostics,
    logEmailDiagnostics,
    normalizeEmailError
};
