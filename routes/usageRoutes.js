const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const { getMyUsage } = require("../controllers/usageController");

router.get("/me", auth, auth.requireRole("customer"), asyncHandler(getMyUsage));

module.exports = router;
