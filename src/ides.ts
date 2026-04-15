import fs from 'fs'
import path from 'path'
import os from 'os'

export interface IDE {
  name: string
  detect: () => boolean
  configure: (scriptsDir: string) => void
}

const home = os.homedir()
const platform = process.platform

function mcpConfigPath(): Record<string, string> {
  if (platform === 'darwin') {
    return {
      vscode:    path.join(home, 'Library/Application Support/Code/User/mcp.json'),
      cursor:    path.join(home, 'Library/Application Support/Cursor/User/mcp.json'),
      windsurf:  path.join(home, '.codeium/windsurf/mcp_settings.json'),
    }
  }
  if (platform === 'linux') {
    return {
      vscode:    path.join(home, '.config/Code/User/mcp.json'),
      cursor:    path.join(home, '.config/Cursor/User/mcp.json'),
      windsurf:  path.join(home, '.codeium/windsurf/mcp_settings.json'),
    }
  }
  // Windows
  const appdata = process.env.APPDATA ?? path.join(home, 'AppData/Roaming')
  return {
    vscode:    path.join(appdata, 'Code/User/mcp.json'),
    cursor:    path.join(appdata, 'Cursor/User/mcp.json'),
    windsurf:  path.join(home, '.codeium/windsurf/mcp_settings.json'),
  }
}

function patchMcpJson(filePath: string, serverKey: string, serverEntry: object): void {
  const raw = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '{}'
  const config = JSON.parse(raw)

  // VS Code / Cursor use "servers", Windsurf uses "mcpServers"
  const key = filePath.includes('windsurf') ? 'mcpServers' : 'servers'
  config[key] = config[key] ?? {}

  if (!config[key][serverKey]) {
    config[key][serverKey] = serverEntry
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2))
  }
}

function patchClaudeCode(scriptsDir: string): void {
  const settingsPath = path.join(home, '.claude/settings.json')
  const raw = fs.existsSync(settingsPath) ? fs.readFileSync(settingsPath, 'utf8') : '{}'
  const settings = JSON.parse(raw)

  settings.hooks = settings.hooks ?? {}

  // SessionStart
  settings.hooks.SessionStart = settings.hooks.SessionStart ?? []
  const hasSession = settings.hooks.SessionStart.some((h: any) =>
    h.hooks?.some((hh: any) => hh.command?.includes('healthy-developer'))
  )
  if (!hasSession) {
    settings.hooks.SessionStart.push({
      matcher: 'startup|clear',
      hooks: [{ type: 'command', command: path.join(scriptsDir, 'session-start.sh'), timeout: 5 }],
    })
  }

  // UserPromptSubmit
  settings.hooks.UserPromptSubmit = settings.hooks.UserPromptSubmit ?? []
  const hasPrompt = settings.hooks.UserPromptSubmit.some((h: any) =>
    h.hooks?.some((hh: any) => hh.command?.includes('healthy-developer'))
  )
  if (!hasPrompt) {
    settings.hooks.UserPromptSubmit.push({
      hooks: [{ type: 'command', command: path.join(scriptsDir, 'user-prompt-submit.sh'), timeout: 2 }],
    })
  }

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
}

const mcpEntry = {
  command: 'npx',
  args: ['healthy-developer', 'serve'],
}

const paths = mcpConfigPath()

export const IDES: IDE[] = [
  {
    name: 'Claude Code',
    detect: () => fs.existsSync(path.join(home, '.claude/settings.json')),
    configure: (scriptsDir) => patchClaudeCode(scriptsDir),
  },
  {
    name: 'VS Code',
    detect: () => fs.existsSync(paths.vscode),
    configure: () => patchMcpJson(paths.vscode, 'healthy-developer', mcpEntry),
  },
  {
    name: 'Cursor',
    detect: () => fs.existsSync(paths.cursor),
    configure: () => patchMcpJson(paths.cursor, 'healthy-developer', mcpEntry),
  },
  {
    name: 'Windsurf',
    detect: () => fs.existsSync(paths.windsurf),
    configure: () => patchMcpJson(paths.windsurf, 'healthy-developer', mcpEntry),
  },
  {
    name: 'Zed',
    detect: () => {
      const zedPath = platform === 'darwin'
        ? path.join(home, 'Library/Application Support/Zed/settings.json')
        : path.join(home, '.config/zed/settings.json')
      return fs.existsSync(zedPath)
    },
    configure: () => {
      const zedPath = platform === 'darwin'
        ? path.join(home, 'Library/Application Support/Zed/settings.json')
        : path.join(home, '.config/zed/settings.json')
      const raw = fs.readFileSync(zedPath, 'utf8')
      const config = JSON.parse(raw)
      config.context_servers = config.context_servers ?? {}
      if (!config.context_servers['healthy-developer']) {
        config.context_servers['healthy-developer'] = { command: { path: 'npx', args: ['healthy-developer', 'serve'] } }
        fs.writeFileSync(zedPath, JSON.stringify(config, null, 2))
      }
    },
  },
]

export function detectIDEs(): IDE[] {
  return IDES.filter((ide) => {
    try { return ide.detect() } catch { return false }
  })
}
