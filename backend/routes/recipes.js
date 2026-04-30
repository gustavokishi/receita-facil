const express = require('express');
const https = require('https');
const router = express.Router();
const { getDb } = require('../database');
const { extractRecipeFromYoutube } = require('../services/recipeExtraction');

/**
 * Busca o título real de um vídeo do YouTube via oEmbed API (sem API key).
 * Funciona com: youtube.com/watch?v=..., youtu.be/..., youtube.com/shorts/...
 * @param {string} videoUrl
 * @returns {Promise<{ title: string, author: string } | null>}
 */
function fetchYoutubeMetadata(videoUrl) {
  return new Promise((resolve) => {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`;

    const req = https.get(oembedUrl, { timeout: 7000 }, (res) => {
      if (res.statusCode !== 200) {
        resolve(null);
        res.resume();
        return;
      }

      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({
            title: json.title || null,
            author: json.author_name || null,
            thumbnail: json.thumbnail_url || null,
          });
        } catch {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

/**
 * Verifica se uma URL é do YouTube
 */
function isYoutubeUrl(url) {
  return /(?:youtube\.com|youtu\.be)/i.test(url);
}

/**
 * Detecta a categoria da receita pelo TEXTO (título do vídeo ou URL como fallback).
 * Normaliza acentos e pontuação antes de comparar.
 * @param {string} text
 * @returns {string} categoria
 */
function detectCategory(text) {
  // Normaliza: minúsculas, remove acentos, troca ç→c
  const u = text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/ç/g, 'c');

  if (/\b(bolo|cake|torta|cupcake|brownie|pudim|chocolate|laranja|limao|cenoura|brigadeiro)\b/.test(u)) return 'bolo';
  if (/\b(frango|chicken|galinha|file|peito|coxa)\b/.test(u)) return 'frango';
  if (/\b(macarrao|espaguete|pasta|lasanha|nhoque|fettuccine|penne|carbonara|bolonhesa|massa)\b/.test(u)) return 'macarrao';
  if (/\b(pizza|calzone)\b/.test(u)) return 'pizza';
  if (/\b(salada|salad|caesar|tabule|vinagrete)\b/.test(u)) return 'salada';
  if (/\b(risoto|risotto)\b/.test(u)) return 'risoto';
  if (/\b(sopa|soup|caldo|creme|bisque|minestrone)\b/.test(u)) return 'sopa';
  if (/\b(carne|picanha|steak|bife|costela|assado|churrasco|hamburguer)\b/.test(u)) return 'carne';
  if (/\b(peixe|camarao|salmao|bacalhau|atum|tilapia|frutos do mar|moqueca)\b/.test(u)) return 'peixe';
  if (/\b(arroz|feijao|feijoada|paella|pilaf)\b/.test(u)) return 'arroz';
  return 'default';
}

// POST /extract — legenda do YouTube + OpenRouter (IA)
router.post('/extract', async (req, res) => {
  const { url } = req.body;

  if (!url || typeof url !== 'string' || !url.trim()) {
    return res.status(400).json({ error: 'URL é obrigatória.' });
  }

  const trimmedUrl = url.trim();

  if (!isYoutubeUrl(trimmedUrl)) {
    return res.status(400).json({ error: 'Por enquanto só são aceitos links do YouTube.' });
  }

  try {
    let videoTitle = null;
    let videoAuthor = null;

    console.log(`[extract] Metadados YouTube: ${trimmedUrl}`);
    const meta = await fetchYoutubeMetadata(trimmedUrl);
    if (meta) {
      videoTitle = meta.title;
      videoAuthor = meta.author;
      console.log(`[extract] Título: "${videoTitle}" — Canal: ${videoAuthor}`);
    }

    const textForDetection = videoTitle || trimmedUrl;
    const categoryKey = detectCategory(textForDetection);

    const CATEGORY_LABELS = {
      bolo: 'Receita de Bolo',
      frango: 'Receita de Frango',
      macarrao: 'Receita de Massa',
      pizza: 'Receita de Pizza',
      salada: 'Salada',
      risoto: 'Risoto',
      sopa: 'Sopa',
      carne: 'Receita de Carne',
      peixe: 'Receita de Peixe',
      arroz: 'Receita de Arroz e Feijão',
      default: 'Receita Especial do Chef',
    };
    const recipeTitle = videoTitle || CATEGORY_LABELS[categoryKey] || 'Receita Especial';

    console.log('[extract] Legenda + OpenRouter…');
    const ai = await extractRecipeFromYoutube(trimmedUrl, recipeTitle);

    const db = getDb();
    const recipeResult = db
      .prepare('INSERT INTO recipes (title, url, category) VALUES (?, ?, ?)')
      .run(recipeTitle, trimmedUrl, categoryKey === 'default' ? 'geral' : categoryKey);
    const recipeId = recipeResult.lastInsertRowid;

    const rowsToInsert = [...ai.ingredients, ...ai.utensils];
    const ingredientStmt = db.prepare(
      'INSERT INTO ingredients (recipe_id, name, quantity, type, has, price) VALUES (?, ?, ?, ?, 0, ?)'
    );
    db.transaction((items) => {
      for (const item of items) {
        const price =
          item.type === 'ingredient' && item.price != null && item.price !== ''
            ? Number(item.price)
            : null;
        ingredientStmt.run(
          recipeId,
          item.name,
          item.quantity || '',
          item.type,
          price
        );
      }
    })(rowsToInsert);

    const savedIngredients = db
      .prepare('SELECT * FROM ingredients WHERE recipe_id = ?')
      .all(recipeId);

    const cat =
      categoryKey === 'default' ? 'geral' : categoryKey;

    return res.json({
      recipe: {
        id: recipeId,
        title: recipeTitle,
        url: trimmedUrl,
        category: cat,
        youtube_title: videoTitle,
        youtube_author: videoAuthor,
        ai_model: ai.model,
      },
      ingredients: savedIngredients.filter((i) => i.type === 'ingredient'),
      utensils: savedIngredients.filter((i) => i.type === 'utensil'),
    });
  } catch (err) {
    console.error('[extract] Erro:', err);
    const code = err.code;
    const msg = err.message || 'Erro ao processar receita.';

    if (code === 'INVALID_URL') {
      return res.status(400).json({ error: msg });
    }
    if (
      code === 'TRANSCRIPT_UNAVAILABLE'
      || code === 'TRANSCRIPT_EMPTY'
      || code === 'EMPTY_EXTRACTION'
    ) {
      return res.status(422).json({ error: msg, code });
    }
    if (
      code === 'OPENROUTER_CONNECTION'
      || code === 'OPENROUTER_HTTP'
      || code === 'OPENROUTER_CONFIG'
    ) {
      return res.status(503).json({ error: msg, code });
    }
    if (code === 'OPENROUTER_AUTH') {
      return res.status(401).json({ error: msg, code });
    }
    if (code === 'OPENROUTER_PARSE') {
      return res.status(502).json({ error: msg, code });
    }

    return res.status(500).json({ error: 'Erro interno ao processar receita.' });
  }
});

// GET /recipes — lista todas as receitas salvas
router.get('/recipes', (req, res) => {
  try {
    const db = getDb();
    const recipes = db.prepare('SELECT * FROM recipes ORDER BY created_at DESC').all();
    res.json(recipes);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar receitas.' });
  }
});

// GET /recipes/:id — detalhe de uma receita
router.get('/recipes/:id', (req, res) => {
  try {
    const db = getDb();
    const recipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get(req.params.id);
    if (!recipe) return res.status(404).json({ error: 'Receita não encontrada.' });

    const ingredients = db
      .prepare('SELECT * FROM ingredients WHERE recipe_id = ? AND type = ?')
      .all(recipe.id, 'ingredient');
    const utensils = db
      .prepare('SELECT * FROM ingredients WHERE recipe_id = ? AND type = ?')
      .all(recipe.id, 'utensil');

    res.json({ recipe, ingredients, utensils });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar receita.' });
  }
});

module.exports = router;
