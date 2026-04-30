const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

// GET /pantry?recipe_id=X — lista todos os ingredientes de uma receita
router.get('/pantry', (req, res) => {
  try {
    const db = getDb();
    const { recipe_id } = req.query;

    let ingredients;
    if (recipe_id) {
      ingredients = db
        .prepare('SELECT * FROM ingredients WHERE recipe_id = ? ORDER BY type, name')
        .all(recipe_id);
    } else {
      ingredients = db
        .prepare('SELECT * FROM ingredients ORDER BY recipe_id, type, name')
        .all();
    }

    res.json(ingredients);
  } catch (err) {
    console.error('Erro ao buscar despensa:', err);
    res.status(500).json({ error: 'Erro ao buscar itens da despensa.' });
  }
});

function parsePrice(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
  if (Number.isNaN(n) || n < 0) return NaN;
  return Math.round(n * 100) / 100;
}

// POST /pantry — atualiza "has" e/ou preço (R$) por ingrediente
// Body: { id, has } | { ids: [1,2,3], has } | { id, price } (price: número ou null para limpar)
router.post('/pantry', (req, res) => {
  try {
    const db = getDb();
    const { id, ids, has, price } = req.body;

    if (ids && Array.isArray(ids)) {
      const updateMany = db.transaction((items) => {
        const stmt = db.prepare('UPDATE ingredients SET has = ? WHERE id = ?');
        for (const itemId of items) {
          stmt.run(has ? 1 : 0, itemId);
        }
      });
      updateMany(ids);
      return res.json({ updated: ids.length });
    }

    if (id === undefined) {
      return res.status(400).json({ error: 'Campo id é obrigatório.' });
    }

    if (has === undefined && price === undefined) {
      return res.status(400).json({ error: 'Informe has e/ou price.' });
    }

    const row = db.prepare('SELECT * FROM ingredients WHERE id = ?').get(id);
    if (!row) {
      return res.status(404).json({ error: 'Ingrediente não encontrado.' });
    }

    let nextHas = row.has;
    let nextPrice = row.price;

    if (has !== undefined) {
      nextHas = has ? 1 : 0;
    }

    if (price !== undefined) {
      const p = parsePrice(price);
      if (Number.isNaN(p)) {
        return res.status(400).json({ error: 'Preço inválido. Use um número positivo.' });
      }
      nextPrice = p;
    }

    db.prepare('UPDATE ingredients SET has = ?, price = ? WHERE id = ?').run(nextHas, nextPrice, id);

    const updated = db.prepare('SELECT * FROM ingredients WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    console.error('Erro ao atualizar despensa:', err);
    res.status(500).json({ error: 'Erro ao atualizar item da despensa.' });
  }
});

module.exports = router;
