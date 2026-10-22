import { AnalysisError } from "./gemini-common";

// Stops double-clicks from starting two paid requests for the same workspace (per server process).
const running = new Set<string>();

export async function runExclusive<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (running.has(key)) throw new AnalysisError("busy", 409, "This analysis is already running for this workspace.");
  running.add(key);
  try {
    return await fn();
  } finally {
    running.delete(key);
  }
}
