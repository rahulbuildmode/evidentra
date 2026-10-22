import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { storage } from "@/lib/server/storage";

let dir = "";
const saved = { ...process.env };
beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "evidentra-storage-"));
  process.env.EVIDENTRA_DATA_DIR = dir;
  delete process.env.BLOB_READ_WRITE_TOKEN;
});
afterAll(async () => {
  process.env = { ...saved };
  await rm(dir, { recursive: true, force: true });
});

describe("storage", () => {
  it("uses local files without a Blob store and the private Blob store when one is connected", () => {
    expect(storage().kind).toBe("local");
    process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_test";
    expect(storage().kind).toBe("vercel-blob");
    delete process.env.BLOB_READ_WRITE_TOKEN;
  });

  it("writes, lists, reads and removes by key", async () => {
    const s = storage();
    await s.write("uploads/ws-a/doc-1.json", '{"x":1}', "application/json");
    expect(await s.list("uploads/ws-a/")).toEqual(["uploads/ws-a/doc-1.json"]);
    expect((await s.read("uploads/ws-a/doc-1.json"))?.toString()).toBe('{"x":1}');
    expect(await s.list("uploads/ws-b/")).toEqual([]);
    await s.remove(["uploads/ws-a/doc-1.json"]);
    expect(await s.read("uploads/ws-a/doc-1.json")).toBeNull();
  });

  it("refuses keys that could escape the storage folder", async () => {
    await expect(storage().write("../etc/passwd", "x", "text/plain")).rejects.toThrow(/Invalid storage key/);
    await expect(storage().write("uploads/WS/../x", "x", "text/plain")).rejects.toThrow(/Invalid storage key/);
  });
});
