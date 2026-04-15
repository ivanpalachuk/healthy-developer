#!/bin/bash
# healthy-developer — UserPromptSubmit hook
# Checks wellness intervals and injects reminders into Claude's context

CONFIG_FILE="$HOME/.healthy-developer/config.json"
STATE_FILE="$HOME/.healthy-developer/state.json"

# Exit silently if not configured or disabled
[ -f "$CONFIG_FILE" ] || exit 0
ENABLED=$(jq -r '.enabled // true' "$CONFIG_FILE" 2>/dev/null)
[ "$ENABLED" = "false" ] && exit 0

# Read config
WATER_INTERVAL=$(jq -r '.waterIntervalMinutes // 30' "$CONFIG_FILE" 2>/dev/null)
WALK_INTERVAL=$(jq -r '.walkIntervalMinutes // 60' "$CONFIG_FILE" 2>/dev/null)
LANGUAGE=$(jq -r '.language // "es"' "$CONFIG_FILE" 2>/dev/null)

# Read state
LAST_WATER=$(jq -r '.lastWaterReminder // 0' "$STATE_FILE" 2>/dev/null)
LAST_WALK=$(jq -r '.lastWalkReminder // 0' "$STATE_FILE" 2>/dev/null)

NOW=$(date +%s)
WATER_ELAPSED=$(( (NOW - LAST_WATER) / 60 ))
WALK_ELAPSED=$(( (NOW - LAST_WALK) / 60 ))

REMINDER=""

if [ "$WATER_ELAPSED" -ge "$WATER_INTERVAL" ]; then
  if [ "$LANGUAGE" = "es" ]; then
    REMINDER="${REMINDER}💧 El usuario lleva ${WATER_ELAPSED} minutos sin tomar agua. Antes de responder su consulta, recordarle brevemente y con naturalidad que tome agua. Solo una línea, sin exagerar.\n"
  else
    REMINDER="${REMINDER}💧 The user hasn't had water in ${WATER_ELAPSED} minutes. Before answering their question, briefly and naturally remind them to drink water. One line, keep it casual.\n"
  fi
  # Update state
  TMP=$(mktemp)
  jq ".lastWaterReminder = $NOW | .waterCountToday = ((.waterCountToday // 0) + 1)" "$STATE_FILE" > "$TMP" 2>/dev/null && mv "$TMP" "$STATE_FILE"
fi

if [ "$WALK_ELAPSED" -ge "$WALK_INTERVAL" ]; then
  if [ "$LANGUAGE" = "es" ]; then
    REMINDER="${REMINDER}🚶 El usuario lleva ${WALK_ELAPSED} minutos sentado. Antes de responder su consulta, recordarle brevemente que se levante y estire las piernas. Solo una línea, con naturalidad.\n"
  else
    REMINDER="${REMINDER}🚶 The user has been sitting for ${WALK_ELAPSED} minutes. Before answering their question, briefly remind them to stand up and stretch. One line, keep it natural.\n"
  fi
  TMP=$(mktemp)
  jq ".lastWalkReminder = $NOW" "$STATE_FILE" > "$TMP" 2>/dev/null && mv "$TMP" "$STATE_FILE"
fi

# Only output if there's a reminder — stdout becomes additionalContext for Claude
if [ -n "$REMINDER" ]; then
  printf "## healthy-developer — wellness reminder\n%b" "$REMINDER"
fi

exit 0
