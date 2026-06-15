import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  NEXT_PUBLIC_BASE_URL: z.string().url(),
  LAUNCH_COUNTY: z.string().default("travis-tx"),
  ADMIN_PASSWORD: z.string().min(1),
  DEPLOY_SECRET: z.string().min(1),
  DEADLINE_PASSED: z.coerce.boolean().default(false),
});

// Only validate on server — client components won't have all vars
export function getServerConfig() {
  return envSchema.parse(process.env);
}

export const LAUNCH_COUNTY = process.env.LAUNCH_COUNTY ?? "travis-tx";
export const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://housedata.us";
export const DEADLINE_PASSED = process.env.DEADLINE_PASSED === "true";
