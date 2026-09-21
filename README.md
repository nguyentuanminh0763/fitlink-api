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

# Run Automated Vitest Test Suite (Unit & Integration tests)
npm test

# Single test run (CI mode)
npm run test:run

# Build for production (Babel transpilation to build/)
npm run build

# Start production server
npm run production
```

### 5. Running with Docker Compose (Replica Set & Redis)
From the project root (`D:\2025\PROJECT_WDP`):
```bash
docker compose up -d
```
This spins up:
- **MongoDB** with Replica Set `rs0` enabled (supporting ACID transactions on local).
- **Redis 7** for fast Cache-Aside data retrieval.
- **FitLink Backend** container.

---

## 🧪 Testing Suite (Vitest)

The backend includes automated tests verifying financial calculations and transaction integrity:
- `src/__tests__/pricing.test.js`: Validates package pricing logic, percentage platform fee deductions, and edge cases.
- `src/__tests__/transaction.test.js`: Validates MongoDB Multi-Document ACID transaction rollback on failure, and confirms idempotency of `creditPTWalletIdempotent` (guaranteeing wallet balances cannot be double-credited upon retry).

---

## 🔄 CI/CD Pipeline (Azure DevOps)

Automated continuous integration is configured in `azure-pipelines.yml`:
- Runs on a **Self-Hosted Windows Agent** (`D:\agent`, pool `Default`).
- Automatically triggers on push and pull-requests to `dev` and `main`.
- Executes dependency installation (`npm install`), Vitest tests (`npm run test:run`), Babel build (`npm run build`), and Docker dry-run build (`docker build`).
- Typical execution time: **~1 minute 07 seconds**.

---

## 🛡️ Security & Integrity Hardening

1. **Authentication:** Secure `httpOnly` cookies (`token`) prevent XSS token theft.
2. **WebSocket Security:** Socket.IO handshakes strictly authenticate the user's JWT from `httpOnly` cookies (`chatSocket.js`), preventing room eavesdropping and identity spoofing.
3. **Idempotency & Concurrency:** PT wallet credits use atomic MongoDB queries (`$ne` on `processedTransactions`), guaranteeing single execution even under network retries.
4. **Data Integrity:** Compound MongoDB indexes on `(pt: 1, startTime: 1)` in `Slot.js` and `(slot: 1)` in `Session.js` prevent double-booking at the database level.
5. **Price & Transaction Ownership:** Server calculates payment totals strictly using `calcBookingPricing()`; transactions enforce user ownership (`trans.student === req.user._id`).

