import express from 'express';
import cors from 'cors';
import { ConfigRegistry } from './runtime/configRegistry';
import { HttpError } from './runtime/errors';

const app = express();
const registry = new ConfigRegistry();
const port = Number(process.env.ENGINE_MANAGER_PORT ?? 4004);

app.use(cors());
app.use(
  express.json({
    limit: '2mb',
    type: [
      'application/json',
      'application/json-patch+json',
      'application/merge-patch+json',
    ],
  }),
);

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'engine-manager',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/configs', (_req, res) => {
  res.json({
    items: registry.list(),
  });
});

app.post(['/api/NewConf', '/api/configs'], async (req, res, next) => {
  try {
    console.log('Creating config', req.body);
    const snapshot = await registry.create(req.body);
    res.status(201).json(snapshot);
  } catch (error) {
    next(error);
  }
});

app.get(['/api/GetConf/:id', '/api/configs/:id'], (req, res, next) => {
  try {
    res.json(registry.get(readRouteParam(req.params.id, 'id')));
  } catch (error) {
    next(error);
  }
});

app.patch(['/api/ApplyPatch/:id', '/api/configs/:id'], async (req, res, next) => {
  try {
    const snapshot = await registry.applyPatch(
      readRouteParam(req.params.id, 'id'),
      req.body,
      req.headers['content-type']?.split(';')[0],
    );
    res.json(snapshot);
  } catch (error) {
    next(error);
  }
});

app.delete(['/api/DeleteConf/:id', '/api/configs/:id'], (req, res, next) => {
  try {
    res.json(registry.delete(readRouteParam(req.params.id, 'id')));
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json({
      error: 'Invalid JSON payload',
    });
    return;
  }

  if (error instanceof HttpError) {
    res.status(error.statusCode).json({
      error: error.message,
      details: error.details,
    });
    return;
  }

  const message = error instanceof Error ? error.message : 'Internal server error';
  res.status(500).json({
    error: message,
  });
});

app.listen(port, () => {
  console.log(`Engine manager is listening on http://localhost:${port}`);
});

function readRouteParam(value: string | string[] | undefined, name: string): string {
  if (typeof value === 'string' && value.trim() !== '') {
    return value;
  }
  throw new HttpError(400, `Route parameter "${name}" is required`);
}
