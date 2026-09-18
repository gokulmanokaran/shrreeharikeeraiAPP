import { defineConfig, type Plugin, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import fs from "fs";
import { pathToFileURL } from "node:url";


// ── Shared Local Dev API ─────────────────────────────────────────────────────
// Serves /api/products and /api/categories from data/catalog.json
// The admin panel writes to this same file → changes reflect immediately.
// ─────────────────────────────────────────────────────────────────────────────

const CATALOG_FILE = path.resolve(__dirname, "data/catalog.json");

function readCatalog(): { products: unknown[]; categories: unknown[] } {
  try {
    if (fs.existsSync(CATALOG_FILE)) {
      const raw = fs.readFileSync(CATALOG_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      return {
        products: Array.isArray(parsed.products) ? parsed.products : [],
        categories: Array.isArray(parsed.categories) ? parsed.categories : [],
      };
    }
  } catch (e) {
    console.warn("[DevAPI] Could not read data/catalog.json:", e);
  }
  return { products: [], categories: [] };
}

function autoSeedIfEmpty(): void {
  const catalog = readCatalog();
  if (catalog.products.length > 0) return; // already seeded

  console.log("[DevAPI] catalog.json is empty — auto-seeding from _catalog.ts...");
  try {
    // Dynamically require the seed script
    const { execSync } = require("child_process");
    execSync("npx tsx scripts/seed-catalog.ts", {
      cwd: __dirname,
      stdio: "inherit",
    });
    console.log("[DevAPI] ✅ Auto-seed complete.");
  } catch (e) {
    console.warn("[DevAPI] Auto-seed failed:", e);
  }
}

function localDevApiPlugin(): Plugin {
  return {
    name: "sri-hari-local-dev-api",
    configureServer(server) {
      // Auto-seed on startup if catalog.json is missing/empty
      autoSeedIfEmpty();

      server.middlewares.use((req, res, next) => {
        const url = req.url || "";
        const env = loadEnv(server.config.mode, process.cwd(), "");
        for (const [key, value] of Object.entries(env)) {
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
        if (!process.env.SUPABASE_URL) {
          process.env.SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL || "";
        }
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
          process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || "";
        }

        if (url.startsWith("/api/auth/check-email") && (req.method === "POST" || req.method === "OPTIONS")) {
          if (req.method === "OPTIONS") {
            res.statusCode = 200;
            res.end();
            return;
          }
          let rawBody = "";
          req.on("data", (chunk: any) => {
            rawBody += chunk;
          });
          req.on("end", async () => {
            try {
              const body = JSON.parse(rawBody || "{}");
              const targetEmail = String(body?.email || "").trim().toLowerCase();
              if (!targetEmail) {
                res.setHeader("Content-Type", "application/json");
                res.statusCode = 400;
                res.end(JSON.stringify({ exists: false, error: "Email is required" }));
                return;
              }

              const serverModUrl = pathToFileURL(path.resolve(__dirname, "api/_supabase.ts")).href;
              const { getSupabaseServerClient } = (await import(serverModUrl)) as {
                getSupabaseServerClient: () => any;
              };
              const serverClient = getSupabaseServerClient();
              if (!serverClient) {
                res.setHeader("Content-Type", "application/json");
                res.statusCode = 200;
                res.end(JSON.stringify({ exists: false }));
                return;
              }

              const { data } = await serverClient.auth.admin.listUsers();
              const existingUser = (data?.users || []).find(
                (u: any) => u.email?.toLowerCase() === targetEmail
              );

              if (!existingUser) {
                res.setHeader("Content-Type", "application/json");
                res.statusCode = 200;
                res.end(JSON.stringify({ exists: false, isVerified: false }));
                return;
              }

              const isVerified = Boolean(
                existingUser.email_confirmed_at ||
                existingUser.confirmed_at ||
                existingUser.user_metadata?.email_verified === true
              );

              const checkOnly = Boolean(body?.checkOnly || body?.action === "forgot-password");
              if (checkOnly) {
                res.setHeader("Content-Type", "application/json");
                res.statusCode = 200;
                res.end(JSON.stringify({ exists: isVerified, isVerified }));
                return;
              }

              if (isVerified) {
                res.setHeader("Content-Type", "application/json");
                res.statusCode = 200;
                res.end(JSON.stringify({ exists: true, isVerified: true }));
                return;
              }

              // Clean stale unverified signup
              try {
                await serverClient.auth.admin.deleteUser(existingUser.id);
                console.log(`[DevAPI check-email] Cleaned stale unverified user ${existingUser.id}`);
              } catch (delErr: any) {
                console.warn("[DevAPI check-email] Delete failed:", delErr.message);
              }

              res.setHeader("Content-Type", "application/json");
              res.statusCode = 200;
              res.end(JSON.stringify({ exists: false, isVerified: false, wasCleaned: true }));
            } catch (err: any) {
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 200;
              res.end(JSON.stringify({ exists: false, isVerified: false }));
            }
          });
          return;
        }


        // GET /api/products
        if (url.startsWith("/api/products") && req.method === "GET") {
          const catalog = readCatalog();
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "no-store");
          res.statusCode = 200;
          res.end(
            JSON.stringify({
              success: true,
              count: catalog.products.length,
              data: catalog.products,
              source: "local-file",
            })
          );
          return;
        }

        // GET /api/categories
        if (url.startsWith("/api/categories") && req.method === "GET") {
          const catalog = readCatalog();
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "no-store");
          res.statusCode = 200;
          res.end(
            JSON.stringify({
              success: true,
              count: catalog.categories.length,
              data: catalog.categories,
              source: "local-file",
            })
          );
          return;
        }

        // Helper to adapt Node http.ServerResponse for serverless handler compatibility
        const adaptRes = (r: any) => {
          if (!r.status) {
            r.status = function (s: number) {
              this.statusCode = s;
              return this;
            };
          }
          if (!r.json) {
            r.json = function (obj: any) {
              this.setHeader("Content-Type", "application/json");
              this.end(JSON.stringify(obj));
              return this;
            };
          }
          return r;
        };

        // Serverless handlers for payment & order lifecycle
        if (
          url.startsWith("/api/create-razorpay-order") ||
          url.startsWith("/api/verify-razorpay-payment") ||
          url.startsWith("/api/process-payment") ||
          url.startsWith("/api/order-webhook") ||
          url.startsWith("/api/razorpay-webhook")
        ) {
          adaptRes(res);
          (async () => {
            try {
              let handlerMod: any;
              if (url.startsWith("/api/create-razorpay-order")) {
                handlerMod = await import(pathToFileURL(path.resolve(__dirname, "api/create-razorpay-order.ts")).href);
              } else if (url.startsWith("/api/verify-razorpay-payment")) {
                handlerMod = await import(pathToFileURL(path.resolve(__dirname, "api/verify-razorpay-payment.ts")).href);
              } else if (url.startsWith("/api/process-payment")) {
                handlerMod = await import(pathToFileURL(path.resolve(__dirname, "api/process-payment.ts")).href);
              } else if (url.startsWith("/api/order-webhook")) {
                handlerMod = await import(pathToFileURL(path.resolve(__dirname, "api/order-webhook.ts")).href);
              } else if (url.startsWith("/api/razorpay-webhook")) {
                handlerMod = await import(pathToFileURL(path.resolve(__dirname, "api/razorpay-webhook.ts")).href);
              }

              if (handlerMod?.default) {
                await handlerMod.default(req, res);
              } else {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: "Handler not found" }));
              }
            } catch (err: any) {
              console.error("[DevAPI Error]:", err);
              if (!res.headersSent) {
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: err?.message || "Internal error" }));
              }
            }
          })();
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), localDevApiPlugin()],
  server: {
    port: 5173,
    open: false,
  },
  build: {
    target: "es2020",
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/react-router-dom/")
          ) {
            return "vendor-react";
          }
          if (id.includes("node_modules/framer-motion/")) {
            return "vendor-motion";
          }
          if (id.includes("node_modules/lucide-react/")) {
            return "vendor-icons";
          }
          if (id.includes("node_modules/@supabase/")) {
            return "vendor-supabase";
          }
        },
      },
    },

  },
});
