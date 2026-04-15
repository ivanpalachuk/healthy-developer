import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/cli.ts', 'src/mcp-server.ts'],
  format: ['esm'],
  target: 'node18',
  clean: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
})
