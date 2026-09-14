import { createServer } from 'vite'

const server = await createServer({ configFile: 'scripts/glass-materials.vite.config.ts' })
await server.listen()
