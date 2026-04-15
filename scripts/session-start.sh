#!/bin/bash
# healthy-developer — SessionStart hook
# Initializes state file if missing

CONFIG_FILE="$HOME/.healthy-developer/config.json"
STATE_FILE="$HOME/.healthy-developer/state.json"
CONFIG_DIR="$HOME/.healthy-developer"

mkdir -p "$CONFIG_DIR"

# Create default state if missing
if [ ! -f "$STATE_FILE" ]; then
  TODAY=$(date +%Y-%m-%d)
  echo "{\"lastWaterReminder\":0,\"lastWalkReminder\":0,\"waterCountToday\":0,\"lastResetDate\":\"$TODAY\"}" > "$STATE_FILE"
fi

# Reset daily counter if new day
if [ -f "$STATE_FILE" ]; then
  TODAY=$(date +%Y-%m-%d)
  LAST_DATE=$(jq -r '.lastResetDate // ""' "$STATE_FILE" 2>/dev/null)
  if [ "$LAST_DATE" != "$TODAY" ]; then
    TMP=$(mktemp)
    jq ".waterCountToday = 0 | .lastResetDate = \"$TODAY\"" "$STATE_FILE" > "$TMP" 2>/dev/null && mv "$TMP" "$STATE_FILE"
  fi
fi

exit 0
