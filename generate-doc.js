const fs = require("fs");
const docx = require("docx");

const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak } = docx;

// Content Data for the Report
const reportData = [
    {
        title: "Abstract / Project Overview",
        bullets: [
            "NetWave is a comprehensive, cloud-based Broadband Management System designed for Internet Service Providers (ISPs).",
            "Core Purpose: To automate billing cycles, streamline online payments, and improve customer communication.",
            "Key Integrations: Features Razorpay for secure payments, automated PDF invoice generation, multichannel notifications (SMS, Email, WhatsApp), and an AI-powered customer support assistant."
        ]
    },
    {
        title: "Problem Statement",
        bullets: [
            "Local ISPs often rely on manual data entry and physical ledgers for managing subscriptions.",
            "Delayed Payments: Lack of automated reminders leads to missed due dates and service interruptions.",
            "Disjointed Systems: Customer support, billing, and technical staff operate in silos without a unified dashboard.",
            "Poor Customer Experience: Customers lack self-service portals to view bills, download invoices, or instantly pay online."
        ]
    },
    {
        title: "Objectives",
        bullets: [
            "Automate Billing: Automatically generate weekly/monthly bills for broadband subscriptions.",
            "Streamline Payments: Provide a frictionless checkout experience using Razorpay.",
            "Enhance Communication: Deliver real-time payment reminders and receipts via Email, SMS (MSG91), and WhatsApp.",
            "Improve Support: Introduce an OpenAI-powered chatbot to resolve basic customer queries instantly.",
            "Centralize Management: Build distinct, secure portals for Admins, Staff, and Customers."
        ]
    },
    {
        title: "Existing System",
        bullets: [
            "Manual Billing & Physical Receipts: Paper-based invoices that are easy to lose and hard to track.",
            "Cash Collections: Heavy reliance on staff physically collecting cash, lacking proper digital audit trails.",
            "No Real-Time Alerts: Customers are not notified when bills are generated or overdue.",
            "Time-Consuming Support: Staff handles basic plan/billing queries manually via phone calls."
        ]
    },
    {
        title: "Proposed System",
        bullets: [
            "Cloud-Hosted Architecture: Highly available system accessible from anywhere.",
            "Role-Based Access Control (RBAC): Secure access mapped to Admin, Staff, and Customer privileges.",
            "Digital Invoicing: Automated, dynamically generated PDF bills available for direct download.",
            "Omnichannel Notifications: Backend intelligently routes alerts via active channels.",
            "AI-Assisted Self-Service: Customers can self-serve payments and ask the AI assistant for help."
        ]
    },
    {
        title: "Technology Stack",
        bullets: [
            "Frontend: React.js, Vite, Tailwind CSS (Hosted on Vercel)",
            "Backend: Node.js, Express.js (Hosted on Render)",
            "Database: MySQL (Cloud-hosted)",
            "Authentication: JSON Web Tokens (JWT) & bcrypt for password hashing",
            "Payment Gateway & Integrations: Razorpay API, Nodemailer, MSG91, Meta WhatsApp Cloud API, OpenAI API, PDFKit."
        ]
    },
    {
        title: "System Architecture / Workflow",
        bullets: [
            "Data Flow: React UI <-> REST API <-> MySQL Database",
            "1. Admin generates a bill.",
            "2. System saves the record and triggers the Notification Service (SMS/Email/WhatsApp).",
            "3. Customer logs in and pays via Razorpay checkout.",
            "4. Backend verifies payment, marks bill as 'Paid', generates PDF, and sends a digital receipt."
        ]
    },
    {
        title: "Methodology / Implementation",
        bullets: [
            "Agile Approach: Iterative development focusing on core modules (Auth -> Billing -> Notifications).",
            "RESTful API Design: Backend built with decoupled services (billingController, aiController, emailService).",
            "Security First: Environment variables for secrets, JWT for session management, and backend-side payment validation.",
            "Dynamic PDF Generation: On-the-fly rendering of invoices using PDFKit only when a payment is verified."
        ]
    },
    {
        title: "Key Features / Modules",
        bullets: [
            "Admin/Staff Module: Manage customers, plans, view global payment history, and generate bills.",
            "Customer Portal: View pending bills, pay online, access payment history, and download PDF receipts.",
            "Notification Engine: Smart fallback system (WhatsApp -> SMS -> Email) for due dates and payment success.",
            "AI Chat Assistant: GPT-powered bot trained to assist with NetWave broadband queries."
        ]
    },
    {
        title: "Results & Testing",
        bullets: [
            "API Testing: Verified endpoint security and rate limiting.",
            "Payment Verification: Successfully tested Razorpay test-mode transactions and backend signature validation.",
            "Automated Tasks: Bill reminders accurately track dates and prevent duplicate SMS sends.",
            "Performance: Frontend loads quickly via CDN; Backend processes PDFs efficiently."
        ]
    },
    {
        title: "Challenges Faced",
        bullets: [
            "API Integrations: Managing and standardizing error responses across multiple external APIs (Razorpay, MSG91, OpenAI).",
            "Node.js Load Order: Resolving environment variable issues where modules evaluated .env files prematurely.",
            "Dynamic Document Generation: Formatting the PDF bill dynamically to correctly align tables, user data, and logos.",
            "Secure File Delivery: Implementing expiring, secure tokens for downloading bills without requiring full re-authentication."
        ]
    },
    {
        title: "Future Enhancements",
        bullets: [
            "Auto-Pay / Subscriptions: Implement Razorpay Subscriptions for automatic monthly deductions.",
            "Ticketing System: Add a robust issue-tracking module for customers to report internet downtime.",
            "Advanced Analytics: Add charts and graphs for Admins to visualize revenue trends and customer growth.",
            "Mobile Application: Port the React application to React Native for iOS and Android apps."
        ]
    },
    {
        title: "Conclusion",
        bullets: [
            "The NetWave Broadband System successfully bridges the gap between manual ISP management and modern cloud operations.",
            "By integrating reliable payment gateways and real-time communication tools, it significantly reduces administrative overhead.",
            "The system provides a transparent, secure, and user-friendly experience for both the ISP staff and their customers."
        ]
    }
];

// Build Document Elements
const childrenElements = [
    new Paragraph({ text: "NetWave Broadband Management System", heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { before: 2000, after: 400 } }),
    new Paragraph({ text: "Final Project Report", heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, spacing: { after: 1200 } }),
    new Paragraph({ text: "Submitted By: [Your Name / Team Members]", alignment: AlignmentType.CENTER, spacing: { after: 200 } }),
    new Paragraph({ text: "Guided By: [Your Professor/Guide Name]", alignment: AlignmentType.CENTER, spacing: { after: 200 } }),
    new Paragraph({ text: "Institution: [Your College/University Name]", alignment: AlignmentType.CENTER, spacing: { after: 800 } }),
    new Paragraph({ children: [new PageBreak()] }) // Move to next page
];

reportData.forEach(section => {
    // Add Section Heading
    childrenElements.push(new Paragraph({ text: section.title, heading: HeadingLevel.HEADING_2, spacing: { before: 400, after: 200 } }));
    // Add Bullets
    section.bullets.forEach(bullet => {
        childrenElements.push(new Paragraph({ text: bullet, bullet: { level: 0 }, spacing: { after: 100 } }));
    });
});

// Initialize Document
const doc = new Document({
    creator: "NetWave Team",
    title: "NetWave Final Project Report",
    sections: [{ properties: {}, children: childrenElements }]
});

// Generate and Save
Packer.toBuffer(doc).then((buffer) => {
    fs.writeFileSync("NetWave_Final_Report.docx", buffer);
    console.log("\n✅ Success! Word Document generated successfully: NetWave_Final_Report.docx");
    console.log("Please open the file and update the '[Your Name]' placeholders on the first page.");
});
