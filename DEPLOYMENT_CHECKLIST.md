# NetWave Deployment Checklist

Use this checklist before putting the broadband system online.

## Required Environment

Create `Backend/.env` on the server. Do not commit real secrets.

```env
NODE_ENV=production
PORT=5000
PUBLIC_BASE_URL=https://your-domain.com
ALLOWED_ORIGINS=https://your-domain.com
JWT_SECRET=use-a-long-random-secret
JWT_EXPIRES_IN=1d
BCRYPT_ROUNDS=10
API_RATE_LIMIT=300
PAYMENT_RATE_LIMIT=30

DB_HOST=your-db-host
DB_USER=your-db-user
DB_PASSWORD=your-db-password
DB_NAME=broadband_db

RAZORPAY_KEY_ID=your-live-key-id
RAZORPAY_KEY_SECRET=your-live-key-secret

SMTP_HOST=your-smtp-host
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
SMTP_FROM=NetWave <billing@your-domain.com>

WHATSAPP_API_VERSION=v20.0
WHATSAPP_PHONE_NUMBER_ID=your-meta-phone-number-id
WHATSAPP_ACCESS_TOKEN=your-meta-access-token
WHATSAPP_TEMPLATE_LANGUAGE=en
WHATSAPP_TEMPLATE_BILL_DUE=bill_due_reminder
WHATSAPP_TEMPLATE_PAYMENT_RECEIVED=payment_received
WHATSAPP_TEMPLATE_ACCOUNT_APPROVED=account_approved
WHATSAPP_TEMPLATE_ACCOUNT_REJECTED=account_rejected
TEST_WHATSAPP_TO=+91XXXXXXXXXX

MSG91_WHATSAPP_AUTHKEY=your-msg91-authkey
MSG91_WHATSAPP_INTEGRATED_NUMBER=91XXXXXXXXXX
MSG91_WHATSAPP_TEMPLATE_NAMESPACE=your-msg91-template-namespace
MSG91_WHATSAPP_API_URL=https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/

# MSG91 SMS
MSG91_AUTHKEY=your-msg91-authkey
MSG91_FLOW_ID=your-default-msg91-flow-id
MSG91_FLOW_ID_BILL_DUE=your-bill-due-flow-id
MSG91_FLOW_ID_PAYMENT_RECEIVED=your-payment-received-flow-id
MSG91_FLOW_ID_ACCOUNT_APPROVED=your-account-approved-flow-id
MSG91_FLOW_ID_ACCOUNT_REJECTED=your-account-rejected-flow-id
MSG91_SENDER=NETWAV
MSG91_ROUTE=
MSG91_SMS_API_URL=https://api.msg91.com/api/v5/flow/
MSG91_MESSAGE_VAR=message
TEST_SMS_TO=+91XXXXXXXXXX

# Generic SMS fallback, only if not using MSG91
SMS_API_URL=
SMS_API_KEY=
SMS_FROM=NetWave

BILL_DOWNLOAD_SECRET=use-another-long-random-secret
BILL_DOWNLOAD_TTL_HOURS=168
```

## Database

1. Create a production MySQL database.
2. Import `Backend/schema.sql`.
3. Start the backend once so it creates any app-managed tables.
4. Change the seeded admin/staff/customer passwords.

## Providers

1. Razorpay: test with test keys first, then switch to live keys.
2. Email: verify SMTP delivery before sending customer bills.
3. WhatsApp: use approved utility templates for bill reminders and payment notifications.
4. SMS: for MSG91, create approved Flows/Templates for each SMS type and set `MSG91_AUTHKEY`, `MSG91_FLOW_ID_BILL_DUE`, `MSG91_FLOW_ID_PAYMENT_RECEIVED`, `MSG91_FLOW_ID_ACCOUNT_APPROVED`, `MSG91_FLOW_ID_ACCOUNT_REJECTED`, `MSG91_SENDER`, and `MSG91_MESSAGE_VAR`. Use a `{{message}}` variable in the MSG91 template if you want the backend text to control the final SMS body.
5. Test SMS delivery with `/test-msg91?to=+91XXXXXXXXXX`, then confirm notification logs show the `sms` channel as sent.

## Hosting

1. Use HTTPS.
2. Set `PUBLIC_BASE_URL` to the public HTTPS domain.
3. For the default Render deploy, keep frontend and backend on the same service and leave `ALLOWED_ORIGINS` empty. If using a separate frontend, set `ALLOWED_ORIGINS` to only that frontend domain.
4. Keep `Backend/.env` private.
5. On Render, use the root `render.yaml`; it builds `Frontend/react-app` and serves the production React app from Express.

## Final Smoke Test

1. Login as admin, staff, and customer.
2. Add a customer with a valid 10-digit phone number.
3. Generate a bill.
4. Pay with Razorpay test mode.
5. Confirm payment history is saved.
6. Download the PDF invoice.
7. Confirm notification logs show email/SMS/WhatsApp sent, skipped, or failed.
