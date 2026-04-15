import * as p from '@clack/prompts'
import chalk from 'chalk'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'
import { writeConfig, readConfig, CONFIG_DIR, CONFIG_FILE, STATE_FILE, SCRIPTS_DIR } from './utils/config.js'
import { readState } from './utils/state.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const command = process.argv[2]

if (!command || command === 'install') {
  await runInstall()
} else if (command === 'serve') {
  // Launch MCP server — used by Cursor/Windsurf/Zed
  const { default: mcp } = await import('./mcp-server.js')
} else if (command === 'status') {
  showStatus()
} else if (command === 'disable') {
  writeConfig({ enabled: false })
  console.log(chalk.yellow('healthy-developer disabled.'))
} else if (command === 'enable') {
  writeConfig({ enabled: true })
  console.log(chalk.green('healthy-developer enabled.'))
} else {
  console.log(`Usage: healthy-developer [install|serve|status|enable|disable]`)
}

async function runInstall() {
  console.log()
  p.intro(chalk.green('🌱 healthy-developer — setup'))

  const config = await p.group(
    {
      waterInterval: () =>
        p.text({
          message: '¿Cada cuántos minutos recordarte tomar agua?',
          initialValue: '30',
          validate: (v) => (isNaN(Number(v)) || Number(v) < 1 ? 'Ingresá un número válido' : undefined),
        }),
      dailyLiters: () =>
        p.text({
          message: '¿Cuántos litros por día querés tomar?',
          initialValue: '2',
          validate: (v) => (isNaN(Number(v)) || Number(v) < 0.5 ? 'Ingresá un número válido' : undefined),
        }),
      walkInterval: () =>
        p.text({
          message: '¿Cada cuántos minutos recordarte caminar?',
          initialValue: '60',
          validate: (v) => (isNaN(Number(v)) || Number(v) < 1 ? 'Ingresá un número válido' : undefined),
        }),
      language: () =>
        p.select({
          message: '¿En qué idioma querés los recordatorios?',
          options: [
            { value: 'es', label: 'Español' },
            { value: 'en', label: 'English' },
          ],
        }),
    },
    {
      onCancel: () => {
        p.cancel('Instalación cancelada.')
        process.exit(0)
      },
    }
  )

  const spin = p.spinner()

  // Save config
  spin.start('Guardando configuración...')
  fs.mkdirSync(CONFIG_DIR, { recursive: true })
  writeConfig({
    waterIntervalMinutes: Number(config.waterInterval),
    walkIntervalMinutes: Number(config.walkInterval),
    dailyLiters: Number(config.dailyLiters),
    language: config.language as 'es' | 'en',
    enabled: true,
  })

  // Initialize state
  if (!fs.existsSync(STATE_FILE)) {
    const today = new Date().toISOString().split('T')[0]
    fs.writeFileSync(
      STATE_FILE,
      JSON.stringify({ lastWaterReminder: 0, lastWalkReminder: 0, waterCountToday: 0, lastResetDate: today }, null, 2)
    )
  }
  spin.stop('Configuración guardada.')

  // Copy scripts
  spin.start('Instalando scripts...')
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
  spin.stop('Scripts instalados.')

  // Patch Claude Code settings.json
  spin.start('Configurando hooks en Claude Code...')
  const claudeSettings = path.join(os.homedir(), '.claude', 'settings.json')
  try {
    const raw = fs.existsSync(claudeSettings) ? fs.readFileSync(claudeSettings, 'utf8') : '{}'
    const settings = JSON.parse(raw)

    settings.hooks = settings.hooks ?? {}

    // SessionStart hook
    settings.hooks.SessionStart = settings.hooks.SessionStart ?? []
    const hasSessionHook = settings.hooks.SessionStart.some((h: any) =>
      h.hooks?.some((hh: any) => hh.command?.includes('healthy-developer'))
    )
    if (!hasSessionHook) {
      settings.hooks.SessionStart.push({
        matcher: 'startup|clear',
        hooks: [{ type: 'command', command: path.join(SCRIPTS_DIR, 'session-start.sh'), timeout: 5 }],
      })
    }

    // UserPromptSubmit hook
    settings.hooks.UserPromptSubmit = settings.hooks.UserPromptSubmit ?? []
    const hasPromptHook = settings.hooks.UserPromptSubmit.some((h: any) =>
      h.hooks?.some((hh: any) => hh.command?.includes('healthy-developer'))
    )
    if (!hasPromptHook) {
      settings.hooks.UserPromptSubmit.push({
        hooks: [{ type: 'command', command: path.join(SCRIPTS_DIR, 'user-prompt-submit.sh'), timeout: 2 }],
      })
    }

    fs.writeFileSync(claudeSettings, JSON.stringify(settings, null, 2))
    spin.stop('Hooks registrados en Claude Code.')
  } catch (e) {
    spin.stop(chalk.yellow('No se pudo patchear Claude Code settings. Podés hacerlo manualmente.'))
  }

  const mcpSnippet = JSON.stringify(
    {
      'healthy-developer': {
        command: 'npx',
        args: ['healthy-developer', 'serve'],
      },
    },
    null,
    2
  )

  p.note(mcpSnippet, 'Para Cursor / Windsurf / Zed — agregá esto a tu config MCP:')

  p.outro(chalk.green('✅ Listo! Reiniciá Claude Code para activarlo.'))
}

function showStatus() {
  const config = readConfig()
  const state = readState()
  const now = Math.floor(Date.now() / 1000)
  const waterElapsed = state.lastWaterReminder === 0 ? null : Math.floor((now - state.lastWaterReminder) / 60)
  const walkElapsed = state.lastWalkReminder === 0 ? null : Math.floor((now - state.lastWalkReminder) / 60)

  console.log()
  console.log(chalk.bold('healthy-developer — status'))
  console.log()
  console.log(`  Enabled:        ${config.enabled ? chalk.green('yes') : chalk.red('no')}`)
  console.log(`  Language:       ${config.language}`)
  console.log(`  Water every:    ${config.waterIntervalMinutes} min`)
  console.log(`  Walk every:     ${config.walkIntervalMinutes} min`)
  console.log(`  Daily goal:     ${config.dailyLiters}L`)
  console.log()
  console.log(`  Water today:    ${state.waterCountToday} reminders`)
  console.log(`  Last water:     ${waterElapsed === null ? 'never' : `${waterElapsed} min ago`}`)
  console.log(`  Last walk:      ${walkElapsed === null ? 'never' : `${walkElapsed} min ago`}`)
  console.log()
}
