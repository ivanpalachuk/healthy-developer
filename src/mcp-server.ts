import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { readConfig } from './utils/config.js'
import { readState, markWaterReminder, markWalkReminder, markMealReminder, logMeal, writeState } from './utils/state.js'
import type { MealType } from './utils/state.js'

const MEAL_TYPES = ['water', 'walk', 'breakfast', 'lunch', 'snack', 'dinner'] as const
type WellnessType = typeof MEAL_TYPES[number]

const MEAL_EMOJI: Record<MealType, string> = {
  breakfast: '🍳',
  lunch: '🥗',
  snack: '🍎',
  dinner: '🍽️',
}

const MEAL_LABELS: Record<string, Record<MealType, string>> = {
  es: { breakfast: 'desayuno', lunch: 'almuerzo', snack: 'merienda', dinner: 'cena' },
  en: { breakfast: 'breakfast', lunch: 'lunch', snack: 'snack', dinner: 'dinner' },
  pt: { breakfast: 'café da manhã', lunch: 'almoço', snack: 'lanche', dinner: 'jantar' },
}

const server = new McpServer({
  name: 'healthy-developer',
  version: '0.1.0',
})

server.tool(
  'check_wellness',
  'Check if the user needs a wellness reminder (water, walk, or meal). Call this before responding to the user.',
  {},
  async () => {
    const config = readConfig()
    const state  = readState()

    if (!config.enabled) {
      return { content: [{ type: 'text', text: 'healthy-developer is disabled.' }] }
    }

    const now          = Math.floor(Date.now() / 1000)
    const waterElapsed = Math.floor((now - state.lastWaterReminder) / 60)
    const walkElapsed  = Math.floor((now - state.lastWalkReminder) / 60)
    const lang         = config.language ?? 'en'
    const reminders: string[] = []

    if (waterElapsed >= config.waterIntervalMinutes) {
      reminders.push(lang === 'es'
        ? `💧 El usuario lleva ${waterElapsed} minutos sin tomar agua. Recordarle brevemente.`
        : lang === 'pt'
        ? `💧 O usuário está há ${waterElapsed} minutos sem beber água. Lembre-o brevemente.`
        : `💧 The user hasn't had water in ${waterElapsed} minutes. Briefly remind them.`)
      markWaterReminder()
    }

    if (walkElapsed >= config.walkIntervalMinutes) {
      reminders.push(lang === 'es'
        ? `🚶 El usuario lleva ${walkElapsed} minutos sentado. Recordarle que se levante.`
        : lang === 'pt'
        ? `🚶 O usuário está sentado há ${walkElapsed} minutos. Lembre-o de se levantar.`
        : `🚶 The user has been sitting for ${walkElapsed} minutes. Remind them to stand up.`)
      markWalkReminder()
    }

    // Meal window checks
    const nowDate   = new Date()
    const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes()

    for (const meal of ['breakfast', 'lunch', 'snack', 'dinner'] as MealType[]) {
      const window = config.mealReminders[meal]
      if (!window.enabled) continue
      if (state.mealsRemindedToday[meal]) continue

      const [sh, sm] = window.start.split(':').map(Number)
      const [eh, em] = window.end.split(':').map(Number)
      const startMin = sh * 60 + sm
      const endMin   = eh * 60 + em

      if (nowMinutes >= startMin && nowMinutes <= endMin) {
        const label = (MEAL_LABELS[lang] ?? MEAL_LABELS.en)[meal]
        reminders.push(lang === 'es'
          ? `${MEAL_EMOJI[meal]} Es el momento del ${label}. Recordarle al usuario que coma.`
          : lang === 'pt'
          ? `${MEAL_EMOJI[meal]} É hora do ${label}. Lembre o usuário de comer.`
          : `${MEAL_EMOJI[meal]} It's ${label} time. Remind the user to eat.`)
        markMealReminder(meal)
      }
    }

    if (reminders.length === 0) {
      return { content: [{ type: 'text', text: 'No reminders needed right now.' }] }
    }

    return { content: [{ type: 'text', text: reminders.join('\n') }] }
  }
)

server.tool(
  'snooze_reminder',
  'Snooze a wellness reminder (water, walk, or meal) for a given number of minutes.',
  {
    type:    z.enum(MEAL_TYPES).describe('Which reminder to snooze'),
    minutes: z.number().min(1).max(120).describe('Minutes to snooze'),
  },
  async ({ type, minutes }: { type: WellnessType; minutes: number }) => {
    const snoozeUntil = Math.floor(Date.now() / 1000) + minutes * 60
    const lang = readConfig().language ?? 'en'

    if (type === 'water') {
      writeState({ lastWaterReminder: snoozeUntil })
    } else if (type === 'walk') {
      writeState({ lastWalkReminder: snoozeUntil })
    } else {
      // For meals: mark as reminded today (they'll get it again tomorrow)
      markMealReminder(type as MealType)
    }

    const typeLabel = type === 'water'
      ? (lang === 'es' ? 'agua' : lang === 'pt' ? 'água' : 'water')
      : type === 'walk'
      ? (lang === 'es' ? 'caminata' : lang === 'pt' ? 'caminhada' : 'walk')
      : (MEAL_LABELS[lang] ?? MEAL_LABELS.en)[type as MealType]

    const msg = lang === 'es'
      ? `Recordatorio de ${typeLabel} pospuesto ${minutes} minutos.`
      : lang === 'pt'
      ? `Lembrete de ${typeLabel} adiado por ${minutes} minutos.`
      : `${typeLabel} reminder snoozed for ${minutes} minutes.`

    return { content: [{ type: 'text', text: msg }] }
  }
)

server.tool(
  'wellness_status',
  'Get the full wellness status: water, walk, and meal reminders for today.',
  {},
  async () => {
    const config = readConfig()
    const state  = readState()
    const now    = Math.floor(Date.now() / 1000)

    const status = {
      waterToday:         state.waterCountToday,
      dailyGoal:          config.dailyLiters,
      minutesSinceWater:  state.lastWaterReminder === 0 ? 'never' : Math.floor((now - state.lastWaterReminder) / 60),
      minutesSinceWalk:   state.lastWalkReminder  === 0 ? 'never' : Math.floor((now - state.lastWalkReminder)  / 60),
      nextWaterIn:        Math.max(0, config.waterIntervalMinutes - Math.floor((now - state.lastWaterReminder) / 60)),
      nextWalkIn:         Math.max(0, config.walkIntervalMinutes  - Math.floor((now - state.lastWalkReminder)  / 60)),
      mealsRemindedToday: state.mealsRemindedToday,
      mealsEnabled: {
        breakfast: config.mealReminders.breakfast.enabled,
        lunch:     config.mealReminders.lunch.enabled,
        snack:     config.mealReminders.snack.enabled,
        dinner:    config.mealReminders.dinner.enabled,
      },
    }

    return { content: [{ type: 'text', text: JSON.stringify(status, null, 2) }] }
  }
)

server.tool(
  'log_wellness',
  'Log that the user completed a wellness action (water, walk, or a meal). Resets the timer or marks the meal as done for today.',
  {
    type: z.enum(MEAL_TYPES).describe('Which action the user completed'),
  },
  async ({ type }: { type: WellnessType }) => {
    const lang = readConfig().language ?? 'en'

    if (type === 'water') {
      markWaterReminder()
      return { content: [{ type: 'text', text:
        lang === 'es' ? '💧 ¡Perfecto! Contador de agua reiniciado.' :
        lang === 'pt' ? '💧 Ótimo! Contador de água reiniciado.' :
        '💧 Great! Water timer reset.'
      }] }
    }

    if (type === 'walk') {
      markWalkReminder()
      return { content: [{ type: 'text', text:
        lang === 'es' ? '🚶 ¡Genial! Contador de caminata reiniciado.' :
        lang === 'pt' ? '🚶 Ótimo! Contador de caminhada reiniciado.' :
        '🚶 Nice! Walk timer reset.'
      }] }
    }

    // Meal
    logMeal(type as MealType)
    const emoji = MEAL_EMOJI[type as MealType]
    const label = (MEAL_LABELS[lang] ?? MEAL_LABELS.en)[type as MealType]
    return { content: [{ type: 'text', text:
      lang === 'es' ? `${emoji} ¡Buenísimo! ${label} registrado.` :
      lang === 'pt' ? `${emoji} Ótimo! ${label} registrado.` :
      `${emoji} Nice! ${label} logged.`
    }] }
  }
)

const transport = new StdioServerTransport()
await server.connect(transport)
