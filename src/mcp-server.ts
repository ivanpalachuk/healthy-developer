import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { readConfig } from './utils/config.js'
import { readState, markWaterReminder, markWalkReminder, writeState } from './utils/state.js'

const server = new McpServer({
  name: 'healthy-developer',
  version: '0.1.0',
})

server.tool(
  'check_wellness',
  'Check if the user needs a wellness reminder (water or walk). Call this before responding to the user.',
  {},
  async () => {
    const config = readConfig()
    const state = readState()

    if (!config.enabled) {
      return { content: [{ type: 'text', text: 'healthy-developer is disabled.' }] }
    }

    const now = Math.floor(Date.now() / 1000)
    const waterElapsed = Math.floor((now - state.lastWaterReminder) / 60)
    const walkElapsed = Math.floor((now - state.lastWalkReminder) / 60)

    const reminders: string[] = []

    if (waterElapsed >= config.waterIntervalMinutes) {
      const msg = config.language === 'es'
        ? `💧 El usuario lleva ${waterElapsed} minutos sin tomar agua. Recordarle brevemente antes de responder.`
        : `💧 The user hasn't had water in ${waterElapsed} minutes. Briefly remind them before answering.`
      reminders.push(msg)
      markWaterReminder()
    }

    if (walkElapsed >= config.walkIntervalMinutes) {
      const msg = config.language === 'es'
        ? `🚶 El usuario lleva ${walkElapsed} minutos sentado. Recordarle que se levante antes de responder.`
        : `🚶 The user has been sitting for ${walkElapsed} minutes. Remind them to stand up before answering.`
      reminders.push(msg)
      markWalkReminder()
    }

    if (reminders.length === 0) {
      return { content: [{ type: 'text', text: 'No reminders needed right now.' }] }
    }

    return { content: [{ type: 'text', text: reminders.join('\n') }] }
  }
)

server.tool(
  'snooze_reminder',
  'Snooze a wellness reminder for a given number of minutes.',
  {
    type: z.enum(['water', 'walk']).describe('Which reminder to snooze'),
    minutes: z.number().min(1).max(120).describe('Minutes to snooze'),
  },
  async ({ type, minutes }) => {
    const snoozeUntil = Math.floor(Date.now() / 1000) + minutes * 60
    if (type === 'water') {
      writeState({ lastWaterReminder: snoozeUntil })
    } else {
      writeState({ lastWalkReminder: snoozeUntil })
    }
    const lang = readConfig().language
    const msg = lang === 'es'
      ? `Recordatorio de ${type === 'water' ? 'agua' : 'caminata'} pospuesto ${minutes} minutos.`
      : `${type === 'water' ? 'Water' : 'Walk'} reminder snoozed for ${minutes} minutes.`
    return { content: [{ type: 'text', text: msg }] }
  }
)

server.tool(
  'wellness_status',
  'Get the current wellness status: water intake today and time since last reminders.',
  {},
  async () => {
    const config = readConfig()
    const state = readState()
    const now = Math.floor(Date.now() / 1000)
    const waterElapsed = Math.floor((now - state.lastWaterReminder) / 60)
    const walkElapsed = Math.floor((now - state.lastWalkReminder) / 60)

    const status = {
      waterToday: state.waterCountToday,
      dailyGoal: config.dailyLiters,
      minutesSinceWater: state.lastWaterReminder === 0 ? 'never' : waterElapsed,
      minutesSinceWalk: state.lastWalkReminder === 0 ? 'never' : walkElapsed,
      nextWaterIn: Math.max(0, config.waterIntervalMinutes - waterElapsed),
      nextWalkIn: Math.max(0, config.walkIntervalMinutes - walkElapsed),
    }

    return { content: [{ type: 'text', text: JSON.stringify(status, null, 2) }] }
  }
)

const transport = new StdioServerTransport()
await server.connect(transport)
