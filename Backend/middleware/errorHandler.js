const { sendError } = require("../utils/apiResponse");

function notFound(req, res) {
    return sendError(res, `Route not found: ${req.method} ${req.originalUrl}`, 404);
}

function errorHandler(err, req, res, next) {
    if (res.headersSent) return next(err);

    if (err.code === "ER_DUP_ENTRY") {
        return sendError(res, "Duplicate record already exists", 400);
    }

    const statusCode = err.statusCode || err.status || 500;
    const message = statusCode === 500 ? "Internal server error" : err.message;

    if (statusCode === 500) {
        console.error(err);
    }

    return sendError(res, message, statusCode);
}

module.exports = {
    notFound,
    errorHandler
};
