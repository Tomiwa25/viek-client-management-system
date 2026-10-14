import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
export function createApp({ frontendOrigin = 'http://localhost:5173' } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: frontendOrigin }));
  app.use(express.json({ limit: '100kb' }));
  app.get('/api/v1/health', (_req, res) => res.json({ status: 'ok', service: 'clientflow-api' }));
  app.use('/api/v1', (_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint not found' } }));
  app.use((err, _req, res, _next) => { if (err instanceof SyntaxError && 'body' in err) return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Malformed JSON body' } }); console.error(err); return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' } }); });
  return app;
}
