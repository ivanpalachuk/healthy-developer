import fs from 'fs'
import path from 'path'
import os from 'os'

export interface Config {
  waterIntervalMinutes: number
  walkIntervalMinutes: number
  dailyLiters: number
  language: 'es' | 'en' | 'pt'
  enabled: boolean
  trackWaterIntake: boolean   // whether to log actual ml consumed
  glassSize: number           // ml per glass (default 250)
}

const DEFAULT_CONFIG: Config = {
  waterIntervalMinutes: 30,
  walkIntervalMinutes: 60,
  dailyLiters: 2,
  language: 'es',
  enabled: true,
  trackWaterIntake: false,
  glassSize: 250,
}

export const CONFIG_DIR = path.join(os.homedir(), '.healthy-developer')
export const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json')
export const STATE_FILE = path.join(CONFIG_DIR, 'state.json')
export const SCRIPTS_DIR = path.join(CONFIG_DIR, 'scripts')

export function readConfig(): Config {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8')
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_CONFIG
  }
}

export function writeConfig(config: Partial<Config>): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true })
  const current = readConfig()
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({ ...current, ...config }, null, 2))
}
