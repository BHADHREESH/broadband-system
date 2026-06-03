const jwt = require("jsonwebtoken");
const env = require("../config/env");
const { sendError } = require("../utils/apiResponse");

function auth(req, res, next) {

    const token = req.cookies.token || 
        (req.headers["authorization"] && req.headers["authorization"].startsWith("Bearer ")
            ? req.headers["authorization"].split(" ")[1]
            : req.headers["authorization"]);

    if (!token) {
        return sendError(res, "No token, access denied", 401);
    }

    try {
        const verified = jwt.verify(token, env.jwtSecret);

        req.user = verified;

        next();
    } catch (err) {
        return sendError(res, "Invalid or expired token", 401);
    }
}

auth.requireRole = (...roles) => {
    const allowedRoles = new Set(roles);

    return (req, res, next) => {
        if (!req.user || !allowedRoles.has(req.user.role)) {
            return sendError(res, "Access denied", 403);
        }

        next();
    };
};

module.exports = auth;
