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

    return sendEmail({
        to: customer.email,
        subject: "NetWave bill due reminder",
        text: `Hi ${customer.name || "Customer"}, your NetWave broadband bill of Rs. ${bill.amount} is due on ${formatDate(bill.due_date)}. Please pay the amount before the due date to keep your service active. Download bill: ${downloadUrl}`,
        html: `
            <p>Hi ${customer.name || "Customer"},</p>
            <p>Your NetWave broadband bill of <strong>Rs. ${bill.amount}</strong> is due on <strong>${formatDate(bill.due_date)}</strong>.</p>
            <p>Please pay the amount before the due date to keep your service active.</p>
            <p><a href="${downloadUrl}">Download your bill</a></p>
        `
    });
};

const sendPaidEmail = (customer, bill) => {
    const downloadUrl = getBillDownloadUrl(bill.id);

    return sendEmail({
        to: customer.email,
        subject: "NetWave payment complete",
        text: `Hi ${customer.name || "Customer"}, your payment is complete. We received Rs. ${bill.amount} for NetWave bill ID ${bill.id}. Download bill: ${downloadUrl}`,
        html: `
            <p>Hi ${customer.name || "Customer"},</p>
            <p>Your payment is complete. We received <strong>Rs. ${bill.amount}</strong> for NetWave bill ID <strong>${bill.id}</strong>.</p>
            <p><a href="${downloadUrl}">Download your bill</a></p>
            <p>Thank you.</p>
        `
    });
};

module.exports = {
    sendDueDateEmail,
    sendPaidEmail
};
