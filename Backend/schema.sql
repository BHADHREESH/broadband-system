CREATE DATABASE IF NOT EXISTS broadband_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE broadband_db;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin','customer','staff') DEFAULT 'customer',
    INDEX idx_users_role (role),
    INDEX idx_users_email_role (email, role)
);

CREATE TABLE IF NOT EXISTS plans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    speed VARCHAR(50) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    validity INT NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    phone VARCHAR(15),
    plan_id INT,
    address VARCHAR(255),
    status ENUM('pending','active','suspended') DEFAULT 'active',
    UNIQUE KEY uq_customers_email (email),
    INDEX idx_customers_plan_id (plan_id),
    INDEX idx_customers_status (status),
    CONSTRAINT fk_customers_plan FOREIGN KEY (plan_id) REFERENCES plans(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS bills (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT,
    amount DECIMAL(10,2) NOT NULL,
    status ENUM('paid','unpaid') DEFAULT 'unpaid',
    bill_date DATE,
    due_date DATE,
    INDEX idx_bills_customer_id (customer_id),
    INDEX idx_bills_status (status),
    CONSTRAINT fk_bills_customer FOREIGN KEY (customer_id) REFERENCES customers(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bill_items (
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
);

CREATE TABLE IF NOT EXISTS support_tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NULL,
    name VARCHAR(100) NULL,
    email VARCHAR(100) NULL,
    issue TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_support_customer_id (customer_id),
    INDEX idx_support_email (email),
    INDEX idx_support_status (status),
    CONSTRAINT fk_support_customer FOREIGN KEY (customer_id) REFERENCES customers(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS data_usage (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    usage_date DATE NOT NULL,
    used_gb DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_gb DECIMAL(10,2) NOT NULL DEFAULT 1000,
    UNIQUE KEY uq_usage_customer_date (customer_id, usage_date),
    INDEX idx_usage_customer_id (customer_id),
    CONSTRAINT fk_usage_customer FOREIGN KEY (customer_id) REFERENCES customers(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payments (
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
);

CREATE TABLE IF NOT EXISTS notification_logs (
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
);

CREATE TABLE IF NOT EXISTS bill_reminders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bill_id INT NOT NULL,
    reminder_date DATE NOT NULL,
    reminder_type VARCHAR(30) NOT NULL DEFAULT 'due',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_bill_reminder_day (bill_id, reminder_date, reminder_type),
    CONSTRAINT fk_bill_reminders_bill FOREIGN KEY (bill_id) REFERENCES bills(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

INSERT INTO users (name, email, password, role) VALUES
('Admin User', 'admin@test.com', '$2b$10$Zc/wQVmmoDQ7EfBC7mIhqO0x/1cNpVMpW9EtC6tjcw00GSFp0f7FC', 'admin'),
('Staff User', 'staff@test.com', '$2b$10$ACq2CAlLBaSTNQsmESLUQuHiTZYh.g7v0p5nTGwpaXk/KPmC/QZ1K', 'staff'),
('Customer User', 'customer@test.com', '$2b$10$J.4uxGVbjn60z360PB8i6uIwepTe5Gksg697kOD25e.8AmtBaDTPy', 'customer')
ON DUPLICATE KEY UPDATE name = VALUES(name), role = VALUES(role);

INSERT INTO plans (id, name, speed, price, validity) VALUES
(1, 'Starter Fiber', '30 Mbps', 399.00, 30),
(2, 'Basic Plan', '50 Mbps', 499.00, 30),
(3, 'Turbo Fiber', '150 Mbps', 799.00, 30),
(4, 'Family Fiber', '500 Mbps', 1499.00, 30),
(5, 'Giga Fiber', '1 Gbps', 1999.00, 30)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    speed = VALUES(speed),
    price = VALUES(price),
    validity = VALUES(validity);

INSERT INTO customers (id, name, email, phone, plan_id, address, status) VALUES
(1, 'Customer User', 'customer@test.com', '9999999999', 2, 'Karur, Tamil Nadu', 'active')
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    email = VALUES(email),
    phone = VALUES(phone),
    plan_id = VALUES(plan_id),
    address = VALUES(address),
    status = VALUES(status);

INSERT INTO bills (id, customer_id, amount, status, bill_date, due_date) VALUES
(1, 1, 799.00, 'unpaid', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 7 DAY))
ON DUPLICATE KEY UPDATE
    customer_id = VALUES(customer_id),
    amount = VALUES(amount),
    status = VALUES(status),
    bill_date = VALUES(bill_date),
    due_date = VALUES(due_date);

INSERT INTO bill_items (bill_id, description, amount, item_type)
SELECT 1, 'Broadband subscription charges', 799.00, 'subscription'
WHERE NOT EXISTS (SELECT 1 FROM bill_items WHERE bill_id = 1 AND item_type = 'subscription');

INSERT INTO data_usage (customer_id, usage_date, used_gb, total_gb) VALUES
(1, DATE_SUB(CURDATE(), INTERVAL 6 DAY), 42.00, 1000.00),
(1, DATE_SUB(CURDATE(), INTERVAL 5 DAY), 88.00, 1000.00),
(1, DATE_SUB(CURDATE(), INTERVAL 4 DAY), 135.00, 1000.00),
(1, DATE_SUB(CURDATE(), INTERVAL 3 DAY), 181.00, 1000.00),
(1, DATE_SUB(CURDATE(), INTERVAL 2 DAY), 226.00, 1000.00),
(1, DATE_SUB(CURDATE(), INTERVAL 1 DAY), 274.00, 1000.00),
(1, CURDATE(), 320.00, 1000.00)
ON DUPLICATE KEY UPDATE
    used_gb = VALUES(used_gb),
    total_gb = VALUES(total_gb);
