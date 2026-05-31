const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const winston = require('winston');
const env = require("./config/env");
const db = require("./config/db");
const { ensureApplicationTables } = require("./services/schemaService");
const { startReminderScheduler } = require("./services/reminderService");
const {
    sendSms,
    sendMsg91Sms,
    getSmsDiagnostics,
    logTwilioDiagnostics,
    logMsg91Diagnostics,
    formatTwilioPhone,
    isE164Phone
} = require("./services/smsService");
const {
    sendEmail,
    getEmailDiagnostics,
    logEmailDiagnostics
} = require("./services/emailService");
const {
    sendDueDateMessage,
    sendMsg91WhatsappTemplate,
    getWhatsappDiagnostics
} = require("./services/whatsappService");
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
            "connect-src": ["'self'", "https://api.razorpay.com"],
            "frame-src": ["'self'", "https://api.razorpay.com", "https://checkout.razorpay.com"],
            "child-src": ["'self'", "https://api.razorpay.com", "https://checkout.razorpay.com"]
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
app.use(express.static(path.join(__dirname, env.frontendDir), {
    setHeaders(res, filePath) {
        if (filePath.endsWith(".html")) {
            res.setHeader("Cache-Control", "no-store");
        }
    }
}));

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
            time: new Date().toISOString(),
            notifications: {
                email: Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS),
                whatsapp: getWhatsappDiagnostics().configured,
                sms: getSmsDiagnostics().msg91.configured
                    || getSmsDiagnostics().twilio.configured
                    || getSmsDiagnostics().genericSmsApiConfigured
            }
        }
    });
});

app.get("/api/health/db", async (req, res) => {
    try {
        const result = await db.executeQuery("SELECT COUNT(*) AS users FROM users");
        res.json({
            success: true,
            message: "Database connected",
            data: {
                users: result[0].users
            }
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Database check failed",
            data: {
                code: err.code || "UNKNOWN",
                detail: err.message
            }
        });
    }
});

app.get("/api/health/notifications", (req, res) => {
    res.json({
        success: true,
        message: "Notification configuration",
        data: {
            whatsapp: getWhatsappDiagnostics(),
            sms: getSmsDiagnostics(),
            email: getEmailDiagnostics()
        }
    });
});

app.get("/test-sms", async (req, res) => {
    const to = formatTwilioPhone(req.query.to || process.env.TEST_SMS_TO);
    const diagnostics = getSmsDiagnostics();

    console.log("/test-sms requested:", {
        to,
        sms: diagnostics
    });

    if (!to) {
        return res.status(400).json({
            success: false,
            message: "Missing SMS destination. Use /test-sms?to=+91XXXXXXXXXX or set TEST_SMS_TO.",
            data: {
                sms: diagnostics
            }
        });
    }

    if (!isE164Phone(to)) {
        return res.status(400).json({
            success: false,
            message: "Invalid phone number. Use E.164 format, for example +91XXXXXXXXXX.",
            data: {
                to,
                sms: diagnostics
            }
        });
    }

    try {
        const result = await sendSms(to, "NetWave test SMS from Render.");

        return res.json({
            success: true,
            message: result && result.skipped ? "SMS skipped" : "SMS request sent",
            data: {
                result,
                sms: diagnostics
            }
        });
    } catch (err) {
        console.error("Test SMS failed:", err.message);
        console.error(err);

        return res.status(err.status || 500).json({
            success: false,
            message: err.message || "Test SMS failed",
            data: {
                sms: diagnostics,
                smsError: {
                    status: err.status,
                    statusText: err.statusText,
                    request: err.request,
                    response: err.response
                }
            }
        });
    }
});

app.get("/test-msg91", async (req, res) => {
    const to = formatTwilioPhone(req.query.to || process.env.TEST_SMS_TO);
    const diagnostics = getSmsDiagnostics();

    console.log("/test-msg91 requested:", {
        to,
        sms: diagnostics
    });

    if (!to) {
        return res.status(400).json({
            success: false,
            message: "Missing SMS destination. Use /test-msg91?to=+91XXXXXXXXXX or set TEST_SMS_TO.",
            data: {
                sms: diagnostics
            }
        });
    }

    if (!isE164Phone(to)) {
        return res.status(400).json({
            success: false,
            message: "Invalid phone number. Use E.164 format, for example +91XXXXXXXXXX.",
            data: {
                to,
                sms: diagnostics
            }
        });
    }

    try {
        const result = await sendMsg91Sms(to, "NetWave test SMS from Render.", {
            name: "Customer",
            customer_name: "Customer",
            amount: "0",
            due_date: new Date().toLocaleDateString("en-IN"),
            bill_id: "TEST"
        });

        return res.status(result && result.skipped ? 503 : 200).json({
            success: !(result && result.skipped),
            message: result && result.skipped ? "MSG91 SMS skipped" : "MSG91 SMS request sent",
            data: {
                result,
                sms: diagnostics
            }
        });
    } catch (err) {
        console.error("Test MSG91 SMS failed:", err.message);
        console.error(err);

        return res.status(err.status || 500).json({
            success: false,
            message: err.message || "Test MSG91 SMS failed",
            data: {
                sms: diagnostics,
                msg91Error: {
                    status: err.status,
                    statusText: err.statusText,
                    response: err.response
                }
            }
        });
    }
});

app.get("/test-msg91-whatsapp-bill-due", async (req, res) => {
    const to = formatTwilioPhone(req.query.to || process.env.TEST_WHATSAPP_TO || process.env.TEST_SMS_TO);
    const amount = String(req.query.amount || "799");
    const dueDate = new Date(req.query.due_date || Date.now() + 7 * 24 * 60 * 60 * 1000);
    const templateName = process.env.WHATSAPP_TEMPLATE_BILL_DUE || "bill_due_reminder";
    const diagnostics = getWhatsappDiagnostics();

    console.log("/test-msg91-whatsapp-bill-due requested:", {
        to,
        template: templateName,
        whatsapp: diagnostics
    });

    if (!to) {
        return res.status(400).json({
            success: false,
            message: "Missing WhatsApp destination. Use /test-msg91-whatsapp-bill-due?to=+91XXXXXXXXXX or set TEST_WHATSAPP_TO.",
            data: {
                whatsapp: diagnostics
            }
        });
    }

    if (!isE164Phone(to)) {
        return res.status(400).json({
            success: false,
            message: "Invalid phone number. Use E.164 format, for example +91XXXXXXXXXX.",
            data: {
                to,
                whatsapp: diagnostics
            }
        });
    }

    try {
        const result = await sendMsg91WhatsappTemplate(to, templateName, [
            dueDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
            amount,
            dueDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
        ]);

        return res.status(result && result.skipped ? 503 : 200).json({
            success: !(result && result.skipped),
            message: result && result.skipped ? "MSG91 WhatsApp skipped" : "MSG91 WhatsApp bill due template request sent",
            data: {
                result,
                template: templateName,
                whatsapp: diagnostics
            }
        });
    } catch (err) {
        console.error("Test MSG91 WhatsApp bill due failed:", err.message);
        console.error(err);

        return res.status(err.status || 500).json({
            success: false,
            message: err.message || "Test MSG91 WhatsApp bill due failed",
            data: {
                whatsapp: diagnostics,
                msg91WhatsappError: {
                    status: err.status,
                    statusText: err.statusText,
                    response: err.response
                }
            }
        });
    }
});

app.get("/test-whatsapp-bill-due", async (req, res) => {
    const to = formatTwilioPhone(req.query.to || process.env.TEST_WHATSAPP_TO || process.env.TEST_SMS_TO);
    const amount = String(req.query.amount || "799");
    const dueDate = req.query.due_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    console.log("/test-whatsapp-bill-due requested:", {
        to,
        template: process.env.WHATSAPP_TEMPLATE_BILL_DUE || "bill_due_reminder",
        language: process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en"
    });

    if (!to) {
        return res.status(400).json({
            success: false,
            message: "Missing WhatsApp destination. Use /test-whatsapp-bill-due?to=+91XXXXXXXXXX or set TEST_WHATSAPP_TO."
        });
    }

    if (!isE164Phone(to)) {
        return res.status(400).json({
            success: false,
            message: "Invalid phone number. Use E.164 format, for example +91XXXXXXXXXX.",
            data: { to }
        });
    }

    try {
        const result = await sendDueDateMessage(
            {
                name: "Customer",
                phone: to
            },
            {
                id: "TEST",
                amount,
                due_date: dueDate
            }
        );

        return res.json({
            success: true,
            message: result && result.skipped ? "WhatsApp bill due template skipped" : "WhatsApp bill due template request sent",
            data: {
                result,
                template: process.env.WHATSAPP_TEMPLATE_BILL_DUE || "bill_due_reminder",
                language: process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en"
            }
        });
    } catch (err) {
        console.error("Test WhatsApp bill due failed:", err.message);
        console.error(err);

        return res.status(err.status || 500).json({
            success: false,
            message: err.message || "Test WhatsApp bill due failed",
            data: {
                whatsappError: {
                    status: err.status,
                    statusText: err.statusText,
                    response: err.response
                }
            }
        });
    }
});

app.get("/test-email", async (req, res) => {
    const to = String(req.query.to || process.env.TEST_EMAIL_TO || "").trim();
    const diagnostics = getEmailDiagnostics();

    console.log("/test-email requested:", {
        to,
        email: diagnostics
    });

    if (!to) {
        return res.status(400).json({
            success: false,
            message: "Missing email destination. Use /test-email?to=name@example.com or set TEST_EMAIL_TO.",
            data: {
                email: diagnostics
            }
        });
    }

    try {
        const result = await sendEmail({
            to,
            subject: "NetWave test email",
            text: "NetWave test email from Render.",
            html: "<p>NetWave test email from Render.</p>"
        });

        return res.json({
            success: true,
            message: result && result.skipped ? "Email skipped" : "Email request sent",
            data: {
                result: {
                    accepted: result.accepted,
                    rejected: result.rejected,
                    response: result.response,
                    messageId: result.messageId,
                    skipped: result.skipped,
                    reason: result.reason
                },
                email: diagnostics
            }
        });
    } catch (err) {
        console.error("Test email failed:", err.message);
        console.error(err);

        return res.status(500).json({
            success: false,
            message: err.message || "Test email failed",
            data: {
                email: diagnostics,
                emailError: {
                    code: err.code,
                    command: err.command,
                    originalMessage: err.originalMessage,
                    response: err.response,
                    responseCode: err.responseCode
                }
            }
        });
    }
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
    logEmailDiagnostics();
    logMsg91Diagnostics();
    logTwilioDiagnostics();
    console.log("Node.js version:", process.version);
    console.log("CommonJS runtime:", true);
    console.log("dotenv loaded before SMS service:", Boolean(env.jwtSecret));
});

ensureApplicationTables()
    .then(() => {
        logger.info("Application tables ready");
        startReminderScheduler();
    })
    .catch((err) => {
        logger.error("Application table setup failed", err);
    });
