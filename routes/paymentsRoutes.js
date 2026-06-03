const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const { getNotificationLogs, getPayments } = require("../controllers/paymentsController");

router.get("/", auth, auth.requireRole("admin", "staff", "customer"), asyncHandler(getPayments));
router.get("/notifications", auth, auth.requireRole("admin", "staff"), asyncHandler(getNotificationLogs));

module.exports = router;
