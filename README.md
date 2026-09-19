# Fit-Link Platform — Backend Service

> RESTful API & Real-time WebSocket Server for Fit-Link, a fitness marketplace connecting students with certified personal trainers (PTs).

---

## 🌟 Tech Stack & Architecture

- **Runtime & Framework:** Node.js (>=18.x), Express.js 4, Babel (ESModules transpilation)
- **Database & ODM:** MongoDB Atlas with Mongoose 8 (compound indexing, schema validations)
- **Real-Time Layer:** Socket.IO 4 (bidirectional chat, instant notification feeds)
- **Authentication:** JWT stored in `httpOnly` secure cookies + Google OAuth 2.0 (`google-auth-library`)
- **Payment Gateway:** PayOS SDK integration (QR code checkout, webhook transaction verification)
- **File Storage:** Cloudinary SDK with Multer middleware
- **Email Service:** Nodemailer with Gmail SMTP & EJS templates
- **AI Consultation:** Express webhook proxying to n8n workflow connected to Google Docs (Knowledge Base) and OpenAI GPT-4o

---

## 📁 Directory Structure

```
backend/src/
├── config/             # Environment variables & MongoDB connection
├── controllers/        # Request handlers (auth, pt, booking, payment, ai, ...)
├── domain/             # System enums (Roles, BookingStatus, SessionStatus)
├── middlewares/        # Authentication guard, error handling, file upload
├── models/             # Mongoose data models & schemas
├── providers/          # Third-party integrations (PayOS, Cloudinary, Mailer)
├── routes/             # RESTful route endpoints (/api/*)
├── services/           # Core business logic (notifications, email, AI)
├── sockets/            # Socket.IO connection & event handlers
├── utils/              # Token generation, formatters, pagination helpers
├── validations/        # Joi schema validation rules
└── server.js           # Server initialization & HTTP/WebSocket bootstrap
```

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js >= 18.x
- npm >= 9.x
- MongoDB Atlas cluster URI

### 2. Installation
```bash
cd backend
npm install
```

### 3. Environment Configuration
Create a `.env` file in the `backend/` root:
```env
# Server
APP_HOST=localhost
APP_PORT=8017
BUILD_MODE=dev
CLIENT_URL=http://localhost:5173

# Database
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net
DATABASE_NAME=fitlink_db

# Security & JWT
ACCESS_TOKEN_SECRET=your_super_secret_access_key
REFRESH_TOKEN_SECRET=your_super_secret_refresh_key
IS_SERCURE_COOKIE=false
COOKIE_SAMESITE=lax

# Google OAuth
GG_CLIENT_ID=your_google_client_id
GG_CLIENT_SECRET=your_google_client_secret

# PayOS Payment
PAYOS_CLIENT_ID=your_payos_client_id
PAYOS_API_KEY=your_payos_api_key
PAYOS_CHECKSUM_KEY=your_payos_checksum_key

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Nodemailer
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM=FitLink <no-reply@fitlink.vn>

# AI Integration
CHATBOT_GPT_N8N_API=your_n8n_webhook_url
PLATFORM_FEE_PERCENT=20
```

### 4. Running the Application
```bash
# Development (with hot-reload via nodemon & babel-node)
npm run dev

# Build for production
npm run build

# Start production server
npm run production
```

---

## 🛡️ Security & Conventions

1. **Authentication:** Uses secure `httpOnly` cookies (`token`) preventing XSS token theft.
2. **Error Handling:** Centralized `errorHandlingMiddleware` prevents stack trace leaks in non-development environments.
3. **Data Integrity:** Compound MongoDB indexes on `(ptId + date + timeSlot)` to avoid overlapping slot bookings.
4. **API Responses:** Uniform JSON responses formatted as `{ statusCode, message, ...data }`.
