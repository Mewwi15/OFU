#!/usr/bin/env bash
# DEBUG ONLY: dump an agent pane's screen to handoff/raw/<agent>.txt
# The real reply is written by the agent itself to handoff/from-<agent>.md.
# This never touches from-*.md so a redraw can't corrupt a real answer.
set -euo pipefail

SESSION="${TMUX_AI_SESSION:-ai-company}"
AGENT="${1:-}"
LINES="${2:-220}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$DIR/.." && pwd)"

case "$AGENT" in
  codex|claude|antigravity) ;;
  *) echo "Usage: $0 codex|claude|antigravity [lines]" >&2; exit 2 ;;
esac

PANE="$("$DIR/tmux-pane.sh" "$AGENT")"
mkdir -p "$ROOT/company-vault/handoff/raw"
OUT="$ROOT/company-vault/handoff/raw/$AGENT.txt"
{
  printf 'RAW SCREEN DUMP (debug) %s — real reply lives in from-%s.md\n\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$AGENT"
  tmux capture-pane -t "$PANE" -p -S "-$LINES"
} > "$OUT"
echo "Dumped $PANE screen to $OUT (debug only)"
