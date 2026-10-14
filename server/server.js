import { createApp } from './app.js';
import { loadEnv } from './src/config/env.js';
const env = loadEnv();
const server = createApp({ frontendOrigin: env.FRONTEND_ORIGIN }).listen(env.PORT, () => console.log(`ClientFlow API listening on port ${env.PORT}`));
function shutdown() { server.close(() => process.exit(0)); }
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);