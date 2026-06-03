# Testing Instructions

## Backend Static Checks

```bash
cd Backend
npm test
```

## Backend Smoke Tests

```bash
curl http://localhost:5000/api/health
```

Login:

```bash
curl -X POST http://localhost:5000/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"admin@test.com\",\"username\":\"admin@test.com\",\"password\":\"your-password\",\"role\":\"admin\"}"
```

## Manual End-to-End Test

1. Start backend on `http://localhost:5000`.
2. Start React frontend on `http://localhost:3000`.
3. Login as admin.
4. Confirm dashboard stats load.
5. Generate bill for a customer.
6. Login as customer.
7. Confirm bill appears.
8. Pay using Razorpay test checkout.
9. Confirm:
   - Bill status becomes `paid`
   - Payment history row appears
   - PDF bill downloads
   - Notification logs show channel statuses
10. Login as staff.
11. Confirm staff can see tickets/customers/payments.

## Production Validation

Before competition submission or real launch:

- Browser console has no errors.
- API network requests return 2xx or handled 4xx messages.
- Invalid login shows an error, not a server crash.
- Protected pages redirect/deny without JWT.
- Role-based dashboards show correct data.
- Payment failure does not mark bill paid.
- Payment success stores transaction details.
