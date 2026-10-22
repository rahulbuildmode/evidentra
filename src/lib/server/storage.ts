import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, get, list, put } from "@vercel/blob";

/**
 * Private key/value file storage shared by every server store (uploads, results, profiles, runs).
 *
 * - Locally: files under `.data/` (or EVIDENTRA_DATA_DIR).
 * - On Vercel with a connected Blob store: a PRIVATE Vercel Blob store, so every serverless
 *   instance sees the same data. Private blobs are not reachable by URL; only this server's token
 *   can read them.
 *
 * Keys are built by the stores from validated ids only (e.g. "uploads/<workspace>/<id>.json").
 */
export interface Storage {
  readonly kind: "local" | "vercel-blob";
  read(key: string): Promise<Buffer | null>;
  write(key: string, data: string | Uint8Array, contentType: string): Promise<void>;
  /** Keys directly or indirectly under `prefix` (which should end with "/"). */
  list(prefix: string): Promise<string[]>;
  remove(keys: string[]): Promise<void>;
}

const SAFE_KEY = /^[a-z0-9-]+(\/[a-z0-9.-]+)*$/;
function check(key: string): string {
  if (!SAFE_KEY.test(key) || key.includes("..")) throw new Error("Invalid storage key");
  return key;
}

export function dataRoot(): string {
  if (process.env.EVIDENTRA_DATA_DIR) return process.env.EVIDENTRA_DATA_DIR;
  if (process.env.VERCEL) return "/tmp/evidentra-data";
  return path.join(process.cwd(), ".data");
}

const local: Storage = {
  kind: "local",
  async read(key) {
    try {
      return await readFile(path.join(dataRoot(), check(key)));
    } catch {
      return null;
    }
  },
  async write(key, data) {
    const f = path.join(dataRoot(), check(key));
    await mkdir(path.dirname(f), { recursive: true });
    await writeFile(f, data);
  },
  async list(prefix) {
    const dir = path.join(dataRoot(), check(prefix.replace(/\/$/, "")));
    try {
      return (await readdir(dir)).map((n) => `${prefix}${n}`);
    } catch {
      return [];
    }
  },
  async remove(keys) {
    await Promise.all(keys.map((k) => rm(path.join(dataRoot(), check(k)), { force: true })));
  },
};

const blob: Storage = {
  kind: "vercel-blob",
  async read(key) {
    const r = await get(check(key), { access: "private", useCache: false }).catch(() => null);
    if (!r || !r.stream) return null;
    return Buffer.from(await new Response(r.stream).arrayBuffer());
  },
  async write(key, data, contentType) {
    await put(check(key), Buffer.from(data), { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType });
  },
  async list(prefix) {
    const out: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: check(prefix.replace(/\/$/, "")) + "/", cursor, limit: 1000 });
      out.push(...page.blobs.map((b) => b.pathname));
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return out;
  },
  async remove(keys) {
    if (keys.length) await del(keys.map(check));
  },
};

/** Vercel Blob when a store is connected (read-write token or store id + OIDC); otherwise local disk. */
export function storage(): Storage {
  return process.env.BLOB_READ_WRITE_TOKEN || (process.env.BLOB_STORE_ID && process.env.VERCEL) ? blob : local;
}

export async function readJson<T>(key: string): Promise<T | null> {
  const b = await storage().read(key);
  if (!b) return null;
  try {
    return JSON.parse(b.toString("utf8")) as T;
  } catch {
    return null;
  }
}

export const writeJson = (key: string, value: unknown) => storage().write(key, JSON.stringify(value), "application/json");
