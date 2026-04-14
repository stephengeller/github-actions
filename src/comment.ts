// Placeholder — implemented in Phase 5.
import type { EnrichedViolation } from "./types";

export async function upsertPrComment(_args: {
  token: string;
  owner: string;
  repo: string;
  prNumber: number;
  violations: EnrichedViolation[];
}): Promise<void> {
  throw new Error("upsertPrComment not implemented (Phase 5)");
}
