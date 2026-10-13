# Deep’s Cake Shop — Backend API (Phase 2)

A robust, enterprise-grade Node.js + Express + TypeScript + MongoDB REST backend for **Deep’s Cake Shop**, featuring strict request validation, server-side pricing recalculation, Cloudinary media handling with local fallback, and database seeding.

---

## 🛠 Tech Stack

- **Runtime & Language:** Node.js (ES2022) with TypeScript (`NodeNext` module resolution)
- **Framework:** Express 5.x
- **Database & ODM:** MongoDB Atlas / Local MongoDB via Mongoose 8.x
- **Validation:** Zod schemas
- **Media Uploads:** Multer with dual-mode storage (Cloudinary remote streaming + local file system fallback)
- **Security:** Bcrypt password hashing, JWT authentication foundation, Express Rate Limiter, Helmet-style CORS controls
- **Testing:** Native Node.js test runner with `supertest` & `tsx`

---

## 📁 Directory Structure

```
d:/cake shop/server/
├── dist/                     # Compiled JavaScript output (from npm run build)
├── src/
│   ├── config/
│   │   ├── db.ts             # Mongoose connection manager with offline resilience
│   │   ├── env.ts            # Type-safe environment variable parsing
│   │   └── cloudinary.ts     # Dual-mode media upload handler (Cloudinary + Local)
│   ├── controllers/
│   │   ├── auth.controller.ts     # Admin login and session verification
│   │   ├── cake.controller.ts     # Filtered catalog search, sorting, details
│   │   ├── category.controller.ts # Category collections
│   │   ├── inquiry.controller.ts  # Custom cake inquiries & quote estimation
│   │   └── order.controller.ts    # Secure server-side pricing & order creation
│   ├── data/
│   │   ├── cakes.ts          # 14 authentic demo bakery products
│   │   └── categories.ts     # 7 cake collections
│   ├── middlewares/
│   │   ├── auth.middleware.ts     # JWT Bearer token protection for admin routes
│   │   ├── error.middleware.ts    # Centralized error and 404 handler
│   │   ├── rateLimiter.ts         # IP rate limiting for submissions and auth
│   │   └── validate.middleware.ts # Zod request validation middleware
│   ├── models/
│   │   ├── Admin.ts          # Admin credentials with bcrypt hashing
│   │   ├── Cake.ts           # Cake product model with multi-weight pricing
│   │   ├── Category.ts       # Bakery category model
│   │   ├── CustomCakeInquiry.ts # Custom cake orders with reference codes
│   │   └── Order.ts          # Customer orders with server-computed line items
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   ├── cake.routes.ts
│   │   ├── category.routes.ts
│   │   ├── health.routes.ts
│   │   ├── inquiry.routes.ts
│   │   └── order.routes.ts
│   ├── schemas/              # Zod validation schemas
│   ├── scripts/
│   │   └── seed.ts           # Idempotent database seeder (upserts catalog & admin)
│   ├── app.ts                # Express application setup, routes & middleware
│   └── index.ts              # Server bootstrapper & database initialization
├── tests/
│   └── api.test.ts           # 11 automated integration tests
├── .env.example              # Environment variables template
├── package.json
└── tsconfig.json
```

---

## ⚙️ Environment Configuration

Create a `.env` file in `d:/cake shop/server/` based on `.env.example`:

```env
# Server Port
PORT=5000

# Node Environment
NODE_ENV=development

# MongoDB Connection String (Local or MongoDB Atlas)
MONGODB_URI=mongodb://127.0.0.1:27017/deeps_cake_shop

# Allowed Frontend URL for CORS
FRONTEND_URL=http://localhost:5173

# Admin JWT Secret for token signing
JWT_SECRET=super_secret_jwt_key_deeps_cake_shop_phase2_replace_in_prod

# Optional Cloudinary Storage (If omitted, uploads save to server/uploads/)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

---

## 🍃 MongoDB Atlas Setup Guide

To use a free cloud database on **MongoDB Atlas**:

1. Sign up or log in at [cloud.mongodb.com](https://cloud.mongodb.com/).
2. Click **Create Cluster** and select the free **M0 Sandbox** tier.
3. In **Database Access**, create a user (e.g., `cake_admin`) and a secure password.
4. In **Network Access**, click **Add IP Address** and choose **Allow Access from Anywhere** (`0.0.0.0/0`) for local development, or add your current IP.
5. In **Database** > **Connect** > **Drivers**, copy the connection string.
6. Paste it into your `server/.env`:
   ```env
   MONGODB_URI=mongodb+srv://cake_admin:<password>@cluster0.abcde.mongodb.net/deeps_cake_shop?retryWrites=true&w=majority
   ```
   *(Replace `<password>` with your database user's password).*

---

## 🚀 Running the Server

Open a terminal in `d:/cake shop/server`:

### 1. Install Dependencies
```bash
npm install
```

### 2. Seed Database (Idempotent)
Populates MongoDB with the 14 authentic demo cakes, 7 bakery collections, and a default admin user (`admin` / `AdminBakery@2026`). Will not create duplicates if run repeatedly.
```bash
npm run seed
```

### 3. Start Development Server
```bash
npm run dev
```
The server will run at `http://localhost:5000`.

### 4. Build & Run for Production
```bash
npm run build
npm start
```

### 5. Run Automated Tests
```bash
npm test
```
Executes 17 integration tests covering health checks, catalog search, pagination, validation, order calculation, discount logic, admin authentication, session logout, and protected admin dashboard statistics.

---

## 🌐 API Endpoints Reference

### Health Check
- `GET /api/health`
  - Returns backend status, uptime, and database connection state (`connected` / `connecting` / `disconnected`).

### Cake Products
- `GET /api/cakes`
  - **Query Parameters:**
    - `search` (e.g. `belgian`, `red velvet`)
    - `category` (e.g. `Birthday`, `Bestseller`, `Anniversary`)
    - `eggPreference` (`all`, `eggless`, `regular`)
    - `weight` (`all`, `0.5 kg`, `1 kg`, `1.5 kg`, `2 kg`)
    - `maxPrice` (e.g. `1200`)
    - `sortBy` (`featured`, `price-asc`, `price-desc`, `rating`, `popular`)
    - `page` & `limit` (default: 20)
- `GET /api/cakes/:id`
  - Retrieves a cake by MongoDB `_id` or numeric `id` slug. Returns 404 if not found.

### Categories
- `GET /api/categories`
  - Returns the 7 bakery collections with images and item counts.

### Custom Cake Inquiries
- `POST /api/custom-cakes`
  - Accepts `multipart/form-data` or `application/json`.
  - Supports image file upload under field `referenceImage`.
  - Computes an estimated base quote.
  - Returns unique inquiry reference (e.g. `INQ-20261012-789012`).
- `GET /api/custom-cakes/:referenceId`
  - Safe customer inquiry status lookup.

### Customer Orders
- `POST /api/orders`
  - **Server-Side Pricing Recalculation:** Client-submitted prices are ignored. All prices are calculated from database records.
  - **Delivery Fee:** Calculated server-side (Free delivery for orders ₹799 and above; ₹99 otherwise).
  - **Coupon Support:** `SWEET10` or `DEEPS10` applies a verified 10% discount to subtotal.
  - **Status:** Initial status is strictly `Pending` (no premature claims of payment).
  - **Idempotency Protection:** Re-submitting with the same `idempotencyKey` safely returns the existing order rather than creating a duplicate.
- `GET /api/orders/:orderId`
  - Safe customer order status and bill lookup.

### Admin Authentication & Operations (Phase 3 Foundation)
- `POST /api/auth/login`
  - Validates username/email and bcrypt password.
  - Issues signed JWT token and sets secure HttpOnly `admin_token` cookie (`SameSite=lax`).
  - Returns user profile and `isDefaultCredentials` security flag.
- `POST /api/auth/logout`
  - Clears the HttpOnly `admin_token` cookie and terminates session.
- `GET /api/auth/me`
  - Requires admin authentication. Returns authenticated admin profile without password hash.
- `GET /api/admin/stats`
  - **Protected Admin Endpoint:** Requires admin authentication (HttpOnly cookie or `Authorization: Bearer <token>`).
  - Returns real MongoDB aggregate metrics:
    - **Orders:** Total count, counts across all 6 statuses (`Pending`, `Confirmed`, `Baking`, `Out for Delivery`, `Delivered`, `Cancelled`), and 5 recent orders.
    - **Revenue:** Total eligible revenue (sum of `grandTotal` for non-cancelled orders), delivered revenue, in-progress revenue, pending revenue, and explicit eligibility criteria.
    - **Catalog:** Total cakes, available cakes count, and total categories.
    - **Custom Inquiries:** Total inquiries, pending review count, breakdown by status (`pending`, `reviewed`, `quoted`, `confirmed`, `cancelled`), and recent inquiries list.
    - **Security:** Flag indicating if default seeded credentials are active with advisory warning.

### Admin Operations & Custom Notifications
- `GET /api/admin/notifications`
  - **Protected Admin Endpoint:** Requires admin authentication.
  - Returns paginated notification audit logs with delivery status, recipient, channel, provider, retry attempts, sanitized errors, and timestamps.
  - Supports filtering by `status`, `channel`, `eventType`, `recipient`, and pagination controls.

---

## 🔔 Customer Notification Foundation (Phase 4, Milestone 1)

1. **Provider Strategy Architecture:** `INotificationProvider` interface enables pluggable messaging delivery (SendGrid, Twilio, WhatsApp Cloud API) decoupled from business controllers.
2. **Safe Development Mock Provider:** `DevMockNotificationProvider` records in-memory dispatches, simulates delivery latencies, and supports failure testing without sending real customer messages.
3. **Duplicate-Send Protection:** Unique `idempotencyKey` prevents duplicate dispatches for orders, status updates, or custom cake quotations.
4. **Bounded Retries:** Exponential backoff with jitter and bounded retry attempts (up to 3 attempts max) before marking status as `failed`.
5. **Customer Consent & Channel Validation:** Enforces opt-in consent and validates email/phone formatting before invoking providers.
6. **Non-Blocking Delivery:** Notification dispatches run asynchronously with error absorption — failing delivery providers NEVER block order placement or inquiry updates.
7. **Sensitive Data Redaction:** `sanitizeLogDetails` automatically scrubs passwords, JWT tokens, Bearer tokens, API credentials, and database connection strings before audit logging.

---

## 🔒 Security Measures

1. **Server-Side Pricing Integrity:** Totals, subtotal, and discounts are never trusted from the client request.
2. **Input Validation:** Zod schemas validate phone numbers, emails, weights, and string limits before controller logic runs.
3. **Password Security:** Admin passwords hashed with `bcryptjs` (salt rounds: 10). Hashes are excluded (`select: false`) by default in queries.
4. **Dual Authentication Support:** Supports both secure HttpOnly session cookies (with SameSite protection) and `Authorization: Bearer <token>` headers for maximum cross-origin compatibility and testing flexibility.
5. **Rate Limiting:** Public inquiry and order creation are capped at 30 requests per hour per IP. Authentication attempts capped at 10 per 15 minutes.
6. **CORS:** Restricted to `FRONTEND_URL` (`http://localhost:5173` in development) with `credentials: true`.
7. **Production Credential Advisory:** Prominent alert flag displayed whenever default seeded admin credentials (`admin`) are in use, requiring rotation prior to production deployment.
8. **Graceful Degradation:** Controllers fall back safely to structured offline data if the MongoDB connection is temporarily offline.
