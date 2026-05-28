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
      const reqPath = req.path;

      // Never log successful response bodies — they can contain JWTs,
      // session-bearing user objects, emails, and other PII. On error
      // responses, capture only the top-level error/message string for
      // diagnostics (truncated, and only if it's a primitive string —
      // never a nested object).
      let capturedErrorMessage: string | undefined;
      const originalResJson = res.json;
      res.json = function (bodyJson, ...args) {
        if (
          res.statusCode >= 400 &&
          bodyJson !== null &&
          typeof bodyJson === "object"
        ) {
          const body = bodyJson as Record<string, unknown>;
          const candidate = body.error ?? body.message;
          if (typeof candidate === "string") {
            // Strip control chars (newlines, ANSI escapes, NUL) so a thrown
            // error whose message echoes user input can't inject fake log
            // lines or break terminal display.
            const sanitized = candidate.replace(/[\x00-\x1F\x7F]/g, " ");
            capturedErrorMessage = sanitized.length > 200
              ? sanitized.slice(0, 199) + "…"
              : sanitized;
          }
        }
        return originalResJson.apply(res, [bodyJson, ...args]);
      };

      res.on("finish", () => {
        if (!reqPath.startsWith("/api")) return;
        const duration = Date.now() - start;
        let logLine = `${req.method} ${reqPath} ${res.statusCode} in ${duration}ms`;
        if (capturedErrorMessage) {
          logLine += ` :: ${capturedErrorMessage}`;
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

    // PWA manifest — declared in code so the brand color stays in sync
    // and the icon URL points at the already-served /assets path (no
    // build-time copy step). Lets browsers offer "install" / "Add to
    // Home Screen" with a real app icon instead of a screenshot stub.
    app.get("/manifest.webmanifest", (_req: Request, res: Response) => {
      res.setHeader("content-type", "application/manifest+json");
      res.json({
        // `name` is what Chrome / Android show in the install dialog and
        // in the long-form app label. `short_name` is what Android shows
        // under the icon on the home screen (truncated otherwise).
        name: "Gbolo Fitness & Nutrition",
        short_name: "Gbolo",
        description:
          "Track workouts, runs, and food with AI-powered macro estimation.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#1B3A27",
        theme_color: "#1B3A27",
        icons: [
          {
            src: "/assets/images/icon.png",
            sizes: "192x192 512x512 1024x1024",
            type: "image/png",
            // Just "any" — the source icon wasn't designed with a maskable
            // safe zone, so declaring it maskable would let Android crop
            // the logo. Browsers downscale the 1024×1024 source for each
            // declared size at install time.
            purpose: "any",
          },
        ],
      });
    });

    // Minimal no-op service worker. Chrome's installability heuristic
    // requires one to be present + activated even if it doesn't cache
    // anything. A future iteration can add an offline shell.
    app.get("/sw.js", (_req: Request, res: Response) => {
      res.setHeader("content-type", "application/javascript");
      res.setHeader("cache-control", "no-cache");
      res.send(
        "self.addEventListener('install',()=>self.skipWaiting());" +
          "self.addEventListener('activate',(e)=>e.waitUntil(self.clients.claim()));" +
          "self.addEventListener('fetch',()=>{});",
      );
    });
    // static-build/ holds native OTA bundles (manifests served above);
    // dist/ holds the Expo web export (built by `npm run web:build`).
    // index:false on both so "/" falls through to the SPA fallback for
    // SEO meta injection rather than getting served as raw HTML.
    app.use(express.static(path.resolve(process.cwd(), "static-build"), { index: false }));
    app.use(express.static(path.resolve(process.cwd(), "dist"), { index: false }));

    // SPA fallback with SEO meta injection. React Navigation's web linking
    // maps URLs like /community, /profile/settings, /posts/42 to in-app
    // routes — but on a hard refresh (or shared link), the browser GETs
    // that path directly. We serve the SPA shell so the client-side router
    // can take over, and inject route-specific <title> / og:* meta so
    // social-share previews and search-crawler snapshots are sensible.
    // The Expo web export writes index.html to dist/. If the build hasn't
    // run yet, the SPA fallback short-circuits (next() → 404) so requests
    // surface as obvious deploy errors rather than empty HTML.
    const indexHtmlPath = path.resolve(process.cwd(), "dist", "index.html");
    let cachedIndexHtml: string | null = null;

    function loadIndexHtml(): string | null {
      if (cachedIndexHtml !== null) return cachedIndexHtml;
      if (!fs.existsSync(indexHtmlPath)) return null;
      cachedIndexHtml = fs.readFileSync(indexHtmlPath, "utf-8");
      return cachedIndexHtml;
    }

    function escapeHtml(s: string): string {
      return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    interface MetaTags {
      title: string;
      description: string;
      ogImage: string;
    }

    const DEFAULT_META: MetaTags = {
      title: "Gbolo Fitness and Nutrition",
      description:
        "Track workouts, runs, and food with AI-powered macro estimation from a single photo.",
      // Path-only — converted to an absolute URL per request so social-share
      // crawlers (FB/Twitter/LinkedIn) can fetch it (relative paths fail
      // silently in those scrapers). Swap to a dedicated 1200×630 og-image
      // file when you have one; the app icon is just a working fallback.
      ogImage: "/assets/images/icon.png",
    };

    function absoluteUrl(req: Request, pathOnly: string): string {
      const envDomain = process.env.EXPO_PUBLIC_DOMAIN;
      if (envDomain) {
        const base = envDomain.startsWith("http") ? envDomain : `https://${envDomain}`;
        return `${base.replace(/\/$/, "")}${pathOnly}`;
      }
      // Local dev fallback. Host is client-supplied but this is only used
      // for SEO meta values, not for security decisions.
      const proto = req.secure ? "https" : "http";
      const host = req.get("host") ?? "localhost";
      return `${proto}://${host}${pathOnly}`;
    }

    // Keep in sync with public routes in client/navigation/linking.ts.
    // The root URL "/" inherits DEFAULT_META (Gbolo branding) — no entry
    // needed. Private (auth-only) routes also inherit defaults; those URLs
    // aren't crawled or shared, so per-page meta is wasted effort there.
    const PUBLIC_PAGE_META: Record<string, Partial<MetaTags>> = {
      "/login": { title: "Sign in · Gbolo" },
      "/register": { title: "Create your Gbolo account" },
      "/forgot-password": { title: "Reset your password · Gbolo" },
      "/reset-password": { title: "Reset your password · Gbolo" },
    };

    function injectMeta(html: string, req: Request): string {
      const urlPath = req.path;
      const meta: MetaTags = { ...DEFAULT_META, ...(PUBLIC_PAGE_META[urlPath] ?? {}) };
      const ogImageAbsolute = absoluteUrl(req, meta.ogImage);
      const tags = [
        `<title>${escapeHtml(meta.title)}</title>`,
        `<meta name="description" content="${escapeHtml(meta.description)}" />`,
        `<meta property="og:title" content="${escapeHtml(meta.title)}" />`,
        `<meta property="og:description" content="${escapeHtml(meta.description)}" />`,
        `<meta property="og:image" content="${escapeHtml(ogImageAbsolute)}" />`,
        `<meta property="og:type" content="website" />`,
        `<meta name="twitter:card" content="summary_large_image" />`,
        `<meta name="twitter:title" content="${escapeHtml(meta.title)}" />`,
        `<meta name="twitter:description" content="${escapeHtml(meta.description)}" />`,
        `<meta name="twitter:image" content="${escapeHtml(ogImageAbsolute)}" />`,
        // PWA install + iOS "Add to Home Screen" support. Without
        // apple-touch-icon, iOS uses an ugly screenshot of the page as
        // the home-screen icon; with it, the proper brand icon is used.
        // apple-mobile-web-app-capable opens the saved app in full-screen
        // (no Safari chrome) once added.
        `<link rel="manifest" href="/manifest.webmanifest" />`,
        `<meta name="theme-color" content="#1B3A27" />`,
        `<link rel="apple-touch-icon" href="/assets/images/icon.png" />`,
        `<meta name="apple-mobile-web-app-capable" content="yes" />`,
        `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />`,
        // iOS uses this as the default name in the Add-to-Home-Screen
        // dialog and as the label under the icon (truncated to fit).
        // Ampersand escaped for valid HTML; iOS renders it as "&".
        `<meta name="apple-mobile-web-app-title" content="Gbolo Fitness &amp; Nutrition" />`,
        // Register the no-op SW so Chrome's install-banner heuristic
        // activates. Errors are swallowed — install is a nice-to-have.
        `<script>if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})}</script>`,
      ].join("\n    ");
      // Strip any default <title> from the bundle, then inject our block
      // just before </head>.
      return html
        .replace(/<title>[^<]*<\/title>/i, "")
        .replace(/<\/head>/i, `    ${tags}\n  </head>`);
    }

    app.get(/^\/(?!api|assets|manifest).*/, (req: Request, res: Response, next: NextFunction) => {
      // Only intercept browser navigations (Accept: text/html). Asset 404s
      // for the native-client paths should still surface as 404s.
      if (!req.accepts("html")) return next();
      const html = loadIndexHtml();
      if (!html) return next();
      res.type("html").send(injectMeta(html, req));
    });

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
    scriptSrc: [
      "'self'",
      "'unsafe-inline'",
      // expo-camera's web build lazy-loads jsQR from jsDelivr for barcode
      // decoding. The worker (see workerSrc below) also importScripts() it.
      "https://cdn.jsdelivr.net",
    ],
    // Reanimated 4's web worklet runtime spawns a worker from a blob: URL
    // generated client-side. Helmet defaults don't declare worker-src, so
    // the browser falls back to script-src (which doesn't allow blob:) and
    // blocks the worker. blob: is same-origin in practice (only our own JS
    // can create one), so allowing it here is safe.
    workerSrc: ["'self'", "blob:"],
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
