import * as p from '@clack/prompts'
import chalk from 'chalk'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { writeConfig, readConfig, CONFIG_DIR, STATE_FILE, SCRIPTS_DIR } from './utils/config.js'
import { readState } from './utils/state.js'
import { detectIDEs } from './ides.js'
import { t, type Lang } from './i18n.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const command = process.argv[2]

if (!command || command === 'install') {
  await runInstall()
} else if (command === 'serve') {
  await import('./mcp-server.js')
} else if (command === 'status') {
  showStatus()
} else if (command === 'disable') {
  writeConfig({ enabled: false })
  console.log(chalk.yellow('healthy-developer disabled.'))
} else if (command === 'enable') {
  writeConfig({ enabled: true })
  console.log(chalk.green('healthy-developer enabled.'))
} else {
  console.log('Usage: healthy-developer [install|serve|status|enable|disable]')
}

async function runInstall() {
  console.log()
  p.intro(chalk.green('🌱 healthy-developer'))

  // Step 1 — Language first, always shown in all three languages
  const lang = await p.select<Lang>({
    message: 'Select your language / Seleccioná tu idioma / Selecione seu idioma',
    options: [
      { value: 'es', label: 'Español' },
      { value: 'en', label: 'English' },
      { value: 'pt', label: 'Português (BR)' },
    ],
  })

  if (p.isCancel(lang)) {
    p.cancel('Cancelled.')
    process.exit(0)
  }

  const m = t(lang)

  // Step 2 — Wellness config
  const config = await p.group(
    {
      waterInterval: () =>
        p.text({
          message: m.waterInterval,
          initialValue: '30',
          validate: (v) => (isNaN(Number(v)) || Number(v) < 1 ? m.invalidNumber : undefined),
        }),
      dailyLiters: () =>
        p.text({
          message: m.dailyLiters,
          initialValue: '2',
          validate: (v) => (isNaN(Number(v)) || Number(v) < 0.5 ? m.invalidNumber : undefined),
        }),
      walkInterval: () =>
        p.text({
          message: m.walkInterval,
          initialValue: '60',
          validate: (v) => (isNaN(Number(v)) || Number(v) < 1 ? m.invalidNumber : undefined),
        }),
    },
    {
      onCancel: () => {
        p.cancel(m.cancelledInstall)
        process.exit(0)
      },
    }
  )

  const spin = p.spinner()

  // Save config
  spin.start(m.savingConfig)
  fs.mkdirSync(CONFIG_DIR, { recursive: true })
  writeConfig({
    waterIntervalMinutes: Number(config.waterInterval),
    walkIntervalMinutes:  Number(config.walkInterval),
    dailyLiters:          Number(config.dailyLiters),
    language:             lang,
    enabled:              true,
  })

  if (!fs.existsSync(STATE_FILE)) {
    const today = new Date().toISOString().split('T')[0]
    fs.writeFileSync(
      STATE_FILE,
      JSON.stringify({ lastWaterReminder: 0, lastWalkReminder: 0, waterCountToday: 0, lastResetDate: today }, null, 2)
    )
  }
  spin.stop(m.configSaved)

  // Copy scripts
  spin.start(m.installingScripts)
  const srcScripts = path.join(__dirname, '..', 'scripts')
  fs.mkdirSync(SCRIPTS_DIR, { recursive: true })
  for (const file of ['user-prompt-submit.sh', 'session-start.sh']) {
    const src = path.join(srcScripts, file)
    const dest = path.join(SCRIPTS_DIR, file)
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest)
      fs.chmodSync(dest, 0o755)
    }
  }
  spin.stop(m.scriptsInstalled)

  // Auto-detect and configure IDEs
  spin.start(m.detectingIDEs)
  const detected = detectIDEs()
  spin.stop(m.detectingIDEs)

  if (detected.length === 0) {
    p.log.warn(m.noIDEsFound)
  } else {
    for (const ide of detected) {
      spin.start(m.configuringIDE(ide.name))
      try {
        ide.configure(SCRIPTS_DIR)
        spin.stop(m.ideConfigured(ide.name))
      } catch {
        spin.stop(chalk.yellow(m.ideFailed(ide.name)))
      }
    }

    const restartNeeded = detected.filter((i) => i.name !== 'Claude Code')
    if (restartNeeded.length > 0) {
      p.note(restartNeeded.map((i) => `• ${m.restartIDE(i.name)}`).join('\n'), '📌')
    }
  }

  p.outro(chalk.green(m.done))
}

function showStatus() {
  const config = readConfig()
  const state  = readState()
  const lang   = (config.language ?? 'en') as Lang
  const m      = t(lang)
  const now    = Math.floor(Date.now() / 1000)

  const waterElapsed = state.lastWaterReminder === 0 ? null : Math.floor((now - state.lastWaterReminder) / 60)
  const walkElapsed  = state.lastWalkReminder  === 0 ? null : Math.floor((now - state.lastWalkReminder)  / 60)

  console.log()
  console.log(chalk.bold(m.statusTitle))
  console.log()
  console.log(`  ${m.statusEnabled}:        ${config.enabled ? chalk.green('✓') : chalk.red('✗')}`)
  console.log(`  ${m.statusLanguage}:       ${config.language}`)
  console.log(`  ${m.statusWaterEvery}:    ${config.waterIntervalMinutes} ${m.statusMin}`)
  console.log(`  ${m.statusWalkEvery}:     ${config.walkIntervalMinutes} ${m.statusMin}`)
  console.log(`  ${m.statusDailyGoal}:     ${config.dailyLiters}${m.liters}`)
  console.log()
  console.log(`  ${m.statusWaterToday}:    ${state.waterCountToday} ${m.statusReminders}`)
  console.log(`  ${m.statusLastWater}:     ${waterElapsed === null ? m.statusNever : m.statusMinAgo(waterElapsed)}`)
  console.log(`  ${m.statusLastWalk}:      ${walkElapsed  === null ? m.statusNever : m.statusMinAgo(walkElapsed)}`)
  console.log()
}
