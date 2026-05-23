import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import express from 'express';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '.env'), override: true });
import { runPipeline } from './handler.js';

const app = express();
app.use(express.json({ limit: '1mb' }));

app.use((_, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  next();
});

app.options('*', (_, res) => res.sendStatus(204));

app.get('/health', (_, res) => res.json({ ok: true }));

app.post('/optimize', async (req, res) => {
  try {
    const data = await runPipeline(req.body);
    res.json({ data });
  } catch (e) {
    const status = e.code === 'invalid_input' ? 400 : 500;
    res.status(status).json({
      error: { code: e.code ?? 'internal_error', message: e.message },
    });
  }
});

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log(`dev-server on http://localhost:${port}`);
});
