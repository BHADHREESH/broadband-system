const crypto = require("crypto");

const getSecret = () => {
    const secret = process.env.BILL_DOWNLOAD_SECRET || process.env.JWT_SECRET;

    if (!secret) {
        throw new Error("BILL_DOWNLOAD_SECRET or JWT_SECRET is required");
    }

    return secret;
};

const createBillDownloadToken = (billId, expiresAt) => crypto
    .createHmac("sha256", getSecret())
    .update(`${billId}:${expiresAt}`)
    .digest("hex");

const isValidBillDownloadToken = (billId, expiresAt, token) => {
    if (!billId || !expiresAt || !token) return false;

    if (Number(expiresAt) < Date.now()) return false;

    const expected = createBillDownloadToken(billId, expiresAt);
    const expectedBuffer = Buffer.from(expected);
    const tokenBuffer = Buffer.from(String(token));

    return expectedBuffer.length === tokenBuffer.length && crypto.timingSafeEqual(expectedBuffer, tokenBuffer);
};

const getBillDownloadUrl = (billId) => {
    const baseUrl = (process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || "http://localhost:5000").replace(/\/$/, "");
    const ttlHours = Number(process.env.BILL_DOWNLOAD_TTL_HOURS || 168);
    const expiresAt = Date.now() + ttlHours * 60 * 60 * 1000;
    return `${baseUrl}/api/bills/download/${billId}/${expiresAt}/${createBillDownloadToken(billId, expiresAt)}`;
};

module.exports = {
    createBillDownloadToken,
    getBillDownloadUrl,
    isValidBillDownloadToken
};
