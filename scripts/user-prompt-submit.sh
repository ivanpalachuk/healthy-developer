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

# ── Water ──────────────────────────────────────────────────────────────────────
if [ "$WATER_ELAPSED" -ge "$WATER_INTERVAL" ]; then
  if [ "$LANGUAGE" = "es" ]; then
    REMINDER="${REMINDER}💧 El usuario lleva ${WATER_ELAPSED} minutos sin tomar agua. Antes de responder su consulta, recordarle brevemente y con naturalidad que tome agua. Solo una línea, sin exagerar.\n"
  elif [ "$LANGUAGE" = "pt" ]; then
    REMINDER="${REMINDER}💧 O usuário está há ${WATER_ELAPSED} minutos sem beber água. Antes de responder, lembre-o brevemente de beber água. Apenas uma linha, de forma natural.\n"
  else
    REMINDER="${REMINDER}💧 The user hasn't had water in ${WATER_ELAPSED} minutes. Before answering their question, briefly and naturally remind them to drink water. One line, keep it casual.\n"
  fi
  TMP=$(mktemp)
  jq ".lastWaterReminder = $NOW" "$STATE_FILE" > "$TMP" 2>/dev/null && mv "$TMP" "$STATE_FILE"
fi

# ── Walk ───────────────────────────────────────────────────────────────────────
if [ "$WALK_ELAPSED" -ge "$WALK_INTERVAL" ]; then
  if [ "$LANGUAGE" = "es" ]; then
    REMINDER="${REMINDER}🚶 El usuario lleva ${WALK_ELAPSED} minutos sentado. Antes de responder su consulta, recordarle brevemente que se levante y estire las piernas. Solo una línea, con naturalidad.\n"
  elif [ "$LANGUAGE" = "pt" ]; then
    REMINDER="${REMINDER}🚶 O usuário está sentado há ${WALK_ELAPSED} minutos. Antes de responder, lembre-o de se levantar e alongar. Apenas uma linha.\n"
  else
    REMINDER="${REMINDER}🚶 The user has been sitting for ${WALK_ELAPSED} minutes. Before answering their question, briefly remind them to stand up and stretch. One line, keep it natural.\n"
  fi
  TMP=$(mktemp)
  jq ".lastWalkReminder = $NOW" "$STATE_FILE" > "$TMP" 2>/dev/null && mv "$TMP" "$STATE_FILE"
fi

# ── Meals ──────────────────────────────────────────────────────────────────────
CURRENT_MINUTES=$(( 10#$(date +%H) * 60 + 10#$(date +%M) ))

check_meal() {
  local MEAL="$1"
  local EMOJI="$2"
  local MSG_ES="$3"
  local MSG_EN="$4"
  local MSG_PT="$5"

  local MEAL_ENABLED
  local START_STR END_STR
  MEAL_ENABLED=$(jq -r ".mealReminders.${MEAL}.enabled // false" "$CONFIG_FILE" 2>/dev/null)
  [ "$MEAL_ENABLED" = "true" ] || return

  START_STR=$(jq -r ".mealReminders.${MEAL}.start // \"00:00\"" "$CONFIG_FILE" 2>/dev/null)
  END_STR=$(jq -r ".mealReminders.${MEAL}.end // \"00:00\"" "$CONFIG_FILE" 2>/dev/null)

  local START_MIN END_MIN
  START_MIN=$(( 10#${START_STR%%:*} * 60 + 10#${START_STR##*:} ))
  END_MIN=$(( 10#${END_STR%%:*} * 60 + 10#${END_STR##*:} ))

  [ "$CURRENT_MINUTES" -ge "$START_MIN" ] && [ "$CURRENT_MINUTES" -le "$END_MIN" ] || return

  local ALREADY_REMINDED
  ALREADY_REMINDED=$(jq -r ".mealsRemindedToday.${MEAL} // false" "$STATE_FILE" 2>/dev/null)
  [ "$ALREADY_REMINDED" = "false" ] || return

  if [ "$LANGUAGE" = "es" ]; then
    REMINDER="${REMINDER}${EMOJI} ${MSG_ES}\n"
  elif [ "$LANGUAGE" = "pt" ]; then
    REMINDER="${REMINDER}${EMOJI} ${MSG_PT}\n"
  else
    REMINDER="${REMINDER}${EMOJI} ${MSG_EN}\n"
  fi

  TMP=$(mktemp)
  jq ".mealsRemindedToday.${MEAL} = true" "$STATE_FILE" > "$TMP" 2>/dev/null && mv "$TMP" "$STATE_FILE"
}

check_meal "breakfast" "🍳" \
  "Es el momento del desayuno. Recordarle al usuario que desayune antes de seguir." \
  "It's breakfast time. Remind the user to have breakfast before continuing." \
  "É hora do café da manhã. Lembre o usuário de tomar café antes de continuar."

check_meal "lunch" "🥗" \
  "Es el momento del almuerzo. Recordarle al usuario que almuerce antes de seguir." \
  "It's lunch time. Remind the user to have lunch before continuing." \
  "É hora do almoço. Lembre o usuário de almoçar antes de continuar."

check_meal "snack" "🍎" \
  "Es el momento de la merienda. Recordarle al usuario que coma algo." \
  "It's snack time. Remind the user to have a snack." \
  "É hora do lanche. Lembre o usuário de comer alguma coisa."

check_meal "dinner" "🍽️" \
  "Es el momento de la cena. Recordarle al usuario que cene." \
  "It's dinner time. Remind the user to have dinner." \
  "É hora do jantar. Lembre o usuário de jantar."

# ── Output ─────────────────────────────────────────────────────────────────────
if [ -n "$REMINDER" ]; then
  printf "## healthy-developer — wellness reminder\n%b" "$REMINDER"
  if [ "$LANGUAGE" = "es" ]; then
    printf "Si el usuario confirma que tomó agua, caminó o comió, llamá al tool log_wellness con el tipo correspondiente para registrarlo.\n"
  elif [ "$LANGUAGE" = "pt" ]; then
    printf "Se o usuário confirmar que bebeu água, caminhou ou comeu, chame o tool log_wellness com o tipo correspondente para registrar.\n"
  else
    printf "If the user confirms they drank water, walked, or ate, call the log_wellness tool with the corresponding type to log it.\n"
  fi
fi

exit 0
