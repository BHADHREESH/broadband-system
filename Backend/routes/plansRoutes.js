const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");

const {
    createPlan,
    getPlans,
    updatePlan,
    deletePlan
} = require("../controllers/plansController");

router.post("/", auth, auth.requireRole("admin"), asyncHandler(createPlan));
router.get("/", asyncHandler(getPlans));
router.put("/:id", auth, auth.requireRole("admin"), asyncHandler(updatePlan));
router.delete("/:id", auth, auth.requireRole("admin"), asyncHandler(deletePlan));

module.exports = router;
