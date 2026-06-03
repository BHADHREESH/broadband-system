# Deployment Guide

## App: Render

The root `render.yaml` deploys the backend and React frontend together as one Render web service.

1. Push repository to GitHub.
2. Create a Render Blueprint from the repository.
3. Set all required environment variables.
4. Use a hosted MySQL database.
5. Set `PUBLIC_BASE_URL` to the Render HTTPS URL, or leave it empty and the app will use Render's `RENDER_EXTERNAL_URL`.
6. Leave `ALLOWED_ORIGINS` empty unless you later deploy a separate frontend.

Required backend variables:

```env
NODE_ENV=production
PUBLIC_BASE_URL=https://your-app.onrender.com
JWT_SECRET=long-random-secret
DB_HOST=cloud-mysql-host
DB_USER=cloud-mysql-user
DB_PASSWORD=cloud-mysql-password
DB_NAME=broadband_db
RAZORPAY_KEY_ID=live-or-test-key
RAZORPAY_KEY_SECRET=live-or-test-secret
BILL_DOWNLOAD_SECRET=long-random-secret
```

Optional provider variables:

```env
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
SMS_API_URL=
SMS_API_KEY=
MSG91_AUTHKEY=
MSG91_FLOW_ID_BILL_DUE=
MSG91_FLOW_ID_PAYMENT_RECEIVED=
MSG91_FLOW_ID_ACCOUNT_APPROVED=
MSG91_FLOW_ID_ACCOUNT_REJECTED=
MSG91_SENDER=
MSG91_MESSAGE_VAR=message
OPENAI_API_KEY=
```

## React Frontend

Render builds `Frontend/react-app` during the backend deploy and Express serves `Frontend/react-app/dist`. In production, the React app calls the API on the same origin, so no `VITE_API_BASE_URL` is required for the normal Render deployment.

If you later deploy the React app as a separate static site, set `VITE_API_BASE_URL` to the backend URL and set backend `ALLOWED_ORIGINS` to the frontend URL.

## Database: Cloud MySQL

Use Railway, Aiven, PlanetScale-compatible MySQL, or VPS MySQL.

1. Create database.
2. Import `Backend/schema.sql`.
3. Start backend once to ensure managed tables exist.
4. Change seeded demo passwords before public launch.

## Production Checklist

- HTTPS enabled
- Live DB connected
- Strong `JWT_SECRET`
- Strong `BILL_DOWNLOAD_SECRET`
- Real `PUBLIC_BASE_URL`
- Strict `ALLOWED_ORIGINS`
- Razorpay keys configured
- Email/SMS/WhatsApp providers tested
- Admin/staff/customer login tested
- Bill generation tested
- Payment verification tested
- PDF download tested
- Notification logs checked
