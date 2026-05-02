const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const { getStats } = require("../controllers/dashboardController");

router.get("/", auth, auth.requireRole("admin"), asyncHandler(getStats));

module.exports = router;
