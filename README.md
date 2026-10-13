# Deep’s Cake Shop — Full-Stack Bakery Web Application

A premium artisanal cake shop e-commerce platform built with **React 19 + TypeScript + Vite + Tailwind CSS v4** on the frontend and **Node.js + Express + TypeScript + MongoDB (Mongoose)** on the backend.

---

## 🏗 Architecture Overview

The repository is structured into two decoupled, fully typed TypeScript applications:

- **Frontend (`/`):** React 19, Vite, Tailwind CSS v4, Lucide React, React Router.
  - Interactive cake catalog with real-time filtering, search, sorting, and pagination.
  - Product details with dynamic weight selection and real-time pricing recalculation.
  - Multi-step custom cake design form with reference photo upload and live quote calculation.
  - Persistent Cart and Wishlist with discount promo codes (`SWEET10`).
  - Checkout flow with delivery address validation and order placement.
- **Backend (`/server`):** Node.js, Express, TypeScript, Mongoose, Zod, Multer, Cloudinary, Bcrypt.
  - Validated Mongoose models: `Cake`, `Category`, `CustomCakeInquiry`, `Order`, `Admin`.
  - Idempotent database seeder (`npm run seed`) populating 14 signature demo cakes.
  - Strict server-side pricing recalculation (client totals are never trusted).
  - Dual-mode image storage (Cloudinary remote streaming + local fallback).
  - Rate limiting, CORS security, centralized error handling, and health-check monitoring.

---

## ⚡ Quick Start

### 1. Prerequisites
- **Node.js**: v18 or newer
- **MongoDB**: Local MongoDB on `mongodb://127.0.0.1:27017` or a free MongoDB Atlas cluster

### 2. Configure Environment Variables

#### Backend (`server/.env`)
Copy `server/.env.example` to `server/.env`:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/deeps_cake_shop
FRONTEND_URL=http://localhost:5173
JWT_SECRET=super_secret_jwt_key_deeps_cake_shop_phase2_replace_in_prod

# Optional Cloudinary (If omitted, uploads save locally in server/uploads/)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

#### Frontend (`.env`)
Copy `.env.example` to `.env`:
```env
VITE_API_BASE_URL=http://localhost:5000/api
```

---

## 🚀 Running the Project

### Terminal 1 — Start the Backend Server
```bash
cd "d:/cake shop/server"
npm install
npm run seed       # Idempotently seeds 14 cakes & categories into MongoDB
npm run dev        # Starts Express server on http://localhost:5000
```

### Terminal 2 — Start the Frontend Application
```bash
cd "d:/cake shop"
npm install
npm run dev        # Starts Vite dev server on http://localhost:5173
```

Now open **http://localhost:5173** in your browser!

---

## 🧪 Testing & Verification

### Run Backend Tests (11 test suites)
```bash
cd "d:/cake shop/server"
npm test
```
Verifies health checks, search filters, category retrieval, custom cake validation, order price recalculation, and delivery tier rules.

### Run Frontend Production Build
```bash
cd "d:/cake shop"
npm run build
```

---

## 📡 Key API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Health status and database connection state |
| `GET` | `/api/cakes` | Search, filter by category/eggless/weight/price, sort, paginate |
| `GET` | `/api/cakes/:id` | Single cake details by slug or MongoDB ID |
| `GET` | `/api/categories` | 7 bakery collection categories with counts |
| `POST` | `/api/custom-cakes` | Multipart custom cake inquiry with reference photo |
| `GET` | `/api/custom-cakes/:referenceId` | Inquiry reference lookup |
| `POST` | `/api/orders` | Server-calculated customer order with idempotency protection |
| `GET` | `/api/orders/:orderId` | Customer order status lookup |
| `POST` | `/api/auth/login` | Admin login (Phase 3 foundation) |
