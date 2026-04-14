// Temporary fixture for dogfooding stephengeller/tsdoc-enforcer-action@v1.
// Remove this file after the Action's behaviour is observed on the PR.

export function pluralize(word: string, count: number): string {
  return count === 1 ? word : `${word}s`;
}

export interface CommentStats {
  total: number;
  byKind: Record<string, number>;
}

export type Severity = "info" | "warn" | "error";

export class RateBucket {
  constructor(private readonly capacity: number) {}

  fits(n: number): boolean {
    return n <= this.capacity;
  }
}
