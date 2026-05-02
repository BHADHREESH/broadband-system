const WHATSAPP_API_VERSION = process.env.WHATSAPP_API_VERSION || "v20.0";
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

const isConfigured = () => Boolean(WHATSAPP_PHONE_NUMBER_ID && WHATSAPP_ACCESS_TOKEN);

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

const sendTextMessage = async (phone, body) => {
    if (!isConfigured()) {
        console.log("WhatsApp not configured. Skipped message:", body);
        return { skipped: true, reason: "WhatsApp not configured" };
    }

    const to = formatPhone(phone);

    if (!to) {
        return { skipped: true, reason: "Customer phone missing" };
    }

    const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

    const response = await fetch(url, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            messaging_product: "whatsapp",
            to,
            type: "text",
            text: {
                preview_url: false,
                body
            }
        })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.error && data.error.message ? data.error.message : "WhatsApp message failed");
    }

    return data;
};

const sendDueDateMessage = (customer, bill) => {
    const body = `Hi ${customer.name || "Customer"}, your NetWave broadband bill of Rs. ${bill.amount} is due on ${formatDate(bill.due_date)}. Please pay the amount before the due date to keep your service active.`;

    return sendTextMessage(customer.phone, body);
};

const sendPaidMessage = (customer, bill) => {
    const body = `Hi ${customer.name || "Customer"}, payment complete. We received Rs. ${bill.amount} for your NetWave broadband bill. Bill ID: ${bill.id}. Thank you.`;

    return sendTextMessage(customer.phone, body);
};

module.exports = {
    sendDueDateMessage,
    sendPaidMessage
};
