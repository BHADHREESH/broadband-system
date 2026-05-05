const nodemailer = require("nodemailer");
const { getBillDownloadUrl } = require("../utils/billDownloadToken");

const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    SMTP_FROM
} = process.env;

const isConfigured = () => Boolean(SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS);

const formatDate = (date) => {
    if (!date) return "--";

    return new Date(date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
};

const getTransporter = () => nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
    }
});

const sendEmail = async ({ to, subject, text, html }) => {
    if (!isConfigured()) {
        console.log("Email not configured. Skipped email:", subject);
        return { skipped: true, reason: "Email not configured" };
    }

    if (!to) {
        return { skipped: true, reason: "Customer email missing" };
    }

    return getTransporter().sendMail({
        from: SMTP_FROM || SMTP_USER,
        to,
        subject,
        text,
        html
    });
};

const sendDueDateEmail = (customer, bill) => {
    const downloadUrl = getBillDownloadUrl(bill.id);
    const supportLine = "If you have already paid, please ignore this reminder or contact NetWave support with your receipt details.";

    return sendEmail({
        to: customer.email,
        subject: "NetWave bill payment reminder",
        text: `Hi ${customer.name || "Customer"}, your NetWave broadband bill of Rs. ${bill.amount} is pending. Last date for payment: ${formatDate(bill.due_date)}. Please pay before this date to keep your service active. ${supportLine} Download bill: ${downloadUrl}`,
        html: `
            <p>Hi ${customer.name || "Customer"},</p>
            <p>Your NetWave broadband bill of <strong>Rs. ${bill.amount}</strong> is pending.</p>
            <p><strong>Last date for payment: ${formatDate(bill.due_date)}</strong></p>
            <p>Please pay before this date to keep your service active.</p>
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
    sendDueDateEmail,
    sendPaidEmail,
    sendCustomerApprovedEmail,
    sendCustomerRejectedEmail
};
