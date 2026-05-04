const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const winston = require('winston');
const env = require("./config/env");
require("./config/db");
const { ensureApplicationTables } = require("./services/schemaService");
const { startReminderScheduler } = require("./services/reminderService");
const { notFound, errorHandler } = require("./middleware/errorHandler");
const { apiLimiter, paymentLimiter } = require("./middleware/rateLimiters");

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'broadband-backend' },
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' }),
    ],
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple(),
    }));
}

const app = express();
app.set("trust proxy", 1);
const localOrigins = new Set([
    "http://localhost:5000",
    "http://127.0.0.1:5000",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "null"
]);
const isLocalOrigin = (origin) => {
    if (!origin) return true;
    if (localOrigins.has(origin)) return true;

    try {
        const { protocol, hostname } = new URL(origin);
        return (
            (protocol === "http:" || protocol === "https:") &&
            (hostname === "localhost" || hostname === "127.0.0.1")
        );
    } catch {
        return false;
    }
};
const isAllowedOrigin = (origin) => {
    if (env.allowedOrigins.length > 0) {
        return !origin || env.allowedOrigins.includes(origin);
    }

    return isLocalOrigin(origin);
};

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "script-src": [
                "'self'",
                "'unsafe-inline'",
                "https://cdn.jsdelivr.net",
                "https://checkout.razorpay.com"
            ],
            "script-src-attr": ["'unsafe-inline'"],
            "style-src": ["'self'", "'unsafe-inline'"],
            "img-src": ["'self'", "data:", "https:"],
            "connect-src": ["'self'", "https://api.razorpay.com"]
        }
    }
}));
app.use(cors({
    origin(origin, callback) {
        if (isAllowedOrigin(origin)) {
            return callback(null, true);
        }

        return callback(null, false);
    },
    credentials: true
}));
app.use(cookieParser());
app.use(express.json());
app.use("/api", apiLimiter);
app.use(express.static(path.join(__dirname, env.frontendDir)));

const authRoutes = require("./routes/authRoutes");
app.use("/api/auth", authRoutes);

const plansRoutes = require("./routes/plansRoutes");
app.use("/api/plans", plansRoutes);

const customerRoutes = require("./routes/customerRoutes");
app.use("/api/customers", customerRoutes);

const billingRoutes = require("./routes/billingRoutes");
app.use("/api/bills", billingRoutes);

const dashboardRoutes = require("./routes/dashboardRoutes");
app.use("/api/dashboard", dashboardRoutes);

const paymentRoutes = require("./routes/paymentRoutes");
app.use("/api/payment", paymentLimiter, paymentRoutes);

const paymentsRoutes = require("./routes/paymentsRoutes");
app.use("/api/payments", paymentsRoutes);

const supportRoutes = require("./routes/supportRoutes");
app.use("/api/support", supportRoutes);

const usageRoutes = require("./routes/usageRoutes");
app.use("/api/usage", usageRoutes);

const staffRoutes = require("./routes/staffRoutes");
app.use("/api/staff", staffRoutes);

const aiRoutes = require("./routes/aiRoutes");
app.use("/api/ai", aiRoutes);

app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "NetWave API healthy",
        data: {
            environment: env.nodeEnv,
            time: new Date().toISOString()
        }
    });
});

app.get("/admin-dashboard", (req, res) => {
    res.sendFile(path.join(__dirname, env.frontendDir, "admin/dashboard.html"));
});

app.get("/staff-dashboard", (req, res) => {
    res.sendFile(path.join(__dirname, env.frontendDir, "staff/staff.html"));
});

app.get("/customer-dashboard", (req, res) => {
    res.sendFile(path.join(__dirname, env.frontendDir, "customer/customer.html"));
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, env.frontendDir, "index.html"));
});

app.use(notFound);
app.use(errorHandler);

app.listen(env.port, () => {
    logger.info(`Server running on port ${env.port}`);
});

ensureApplicationTables()
    .then(() => {
        logger.info("Application tables ready");
        startReminderScheduler();
    })
    .catch((err) => {
        logger.error("Application table setup failed", err);
    });
