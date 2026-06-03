const pptxgen = require("pptxgenjs");

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.author = "NetWave Team";
pres.company = "NetWave Broadband";
pres.title = "NetWave Broadband Management System";

// Define a master slide with a professional header and footer
pres.defineSlideMaster({
    title: "MASTER_SLIDE",
    background: { color: "F8FAFC" },
    slideNumber: { x: "95%", y: "94%", color: "94A3B8", fontSize: 10 },
    objects: [
        { rect: { x: 0, y: 0, w: "100%", h: 0.7, fill: { color: "0B2447" } } },
        { rect: { x: 0, y: 0.7, w: "100%", h: 0.05, fill: { color: "2563EB" } } },
        { rect: { x: 0, y: "91%", w: "100%", h: 0.02, fill: { color: "E2E8F0" } } },
        { text: { text: "NetWave Broadband System", options: { x: 0.5, y: "94%", w: "40%", fontSize: 10, color: "94A3B8" } } },
        { text: { text: "Final Project Presentation", options: { x: "50%", y: "94%", w: "40%", align: "right", fontSize: 10, color: "94A3B8" } } }
    ]
});

// Slide 1: Title Slide
const slide1 = pres.addSlide();
slide1.background = { color: "0B2447" };
slide1.addShape(pres.ShapeType.rect, { x: 0, y: "15%", w: "100%", h: 0.1, fill: { color: "2563EB" } });
slide1.addShape(pres.ShapeType.rect, { x: 0, y: "85%", w: "100%", h: 0.1, fill: { color: "2563EB" } });
slide1.addText("NetWave Broadband Management System", { 
    x: 0.5, y: 2.2, w: "90%", h: 1, fontSize: 40, bold: true, color: "FFFFFF", align: "center" 
});
slide1.addText("An Automated ISP Billing, Payment, and Notification Solution", { 
    x: 0.5, y: 3.2, w: "90%", h: 0.8, fontSize: 22, color: "93C5FD", align: "center" 
});
slide1.addText("Submitted By: [Your Name / Team Members]", { 
    x: 0.5, y: 4.8, w: "90%", fontSize: 16, color: "E2E8F0", align: "center" 
});
slide1.addText("Guided By: [Your Professor/Guide Name]\nInstitution: [Your College/University Name]", { 
    x: 0.5, y: 5.3, w: "90%", fontSize: 14, color: "CBD5E1", align: "center" 
});

// Helper function to add standard slides
function addStandardSlide(title, bullets) {
    const slide = pres.addSlide({ masterName: "MASTER_SLIDE" });
    slide.addText(title.replace(/^\d+\.\s*/, ""), { 
        x: 0.5, y: 0.1, w: "90%", h: 0.5, fontSize: 24, bold: true, color: "FFFFFF" 
    });
    
    const textProps = bullets.map(b => ({
        text: b,
        options: { bullet: { color: "2563EB" }, color: "334155", fontSize: 20, breakLine: true }
    }));
    
    slide.addText(textProps, { x: 0.5, y: 1.2, w: "90%", h: 4.0, valign: "top", lineSpacing: 32 });
}

// Presentation Data
const slidesData = [
    {
        title: "2. Abstract / Project Overview",
        bullets: [
            "NetWave is a comprehensive, cloud-based Broadband Management System designed for Internet Service Providers (ISPs).",
            "Core Purpose: To automate billing cycles, streamline online payments, and improve customer communication.",
            "Key Integrations: Features Razorpay for secure payments, automated PDF invoice generation, multichannel notifications (SMS, Email, WhatsApp), and an AI-powered customer support assistant."
        ]
    },
    {
        title: "3. Problem Statement",
        bullets: [
            "Local ISPs often rely on manual data entry and physical ledgers for managing subscriptions.",
            "Delayed Payments: Lack of automated reminders leads to missed due dates and service interruptions.",
            "Disjointed Systems: Customer support, billing, and technical staff operate in silos without a unified dashboard.",
            "Poor Customer Experience: Customers lack self-service portals to view bills, download invoices, or instantly pay online."
        ]
    },
    {
        title: "4. Objectives",
        bullets: [
            "Automate Billing: Automatically generate weekly/monthly bills for broadband subscriptions.",
            "Streamline Payments: Provide a frictionless checkout experience using Razorpay.",
            "Enhance Communication: Deliver real-time payment reminders and receipts via Email, SMS (MSG91), and WhatsApp.",
            "Improve Support: Introduce an OpenAI-powered chatbot to resolve basic customer queries instantly.",
            "Centralize Management: Build distinct, secure portals for Admins, Staff, and Customers."
        ]
    },
    {
        title: "5. Existing System",
        bullets: [
            "Manual Billing & Physical Receipts: Paper-based invoices that are easy to lose and hard to track.",
            "Cash Collections: Heavy reliance on staff physically collecting cash, lacking proper digital audit trails.",
            "No Real-Time Alerts: Customers are not notified when bills are generated or overdue.",
            "Time-Consuming Support: Staff handles basic plan/billing queries manually via phone calls."
        ]
    },
    {
        title: "6. Proposed System",
        bullets: [
            "Cloud-Hosted Architecture: Highly available system accessible from anywhere.",
            "Role-Based Access Control (RBAC): Secure access mapped to Admin, Staff, and Customer privileges.",
            "Digital Invoicing: Automated, dynamically generated PDF bills available for direct download.",
            "Omnichannel Notifications: Backend intelligently routes alerts via active channels.",
            "AI-Assisted Self-Service: Customers can self-serve payments and ask the AI assistant for help."
        ]
    },
    {
        title: "7. Technology Stack",
        bullets: [
            "Frontend: React.js, Vite, Tailwind CSS (Hosted on Vercel)",
            "Backend: Node.js, Express.js (Hosted on Render)",
            "Database: MySQL (Cloud-hosted)",
            "Authentication: JSON Web Tokens (JWT) & bcrypt for password hashing",
            "Payment Gateway & Integrations: Razorpay API, Nodemailer, MSG91, Meta WhatsApp Cloud API, OpenAI API, PDFKit."
        ]
    },
    {
        title: "8. System Architecture / Workflow",
        bullets: [
            "Data Flow: React UI ↔ REST API ↔ MySQL Database",
            "1. Admin generates a bill.",
            "2. System saves the record and triggers the Notification Service (SMS/Email/WhatsApp).",
            "3. Customer logs in and pays via Razorpay checkout.",
            "4. Backend verifies payment, marks bill as 'Paid', generates PDF, and sends a digital receipt.",
            "(Note: Refer to architecture diagrams in project report)"
        ]
    },
    {
        title: "9. Methodology / Implementation",
        bullets: [
            "Agile Approach: Iterative development focusing on core modules (Auth -> Billing -> Notifications).",
            "RESTful API Design: Backend built with decoupled services (billingController, aiController, emailService).",
            "Security First: Environment variables for secrets, JWT for session management, and backend-side payment validation.",
            "Dynamic PDF Generation: On-the-fly rendering of invoices using PDFKit only when a payment is verified."
        ]
    },
    {
        title: "10. Key Features / Modules",
        bullets: [
            "Admin/Staff Module: Manage customers, plans, view global payment history, and generate bills.",
            "Customer Portal: View pending bills, pay online, access payment history, and download PDF receipts.",
            "Notification Engine: Smart fallback system (WhatsApp -> SMS -> Email) for due dates and payment success.",
            "AI Chat Assistant: GPT-powered bot trained to assist with NetWave broadband queries."
        ]
    },
    {
        title: "11. Screenshots / Demo",
        bullets: [
            "(Please insert screenshots of your working project here)",
            "1. Admin Dashboard (showing total bills/revenue)",
            "2. Customer Dashboard & AI Chat",
            "3. Razorpay Payment Checkout Flow",
            "4. Generated PDF Bill Example",
            "5. Email/SMS Notification proof"
        ]
    },
    {
        title: "12. Results & Testing",
        bullets: [
            "API Testing: Verified endpoint security and rate limiting.",
            "Payment Verification: Successfully tested Razorpay test-mode transactions and backend signature validation.",
            "Automated Tasks: Bill reminders accurately track dates and prevent duplicate SMS sends.",
            "Performance: Frontend loads quickly via CDN; Backend processes PDFs efficiently."
        ]
    },
    {
        title: "13. Challenges Faced",
        bullets: [
            "API Integrations: Managing and standardizing error responses across multiple external APIs (Razorpay, MSG91, OpenAI).",
            "Node.js Load Order: Resolving environment variable issues where modules evaluated `.env` files prematurely.",
            "Dynamic Document Generation: Formatting the PDF bill dynamically to correctly align tables, user data, and logos.",
            "Secure File Delivery: Implementing expiring, secure tokens for downloading bills without requiring full re-authentication."
        ]
    },
    {
        title: "14. Future Enhancements",
        bullets: [
            "Auto-Pay / Subscriptions: Implement Razorpay Subscriptions for automatic monthly deductions.",
            "Ticketing System: Add a robust issue-tracking module for customers to report internet downtime.",
            "Advanced Analytics: Add charts and graphs for Admins to visualize revenue trends and customer growth.",
            "Mobile Application: Port the React application to React Native for iOS and Android apps."
        ]
    },
    {
        title: "15. Conclusion",
        bullets: [
            "The NetWave Broadband System successfully bridges the gap between manual ISP management and modern cloud operations.",
            "By integrating reliable payment gateways and real-time communication tools, it significantly reduces administrative overhead.",
            "The system provides a transparent, secure, and user-friendly experience for both the ISP staff and their customers."
        ]
    },
    {
        title: "16. References",
        bullets: [
            "Node.js & Express.js Official Documentation",
            "React.js & Vite Documentation",
            "Razorpay API Integration Guide",
            "MSG91 API & Meta WhatsApp Cloud API References",
            "OpenAI API Documentation",
            "PDFKit Node.js Library Guide"
        ]
    }
];

slidesData.forEach(slide => addStandardSlide(slide.title, slide.bullets));

// Save the Presentation
pres.writeFile({ fileName: "NetWave_Final_Presentation.pptx" }).then(fileName => {
    console.log(`\n✅ Success! PowerPoint generated successfully: ${fileName}`);
    console.log(`Please open the file and update the "[Your Name]" placeholders on Slide 1.`);
});