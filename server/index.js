'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { createProxyMiddleware, fixRequestBody } = require('http-proxy-middleware');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const formRouter = require('./routes/form');
const { injectMetrika } = require('./services/metrika');

const PORT = Number(process.env.PORT || 3000);
const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://127.0.0.1:8000';
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const WEB_DIR = path.join(__dirname, '..', 'web');

const app = express();
app.use(cors());

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'vitalis-node',
    metrika: Boolean(process.env.YANDEX_METRIKA_ID),
    python: PYTHON_API_URL,
  });
});

// Прокси AI до json-parser — иначе тело POST «съедается» и запрос зависает
app.use(
  '/api/ai',
  createProxyMiddleware({
    target: PYTHON_API_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/ai': '' },
    on: {
      proxyReq: fixRequestBody,
      error(err, _req, res) {
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              error: 'Python API недоступен',
              detail: err.message,
              hint: 'Запустите: cd backend && .venv312\\Scripts\\python -m uvicorn app.main:app --port 8000',
            })
          );
        }
      },
    },
  })
);

app.use(express.json({ limit: '1mb' }));
app.use('/api/leads', formRouter);

function sendHtml(filePath, res) {
  fs.readFile(filePath, 'utf8', (err, html) => {
    if (err) {
      res.status(404).send('Not found');
      return;
    }
    res.type('html').send(injectMetrika(html));
  });
}

app.get('/', (_req, res) => sendHtml(path.join(PUBLIC_DIR, 'index.html'), res));
app.get('/app', (_req, res) => sendHtml(path.join(WEB_DIR, 'app.html'), res));
app.get('/app/', (_req, res) => sendHtml(path.join(WEB_DIR, 'app.html'), res));

app.use('/assets', express.static(path.join(WEB_DIR, 'assets')));
app.use(express.static(PUBLIC_DIR));

app.listen(PORT, () => {
  console.log(`Vitalis Node: http://localhost:${PORT}`);
  console.log(`Лендинг:      http://localhost:${PORT}/`);
  console.log(`Продукт:      http://localhost:${PORT}/app`);
  console.log(`AI proxy →    ${PYTHON_API_URL}`);
});
