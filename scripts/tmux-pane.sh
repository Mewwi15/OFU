#!/usr/bin/env bash
# Resolve an agent's tmux pane id by its @agent user option.
# Pane indices shift on split, and CLIs (codex) overwrite pane_title — the
# @agent option is the only tag that survives both.
# Usage: scripts/tmux-pane.sh codex|claude|antigravity|ceo|logs
set -euo pipefail
SESSION="${TMUX_AI_SESSION:-ai-company}"
WANT="${1:-}"
[ -z "$WANT" ] && { echo "Usage: $0 <agent>" >&2; exit 2; }

PANE=$(tmux list-panes -t "$SESSION:0" -F '#{pane_id} #{@agent}' 2>/dev/null \
       | awk -v t="$WANT" '$2 == t { print $1; exit }')
[ -z "$PANE" ] && { echo "No pane tagged @agent=$WANT in '$SESSION'. Run scripts/tmux-ai-company.sh." >&2; exit 1; }
echo "$PANE"
