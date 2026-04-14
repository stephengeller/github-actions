// Placeholder — implemented in Phase 2.
import type { ChangedFile } from "./types";

export async function getChangedTypeScriptFiles(_args: {
  token: string;
  owner: string;
  repo: string;
  prNumber: number;
}): Promise<ChangedFile[]> {
  throw new Error("getChangedTypeScriptFiles not implemented (Phase 2)");
}
