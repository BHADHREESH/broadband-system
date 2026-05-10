const db = require("../config/db");

const statements = [
    `ALTER TABLE customers
        MODIFY status ENUM('pending','active','suspended') DEFAULT 'active'`,
    `CREATE TABLE IF NOT EXISTS payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        bill_id INT NOT NULL,
        customer_id INT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'paid',
        method VARCHAR(50) NULL,
        provider VARCHAR(50) NULL,
        provider_order_id VARCHAR(120) NULL,
        provider_payment_id VARCHAR(120) NULL,
        receipt_number VARCHAR(80) NULL,
        paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_payments_bill_id (bill_id),
        INDEX idx_payments_customer_id (customer_id),
        INDEX idx_payments_paid_at (paid_at),
        CONSTRAINT fk_payments_bill FOREIGN KEY (bill_id) REFERENCES bills(id)
            ON UPDATE CASCADE
            ON DELETE CASCADE,
        CONSTRAINT fk_payments_customer FOREIGN KEY (customer_id) REFERENCES customers(id)
            ON UPDATE CASCADE
            ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS bill_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        bill_id INT NOT NULL,
        description VARCHAR(160) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        item_type VARCHAR(40) NOT NULL DEFAULT 'hardware',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_bill_items_bill_id (bill_id),
        CONSTRAINT fk_bill_items_bill FOREIGN KEY (bill_id) REFERENCES bills(id)
            ON UPDATE CASCADE
            ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS notification_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        bill_id INT NULL,
        customer_id INT NULL,
        channel VARCHAR(30) NOT NULL,
        notification_type VARCHAR(30) NOT NULL,
        status VARCHAR(30) NOT NULL,
        message VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_notification_bill_id (bill_id),
        INDEX idx_notification_customer_id (customer_id),
        INDEX idx_notification_created_at (created_at)
    )`,
    `CREATE TABLE IF NOT EXISTS bill_reminders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        bill_id INT NOT NULL,
        reminder_date DATE NOT NULL,
        reminder_type VARCHAR(30) NOT NULL DEFAULT 'due',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_bill_reminder_day (bill_id, reminder_date, reminder_type),
        CONSTRAINT fk_bill_reminders_bill FOREIGN KEY (bill_id) REFERENCES bills(id)
            ON UPDATE CASCADE
            ON DELETE CASCADE
    )`
];

async function ensureApplicationTables() {
    for (const statement of statements) {
        try {
            await db.executeQuery(statement);
        } catch (err) {
            if (err.code === "ER_NO_SUCH_TABLE" && statement.startsWith("ALTER TABLE customers")) {
                continue;
            }
            throw err;
        }
    }
}

module.exports = {
    ensureApplicationTables
};
