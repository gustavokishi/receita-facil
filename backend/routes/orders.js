const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

// POST /orders — cria pedido com lista de itens
// Body: { recipe_id, items: [{ name, quantity }] }
router.post('/orders', (req, res) => {
  try {
    const db = getDb();
    const { recipe_id, items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'É necessário ao menos um item no pedido.' });
    }

    const createOrder = db.transaction(() => {
      const orderResult = db
        .prepare('INSERT INTO orders (recipe_id, status) VALUES (?, ?)')
        .run(recipe_id || null, 'pending');

      const orderId = orderResult.lastInsertRowid;

      const itemStmt = db.prepare(
        'INSERT INTO order_items (order_id, name, quantity, price) VALUES (?, ?, ?, ?)'
      );

      for (const item of items) {
        let p = null;
        if (item.price !== undefined && item.price !== null && item.price !== '') {
          const n = typeof item.price === 'number' ? item.price : parseFloat(String(item.price).replace(',', '.'));
          p = Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
        }
        itemStmt.run(orderId, item.name, item.quantity || '1 un', p);
      }

      return orderId;
    });

    const orderId = createOrder();

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    const orderItems = db
      .prepare('SELECT * FROM order_items WHERE order_id = ?')
      .all(orderId);

    res.status(201).json({ order, items: orderItems });
  } catch (err) {
    console.error('Erro ao criar pedido:', err);
    res.status(500).json({ error: 'Erro ao criar pedido.' });
  }
});

// GET /orders — lista pedidos ativos (pending e accepted)
router.get('/orders', (req, res) => {
  try {
    const db = getDb();
    const { status } = req.query;

    let orders;
    if (status) {
      orders = db
        .prepare('SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC')
        .all(status);
    } else {
      orders = db
        .prepare("SELECT * FROM orders WHERE status IN ('pending', 'accepted') ORDER BY created_at DESC")
        .all();
    }

    // Anexa itens a cada pedido
    const ordersWithItems = orders.map((order) => {
      const items = db
        .prepare('SELECT * FROM order_items WHERE order_id = ?')
        .all(order.id);
      return { ...order, items };
    });

    res.json(ordersWithItems);
  } catch (err) {
    console.error('Erro ao listar pedidos:', err);
    res.status(500).json({ error: 'Erro ao listar pedidos.' });
  }
});

// GET /orders/:id — detalhe de um pedido
router.get('/orders/:id', (req, res) => {
  try {
    const db = getDb();
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);

    if (!order) return res.status(404).json({ error: 'Pedido não encontrado.' });

    const items = db
      .prepare('SELECT * FROM order_items WHERE order_id = ?')
      .all(order.id);

    res.json({ ...order, items });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar pedido.' });
  }
});

// POST /orders/:id/accept — muda status para accepted
router.post('/orders/:id/accept', (req, res) => {
  try {
    const db = getDb();
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);

    if (!order) return res.status(404).json({ error: 'Pedido não encontrado.' });
    if (order.status !== 'pending') {
      return res.status(409).json({ error: `Pedido já está com status "${order.status}".` });
    }

    db.prepare("UPDATE orders SET status = 'accepted' WHERE id = ?").run(req.params.id);
    const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);

    res.json(updated);
  } catch (err) {
    console.error('Erro ao aceitar pedido:', err);
    res.status(500).json({ error: 'Erro ao aceitar pedido.' });
  }
});

// POST /orders/:id/deliver — muda status para delivered e cria entrada no histórico
router.post('/orders/:id/deliver', (req, res) => {
  try {
    const db = getDb();
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);

    if (!order) return res.status(404).json({ error: 'Pedido não encontrado.' });
    if (order.status !== 'accepted') {
      return res.status(409).json({ error: `Pedido deve estar "accepted" para ser entregue. Status atual: "${order.status}".` });
    }

    const deliver = db.transaction(() => {
      db.prepare("UPDATE orders SET status = 'delivered' WHERE id = ?").run(req.params.id);

      // Cria entrada no histórico se ainda não existir
      const existing = db
        .prepare('SELECT id FROM history WHERE order_id = ?')
        .get(req.params.id);

      if (!existing) {
        db.prepare('INSERT INTO history (order_id, rating) VALUES (?, 0)').run(req.params.id);
      }
    });

    deliver();

    const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    console.error('Erro ao marcar entrega:', err);
    res.status(500).json({ error: 'Erro ao marcar pedido como entregue.' });
  }
});

// POST /orders/:id/rate — avalia pedido (1-5 estrelas)
router.post('/orders/:id/rate', (req, res) => {
  try {
    const db = getDb();
    const { rating } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Avaliação deve ser entre 1 e 5.' });
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado.' });
    if (order.status !== 'delivered') {
      return res.status(409).json({ error: 'Só é possível avaliar pedidos entregues.' });
    }

    const historyEntry = db
      .prepare('SELECT * FROM history WHERE order_id = ?')
      .get(req.params.id);

    if (!historyEntry) {
      db.prepare('INSERT INTO history (order_id, rating) VALUES (?, ?)').run(
        req.params.id,
        rating
      );
    } else {
      db.prepare('UPDATE history SET rating = ? WHERE order_id = ?').run(
        rating,
        req.params.id
      );
    }

    const updated = db.prepare('SELECT * FROM history WHERE order_id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    console.error('Erro ao avaliar pedido:', err);
    res.status(500).json({ error: 'Erro ao salvar avaliação.' });
  }
});

module.exports = router;
