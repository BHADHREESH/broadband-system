const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const {
    getTickets,
    createTicket,
    updateTicket
} = require("../controllers/supportController");

router.get("/", auth, asyncHandler(getTickets));
router.post("/", auth, asyncHandler(createTicket));
router.put("/:id", auth, auth.requireRole("admin", "staff"), asyncHandler(updateTicket));

module.exports = router;
