import { z } from "zod";

const configSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3100),
  HOST: z.string().default("0.0.0.0"),
  THREE_MOK_PUBLIC_URL: z.string().url().default("http://localhost:8080/threemok/"),
  LEGACY_ORIGIN: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().optional(),
  SESSION_SECRET: z.string().min(16).default("local-three-level-omok-session-secret"),
  ENABLE_DEV_AUTH: z.coerce.boolean().default(true),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
});

export type AppConfig = z.infer<typeof configSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return configSchema.parse(env);
}
