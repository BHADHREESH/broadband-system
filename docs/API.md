# NetWave Broadband API

Base URL:

- Local: `http://localhost:5000`
- Production: value of `PUBLIC_BASE_URL`

All protected endpoints require:

```http
Authorization: Bearer <jwt_token>
```

Responses use:

```json
{
  "success": true,
  "message": "Message",
  "data": {}
}
```

## Health

### `GET /api/health`

Checks backend status.

## Authentication

### `POST /api/auth/login`

Body:

```json
{
  "email": "admin@test.com",
  "username": "admin@test.com",
  "password": "password",
  "role": "admin"
}
```

Roles: `admin`, `staff`, `customer`.

### `POST /api/auth/register`

Registers a customer account.

Body:

```json
{
  "name": "Customer",
  "email": "customer@example.com",
  "phone": "9876543210",
  "address": "Karur",
  "plan_id": 1,
  "password": "StrongPass@123"
}
```

### `PUT /api/auth/change-password`

Protected.

Body:

```json
{
  "currentPassword": "OldPass@123",
  "newPassword": "NewPass@1234"
}
```

## Customers

### `GET /api/customers`

Admin/staff. Lists customers.

### `POST /api/customers`

Admin/staff. Creates customer and login account if password is supplied.

### `PUT /api/customers/:id`

Admin/staff. Updates customer profile, plan, and connection status.

### `DELETE /api/customers/:id`

Admin only. Deletes customer and customer login account.

### `GET /api/customers/me`

Customer only. Returns current customer profile with plan.

### `PUT /api/customers/me`

Customer only. Updates own name, phone, and address.

## Plans

### `GET /api/plans`

Public. Lists broadband plans.

### `POST /api/plans`

Admin only. Creates a plan.

### `PUT /api/plans/:id`

Admin only. Updates a plan.

### `DELETE /api/plans/:id`

Admin only. Deletes a plan.

## Billing

### `GET /api/bills`

Admin/staff: all bills. Customer: own bills.

### `POST /api/bills/generate`

Admin/staff. Generates bill and sends due notifications.

Body:

```json
{ "customer_id": 1 }
```

### `PUT /api/bills/pay/:id`

Admin/staff. Marks bill as paid and stores manual payment record.

### `GET /api/bills/download/:id`

Protected PDF bill download.

### `GET /api/bills/download/:id/:expiresAt/:token`

Public expiring PDF bill link for email.

### `POST /api/bills/reminders/send`

Admin/staff. Sends due reminders for unpaid bills due within 3 days.

## Payments

### `POST /api/payment/create-order`

Protected. Creates Razorpay order.

Body:

```json
{ "amount": 799 }
```

### `POST /api/payment/verify`

Protected. Verifies Razorpay signature, marks bill paid, stores transaction.

### `GET /api/payments`

Admin/staff: all payments. Customer: own payments.

### `GET /api/payments/notifications`

Admin/staff. Lists notification delivery logs.

## Support

### `GET /api/support`

Admin/staff: all tickets. Customer: own tickets.

### `POST /api/support`

Creates support ticket.

Body:

```json
{ "issue": "Internet is slow" }
```

### `PUT /api/support/:id`

Admin/staff. Updates ticket status.

## Usage

### `GET /api/usage/me`

Customer only. Returns data usage history.

## AI

### `POST /api/ai/ask`

Protected. Basic FAQ assistant.

Body:

```json
{ "message": "How do I pay my bill?" }
```
