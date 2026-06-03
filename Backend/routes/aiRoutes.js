const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const { askAssistant } = require("../controllers/aiController");

router.post("/ask", auth, asyncHandler(askAssistant));

module.exports = router;
