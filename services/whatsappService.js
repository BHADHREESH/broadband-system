const WHATSAPP_API_VERSION = process.env.WHATSAPP_API_VERSION || "v20.0";
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_TEMPLATE_LANGUAGE = process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en";
const WHATSAPP_TEMPLATE_BILL_DUE = process.env.WHATSAPP_TEMPLATE_BILL_DUE || "bill_due_reminder";
const WHATSAPP_TEMPLATE_PAYMENT_RECEIVED = process.env.WHATSAPP_TEMPLATE_PAYMENT_RECEIVED || "payment_received";
const WHATSAPP_TEMPLATE_ACCOUNT_APPROVED = process.env.WHATSAPP_TEMPLATE_ACCOUNT_APPROVED || "account_approved";
const WHATSAPP_TEMPLATE_ACCOUNT_REJECTED = process.env.WHATSAPP_TEMPLATE_ACCOUNT_REJECTED || "account_rejected";
const firstValue = (...values) => values.find((value) => String(value || "").trim());
const hasRealValue = (value) => {
    const text = String(value || "").trim();
    return Boolean(text && !text.startsWith("your-"));
};
const MSG91_WHATSAPP_AUTHKEY = firstValue(process.env.MSG91_WHATSAPP_AUTHKEY, process.env.MSG91_AUTHKEY);
const MSG91_WHATSAPP_INTEGRATED_NUMBER = firstValue(process.env.MSG91_WHATSAPP_INTEGRATED_NUMBER, process.env.MSG91_INTEGRATED_NUMBER);
const MSG91_WHATSAPP_TEMPLATE_NAMESPACE = firstValue(process.env.MSG91_WHATSAPP_TEMPLATE_NAMESPACE, process.env.MSG91_TEMPLATE_NAMESPACE);
const MSG91_WHATSAPP_API_URL = process.env.MSG91_WHATSAPP_API_URL || "https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/";

const isMetaConfigured = () => Boolean(hasRealValue(WHATSAPP_PHONE_NUMBER_ID) && hasRealValue(WHATSAPP_ACCESS_TOKEN));
const isMsg91Configured = () => Boolean(hasRealValue(MSG91_WHATSAPP_AUTHKEY) && hasRealValue(MSG91_WHATSAPP_INTEGRATED_NUMBER) && hasRealValue(MSG91_WHATSAPP_TEMPLATE_NAMESPACE));
const isConfigured = () => Boolean(isMsg91Configured() || isMetaConfigured());

const getMissingMsg91WhatsappFields = () => [
    ["MSG91_WHATSAPP_AUTHKEY", MSG91_WHATSAPP_AUTHKEY],
    ["MSG91_WHATSAPP_INTEGRATED_NUMBER", MSG91_WHATSAPP_INTEGRATED_NUMBER],
    ["MSG91_WHATSAPP_TEMPLATE_NAMESPACE", MSG91_WHATSAPP_TEMPLATE_NAMESPACE]
]
    .filter(([, value]) => !hasRealValue(value))
    .map(([key]) => key);

const getWhatsappDiagnostics = () => ({
    provider: isMsg91Configured() ? "msg91" : isMetaConfigured() ? "meta" : "none",
    configured: isConfigured(),
    msg91: {
        authkeyPresent: Boolean(MSG91_WHATSAPP_AUTHKEY),
        integratedNumber: MSG91_WHATSAPP_INTEGRATED_NUMBER || "",
        templateNamespacePresent: Boolean(MSG91_WHATSAPP_TEMPLATE_NAMESPACE),
        apiUrl: MSG91_WHATSAPP_API_URL,
        missingFields: getMissingMsg91WhatsappFields(),
        configured: isMsg91Configured()
    },
    meta: {
        phoneNumberId: WHATSAPP_PHONE_NUMBER_ID || "",
        accessTokenPresent: Boolean(WHATSAPP_ACCESS_TOKEN),
        configured: isMetaConfigured()
    },
    templates: {
        language: WHATSAPP_TEMPLATE_LANGUAGE,
        billDue: WHATSAPP_TEMPLATE_BILL_DUE,
        paymentReceived: WHATSAPP_TEMPLATE_PAYMENT_RECEIVED,
        accountApproved: WHATSAPP_TEMPLATE_ACCOUNT_APPROVED,
        accountRejected: WHATSAPP_TEMPLATE_ACCOUNT_REJECTED
    }
});

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

const formatMonth = (date) => {
    if (!date) return "current month";

    return new Date(date).toLocaleDateString("en-IN", {
        month: "long",
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

const buildTextParameter = (text) => ({
    type: "text",
    text: String(text || "")
});

const sendTemplateMessage = async (phone, templateName, parameters) => {
    if (!isConfigured()) {
        console.log("WhatsApp not configured. Skipped template:", templateName);
        return { skipped: true, reason: "WhatsApp not configured" };
    }

    const to = formatPhone(phone);

    if (!to) {
        return { skipped: true, reason: "Customer phone missing" };
    }

    if (isMsg91Configured()) {
        return sendMsg91WhatsappTemplate(to, templateName, parameters);
    }

    const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
    const bodyParameters = parameters.map(buildTextParameter);

    const response = await fetch(url, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            messaging_product: "whatsapp",
            to,
            type: "template",
            template: {
                name: templateName,
                language: {
                    code: WHATSAPP_TEMPLATE_LANGUAGE
                },
                components: [
                    {
                        type: "body",
                        parameters: bodyParameters
                    }
                ]
            }
        })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        console.error("WhatsApp template API error response:", {
            status: response.status,
            statusText: response.statusText,
            request: {
                to,
                templateName,
                language: WHATSAPP_TEMPLATE_LANGUAGE,
                parameterCount: bodyParameters.length
            },
            response: data
        });

        throw new Error(data.error && data.error.message ? data.error.message : "WhatsApp template message failed");
    }

    console.log("WhatsApp template sent:", {
        to,
        templateName,
        language: WHATSAPP_TEMPLATE_LANGUAGE,
        messageId: data.messages && data.messages[0] ? data.messages[0].id : undefined
    });

    return data;
};

const buildMsg91Components = (parameters) => {
    return parameters.reduce((components, value, index) => {
        components[`body_${index + 1}`] = {
            type: "text",
            value: String(value || "")
        };
        return components;
    }, {});
};

const sendMsg91WhatsappTemplate = async (phone, templateName, parameters) => {
    if (!isMsg91Configured()) {
        return {
            skipped: true,
            reason: `MSG91 WhatsApp not configured. Missing: ${getMissingMsg91WhatsappFields().join(", ")}`
        };
    }

    const body = {
        integrated_number: MSG91_WHATSAPP_INTEGRATED_NUMBER,
        content_type: "template",
        payload: {
            messaging_product: "whatsapp",
            type: "template",
            template: {
                name: templateName,
                language: {
                    code: WHATSAPP_TEMPLATE_LANGUAGE,
                    policy: "deterministic"
                },
                namespace: MSG91_WHATSAPP_TEMPLATE_NAMESPACE,
                to_and_components: [
                    {
                        to: [phone],
                        components: buildMsg91Components(parameters)
                    }
                ]
            }
        }
    };

    const response = await fetch(MSG91_WHATSAPP_API_URL, {
        method: "POST",
        headers: {
            authkey: MSG91_WHATSAPP_AUTHKEY,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.type === "error") {
        console.error("MSG91 WhatsApp API error response:", {
            status: response.status,
            statusText: response.statusText,
            request: {
                integratedNumber: MSG91_WHATSAPP_INTEGRATED_NUMBER,
                templateName,
                namespace: MSG91_WHATSAPP_TEMPLATE_NAMESPACE,
                to: phone,
                parameterCount: parameters.length
            },
            response: data
        });

        const err = new Error(data.message || data.error || "MSG91 WhatsApp template message failed");
        err.status = response.status;
        err.statusText = response.statusText;
        err.response = data;
        throw err;
    }

    console.log("MSG91 WhatsApp template sent:", {
        to: phone,
        templateName,
        response: data
    });

    return data;
};

const sendDueDateMessage = (customer, bill) => {
    return sendTemplateMessage(customer.phone, WHATSAPP_TEMPLATE_BILL_DUE, [
        formatMonth(bill.due_date),
        String(bill.amount || ""),
        formatDate(bill.due_date)
    ]);
};

const sendPaidMessage = (customer, bill) => {
    return sendTemplateMessage(customer.phone, WHATSAPP_TEMPLATE_PAYMENT_RECEIVED, [
        String(bill.amount || ""),
        String(bill.id || "")
    ]);
};

const sendCustomerApprovedMessage = (customer) => {
    return sendTemplateMessage(customer.phone, WHATSAPP_TEMPLATE_ACCOUNT_APPROVED, [
        customer.name || "Customer"
    ]);
};

const sendCustomerRejectedMessage = (customer) => {
    return sendTemplateMessage(customer.phone, WHATSAPP_TEMPLATE_ACCOUNT_REJECTED, [
        customer.name || "Customer"
    ]);
};

module.exports = {
    sendTextMessage,
    sendTemplateMessage,
    sendMsg91WhatsappTemplate,
    getWhatsappDiagnostics,
    sendDueDateMessage,
    sendPaidMessage,
    sendCustomerApprovedMessage,
    sendCustomerRejectedMessage
};
