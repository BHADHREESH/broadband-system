const db = require("../config/db");
const { sendSuccess } = require("../utils/apiResponse");

function validatePlan({ name, speed, price, validity }) {
    if (!name || !speed || !price || !validity) {
        const err = new Error("All plan fields are required");
        err.statusCode = 400;
        throw err;
    }

    if (Number(price) <= 0 || Number(validity) <= 0) {
        const err = new Error("Price and validity must be positive");
        err.statusCode = 400;
        throw err;
    }
}

exports.createPlan = async (req, res) => {
    const { name, speed, price, validity } = req.body;
    validatePlan({ name, speed, price, validity });

    await db.executeQuery(
        "INSERT INTO plans (name, speed, price, validity) VALUES (?, ?, ?, ?)",
        [String(name).trim(), String(speed).trim(), Number(price), Number(validity)]
    );

    return sendSuccess(res, "Plan created successfully", {}, 201);
};

exports.getPlans = async (req, res) => {
    const plans = await db.executeQuery("SELECT * FROM plans ORDER BY price ASC");
    return sendSuccess(res, "Plans loaded", plans);
};

exports.updatePlan = async (req, res) => {
    const { id } = req.params;
    const { name, speed, price, validity } = req.body;
    validatePlan({ name, speed, price, validity });

    const result = await db.executeQuery(
        "UPDATE plans SET name = ?, speed = ?, price = ?, validity = ? WHERE id = ?",
        [String(name).trim(), String(speed).trim(), Number(price), Number(validity), id]
    );

    if (result.affectedRows === 0) {
        const err = new Error("Plan not found");
        err.statusCode = 404;
        throw err;
    }

    return sendSuccess(res, "Plan updated");
};

exports.deletePlan = async (req, res) => {
    const result = await db.executeQuery("DELETE FROM plans WHERE id = ?", [req.params.id]);

    if (result.affectedRows === 0) {
        const err = new Error("Plan not found");
        err.statusCode = 404;
        throw err;
    }

    return sendSuccess(res, "Plan deleted");
};
