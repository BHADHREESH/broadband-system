const { sendError } = require("../utils/apiResponse");

function requireFields(fields) {
    return (req, res, next) => {
        const missing = fields.filter((field) => {
            const value = req.body[field];
            return value === undefined || value === null || String(value).trim() === "";
        });

        if (missing.length > 0) {
            return sendError(res, `Missing required fields: ${missing.join(", ")}`, 400);
        }

        next();
    };
}

function normalizeIndianPhone(phone) {
    const digits = String(phone || "").replace(/\D/g, "");

    if (digits.length === 10) return digits;
    if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);

    return "";
}

function requireIndianPhone(field = "phone") {
    return (req, res, next) => {
        const normalized = normalizeIndianPhone(req.body[field]);

        if (!normalized) {
            return sendError(res, "Enter a valid 10-digit Indian phone number", 400);
        }

        req.body[field] = normalized;
        next();
    };
}

function optionalIndianPhone(field = "phone") {
    return (req, res, next) => {
        if (req.body[field] === undefined || req.body[field] === null || String(req.body[field]).trim() === "") {
            return next();
        }

        const normalized = normalizeIndianPhone(req.body[field]);

        if (!normalized) {
            return sendError(res, "Enter a valid 10-digit Indian phone number", 400);
        }

        req.body[field] = normalized;
        next();
    };
}

module.exports = {
    normalizeIndianPhone,
    optionalIndianPhone,
    requireFields,
    requireIndianPhone
};
