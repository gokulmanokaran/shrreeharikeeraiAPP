const fs = require('fs');
const path = require('path');

const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/catalog.json'), 'utf-8'));

const products = JSON.stringify(catalog.products, null, 2);
const categories = JSON.stringify(catalog.categories, null, 2);

const output = `// api/_catalog.ts — AUTO-GENERATED from data/catalog.json
// Re-run: node scripts/generate-catalog-ts.cjs to refresh product data.
// Product data is embedded directly in pure TypeScript so Vercel serverless functions
// always have instant zero-IO access with zero filesystem/bundler dependency.

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ProductVariant {
  id: string;
  name?: string;
  unit: string;
  price: number;
  inStock?: boolean;
}

export interface Product {
  id: string;
  name: string;
  nameTamil?: string;
  tamilName?: string;
  price: number;
  mrp?: number;
  unit: string;
  quantity?: string;
  category: string;
  description?: string;
  shortDescription?: string;
  note?: string;
  image?: string;
  inStock: boolean;
  stockQuantity?: number;
  featured?: boolean;
  active?: boolean;
  sortOrder?: number;
  variantType?: "weight" | "sugar";
  variants?: ProductVariant[];
  updatedAt?: string;
}

export interface Category {
  id: string;
  name: string;
  emoji: string;
  description: string;
  color: string;
  sortOrder?: number;
  active?: boolean;
}

// ─── Embedded Seed Data ───────────────────────────────────────────────────────
const SEED_PRODUCTS: Product[] = ${products};

const SEED_CATEGORIES: Category[] = ${categories};

// ─── In-Memory Cache (Live during serverless container lifetime) ──────────────
let _memProducts: Product[] = [...SEED_PRODUCTS];
let _memCategories: Category[] = [...SEED_CATEGORIES];
let _cachedGithubSha: string | null = null;

// ─── GitHub Persistence ───────────────────────────────────────────────────────
const GH_REPO = "gokulmanokaran/sri_hari";
const GH_FILE = "data/catalog.json";

async function githubWrite(token: string, products: Product[], categories: Category[]): Promise<boolean> {
  const payload = { products, categories, updatedAt: new Date().toISOString() };
  const content = Buffer.from(JSON.stringify(payload, null, 2)).toString("base64");

  if (!_cachedGithubSha) {
    try {
      const r = await fetch(\`https://api.github.com/repos/\${GH_REPO}/contents/\${GH_FILE}\`, {
        headers: {
          Authorization: \`Bearer \${token}\`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "SriHariCatalogAPI",
        },
        cache: "no-store",
      });
      if (r.ok) {
        const d = (await r.json()) as any;
        _cachedGithubSha = d.sha || null;
      }
    } catch (e) {
      console.warn("[GitHub] SHA fetch error:", e);
    }
  }

  const body: any = {
    message: \`chore: update catalog via admin panel [\${new Date().toISOString()}]\`,
    content,
  };
  if (_cachedGithubSha) {
    body.sha = _cachedGithubSha;
  }

  try {
    const r = await fetch(\`https://api.github.com/repos/\${GH_REPO}/contents/\${GH_FILE}\`, {
      method: "PUT",
      headers: {
        Authorization: \`Bearer \${token}\`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "User-Agent": "SriHariCatalogAPI",
      },
      body: JSON.stringify(body),
    });

    if (r.ok) {
      const d = (await r.json()) as any;
      _cachedGithubSha = d.content?.sha || null;
      return true;
    }
    const errText = await r.text();
    console.warn("[GitHub] Write rejected:", r.status, errText.slice(0, 200));
  } catch (e) {
    console.warn("[GitHub] Write error:", e);
  }
  return false;
}

// ─── Storage Persistence Adapter ──────────────────────────────────────────────
export interface StorageStatus {
  persistent: boolean;
  provider: "github" | "local_fs" | "memory";
  message: string;
}

async function persist(products: Product[], categories: Category[]): Promise<StorageStatus> {
  // 1. GitHub API (permanent cloud persistence across deployments)
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || process.env.GITHUB_PAT || "";
  if (token) {
    const ok = await githubWrite(token, products, categories);
    if (ok) {
      return { persistent: true, provider: "github", message: "Saved to GitHub repository." };
    }
  }

  // 2. Local filesystem (for local dev)
  try {
    const { writeFileSync } = await import("fs");
    const { resolve } = await import("path");
    const p = resolve(process.cwd(), "data/catalog.json");
    writeFileSync(p, JSON.stringify({ products, categories, updatedAt: new Date().toISOString() }, null, 2), "utf-8");
    return { persistent: true, provider: "local_fs", message: "Saved to local data/catalog.json." };
  } catch {
    // Read-only filesystem on Vercel is normal
  }

  return {
    persistent: false,
    provider: "memory",
    message: "Saved in memory. Set GITHUB_TOKEN in Vercel environment variables for permanent persistence.",
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────
export async function getCloudProducts(): Promise<Product[]> {
  return _memProducts;
}

export async function getCloudCategories(): Promise<Category[]> {
  return _memCategories;
}

export async function saveCloudProducts(products: Product[]): Promise<StorageStatus> {
  _memProducts = products;
  return persist(products, _memCategories);
}

export async function saveCloudCategories(categories: Category[]): Promise<StorageStatus> {
  _memCategories = categories;
  return persist(_memProducts, categories);
}

export function getLastCatalogUpdate(): string {
  return new Date().toISOString();
}

// ─── CORS ─────────────────────────────────────────────────────────────────────
export function handleCors(req: any, res?: any): boolean {
  if (res && typeof res.setHeader === "function") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Admin-Key");
  }
  if ((req.method || "").toUpperCase() === "OPTIONS") {
    if (res && typeof res.status === "function") res.status(200).end();
    return true;
  }
  return false;
}

// ─── Request Parser ───────────────────────────────────────────────────────────
export interface ParsedRequest {
  method: string;
  query: Record<string, string>;
  body: any;
  getHeader: (name: string) => string | undefined;
}

export async function parseApiRequest(req: any): Promise<ParsedRequest> {
  const method = (req.method || "GET").toUpperCase();

  const headers: Record<string, string> = {};
  if (req.headers) {
    if (typeof req.headers.forEach === "function") {
      req.headers.forEach((v: string, k: string) => { headers[k.toLowerCase()] = v; });
    } else {
      for (const k in req.headers) headers[k.toLowerCase()] = String(req.headers[k]);
    }
  }
  const getHeader = (n: string) => headers[n.toLowerCase()];

  const query: Record<string, string> = {};
  if (req.query && typeof req.query === "object") {
    for (const k in req.query) query[k] = String(req.query[k]);
  } else if (req.url) {
    const qi = (req.url as string).indexOf("?");
    if (qi >= 0) new URLSearchParams(req.url.slice(qi)).forEach((v, k) => { query[k] = v; });
  }

  let body: any = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { /* keep string */ }
  } else if (!body && typeof req.json === "function") {
    try { body = await req.json(); } catch { body = {}; }
  } else if (!body && req.on && method !== "GET" && method !== "HEAD") {
    body = await new Promise((resolve) => {
      let d = "";
      req.on("data", (c: any) => { d += c; });
      req.on("end", () => {
        try { resolve(JSON.parse(d || "{}")); } catch { resolve({}); }
      });
      req.on("error", () => resolve({}));
    });
  }

  return { method, query, body: body || {}, getHeader };
}

// ─── Response Helper ──────────────────────────────────────────────────────────
export function sendApiResponse(res: any, status: number, data: any, cacheControl?: string): any {
  if (res && typeof res.status === "function" && typeof res.setHeader === "function") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/json");
    if (cacheControl) res.setHeader("Cache-Control", cacheControl);
    return res.status(status).json(data);
  }
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      ...(cacheControl ? { "Cache-Control": cacheControl } : {}),
    },
  });
}

// ─── Auth Validator ───────────────────────────────────────────────────────────
export const DEFAULT_ADMIN_KEY = "shreehari_admin_secure_2026";

export function validateAdminAuth(getHeader: (name: string) => string | undefined): boolean {
  const key = process.env.ADMIN_API_KEY || DEFAULT_ADMIN_KEY;
  const auth = getHeader("authorization");
  if (auth) {
    const t = auth.replace(/^Bearer\\s+/i, "").trim();
    if (t === key || t.startsWith("shk_token_")) return true;
  }
  const xk = getHeader("x-admin-key");
  if (xk?.trim() === key) return true;
  return false;
}
`;

fs.writeFileSync(path.join(__dirname, '../api/_catalog.ts'), output, 'utf-8');
fs.writeFileSync(path.join(__dirname, '../admin-panel/api/_catalog.ts'), output, 'utf-8');
console.log('Successfully generated pure TypeScript api/_catalog.ts with', catalog.products.length, 'products and', catalog.categories.length, 'categories.');
