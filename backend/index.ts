/**
 * Backend Architecture Entry Point
 * All server-side business logic, controllers, database models, and middlewares
 */

export * from "./db/prisma";
export * from "./middleware/adminAuth";
export * from "./middleware/rateLimit";

// Services
export * as AuthService from "./services/auth.service";
export * as PaymentsService from "./services/payments.service";
export * as CreditsService from "./services/credits.service";
export * as TemplatesService from "./services/templates.service";
export * as PosterStorageService from "./services/posterStorage.service";
export * as ModerationService from "./services/moderation.service";
export * as PoseGeneratorService from "./services/poseGenerator.service";
export * as AnalyticsService from "./services/analytics.service";
export * as WatermarkService from "./services/watermark.service";

// Controllers
export * as AuthController from "./controllers/auth.controller";
export * as AdminController from "./controllers/admin.controller";
export * as CreditsController from "./controllers/credits.controller";
export * as PaymentsController from "./controllers/payments.controller";
export * as PosesController from "./controllers/poses.controller";
export * as PostersController from "./controllers/posters.controller";
export * as TemplatesController from "./controllers/templates.controller";
export * as AnalyticsController from "./controllers/analytics.controller";
export * as SafetyController from "./controllers/safety.controller";
export * as PackagesController from "./controllers/packages.controller";
export * as SettingsController from "./controllers/settings.controller";
export * as ReportsController from "./controllers/reports.controller";
export * as AiController from "./controllers/ai.controller";
