#!/usr/bin/env bash
# Send the queued task to an agent pane.
# The agent writes its own reply file — screen scraping loses long answers when
# the TUI redraws, so we never rely on capture-pane for the real content.
set -euo pipefail

SESSION="${TMUX_AI_SESSION:-ai-company}"
AGENT="${1:-}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

case "$AGENT" in
  codex)
    ROLE="You are the architect/reviewer: produce a scoped plan or a diff review. Do not implement unless the task says so. Read AGENTS.md (Expo v54 docs rule) before proposing Expo code."
    ;;
  claude)
    ROLE="You are the engineer: implement on a branch, verify locally, open a PR, never merge. Read only the files the task lists — your quota is shared with the CEO chat."
    ;;
  antigravity)
    ROLE="You are the product/UX planner. Plan only — never edit code."
    ;;
  *)
    echo "Usage: $0 codex|claude|antigravity" >&2
    exit 2
    ;;
esac

PANE="$("$DIR/tmux-pane.sh" "$AGENT")"
# absolute paths: agents run in their own worktrees where company-vault/ does not exist
ROOT="$(cd "$DIR/.." && pwd)"
IN="$ROOT/company-vault/handoff/to-$AGENT.md"
OUT="$ROOT/company-vault/handoff/from-$AGENT.md"

PROMPT="NEW TASK — ignore every earlier task in this session; do not reuse an earlier answer. Read $IN now and answer only what that file asks. $ROLE Then overwrite $OUT with your answer to THIS task (start it with '# From $AGENT — <iso time>' followed by the task title from $IN). Keep terminal output to one line — the file is the deliverable."

# TUI agents drop keystrokes when text and Enter arrive together
tmux send-keys -t "$PANE" "$PROMPT"
sleep 1
tmux send-keys -t "$PANE" C-m

echo "Sent $IN to $AGENT ($PANE) — reply expected at $OUT"
