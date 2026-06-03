# Project Structure

```text
broadband-system/
├─ Backend/
│  ├─ config/
│  │  ├─ db.js
│  │  └─ env.js
│  ├─ controllers/
│  ├─ middleware/
│  ├─ models/
│  ├─ routes/
│  ├─ services/
│  ├─ utils/
│  ├─ package.json
│  ├─ schema.sql
│  └─ server.js
├─ Frontend/
│  ├─ react-app/
│  │  ├─ src/
│  │  │  ├─ lib/
│  │  │  ├─ App.jsx
│  │  │  ├─ main.jsx
│  │  │  └─ styles.css
│  │  ├─ package.json
│  │  ├─ tailwind.config.js
│  │  ├─ vite.config.js
│  │  └─ vercel.json
│  ├─ admin/
│  ├─ customer/
│  ├─ staff/
│  ├─ login.html
│  └─ register.html
├─ docs/
│  ├─ API.md
│  ├─ DEPLOYMENT.md
│  ├─ PROJECT_STRUCTURE.md
│  └─ SETUP.md
├─ DEPLOYMENT_CHECKLIST.md
└─ render.yaml
```

The React frontend is the production frontend. The existing HTML pages are kept as a legacy/static fallback served by Express.
