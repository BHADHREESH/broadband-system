const Razorpay = require("razorpay");
const crypto = require("crypto");
const db = require("../config/db");
const { notifyBillPaid } = require("../services/notificationService");
const { sendSuccess } = require("../utils/apiResponse");

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

const razorpay = keyId && keySecret
    ? new Razorpay({ key_id: keyId, key_secret: keySecret })
    : null;

function httpError(message, statusCode) {
    const err = new Error(message);
    err.statusCode = statusCode;
    return err;
}

exports.createOrder = async (req, res) => {
    const { amount } = req.body;

    if (!keyId || !keySecret || !razorpay) {
        throw httpError("Razorpay keys are not configured", 500);
    }

    if (!amount || Number(amount) <= 0) {
        throw httpError("Valid amount is required", 400);
    }

    try {
        const order = await razorpay.orders.create({
            amount: Math.round(Number(amount) * 100),
            currency: "INR",
            receipt: `receipt_${Date.now()}`
        });

        return sendSuccess(res, "Payment order created", {
            ...order,
            key_id: keyId
        });
    } catch (err) {
        const razorpayMessage = err.error && err.error.description;
        throw httpError(razorpayMessage || "Order creation failed", 500);
    }
};

exports.verifyPayment = async (req, res) => {
    const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        bill_id
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !bill_id) {
        throw httpError("Missing payment verification details", 400);
    }

    if (!keySecret) {
        throw httpError("Razorpay key secret is not configured", 500);
    }

    const generatedSignature = crypto
        .createHmac("sha256", keySecret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");

    if (generatedSignature !== razorpay_signature) {
        throw httpError("Invalid payment signature", 400);
    }

    const result = await db.executeQuery("UPDATE bills SET status = 'paid' WHERE id = ?", [bill_id]);
    if (result.affectedRows === 0) {
        throw httpError("Bill not found", 404);
    }

    const rows = await db.executeQuery(
        `SELECT bills.id, bills.customer_id, bills.amount, customers.name, customers.email, customers.phone
         FROM bills
         JOIN customers ON bills.customer_id = customers.id
         WHERE bills.id = ?
         LIMIT 1`,
        [bill_id]
    );

    if (rows.length > 0) {
        const bill = rows[0];
        await db.executeQuery(
            `INSERT INTO payments
                (bill_id, customer_id, amount, status, method, provider, provider_order_id, provider_payment_id, receipt_number)
             VALUES (?, ?, ?, 'paid', 'online', 'razorpay', ?, ?, ?)
             ON DUPLICATE KEY UPDATE status = VALUES(status)`,
            [
                bill.id,
                bill.customer_id,
                bill.amount,
                razorpay_order_id,
                razorpay_payment_id,
                `NW-${bill.id}-${Date.now()}`
            ]
        );
        notifyBillPaid(bill, bill);
    }

    return sendSuccess(res, "Payment verified");
};
