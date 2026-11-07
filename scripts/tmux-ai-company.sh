#!/usr/bin/env bash
# Create the ai-company tmux session.
# Panes are identified by title, never by index: tmux renumbers indices on every
# split, which previously mismatched the send/capture scripts.
set -euo pipefail

SESSION="${1:-ai-company}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "tmux session already exists: $SESSION"
  echo "Attach with: tmux attach -t $SESSION"
  exit 0
fi

banner() { # pane_id agent body
  tmux select-pane -t "$1" -T "$2"
  tmux set-option -p -t "$1" @agent "$2"
  tmux send-keys -t "$1" "cd '$ROOT' && clear && printf '%s\n' '$3'" C-m
}

tmux new-session -d -s "$SESSION" -n company -c "$ROOT"
CEO=$(tmux list-panes -t "$SESSION:0" -F '#{pane_id}' | head -1)
KRIT=$(tmux split-window -h -t "$CEO" -c "$ROOT" -P -F '#{pane_id}')
MIRA=$(tmux split-window -v -t "$KRIT" -c "$ROOT" -P -F '#{pane_id}')
NARIN=$(tmux split-window -v -t "$CEO" -c "$ROOT" -P -F '#{pane_id}')
LOGS=$(tmux split-window -v -t "$MIRA" -c "$ROOT" -P -F '#{pane_id}')

banner "$CEO"   "ceo"         "CEO / Obsidian — vault: company-vault/ → open 00 CEO Dashboard.md"
banner "$KRIT"  "codex"       "KRIT CODEX (architect/reviewer) — start with:  codex     · task: company-vault/handoff/to-codex.md"
banner "$MIRA"  "claude"      "MIRA CLAUDE (engineer) — start with:  claude    · task: company-vault/handoff/to-claude.md  (quota shared — close when idle)"
banner "$NARIN" "antigravity" "NARIN ANTIGRAVITY (planner) — start with:  agy   · task: company-vault/handoff/to-antigravity.md"
banner "$LOGS"  "logs"        "LOGS / office UI — http://127.0.0.1:8899/"

tmux select-layout -t "$SESSION:0" tiled
tmux select-pane -t "$CEO"

echo "Created tmux session: $SESSION"
tmux list-panes -t "$SESSION:0" -F '  pane #{pane_index} (#{pane_id}) = #{@agent}'
echo "Attach with: tmux attach -t $SESSION"
