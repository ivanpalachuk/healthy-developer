import fs from 'fs'
import { CONFIG_DIR, STATE_FILE } from './config.js'

export type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner'

export interface State {
  lastWaterReminder: number
  lastWalkReminder: number
  waterCountToday: number
  waterMlToday: number
  lastResetDate: string
  mealsRemindedToday: Record<MealType, boolean>
}

const DEFAULT_STATE: State = {
  lastWaterReminder: 0,
  lastWalkReminder: 0,
  waterCountToday: 0,
  waterMlToday: 0,
  lastResetDate: '',
  mealsRemindedToday: {
    breakfast: false,
    lunch:     false,
    snack:     false,
    dinner:    false,
  },
}

export function readState(): State {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    const state: State = {
      ...DEFAULT_STATE,
      ...parsed,
      mealsRemindedToday: { ...DEFAULT_STATE.mealsRemindedToday, ...parsed.mealsRemindedToday },
    }

    // Reset daily counters if new day
    const today = new Date().toISOString().split('T')[0]
    if (state.lastResetDate !== today) {
      state.waterCountToday = 0
      state.waterMlToday = 0
      state.mealsRemindedToday = { breakfast: false, lunch: false, snack: false, dinner: false }
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
  writeState({ lastWaterReminder: Math.floor(Date.now() / 1000) })
}

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

export function markMealReminder(meal: MealType): void {
  const state = readState()
  writeState({
    mealsRemindedToday: { ...state.mealsRemindedToday, [meal]: true },
  })
}

export function logMeal(meal: MealType): void {
  markMealReminder(meal)
}
