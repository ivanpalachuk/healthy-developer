import fs from 'fs'
import path from 'path'
import os from 'os'

export interface MealWindow {
  enabled: boolean
  start: string  // "HH:MM" 24h format
  end: string    // "HH:MM" 24h format
}

export interface Config {
  waterIntervalMinutes: number
  walkIntervalMinutes: number
  dailyLiters: number
  language: 'es' | 'en' | 'pt'
  enabled: boolean
  trackWaterIntake: boolean
  glassSize: number
  mealReminders: {
    breakfast: MealWindow
    lunch:     MealWindow
    snack:     MealWindow
    dinner:    MealWindow
  }
}

const DEFAULT_CONFIG: Config = {
  waterIntervalMinutes: 30,
  walkIntervalMinutes: 60,
  dailyLiters: 2,
  language: 'es',
  enabled: true,
  trackWaterIntake: false,
  glassSize: 250,
  mealReminders: {
    breakfast: { enabled: false, start: '07:00', end: '09:00' },
    lunch:     { enabled: false, start: '12:00', end: '14:00' },
    snack:     { enabled: false, start: '15:30', end: '17:00' },
    dinner:    { enabled: false, start: '19:00', end: '21:00' },
  },
}

export const CONFIG_DIR  = path.join(os.homedir(), '.healthy-developer')
export const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json')
export const STATE_FILE  = path.join(CONFIG_DIR, 'state.json')
export const SCRIPTS_DIR = path.join(CONFIG_DIR, 'scripts')

export function readConfig(): Config {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      mealReminders: { ...DEFAULT_CONFIG.mealReminders, ...parsed.mealReminders },
    }
  } catch {
    return DEFAULT_CONFIG
  }
}

export function writeConfig(config: Partial<Config>): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true })
  const current = readConfig()
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({ ...current, ...config }, null, 2))
}
