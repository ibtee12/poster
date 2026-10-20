# Poster Maker — Backend Architecture & 7-Developer Distribution Plan

---

## 1. Project Folder Structure

```
poster-backend/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── models/
│       ├── ai.prisma
│       ├── assets.prisma
│       ├── audit.prisma
│       ├── billing.prisma
│       ├── content.prisma
│       ├── enums.prisma
│       ├── identity.prisma
│       ├── posters.prisma
│       ├── rbac.prisma
│       └── templates.prisma
├── src/
│   ├── app.ts
│   ├── server.ts
│   ├── config/
│   │   ├── env.ts
│   │   ├── db.ts
│   │   └── cloudinary.ts
│   ├── middleware/
│   │   ├── auth.middleware.ts
│   │   ├── permission.middleware.ts
│   │   ├── validateRequest.middleware.ts
│   │   ├── rateLimit.middleware.ts
│   │   ├── notFound.middleware.ts
│   │   └── error.middleware.ts
│   ├── modules/
│   │   ├── auth/
│   │   ├── user/
│   │   ├── admin/
│   │   ├── rbac/
│   │   ├── category/
│   │   ├── template/
│   │   ├── poster/
│   │   ├── ai/
│   │   ├── upload/
│   │   ├── wallet/
│   │   ├── transaction/
│   │   ├── package/
│   │   ├── subscription/
│   │   ├── payment/
│   │   └── bookmark/
│   ├── routes/
│   │   └── index.ts
│   ├── services/
│   │   └── storage/
│   │       ├── storage.service.ts
│   │       ├── cloudinary.storage.ts
│   │       ├── ImageOptimizer.ts
│   │       ├── ImageValidator.ts
│   │       └── image.types.ts
│   ├── shared/
│   │   ├── errors/
│   │   ├── pagination/
│   │   ├── filters/
│   │   ├── utils/
│   │   └── types/
│   ├── lib/
│   │   └── prisma.ts
│   ├── types/
│   │   └── express.d.ts
│   ├── utils/
│   ├── cronJob/
│   └── workers/
├── .env
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── prisma.config.ts
└── README.md
```

---



## 3. The 7 Developer Assignments (Zero-Conflict Breakdown)

Each developer owns specific folders and files. **No developer ever edits another developer's module folder.**

```
┌────────────────────────────────────────────────────────────────────────┐
│  Dev 1: Core Platform Architect & Shared Middleware                    │
│  (app.ts, server.ts, config/, middleware/, shared/, prisma root)        │
└────────────────────────────────────────────────────────────────────────┘
          │ (Provides base server, errors, and validation wrapper)
          ▼
┌───────────────────┬───────────────────┬───────────────────┬────────────┐
│ Dev 2: Auth & RBAC│ Dev 3: Templates  │ Dev 4: Posters    │ Dev 5: Media│
│ (auth, user, rbac,│ (category,        │ (poster lifecycle,│ (upload,    │
│  admin)           │  template,        │  user projects,   │  cloudinary,│
│                   │  bookmark)        │  downloads)       │  storage)   │
└───────────────────┴───────────────────┴───────────────────┴────────────┘
          │                   │                   │               │
          └───────────────────┼───────────────────┴───────────────┘
                              ▼
┌───────────────────────────────────────┬────────────────────────────────┐
│ Dev 6: Monetization & Billing         │ Dev 7: AI Pipeline & Workers   │
│ (wallet, transaction, package,        │ (ai slogans, pose jobs,        │
│  subscription, payment gateways)      │  moderation, cronJob, workers) │
└───────────────────────────────────────┴────────────────────────────────┘
```

---

### 👤 Developer 1: Core Platform Architect & Shared Infrastructure
*The foundation builder. Sets up the project skeleton on Day 1 so Developers 2–7 have a stable environment.*

* **Directories & Files Owned:**
  - `src/app.ts`, `src/server.ts`
  - `src/config/env.ts`, `src/config/db.ts`
  - `src/lib/prisma.ts`
  - `prisma/schema.prisma`, `prisma/models/enums.prisma`, `prisma/models/audit.prisma`
  - `src/middleware/error.middleware.ts`, `src/middleware/notFound.middleware.ts`
  - `src/middleware/validateRequest.middleware.ts`, `src/middleware/rateLimit.middleware.ts`
  - `src/shared/errors/` (AppError, BadRequest, NotFound, Unauthorized, Forbidden)
  - `src/shared/utils/` (`sendResponse.ts` standard `{ success, statusCode, message, data }`)
  - `src/shared/pagination/`, `src/shared/filters/`
  - `src/routes/index.ts` *(Root router mounting points)*
  - `package.json`, `tsconfig.json`, `.env.example`
* **What they provide to other developers:**
  - Standard response format helper `sendResponse(res, { statusCode, success, message, data })`
  - Global error handler so no developer has to write repetitive `try/catch` JSON responses
  - Zod validation middleware `validateRequest(schema)`
* **AI Prompt to guide their work:**
  > *"I am Developer 1 on a TypeScript + Express + Prisma backend. Generate the root Express application (`app.ts`, `server.ts`), global error handling middleware, Zod request validation middleware, standard API response utility (`sendResponse.ts`), and environment configuration using Zod."*

---

### 👤 Developer 2: Identity, Access & Security (Auth, User & RBAC)
*Responsible for user signup/login, password hashing, JWT/cookie sessions, and role permissions.*

* **Directories & Files Owned:**
  - `prisma/models/identity.prisma` (User, Session, RefreshToken)
  - `prisma/models/rbac.prisma` (Role, Permission, UserRole)
  - `src/middleware/auth.middleware.ts`, `src/middleware/permission.middleware.ts`
  - `src/types/express.d.ts` (Extends `Express.Request` to include `req.user`)
  - `src/modules/auth/` (`auth.controller.ts`, `auth.service.ts`, `auth.route.ts`, `auth.validation.ts`, `auth.types.ts`)
  - `src/modules/user/` (`user.controller.ts`, `user.service.ts`, `user.route.ts`)
  - `src/modules/rbac/` (`rbac.controller.ts`, `rbac.service.ts`, `rbac.route.ts`)
  - `src/modules/admin/` (`admin.controller.ts`, `admin.service.ts`, `admin.route.ts`)
* **What they expect from others:** Dev 1's `validateRequest` and `AppError`.
* **What they deliver to others:**
  - `authMiddleware`: verifies JWT token and injects `req.user = { id, email, role }`.
  - `permissionMiddleware(roles)`: restricts routes to ADMIN, CREATOR, or USER.
* **Key Endpoints:**
  - `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`
  - `GET /api/v1/user/profile`, `PATCH /api/v1/user/profile`
  - `GET /api/v1/admin/users`, `PATCH /api/v1/admin/users/:id/role`
* **AI Prompt to guide their work:**
  > *"I am Developer 2. Build the `auth` and `rbac` module for an Express + TypeScript + Prisma app with JWT tokens, refresh tokens in httpOnly cookies, password hashing with bcrypt, role-based authorization middleware (`auth.middleware.ts`, `permission.middleware.ts`), and Zod validation."*

---

### 👤 Developer 3: Template & Content Catalog Domain
*Responsible for organizing template categories, slot schemas, and bookmarking.*

* **Directories & Files Owned:**
  - `prisma/models/templates.prisma` (Template, Slot, Layout, Variant)
  - `prisma/models/content.prisma` (Category, Tag, Bookmark)
  - `src/modules/category/` (CRUD for categories e.g. Political, Birthday, Eid, Business)
  - `src/modules/template/` (CRUD for templates, layouts, slots, font styling, publication status)
  - `src/modules/bookmark/` (User saving and retrieving favorite templates)
* **What they expect from others:** Dev 2's `authMiddleware` for admin template management and user bookmarking.
* **What they deliver to others:**
  - `GET /api/v1/templates`: List public templates with category filtering, search, and pagination.
  - `GET /api/v1/templates/:id`: Full template configuration (slots, sizes, layouts, font definitions).
* **AI Prompt to guide their work:**
  > *"I am Developer 3. Build the `template`, `category`, and `bookmark` modules in Express + TypeScript + Prisma. Include full CRUD for templates with JSON slot definitions (photo and text slots), search & filtering by category, pagination using Prisma, and user bookmark toggling."*

---

### 👤 Developer 4: Poster Generation & User Project Workspace
*Responsible for user poster instances, draft saves, poster history, and export records.*

* **Directories & Files Owned:**
  - `prisma/models/posters.prisma` (Poster, PosterExport, CleanDownload)
  - `src/modules/poster/` (`poster.controller.ts`, `poster.service.ts`, `poster.route.ts`, `poster.validation.ts`, `poster.types.ts`)
* **What they expect from others:** Dev 2's `authMiddleware` (to get `req.user.id`) and Dev 3's template IDs.
* **What they deliver to others:**
  - Poster project persistence (saving canvas state, layer adjustments, text values, applied photos).
  - User workspace APIs (`GET /api/v1/posters/my-posters`).
  - Poster duplication and export tracking.
* **Key Endpoints:**
  - `POST /api/v1/posters` (Create/Save poster project)
  - `GET /api/v1/posters/my-posters` (List authenticated user's posters)
  - `GET /api/v1/posters/:id` (Get specific poster project)
  - `POST /api/v1/posters/:id/duplicate` (Clone poster)
  - `DELETE /api/v1/posters/:id` (Delete poster)
* **AI Prompt to guide their work:**
  > *"I am Developer 4. Build the `poster` module for a poster creation app in Express + TypeScript + Prisma. Handle creating poster projects linked to a user and a template, updating draft state (text and photo placement coordinates), listing user posters with pagination, duplicating posters, and tracking downloads."*

---

### 👤 Developer 5: Media Processing & Cloud Storage Pipeline
*Responsible for image uploads, Cloudinary integration, file validation, and image optimization.*

* **Directories & Files Owned:**
  - `prisma/models/assets.prisma` (MediaAsset, UploadLog)
  - `src/config/cloudinary.ts`
  - `src/services/storage/` (`storage.service.ts`, `cloudinary.storage.ts`, `ImageOptimizer.ts`, `ImageValidator.ts`, `image.types.ts`)
  - `src/modules/upload/` (`upload.controller.ts`, `upload.service.ts`, `upload.route.ts`, `upload.validation.ts`)
* **What they expect from others:** Dev 1's error classes and Dev 2's `authMiddleware`.
* **What they deliver to others:**
  - `StorageService.uploadFile(buffer, folder)` helper function that Dev 3 (templates) and Dev 4 (posters) can call.
  - `POST /api/v1/upload/single` & `POST /api/v1/upload/multiple` endpoints returning secure CDN URLs.
  - Image validation (magic bytes inspection, file size caps, dimension checks).
* **AI Prompt to guide their work:**
  > *"I am Developer 5. Build the media storage and upload module in Express + TypeScript. Implement Multer memory storage, Cloudinary upload provider, image optimization using Sharp (resizing, format conversion to WebP), mime-type and magic-byte security validator, and single/multiple upload REST endpoints."*

---

### 👤 Developer 6: Monetization Engine (Wallets, Credits, Packages & Payments)
*Responsible for user wallets, credit ledger, packages, and payment gateway integration.*

* **Directories & Files Owned:**
  - `prisma/models/billing.prisma` (Wallet, CreditTransaction, Package, Subscription, Payment)
  - `src/modules/wallet/` (Wallet balance, wallet initialization)
  - `src/modules/transaction/` (Immutable audit ledger for credit additions and deductions)
  - `src/modules/package/` (Credit purchase packages)
  - `src/modules/subscription/` (Monthly/annual pro tiers)
  - `src/modules/payment/` (Gateway adapters: bKash, Nagad, SSLCommerz, Stripe webhooks)
* **What they expect from others:** Dev 2's `authMiddleware` (`req.user.id`).
* **What they deliver to others:**
  - `WalletService.deductCredits(userId: string, amount: number, reason: string): Promise<boolean>`: Crucial function consumed by Dev 7 (AI features) and Dev 4 (HD downloads).
  - Payment initiation and webhook verification endpoints.
* **Key Endpoints:**
  - `GET /api/v1/wallet/balance`, `GET /api/v1/wallet/transactions`
  - `GET /api/v1/packages` (List purchasable packages)
  - `POST /api/v1/payments/create`, `POST /api/v1/payments/verify`, `POST /api/v1/payments/webhook`
* **AI Prompt to guide their work:**
  > *"I am Developer 6. Build the financial billing, wallet, credit ledger, and payment module for an Express + TypeScript + Prisma app. Include atomic database transactions for deducting and adding credits, payment gateway adapters (bKash, SSLCommerz, Stripe webhook verification), and balance query endpoints."*

---

### 👤 Developer 7: AI Intelligence, Pose Engine, Moderation & Async Workers
*Responsible for slogan generation, AI pose background jobs, image safety moderation, and cron cleanup.*

* **Directories & Files Owned:**
  - `prisma/models/ai.prisma` (PoseJob, SloganLog, ModerationLog)
  - `src/modules/ai/`
    - Slogan suggestions (`POST /api/v1/ai/slogans` via Gemini 3.5 Flash Lite)
    - Background removal fallback (`POST /api/v1/ai/remove-bg`)
    - AI Pose generation jobs (`POST /api/v1/ai/poses/generate`)
    - Content moderation check
  - `src/workers/` (Async background queue processor for heavy image generation jobs)
  - `src/cronJob/` (Scheduled cleanups: expire old unpaid jobs, clean temp files)
* **What they expect from others:**
  - Dev 6's `WalletService.deductCredits()` (to charge credits for AI generation).
  - Dev 5's `StorageService` (to upload AI-generated pose outputs).
* **What they deliver to others:**
  - Real-time slogan suggestions endpoint (debounced, fast ~400ms responses).
  - Async pose job status polling endpoint (`GET /api/v1/ai/poses/jobs/:id`).
* **AI Prompt to guide their work:**
  > *"I am Developer 7. Build the AI module and background worker service in Express + TypeScript. Implement Google Gemini API integration for Bengali slogan suggestions, a job queue/worker model for async image pose generation (with status polling: pending, processing, completed, failed), image safety moderation, and credit deduction on completion."*

---



4. **Shared Route Mounter:**
   - In `src/routes/index.ts`, Dev 1 sets up one clean mounting line per module:
     ```typescript
     router.use("/auth", authRoutes);
     router.use("/templates", templateRoutes);
     router.use("/posters", posterRoutes);
     router.use("/upload", uploadRoutes);
     router.use("/wallet", walletRoutes);
     router.use("/ai", aiRoutes);
     ```
   Nobody touches `src/routes/index.ts` except to add their one line when their module is complete.
