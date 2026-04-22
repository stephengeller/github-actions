# auto-downstream-pr

Automates the "upstream OEM integration merged → raise a PR in amber-core that
pulls the change in" flow.

Ships as **two composite actions** because the work spans two repos:

| Action                       | Runs in                             | Purpose                                                          |
| ---------------------------- | ----------------------------------- | ---------------------------------------------------------------- |
| `auto-downstream-pr/trigger` | Upstream OEM repo (e.g. `growatt`)  | On PR merge, fires a `workflow_dispatch` at the downstream repo. |
| `auto-downstream-pr`         | Downstream repo (e.g. `amber-core`) | Runs the update command, commits, opens or updates a PR.         |

The update itself defaults to `git subrepo pull oem/${INTEGRATION}`, matching
how amber-core vendors OEM integrations, but the command is configurable.

## Topology

```
┌──────────────────────────┐      gh workflow run      ┌──────────────────────────┐
│ amberelectric/growatt    │ ────────────────────────▶ │ amberelectric/amber-core │
│  PR merged → main        │   (workflow_dispatch      │  bump-from-oem.yml       │
│  uses: .../trigger       │    with PR metadata)      │  uses: auto-downstream-pr│
└──────────────────────────┘                           │  → git subrepo pull      │
                                                       │  → open/update PR        │
                                                       └──────────────────────────┘
```

## Authentication

Both halves need a **GitHub App** token. The default `GITHUB_TOKEN` cannot
dispatch workflows in another repo, and cannot open PRs across repos.

Create one App installed on all OEM integration repos and on amber-core.
Required permissions:

- On **upstream repos**: `actions: write` (to dispatch).
- On **downstream repo**: `contents: write`, `pull_requests: write`.

Mint a token per run with `actions/create-github-app-token@v1`.

---

## Downstream: `amber-core` setup

### 1. Install `git-subrepo` in the runner

`git subrepo` is not a built-in git command. Install it before calling this
action.

Check with `@amberelectric/oem-dev` whether amber-core uses a private fork of
`git-subrepo` — if so, install from that fork. Otherwise, upstream is
[ingydotnet/git-subrepo](https://github.com/ingydotnet/git-subrepo):

```yaml
- name: Install git-subrepo
  shell: bash
  run: |
    git clone --depth=1 https://github.com/ingydotnet/git-subrepo.git "$HOME/.git-subrepo"
    echo "$HOME/.git-subrepo/lib" >> "$GITHUB_PATH"
    echo "GIT_SUBREPO_ROOT=$HOME/.git-subrepo" >> "$GITHUB_ENV"
```

### 2. Workflow

```yaml
# .github/workflows/bump-from-oem.yml (in amber-core)
name: Bump from OEM
on:
  workflow_dispatch:
    inputs:
      integration-name: { required: true, type: string }
      upstream-repo: { required: true, type: string }
      upstream-pr-number: { required: true, type: string }
      upstream-sha: { required: true, type: string }
      upstream-title: { required: false, type: string, default: "" }
      upstream-author: { required: false, type: string, default: "" }
      upstream-url: { required: false, type: string, default: "" }

jobs:
  bump:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/create-github-app-token@v1
        id: token
        with:
          app-id: ${{ vars.AMBER_BOT_APP_ID }}
          private-key: ${{ secrets.AMBER_BOT_PRIVATE_KEY }}

      - name: Install git-subrepo
        shell: bash
        run: |
          git clone --depth=1 https://github.com/ingydotnet/git-subrepo.git "$HOME/.git-subrepo"
          echo "$HOME/.git-subrepo/lib" >> "$GITHUB_PATH"
          echo "GIT_SUBREPO_ROOT=$HOME/.git-subrepo" >> "$GITHUB_ENV"

      - uses: amberelectric/github-actions/auto-downstream-pr@main
        with:
          token: ${{ steps.token.outputs.token }}
          integration-name: ${{ inputs.integration-name }}
          upstream-repo: ${{ inputs.upstream-repo }}
          upstream-pr-number: ${{ inputs.upstream-pr-number }}
          upstream-sha: ${{ inputs.upstream-sha }}
          upstream-title: ${{ inputs.upstream-title }}
          upstream-author: ${{ inputs.upstream-author }}
          upstream-url: ${{ inputs.upstream-url }}
          # Defaults shown for reference:
          # update-command: |
          #   git subrepo pull "oem/${INTEGRATION}"
          # reviewers: amberelectric/oem-dev
```

## Upstream: OEM integration setup (one per OEM repo)

```yaml
# .github/workflows/notify-amber-core.yml (in e.g. growatt)
name: Notify amber-core
on:
  pull_request:
    types: [closed]
    branches: [main]

jobs:
  notify:
    if: github.event.pull_request.merged == true
    runs-on: ubuntu-latest
    steps:
      - uses: actions/create-github-app-token@v1
        id: token
        with:
          app-id: ${{ vars.AMBER_BOT_APP_ID }}
          private-key: ${{ secrets.AMBER_BOT_PRIVATE_KEY }}
          owner: amberelectric
          repositories: amber-core

      - uses: amberelectric/github-actions/auto-downstream-pr/trigger@main
        with:
          token: ${{ steps.token.outputs.token }}
          downstream-repo: amberelectric/amber-core
          downstream-workflow: bump-from-oem.yml
          integration-name: growatt
```

---

## `auto-downstream-pr` inputs (downstream action)

| Name                 | Required | Default                                 | Description                          |
| -------------------- | -------- | --------------------------------------- | ------------------------------------ |
| `token`              | yes      | —                                       | Token with write on this repo.       |
| `integration-name`   | yes      | —                                       | Short slug (`growatt`, `deye`, …).   |
| `upstream-repo`      | yes      | —                                       | `owner/repo` that triggered the run. |
| `upstream-pr-number` | yes      | —                                       | Merged PR number.                    |
| `upstream-sha`       | yes      | —                                       | Merge commit SHA.                    |
| `upstream-title`     | no       | `""`                                    | For PR body.                         |
| `upstream-author`    | no       | `""`                                    | For PR body.                         |
| `upstream-url`       | no       | computed                                | For PR body.                         |
| `update-command`     | no       | `git subrepo pull "oem/${INTEGRATION}"` | Shell snippet; must produce a diff.  |
| `base`               | no       | `main`                                  | Base branch of the downstream PR.    |
| `branch-prefix`      | no       | `auto/bump`                             | Branch name prefix.                  |
| `reviewers`          | no       | `amberelectric/oem-dev`                 | Comma-separated users/teams.         |
| `labels`             | no       | `""`                                    | Comma-separated labels.              |
| `commit-message`     | no       | templated                               | Override commit message.             |
| `pr-title`           | no       | templated                               | Override PR title.                   |

### Outputs

- `pull-request-url` — URL of the created/updated PR.
- `branch` — Branch pushed.
- `changed` — `"true"` if the update produced a diff.

## `trigger` inputs (upstream action)

| Name                  | Required | Default | Description                                |
| --------------------- | -------- | ------- | ------------------------------------------ |
| `token`               | yes      | —       | Token with `actions: write` on downstream. |
| `downstream-repo`     | yes      | —       | e.g. `amberelectric/amber-core`.           |
| `downstream-workflow` | yes      | —       | e.g. `bump-from-oem.yml`.                  |
| `downstream-ref`      | no       | `main`  | Branch to dispatch against.                |
| `integration-name`    | yes      | —       | Short slug.                                |

## Behaviour notes

- **Per-merge branches.** Branch name is derived from the upstream PR number,
  so reruns (e.g. manual redispatch) update the existing branch/PR instead of
  creating duplicates. The push uses `--force-with-lease`.
- **No diff → no PR.** If `update-command` produces no change, the run exits
  cleanly without opening anything.
- **Reviewer / label failures don't fail the run.** They emit a warning — the
  PR is still created/updated.
- **Slack notification to `#oem-prs`** is out of scope for v1. Add a
  follow-up step in the downstream workflow that posts to Slack with
  `${{ steps.<id>.outputs.pull-request-url }}`.

## Design

- **Composite actions**, not JS/Docker. No build step; the YAML is the source.
- **Two actions, two repos.** Splitting the trigger from the work mirrors the
  actual topology (dispatch → run) and lets each side evolve independently.
- **User-supplied `update-command`.** Default covers the subrepo flow; overrideable for future integrations that vendor differently.
