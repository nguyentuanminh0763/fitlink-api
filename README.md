# Fit-Link Platform — Backend Service

> RESTful API & Real-time WebSocket Server for Fit-Link, a fitness marketplace connecting students with certified personal trainers (PTs).
>
> Frontend: [fitlink-portal](https://github.com/nguyentuanminh0763/fitlink-portal)

---

## 🌟 Tech Stack & Architecture

- **Runtime & Framework:** Node.js 20, Express.js 4, Babel (ESModules transpilation, `~/` path alias)
- **Database & ODM:** MongoDB (replica set, required for multi-document transactions) with Mongoose 8
- **Cache:** Redis 7 (ioredis) with automatic in-memory fallback when Redis is unreachable
- **Real-Time Layer:** Socket.IO 4 (bidirectional chat, instant notification feeds)
- **Authentication:** JWT stored in `httpOnly` cookies + Google OAuth 2.0 (`google-auth-library`)
- **Payment Gateway:** PayOS SDK (QR code checkout, server-side payment verification)
- **File Storage:** Cloudinary SDK with Multer middleware
- **Email Service:** Nodemailer with Gmail SMTP
- **AI Consultation:** Express webhook proxying to an n8n workflow

---

## 📁 Directory Structure

```
src/
├── config/             # Environment variables, MongoDB, Redis, Cloudinary
├── controllers/        # Request handlers (auth, pt, booking, payment, ai, ...)
├── domain/             # System enums (Roles, BookingStatus, SessionStatus)
├── middlewares/        # Authentication guard, error handling, file upload, cache
├── models/             # Mongoose data models & schemas
├── providers/          # Third-party integrations (PayOS, Cloudinary, Mailer)
├── routes/             # RESTful route endpoints (/api/*)
├── seeds/              # Demo data (`npm run seed`)
├── services/           # Core business logic (notifications, cache, booking)
├── sockets/            # Socket.IO connection & event handlers
├── utils/              # Token generation, formatters, pagination helpers
├── validations/        # Joi schema validation rules
└── server.js           # Server initialization & HTTP/WebSocket bootstrap
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js 20** and npm 10
- **Docker Desktop** (runs MongoDB as a replica set + Redis — no Atlas account needed)

### 2. Quick start
```bash
git clone https://github.com/nguyentuanminh0763/fitlink-api.git
cd fitlink-api

docker compose up -d     # MongoDB replica set (rs0) + Redis
cp .env.example .env     # the defaults work as-is for local development
npm ci                   # installs the exact versions from package-lock.json
npm run seed             # demo data (see accounts below)
npm run dev              # API on http://localhost:3000 — check http://localhost:3000/health
```

> PowerShell: use `Copy-Item .env.example .env` instead of `cp`.
> The first `npm run dev` can take a minute or two: `babel-node` compiles on the fly.

Then start the frontend ([fitlink-portal](https://github.com/nguyentuanminh0763/fitlink-portal)) — it runs on `http://localhost:5173` and proxies `/api` and `/socket.io` to port 3000.

### 3. Demo accounts
Created by `npm run seed`. Password for all: `123456`.

| Role | Email |
|---|---|
| Admin | `admin@fitlink.vn` |
| PT | `pt.hung@fitlink.vn` (+ 99 more PTs) |
| Student | `student.kiet@fitlink.vn`, `student.trang@fitlink.vn` |

> ⚠️ `npm run seed` **deletes all users, PT profiles, wallets and packages** before inserting. Only run it against a local database.

### 4. Configuration

All configuration comes from environment variables, read in one place: [`src/config/environment.js`](src/config/environment.js).

| Where it runs | Where the values come from |
|---|---|
| Local (`npm run dev`) | `.env`, copied from [`.env.example`](.env.example) — the defaults work as-is |
| Production (Docker image) | The hosting platform's environment variables. The image contains no `.env` (`.dockerignore` excludes it) |

A real environment variable always wins over `.env` (dotenv never overrides), so the same code runs everywhere and only the source of the values changes.

| Variable | Needed | Local default | Production | Notes |
|---|---|---|---|---|
| `APP_PORT` | ✅ | `3000` | `3000` | Must match the port the platform routes to (the Dockerfile exposes 3000) |
| `APP_HOST` | | `localhost` | leave unset | Unset = listen on all interfaces. Use `0.0.0.0` locally if a container must reach the API |
| `BUILD_MODE` | ✅ | `dev` | **`production`** | Defaults to `dev` when missing → stack traces in error responses |
| `CLIENT_URL` | ✅ | `http://localhost:5173` | public frontend URL | CORS (HTTP + Socket.IO), links in emails, PayOS return URL |
| `MONGODB_URI` | ✅ | local replica set | managed replica set | Must be a replica set and end with `/fitlink_db` |
| `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET` | ✅ | placeholders | long random values | Wrap in single quotes if a value contains `$` |
| `IS_SERCURE_COOKIE` | ✅ in prod | `false` | **`true`** | Misspelled on purpose — keep the name. `true` adds the `Secure` flag to the auth cookie |
| `COOKIE_SAMESITE` | | `lax` | `lax` | |
| `REDIS_MODE` | | `local` | `local` / `cloud` / `memory` | `memory` = no Redis. If Redis is unreachable the API falls back to in-memory cache |
| `REDIS_LOCAL_URI` / `REDIS_CLOUD_URI` | per mode | `redis://127.0.0.1:6379` / empty | per mode | |
| `CACHE_DEFAULT_TTL` | | `300` | | Seconds |
| `PLATFORM_FEE_PERCENT` | | `20` | | Share kept by the platform on each payment |
| `GG_CLIENT_ID` | Google login | public client ID | same | Must equal `VITE_GG_CLIENT_ID` in fitlink-portal |
| `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM` | optional | empty | set | Empty → sign-up and forgot-password return 500 (use the demo accounts) |
| `CLOUDINARY_*` | optional | empty | set | Empty → image uploads fail |
| `PAYOS_*` | optional | empty | set | Empty → the "Pay" step cannot create a QR link. Use sandbox keys locally |
| `CHATBOT_GPT_N8N_API` | optional | empty | set to enable | Empty → AI chat is off |
| `DATABASE_NAME` | | `fitlink_db` | | Not used by the live connection (`src/config/database.js`) — the database name comes from the URI path |

### 5. Scripts

| Command | Description |
|---|---|
| `npm run dev` | Nodemon + babel-node with hot reload |
| `npm run seed` | Reset and insert demo data |
| `npm test` | All Vitest suites — `transaction.test.js` needs `docker compose up -d` (replica set on 27017) |
| `npm run build` | Babel-compile to `build/` |
| `npm run production` | Build + start the compiled server |
| `npm run lint` | ESLint |

### 6. Troubleshooting

| Error | Cause → fix |
|---|---|
| `Invalid scheme, expected connection string to start with "mongodb://"` | No `.env` or empty `MONGODB_URI` → `cp .env.example .env` |
| `Transaction numbers are only allowed on a replica set member or mongos` | MongoDB is not a replica set → use `docker compose up -d` from this repo |
| Pages load but every POST returns `500` `CORS blocked` | `CLIENT_URL` doesn't match the frontend origin (browsers send `Origin` on POST, not on same-origin GET) |
| `Cannot find module '~/...'` | Started with `node src/server.js` → the `~/` alias only works through Babel; use `npm run dev` |
| Data "disappears" | `MONGODB_URI` without `/fitlink_db` → Mongoose silently uses the `test` database |

### 7. Production image
```bash
docker build -t fitlink-api .
```
Multi-stage build, runs as non-root `node` under `dumb-init`, exposes port 3000 with a `/health` HEALTHCHECK. In production set at least `BUILD_MODE=production`, `CLIENT_URL` (the public frontend URL) and a `MONGODB_URI` ending in `/fitlink_db`.

---

## 🧪 Testing Suite (Vitest)

- `src/__tests__/pricing.test.js`: package pricing logic, platform fee deductions, edge cases.
- `src/__tests__/transaction.test.js`: MongoDB multi-document transaction rollback on failure, and idempotency of `creditPTWalletIdempotent` (a wallet cannot be credited twice for the same payment). Uses the local replica set on port 27017.
- `src/__tests__/cacheInvalidation.test.js`: cache eviction by PT id **and** slug.

---

## 🔄 CI Pipeline (Azure DevOps)

Configured in `azure-pipelines.yml`, triggered on pushes to `dev` and `main`:
1. Node.js 20 setup
2. `npm ci`
3. `npx vitest run src/__tests__/pricing.test.js`
4. `npm run build`
5. Docker build and push to Azure Container Registry (tags: build ID and `latest`)

Deployment to Azure Container Apps is a manual step — the pipeline does not deploy.

---

## 🛡️ Security & Integrity Hardening

1. **Authentication:** `httpOnly` cookies (`token`) keep the JWT out of reach of JavaScript.
2. **WebSocket Security:** Socket.IO handshakes authenticate the user's JWT from the `httpOnly` cookie (`chatSocket.js`), preventing room eavesdropping and identity spoofing.
3. **Idempotent wallet credits:** `creditPTWalletIdempotent` runs inside `session.withTransaction()` and relies on a unique index on `(refId, refType)` in `PTWalletTransaction` — refreshing the payment result page credits the PT once.
4. **Data Integrity:** Unique indexes on `(pt, startTime)` in `Slot.js` and `(slot)` in `Session.js` prevent double-booking at the database level.
5. **Price & Transaction Ownership:** The server computes payment totals with `calcBookingPricing()`; pay/confirm endpoints check `trans.student === req.user._id`.
