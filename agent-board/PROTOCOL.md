# Agent Company Protocol

This repo uses Git as the shared source of truth and markdown as the low-token
handoff layer.

## Roles

- CEO: human owner. Approves priorities, spend, deploys, and risky actions.
- Manager: turns goals into small tickets and keeps scope tight.
- Engineer: implements changes and verifies locally.
- QA: reviews scoped diffs and finds bugs.
- Reviewer: checks risk, UX, security, and release readiness.

## Current Staff

- Mewwi: CEO / Approver.
- Krit Codex: CTO / Lead Engineer.
- Mira Claude: QA Lead / Risk Reviewer.
- Narin Antigravity: Product / UX Planner.

## Worktree Isolation

- The owner checkout is `/Users/mewwi/dev/my-rn-app`; agents must not run tasks
  or switch branches there.
- Paperclip agent `cwd` values must point at
  `/Users/mewwi/dev/ofu-worktrees/<name>`.
- Each agent creates and switches task branches only inside its own worktree:
  Krit in `/Users/mewwi/dev/ofu-worktrees/krit`, Mira in
  `/Users/mewwi/dev/ofu-worktrees/mira`, and Narin in
  `/Users/mewwi/dev/ofu-worktrees/narin`.

The visual company room is `agent-board/company.html`.

## Communication Rules

- Use GitHub issues or `agent-board/tasks/*.md` as the task source.
- Issue-based flow (labels, gh commands, handoff): see `agent-board/GITHUB.md`.
- One task should fit in one branch and one review.
- Agents read only the task file, listed files, and command output.
- Agents do not scan the whole repository unless the task explicitly allows it.
- Keep replies under 5 findings or 300 words unless asked for more.
- Use local checks before asking another AI to reason broadly.
- Put long logs in files and summarize only the failing lines.

## Branch Rules

Use this format:

```text
agent/<role>/<issue-or-task-id>-short-title
```

Examples:

```text
agent/engineer/12-checkout-submit
agent/qa/12-checkout-submit
```

## Task Lifecycle

1. CEO creates a GitHub issue or task file.
2. Manager writes a small scope and done criteria.
3. Engineer creates a branch and implements.
4. Engineer runs local checks and writes notes.
5. QA reviews only the diff and scoped files.
6. Engineer fixes verified findings.
7. CEO approves merge/deploy.

## Handoff Format

Every agent reply should use:

```md
## Agent Reply

- Decision:
- Findings:
- Evidence:
- Commands:
- Risks:
- Next action:
- Needs approval: yes/no
```

## Cost Controls

- Prefer `git diff`, `git status`, and targeted files over broad repo reads.
- Prefer `npm run lint`, typecheck, and focused repro steps over model debate.
- Use Claude only for scoped QA/review when its judgment adds value.
- Stop an agent when it asks for broad context without a concrete reason.
