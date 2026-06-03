const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const {
    getStaff,
    addStaff,
    deleteStaff
} = require("../controllers/staffController");

router.get("/", auth, auth.requireRole("admin"), asyncHandler(getStaff));
router.post("/", auth, auth.requireRole("admin"), asyncHandler(addStaff));
router.delete("/:id", auth, auth.requireRole("admin"), asyncHandler(deleteStaff));

module.exports = router;
