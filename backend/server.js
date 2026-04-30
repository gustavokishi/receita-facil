const path = require('path');

// Carrega variáveis de backend/.env e, em seguida, .env na raiz do projeto (sem sobrescrever já definidas).
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const { getDb } = require('./database');

const recipesRouter = require('./routes/recipes');
const pantryRouter = require('./routes/pantry');
const ordersRouter = require('./routes/orders');
const historyRouter = require('./routes/history');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middlewares ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serve arquivos estáticos do frontend
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ── Rotas da API ─────────────────────────────────────────────────────────────
app.use('/api', recipesRouter);
app.use('/api', pantryRouter);
app.use('/api', ordersRouter);
app.use('/api', historyRouter);

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Fallback: serve index.html para rotas do frontend ────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// ── Inicia servidor ───────────────────────────────────────────────────────────
app.listen(PORT, () => {
  // Força inicialização do banco na subida
  getDb();
  console.log(`\n  ReceitaFácil rodando em http://localhost:${PORT}\n`);
  console.log('  Páginas disponíveis:');
  console.log(`    Home      → http://localhost:${PORT}/`);
  console.log(`    Dashboard → http://localhost:${PORT}/dashboard.html`);
  console.log(`    Shopper   → http://localhost:${PORT}/shopper.html`);
  console.log(`    Histórico → http://localhost:${PORT}/history.html\n`);
});
