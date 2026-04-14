import Anthropic from "@anthropic-ai/sdk";
import * as core from "@actions/core";

import type { Violation } from "./types";
import { SYSTEM_PROMPT, buildUserMessage } from "./prompt";

const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 1024;

/**
 * Asks Claude to produce a TSDoc block for a single undocumented symbol.
 *
 * The returned string is the raw doc block starting with `/**` and ending
 * with `*\/`, ready to paste directly above the symbol with no further
 * post-processing.
 */
export async function generateTsDoc(args: {
  apiKey: string;
  violation: Violation;
}): Promise<string> {
  const { apiKey, violation } = args;
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: buildUserMessage(violation),
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text content");
  }

  const raw = textBlock.text.trim();
  const block = extractDocBlock(raw);
  if (!block) {
    core.warning(
      `Claude output didn't contain a valid TSDoc block for ${violation.symbolName}; using raw output.`,
    );
    return raw;
  }
  return block;
}

/**
 * Finds the first `/** ... *\/` block in the model output. Guards against
 * the model adding chatty preamble like "Here is the TSDoc:".
 */
function extractDocBlock(text: string): string | undefined {
  const match = text.match(/\/\*\*[\s\S]*?\*\//);
  return match?.[0];
}
