# Refactor Status & Notes

## Completed Cleanups
All temporary bridges, compatibility re-exports, and deprecated shims have been cleanly removed:
- [x] Removed adminAuth re-exports (`AUTH_COOKIE_NAME`, `getExpectedToken`, `verifyAuthToken`) from `backend/services/auth.service.ts`.
- [x] Removed backwards-compatibility `getCurrentUser(reqOrToken)` helper from `backend/services/auth.service.ts`; all routes use standard `withUser`, `withOptionalUser`, and `withUserOrAdmin` wrappers.
- [x] Deleted obsolete root-level barrel file `lib/auth.ts`.
- [x] Deleted obsolete root-level barrel file `lib/auth-edge.ts`.
- [x] Deleted obsolete root-level barrel file `lib/adminAuth.ts`.
- [x] Removed package controller re-exports from `backend/controllers/admin.controller.ts`; routes import directly from `@/backend/controllers/admin.packages.controller`.
- [x] All 14 API route groups under `app/api/**/route.ts` are composed one-liners with `handle(...)` and standard middlewares.

---

## Future Deployment Architecture Notes

### 1. Rate Limiting Multi-Instance Scaling
- **In-memory rate limiter (`backend/middleware/rateLimit.ts`)**:
  - The current rate limiter uses an in-memory `Map` store (`InMemoryRateLimiter`).
  - When deployed across multiple server instances or serverless containers, rate limiting state is not shared between processes.
  - *Action*: Replace with a distributed shared store (e.g. Redis / Upstash Redis) when deploying to multi-instance environments.
