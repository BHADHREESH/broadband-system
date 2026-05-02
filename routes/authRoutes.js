const express = require("express");
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const auth = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const { requireFields, requireIndianPhone } = require("../middleware/validate");
const { register, login, changePassword } = require("../controllers/authController");

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 requests per windowMs
    message: 'Too many login attempts from this IP, please try again after 15 minutes.'
});

const validateAuth = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
    }
    next();
};

router.post("/register", 
    [
        body('email').isEmail().normalizeEmail(),
        body('password').isLength({ min: 12 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[a-zA-Z\d@$!%*?&]{12,}$/),
        body('name').trim().isLength({ min: 1 }),
        body('phone').trim().isLength({ min: 1 }),
        body('address').trim().isLength({ min: 1 }),
        body('plan_id').isInt({ min: 1 })
    ],
    validateAuth,
    requireIndianPhone("phone"),
    requireFields(["name", "email", "phone", "address", "plan_id", "password"]), 
    asyncHandler(register)
);
router.post("/login", 
    loginLimiter, 
    [
        body('email').optional().isEmail().normalizeEmail(),
        body('username').optional().isEmail().normalizeEmail(),
        body('password').isLength({ min: 1 })
    ],
    validateAuth,
    requireFields(["password"]), 
    asyncHandler(login)
);
router.put("/change-password", 
    auth, 
    [
        body('currentPassword').isLength({ min: 1 }),
        body('newPassword').isLength({ min: 12 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[a-zA-Z\d@$!%*?&]{12,}$/)
    ],
    validateAuth,
    asyncHandler(changePassword)
);

module.exports = router;
