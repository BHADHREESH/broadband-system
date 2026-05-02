const { sendSuccess } = require("../utils/apiResponse");

function httpError(message, statusCode) {
    const err = new Error(message);
    err.statusCode = statusCode;
    return err;
}

exports.askAssistant = async (req, res) => {
    const message = String(req.body.message || "").trim();

    if (!message) {
        throw httpError("Question is required", 400);
    }

    if (!process.env.OPENAI_API_KEY) {
        return sendSuccess(res, "AI fallback response", {
            reply: "AI key is not configured yet. For now, please check your bill, payment status, plan details, or raise a support ticket from this dashboard."
        });
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: process.env.OPENAI_MODEL || "gpt-5.2",
            instructions: "You are NetWave's broadband support assistant. Give short, helpful answers about bills, plans, payments, service status, and support tickets. Do not claim to perform account changes.",
            input: message
        })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw httpError(
            data.error && data.error.message ? data.error.message : "AI request failed",
            500
        );
    }

    return sendSuccess(res, "AI response generated", {
        reply: data.output_text || "I could not generate a response right now."
    });
};
