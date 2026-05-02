const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const billingController = require("../controllers/billingController");

router.post("/generate", auth, auth.requireRole("admin", "staff"), asyncHandler(billingController.generateBill));
router.post("/reminders/send", auth, auth.requireRole("admin", "staff"), asyncHandler(billingController.sendReminders));
router.get("/", auth, asyncHandler(billingController.getBills));
router.put("/pay/:id", auth, auth.requireRole("admin", "staff"), asyncHandler(billingController.markPaid));
router.get("/download/:id/:expiresAt/:token", asyncHandler(billingController.downloadBillByToken));
router.get("/download/:id", auth, asyncHandler(billingController.downloadBill));

module.exports = router;
