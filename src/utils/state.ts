import fs from 'fs'
import { CONFIG_DIR, STATE_FILE } from './config.js'

export interface State {
  lastWaterReminder: number  // unix timestamp seconds
  lastWalkReminder: number
  waterCountToday: number
  lastResetDate: string      // YYYY-MM-DD
}

const DEFAULT_STATE: State = {
  lastWaterReminder: 0,
  lastWalkReminder: 0,
  waterCountToday: 0,
  lastResetDate: '',
}

export function readState(): State {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8')
    const state: State = { ...DEFAULT_STATE, ...JSON.parse(raw) }

    // Reset daily counter if new day
    const today = new Date().toISOString().split('T')[0]
    if (state.lastResetDate !== today) {
      state.waterCountToday = 0
      state.lastResetDate = today
      writeState(state)
    }

    return state
  } catch {
    return DEFAULT_STATE
  }
}

export function writeState(state: Partial<State>): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true })
  const current = readState()
  fs.writeFileSync(STATE_FILE, JSON.stringify({ ...current, ...state }, null, 2))
}

export function markWaterReminder(): void {
  const state = readState()
  writeState({
    lastWaterReminder: Math.floor(Date.now() / 1000),
    waterCountToday: state.waterCountToday + 1,
  })
}

export function markWalkReminder(): void {
  writeState({ lastWalkReminder: Math.floor(Date.now() / 1000) })
}
