/**
 * ReceitaFácil — API Client
 * Centraliza todas as chamadas HTTP ao backend
 */

const API_BASE = '/api';

/**
 * Wrapper fetch com tratamento de erros padronizado
 */
async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const config = {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  };

  const res = await fetch(url, config);
  const data = await res.json();

  if (!res.ok) {
    const err = new Error(data.error || `Erro ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

const API = {
  // ── Receitas ────────────────────────────────────────────
  /**
   * Extrai receita a partir de uma URL
   * @param {string} url
   * @returns {Promise<{ recipe, ingredients, utensils }>}
   */
  extract(url) {
    return request('/extract', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
  },

  /** Lista todas as receitas salvas */
  getRecipes() {
    return request('/recipes');
  },

  /** Detalhe de uma receita pelo id */
  getRecipe(id) {
    return request(`/recipes/${id}`);
  },

  // ── Despensa (Pantry) ───────────────────────────────────
  /**
   * Lista ingredientes, opcionalmente filtrado por recipe_id
   * @param {number|null} recipeId
   */
  getPantry(recipeId = null) {
    const qs = recipeId ? `?recipe_id=${recipeId}` : '';
    return request(`/pantry${qs}`);
  },

  /**
   * Atualiza o status "tem em casa" de um ingrediente
   * @param {number} id
   * @param {boolean} has
   */
  updatePantryItem(id, has) {
    return request('/pantry', {
      method: 'POST',
      body: JSON.stringify({ id, has }),
    });
  },

  /** Atualiza preço estimado (R$) de um ingrediente; use null para limpar */
  updateIngredientPrice(id, price) {
    return request('/pantry', {
      method: 'POST',
      body: JSON.stringify({ id, price }),
    });
  },

  /**
   * Atualiza múltiplos ingredientes de uma vez
   * @param {number[]} ids
   * @param {boolean} has
   */
  updatePantryItems(ids, has) {
    return request('/pantry', {
      method: 'POST',
      body: JSON.stringify({ ids, has }),
    });
  },

  // ── Pedidos ─────────────────────────────────────────────
  /**
   * Cria um novo pedido
   * @param {{ recipe_id?: number, items: Array<{name, quantity}> }} payload
   */
  createOrder(payload) {
    return request('/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Lista pedidos ativos (pending + accepted)
   * @param {string|null} status  filtro opcional de status
   */
  getOrders(status = null) {
    const qs = status ? `?status=${status}` : '';
    return request(`/orders${qs}`);
  },

  /** Detalhes de um pedido */
  getOrder(id) {
    return request(`/orders/${id}`);
  },

  /** Aceita um pedido (pending → accepted) */
  acceptOrder(id) {
    return request(`/orders/${id}/accept`, { method: 'POST' });
  },

  /** Marca pedido como entregue (accepted → delivered) */
  deliverOrder(id) {
    return request(`/orders/${id}/deliver`, { method: 'POST' });
  },

  /**
   * Avalia um pedido entregue
   * @param {number} id
   * @param {number} rating  1-5
   */
  rateOrder(id, rating) {
    return request(`/orders/${id}/rate`, {
      method: 'POST',
      body: JSON.stringify({ rating }),
    });
  },

  // ── Histórico ───────────────────────────────────────────
  /** Lista todo o histórico de pedidos entregues */
  getHistory() {
    return request('/history');
  },
};

// Expõe globalmente
window.API = API;
