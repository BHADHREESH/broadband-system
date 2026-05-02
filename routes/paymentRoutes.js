const express = require("express");
const router = express.Router();
const asyncHandler = require("../middleware/asyncHandler");

const { createOrder, verifyPayment } = require("../controllers/paymentController");
const auth = require("../middleware/auth");

router.post("/create-order", auth, asyncHandler(createOrder));

router.post("/verify", auth, asyncHandler(verifyPayment));

module.exports = router;
