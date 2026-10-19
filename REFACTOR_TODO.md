# Refactor TODO List

This file tracks temporary bridges, compatibility re-exports, and deprecated shims that are preserved during domain-by-domain migration and must be removed or cleaned up in the final pass.

---

## Temporary Re-exports & Shims to Remove at the End

### 1. `backend/services/auth.service.ts`
- **Re-exports from `../middleware/adminAuth`**:
  ```ts
  export { AUTH_COOKIE_NAME, getExpectedToken, verifyAuthToken } from "../middleware/adminAuth";
  ```
  *Reason*: Legacy controllers/services imported admin auth from `auth.service`. Remove once all admin domain calls import directly from `@/backend/middleware/adminAuth`.
- **Backward-compatibility `getCurrentUser(reqOrToken)` helper**:
  ```ts
  export async function getCurrentUser(reqOrToken?: Request | string | null)
  ```
  *Reason*: Temporary shim for unmigrated controllers (`posters`, `poses`, `payments`, `reports`, `credits`). Remove once all controllers use `withUser` or `withOptionalUser` wrappers and receive `ctx.user`.

### 2. `lib/auth.ts`
- **Root-level barrel file**:
  ```ts
  export * from "@/backend/services/auth.service";
  ```
  *Reason*: Frontend/API legacy imports from `@/lib/auth`. Update legacy callers to import from `@/backend/services/auth.service` or `@/backend/middleware/auth`, then delete.

### 3. `lib/auth-edge.ts`
- **Root-level barrel file**:
  ```ts
  export * from "@/backend/middleware/adminAuth";
  ```
  *Reason*: Middleware/edge legacy imports from `@/lib/auth-edge`. Update callers to `@/backend/middleware/adminAuth`, then delete.

### 4. `backend/controllers/admin.controller.ts`
- **Re-exports from `./admin.packages.controller`**:
  ```ts
  export {
    createAdminPackageController,
    updateAdminPackageController,
    deleteAdminPackageController,
  } from "./admin.packages.controller";
  ```
  *Reason*: Legacy routes/callers that import from `admin.controller`. Remove once all callers import directly from `admin.packages.controller`.

### 5. `backend/index.ts`
- **Central export aggregator**:
  *Reason*: Legacy barrel export file. Review usage across project at the end to ensure direct imports from specific domain modules, then eliminate if unused.

