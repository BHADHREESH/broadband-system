# Local Setup Guide

## Requirements

- Node.js 18+
- MySQL 8+
- npm

## 1. Database

Create and seed the database:

```bash
mysql -u root -p < Backend/schema.sql
```

If MySQL is already running with no root password locally:

```bash
mysql -u root < Backend/schema.sql
```

## 2. Backend

```bash
cd Backend
npm install
copy .env.example .env
npm start
```

Minimum `.env`:

```env
PORT=5000
PUBLIC_BASE_URL=http://localhost:5000
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5000
JWT_SECRET=change-this-secret
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=broadband_db
BILL_DOWNLOAD_SECRET=change-this-bill-secret
```

Verify:

```bash
curl http://localhost:5000/api/health
```

## 3. React Frontend

```bash
cd Frontend/react-app
npm install
copy .env.example .env
npm run dev
```

Open:

```text
http://localhost:3000
```

## 4. Seed Login Accounts

The schema includes default users. If passwords were changed in your database, use your current credentials.

Roles:

- Admin: `admin@test.com`
- Staff: `staff@test.com`
- Customer: `customer@test.com`

## 5. Test Flow

1. Login as admin.
2. Add or verify plans.
3. Add customer with valid 10-digit phone.
4. Generate a bill.
5. Login as customer.
6. Pay bill using Razorpay test keys.
7. Confirm bill status, payment history, PDF bill, and notification logs.
