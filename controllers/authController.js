const authService = require("../services/authService");
const { sendSuccess } = require("../utils/apiResponse");

exports.register = async (req, res) => {
    const result = await authService.registerCustomer(req.body);
    return sendSuccess(res, "User registered successfully", result, 201);
};

exports.login = async (req, res) => {
    const result = await authService.login(req.body);
    
    // Set httpOnly cookie
    res.cookie('token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000 // 1 day
    });
    
    return sendSuccess(res, "Login successful", result);
};

exports.changePassword = async (req, res) => {
    await authService.changePassword(
        req.user.id,
        req.body.currentPassword,
        req.body.newPassword
    );

    return sendSuccess(res, "Password changed successfully");
};
