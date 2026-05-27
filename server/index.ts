import "dotenv/config";
import cluster from "node:cluster";
import os from "node:os";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import authRouter, { authLimiter } from "./auth";
import { initializeDatabase, pool } from "./db";
import * as fs from "fs";
import * as path from "path";

const isProduction = process.env.NODE_ENV === "production";
const log = console.log;

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

if (isProduction && cluster.isPrimary) {
  // Master process: initialize DB once, then fork workers
  (async () => {
    await initializeDatabase();

    const numWorkers = Math.min(os.cpus().length, 4);
    log(`Master ${process.pid}: DB initialized, starting ${numWorkers} workers`);

    for (let i = 0; i < numWorkers; i++) {
      cluster.fork();
    }

    cluster.on("exit", (worker, code) => {
      log(`Worker ${worker.process.pid} exited (code ${code}). Restarting...`);
      cluster.fork();
    });
  })();
} else {
  // Worker process (production) or single process (development)
  startServer();
}

async function startServer() {
  if (!isProduction) {
    await initializeDatabase();
  }

  const app = express();
  app.set("trust proxy", 1);
  const PgSession = connectPgSimple(session);

  function setupCors(app: express.Application) {
    app.use((req, res, next) => {
      const origins = new Set<string>();

      if (process.env.EXPO_PUBLIC_DOMAIN) {
        origins.add(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);
      }

      const origin = req.header("origin");

      // Localhost origins are only honored in development. In production a
      // malicious local app served on http://localhost:* could otherwise
      // ride the user's logged-in session against the API.
      const isLocalhost =
        !isProduction &&
        (origin?.startsWith("http://localhost:") ||
          origin?.startsWith("http://127.0.0.1:"));

      if (origin && (origins.has(origin) || isLocalhost)) {
        res.header("Access-Control-Allow-Origin", origin);
        res.header(
          "Access-Control-Allow-Methods",
          "GET, POST, PUT, DELETE, OPTIONS",
        );
        res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
        res.header("Access-Control-Allow-Credentials", "true");
      }

      if (req.method === "OPTIONS") {
        return res.sendStatus(200);
      }

      next();
    });
  }

  function setupBodyParsing(app: express.Application) {
    app.use(
      express.json({
        limit: '10mb',
        verify: (req, _res, buf) => {
          req.rawBody = buf;
        },
      }),
    );

    app.use(express.urlencoded({ extended: false, limit: '10mb' }));
  }

  function setupRequestLogging(app: express.Application) {
    app.use((req, res, next) => {
      const start = Date.now();
      const path = req.path;
      let capturedJsonResponse: Record<string, unknown> | undefined = undefined;

      const originalResJson = res.json;
      res.json = function (bodyJson, ...args) {
        capturedJsonResponse = bodyJson;
        return originalResJson.apply(res, [bodyJson, ...args]);
      };

      res.on("finish", () => {
        if (!path.startsWith("/api")) return;

        const duration = Date.now() - start;

        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }

        if (logLine.length > 80) {
          logLine = logLine.slice(0, 79) + "…";
        }

        log(logLine);
      });

      next();
    });
  }

  function serveExpoManifest(platform: string, res: Response) {
    const manifestPath = path.resolve(
      process.cwd(),
      "static-build",
      platform,
      "manifest.json",
    );

    if (!fs.existsSync(manifestPath)) {
      return res
        .status(404)
        .json({ error: `Manifest not found for platform: ${platform}` });
    }

    res.setHeader("expo-protocol-version", "1");
    res.setHeader("expo-sfv-version", "0");
    res.setHeader("content-type", "application/json");

    const manifest = fs.readFileSync(manifestPath, "utf-8");
    res.send(manifest);
  }

  function configureExpo(app: express.Application) {
    log("Serving static Expo files with dynamic manifest routing");

    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith("/api")) {
        return next();
      }

      if (req.path !== "/" && req.path !== "/manifest") {
        return next();
      }

      const platform = req.header("expo-platform");
      if (platform && (platform === "ios" || platform === "android")) {
        return serveExpoManifest(platform, res);
      }

      next();
    });

    app.use("/assets", express.static(path.resolve(process.cwd(), "assets")));
    app.use(express.static(path.resolve(process.cwd(), "static-build")));

    log("Expo routing: Checking expo-platform header on / and /manifest");
  }

  function setupErrorHandler(app: express.Application) {
    app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
      const error = err as {
        status?: number;
        statusCode?: number;
        message?: string;
      };

      const status = error.status || error.statusCode || 500;
      const message = error.message || "Internal Server Error";

      console.error("Internal Server Error:", err);

      if (res.headersSent) {
        return next(err);
      }

      return res.status(status).json({ message });
    });
  }

  // Security headers. CSP applies to the Expo web bundle served from
  // static-build/; the native mobile clients ignore it. Each host below is
  // pinned to something the client actually loads — no `https:` or `wss:`
  // wildcards, no `unsafe-eval`.
  const cspDirectives: Record<string, Iterable<string>> = {
    defaultSrc: ["'self'"],
    // React Native Web injects inline <style> tags via StyleSheet.create at
    // runtime; the Expo web bootstrap loads its bundle with an inline script.
    // unsafe-inline is required for both until we wire up nonces.
    styleSrc: [
      "'self'",
      "'unsafe-inline'",
      "https://fonts.googleapis.com",
      "https://unpkg.com", // Leaflet CSS, loaded on the web run-tracker map
    ],
    fontSrc: ["'self'", "https://fonts.gstatic.com"],
    imgSrc: [
      "'self'",
      "data:", // Base64 post/food/avatar images served inline
      "blob:", // Image-picker previews
      "https://*.basemaps.cartocdn.com", // Map tiles
      "https://unpkg.com", // Leaflet's CSS references marker icons here
    ],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    connectSrc: [
      "'self'",
      "https://world.openfoodfacts.org", // Barcode lookups
    ],
    // Defense-in-depth (most are helmet defaults; setting explicitly so the
    // policy is self-documenting and won't drift if helmet defaults change).
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    frameAncestors: ["'none'"],
    formAction: ["'self'"],
    upgradeInsecureRequests: [],
  };

  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: cspDirectives,
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }));

  // General API rate limiter (100 requests per minute)
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    message: { error: "Too many requests. Please slow down." },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use("/api", apiLimiter);

  setupCors(app);
  setupBodyParsing(app);

  app.use(session({
    store: new PgSession({
      pool,
      tableName: "session",
    }),
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
    },
  }));

  setupRequestLogging(app);

  app.use("/api/auth", authRouter);

  configureExpo(app);

  const server = await registerRoutes(app);

  setupErrorHandler(app);

  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(port, "0.0.0.0", () => {
    const pid = process.pid;
    if (isProduction) {
      log(`Worker ${pid}: express server on port ${port}`);
    } else {
      log(`express server serving on port ${port}`);
    }
  });
}
