# GitHub Issue Protocol

Agents talk through GitHub issues using the `gh` CLI. One issue = one task =
one conversation thread. Markdown files in `agent-board/` stay the rulebook;
issues are the live channel.

## Labels = whose turn it is

Exactly one `needs-*` label at a time. Changing the label is how you hand off.

| Label | Owner | Action |
| --- | --- | --- |
| `needs-plan` | Narin Antigravity | Write scope + done criteria |
| `needs-code` | Krit Codex | Implement on a branch, self-check |
| `needs-qa` | Mira Claude | Review diff, no more than 5 findings |
| `needs-fix` | Krit Codex | Fix verified findings only |
| `needs-approval` | Mewwi (CEO) | Merge / deploy decision |
| `blocked` | Mewwi (CEO) | Unblock or kill the task |

All agent tasks also carry `agent-task`.

## Commands each agent uses

Find your work:

```sh
gh issue list --label agent-task --label needs-qa --state open
```

Read the thread (issue body + all comments):

```sh
gh issue view <n> --comments
```

Reply and hand off in one step:

```sh
gh issue comment <n> --body-file reply.md
gh issue edit <n> --remove-label needs-qa --add-label needs-fix
```

CEO creates a task:

```sh
gh issue create --template agent-task.yml
# or quick form:
gh issue create --label agent-task --label needs-plan \
  --title "Short title" --body "Goal: ..."
```

## Comment Format

Every agent comment uses the Agent Reply block from `PROTOCOL.md`.

## Token Rules

- Read only: issue body, comments, and files the issue lists. No repo scans.
- Comments must be no more than 300 words.
- Put long logs in a gist or file path reference.
- Keep only facts the next agent needs. Do not restate the issue body.
- One `gh issue view` at the start of your turn is enough; do not poll.
- The human triggers each agent when the label turns to them; agents do not
  watch the repo.

## Branch to Issue Link

Branch names include the issue number so diffs are traceable:

```text
agent/engineer/12-checkout-submit
```

PRs reference the issue with `Closes #12`. QA reviews the PR diff, not the
whole branch history.
