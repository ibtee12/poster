import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string({ message: "Email and password are required." })
    .min(1, "Email and password are required."),
  password: z
    .string({ message: "Email and password are required." })
    .min(1, "Email and password are required."),
});

export const signupSchema = z.object({
  email: z
    .string({ message: "Please enter a valid email address." })
    .refine((val) => val.includes("@"), {
      message: "Please enter a valid email address.",
    }),
  password: z
    .string({ message: "Password must be at least 6 characters long." })
    .min(6, "Password must be at least 6 characters long."),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
