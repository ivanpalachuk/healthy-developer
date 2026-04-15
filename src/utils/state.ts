import fs from 'fs'
import { CONFIG_DIR, STATE_FILE } from './config.js'

export interface State {
  lastWaterReminder: number  // unix timestamp seconds
  lastWalkReminder: number
  waterCountToday: number
  waterMlToday: number       // actual ml logged by user
  lastResetDate: string      // YYYY-MM-DD
}

const DEFAULT_STATE: State = {
  lastWaterReminder: 0,
  lastWalkReminder: 0,
  waterCountToday: 0,
  waterMlToday: 0,
  lastResetDate: '',
}

export function readState(): State {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8')
    const state: State = { ...DEFAULT_STATE, ...JSON.parse(raw) }

    // Reset daily counters if new day
    const today = new Date().toISOString().split('T')[0]
    if (state.lastResetDate !== today) {
      state.waterCountToday = 0
      state.waterMlToday = 0
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

// Called when reminder fires — only resets the timer, does NOT increment counter
export function markWaterReminder(): void {
  writeState({ lastWaterReminder: Math.floor(Date.now() / 1000) })
}

// Called when user confirms they drank water — increments counter and logs ml
export function logWaterIntake(ml: number): void {
  const state = readState()
  writeState({
    lastWaterReminder: Math.floor(Date.now() / 1000),
    waterCountToday: state.waterCountToday + 1,
    waterMlToday: state.waterMlToday + ml,
  })
}

export function markWalkReminder(): void {
  writeState({ lastWalkReminder: Math.floor(Date.now() / 1000) })
}
