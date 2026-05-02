const rateLimit = require("express-rate-limit");

const jsonMessage = (message) => ({
    success: false,
    message
});

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: Number(process.env.API_RATE_LIMIT || 300),
    standardHeaders: true,
    legacyHeaders: false,
    message: jsonMessage("Too many requests. Please try again shortly.")
});

const paymentLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: Number(process.env.PAYMENT_RATE_LIMIT || 30),
    standardHeaders: true,
    legacyHeaders: false,
    message: jsonMessage("Too many payment requests. Please try again shortly.")
});

module.exports = {
    apiLimiter,
    paymentLimiter
};
