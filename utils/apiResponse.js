function sendSuccess(res, message, data = {}, statusCode = 200) {
    return res.status(statusCode).json({
        success: true,
        message,
        data
    });
}

function sendError(res, message, statusCode = 500, data = {}) {
    return res.status(statusCode).json({
        success: false,
        message,
        data
    });
}

module.exports = {
    sendSuccess,
    sendError
};
