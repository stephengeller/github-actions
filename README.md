# tsdoc-enforcer-action

A GitHub Action that fails pull requests when exported TypeScript symbols are missing or have incomplete [TSDoc](https://tsdoc.org), and posts a single PR comment with AI-generated doc blocks — ready to paste directly above each symbol.

When a violation is found, the comment also includes the **exact prompt** that was used to generate the block, so you can regenerate or tweak it in ChatGPT, Claude.ai, Copilot Chat, or any other AI tool — no tooling lock-in.

---

## What it checks

Only **exported** symbols on changed `.ts` / `.tsx` files in the PR:

| Symbol                                                                   | Required                                                                  |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Exported function / method / class / interface / type alias              | Must have a TSDoc block with a non-empty description                      |
| Function / method with parameters                                        | `@param` for every non-underscore parameter, with a non-empty description |
| Function / method returning anything other than `void` / `Promise<void>` | `@returns` with a non-empty description                                   |

Private / protected methods, non-exported symbols, and parameters whose names start with `_` are intentionally ignored.

Prose _quality_ is **not** graded. `@param id - the id` passes structural checks even though it's useless — that's a scope decision for v0.1.

---

## Usage

### 1. Add the required secret

In your consuming repo, go to **Settings → Secrets and variables → Actions → New repository secret** and add:

- `ANTHROPIC_API_KEY` — a key from https://console.anthropic.com. Used to generate paste-ready TSDoc blocks via `claude-sonnet-4-20250514`. Cost is roughly $0.003 per flagged symbol.

`GITHUB_TOKEN` is provided automatically by GitHub — nothing to configure.

### 2. Add the workflow

Create `.github/workflows/tsdoc.yml` in your consumer repo:

```yaml
name: TSDoc Enforcer

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  tsdoc:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: stephengeller/tsdoc-enforcer-action@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

### Using a pre-release ref

Until there's a tagged release, you can pin to the development branch:

```yaml
- uses: stephengeller/tsdoc-enforcer-action@feat/tsdoc-enforcer
```

---

## What happens on a PR

- ✅ **All changed exports are documented** → the Action passes silently, no comment.
- 🚨 **Any changed export is missing/incomplete** → the Action:
  1. Fails the check (exit 1), blocking the PR if you have the check required
  2. Posts/updates a single PR comment listing every violation with:
     - `file:line — symbol (kind)` heading
     - A `typescript` fenced block containing the AI-generated TSDoc — paste it directly above the symbol
     - A collapsible "Regenerate with your own AI tool" section with the full self-contained prompt

The comment upserts — pushing more commits to the PR updates the existing comment instead of stacking new ones.

---

## Example output

> 🚨 TSDoc missing for 1 symbol(s). Paste the blocks below directly above each symbol.
>
> <details>
> <summary><code>src/users.ts:42</code> — <code>fetchUserById</code> (function)</summary>
>
> ```typescript
> /**
>  * Fetches the user with the given id, returning `null` when no row exists.
>  *
>  * @param id - Primary key of the user to fetch.
>  * @param client - Database client used to issue the query.
>  * @returns The user row, or `null` when the id doesn't exist.
>  */
> ```
>
> <details>
> <summary>Regenerate with your own AI tool</summary>
>
> ```
> <full paste-ready prompt: system rules + this specific symbol>
> ```
>
> </details>
> </details>

---

## Permissions

The workflow needs:

- `contents: read` — to fetch changed files at the PR head SHA
- `pull-requests: write` — to post/update the PR comment

These are set in the workflow example above.

---

## How it works (internals)

1. **Diff** (`src/diff.ts`) — paginates `pulls.listFiles`, filters to `.ts` / `.tsx`, fetches each blob at the PR head SHA
2. **Analyze** (`src/analyze.ts` + `src/tsdoc-rules.ts`) — [ts-morph](https://ts-morph.com) walks each source file; collects exported functions/classes/public methods/interfaces/type-aliases; applies the tag-aware predicate
3. **Generate** (`src/generate.ts` + `src/prompt.ts`) — calls Anthropic Messages API per symbol with an ephemeral-cached system prompt; extracts the `/** ... */` block from the response
4. **Comment** (`src/comment.ts`) — finds/updates the Action's comment via a hidden HTML marker; renders nested `<details>` sections

---

## Local development

```bash
npm install
npm run typecheck
npm run build          # produces dist/index.js via @vercel/ncc
```

The `dist/` bundle is committed because GitHub Actions runners execute it directly — no `npm install` happens on the consumer side.

---

## Roadmap (maybe)

- Prose-quality grading via a second AI pass (would catch `@param id - the id`)
- `@throws` enforcement on functions containing `throw` statements
- Configurable inputs (currently: opinionated defaults only)

## License

MIT
