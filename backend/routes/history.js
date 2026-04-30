const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

// GET /history — lista pedidos entregues com avaliação
router.get('/history', (req, res) => {
  try {
    const db = getDb();

    const entries = db
      .prepare(`
        SELECT
          h.id         AS history_id,
          h.order_id,
          h.rating,
          h.created_at AS delivered_at,
          o.created_at AS ordered_at,
          o.recipe_id,
          r.title      AS recipe_title,
          r.category   AS recipe_category
        FROM history h
        JOIN orders o ON o.id = h.order_id
        LEFT JOIN recipes r ON r.id = o.recipe_id
        ORDER BY h.created_at DESC
      `)
      .all();

    // Adiciona itens de cada pedido
    const result = entries.map((entry) => {
      const items = db
        .prepare('SELECT * FROM order_items WHERE order_id = ?')
        .all(entry.order_id);
      return { ...entry, items };
    });

    res.json(result);
  } catch (err) {
    console.error('Erro ao buscar histórico:', err);
    res.status(500).json({ error: 'Erro ao buscar histórico.' });
  }
});

module.exports = router;
