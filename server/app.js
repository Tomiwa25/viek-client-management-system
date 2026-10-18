import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { authRouter } from './src/routes/auth.routes.js';
import { leadsRouter } from './src/routes/leads.routes.js';
import { clientsRouter } from './src/routes/clients.routes.js';
import { tasksRouter } from './src/routes/tasks.routes.js';
import { interactionsRouter } from './src/routes/interactions.routes.js';
import { projectsRouter } from './src/routes/projects.routes.js';

export function createApp({ frontendOrigin = 'http://localhost:5173' } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: frontendOrigin, credentials: true }));
  app.use(cookieParser());
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/v1/health', (_req, res) => res.json({ status: 'ok', service: 'clientflow-api' }));
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/team', teamRouter);
  app.use('/api/v1/leads', leadsRouter);
  app.use('/api/v1/clients', clientsRouter);
  app.use('/api/v1/tasks', tasksRouter);
  app.use('/api/v1/interactions', interactionsRouter);
  app.use('/api/v1/projects', projectsRouter);

  // Legacy / assessment API compatibility routes
  app.use('/api/projects', projectsRouter);
  app.use('/api/clients', clientsRouter);
  app.use('/api/login', (req, res, next) => {
    req.url = '/login';
    authRouter(req, res, next);
  });

  app.use('/api/v1', (_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint not found' } }));
  app.use((err, _req, res, _next) => {
    if (err instanceof SyntaxError && 'body' in err) {
      return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Malformed JSON body' } });
    }
    console.error(err);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' } });
  });

  return app;
}
