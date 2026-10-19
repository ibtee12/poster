import path from "path";

export const AUTH_COOKIE_NAME = "poster_admin_token";
export const USER_COOKIE_NAME = "poster_user_token";

export const COOKIE_MAX_AGE_ADMIN = 60 * 60 * 24 * 7; // 7 days
export const COOKIE_MAX_AGE_USER = 60 * 60 * 24 * 30; // 30 days

export const MAX_TEMPLATE_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
export const MAX_IMAGE_UPLOAD_SIZE = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export const ALLOWED_IMAGE_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
] as const;

export const DATA_DIR = path.join(process.cwd(), "data");
export const TEMPLATES_DIR = path.join(DATA_DIR, "templates");
export const POSTERS_DIR = path.join(DATA_DIR, "posters");

export const RATE_LIMITS = {
  POSE_GENERATION: { limit: 10, windowSeconds: 60 },
  REPORTS: { limit: 5, windowSeconds: 600 },
  REMOVE_BG: { limit: 10, windowSeconds: 60 },
  IMAGE_MODERATION: { limit: 30, windowSeconds: 60 },
} as const;

export const DEFAULT_SETTINGS = {
  CLEAN_DOWNLOAD_CREDIT_COST: 0,
  POSE_GENERATION_CREDIT_COST: 10,
  FREE_SIGNUP_CREDITS: 0,
  DAILY_SPENDING_CAP_PER_USER: 100,
  AI_KILL_SWITCH: false,
} as const;
