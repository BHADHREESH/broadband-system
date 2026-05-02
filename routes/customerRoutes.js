const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const { optionalIndianPhone, requireIndianPhone } = require("../middleware/validate");

const {
    addCustomer,
    getCustomers,
    getMyCustomerProfile,
    updateMyCustomerProfile,
    updateCustomer,
    deleteCustomer
} = require("../controllers/customerController");

router.post("/", auth, auth.requireRole("admin", "staff"), requireIndianPhone("phone"), asyncHandler(addCustomer));
router.get("/me", auth, auth.requireRole("customer"), asyncHandler(getMyCustomerProfile));
router.put("/me", auth, auth.requireRole("customer"), optionalIndianPhone("phone"), asyncHandler(updateMyCustomerProfile));
router.get("/", auth, auth.requireRole("admin", "staff"), asyncHandler(getCustomers));
router.put("/:id", auth, auth.requireRole("admin", "staff"), optionalIndianPhone("phone"), asyncHandler(updateCustomer));
router.delete("/:id", auth, auth.requireRole("admin"), asyncHandler(deleteCustomer));

module.exports = router;
