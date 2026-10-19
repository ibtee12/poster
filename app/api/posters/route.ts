import {
  getUserPostersController,
  createPosterController,
} from "@/backend/controllers/posters.controller";

export const GET = getUserPostersController;
export const POST = createPosterController;
