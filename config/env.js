require("dotenv").config();

const env = {
    nodeEnv: process.env.NODE_ENV || "development",
    port: process.env.PORT || 5000,
    jwtSecret: process.env.JWT_SECRET || (() => { throw new Error("JWT_SECRET environment variable is required"); })(),
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1d",
    bcryptRounds: Number(process.env.BCRYPT_ROUNDS || 10),
    publicBaseUrl: process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || "http://localhost:5000",
    allowedOrigins: (process.env.ALLOWED_ORIGINS || "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    frontendDir: "../Frontend"
};

module.exports = env;
