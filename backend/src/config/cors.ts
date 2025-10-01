import type { CorsOptions } from "cors";
import { env } from "./env";

const origins = env.CORS_ORIGINS.split(",").map(s => s.trim());

export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    if (origins.indexOf(origin) !== -1 || origins.includes("*")) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id", "X-Requested-With"],
  exposedHeaders: ["X-Request-Id"],
};
