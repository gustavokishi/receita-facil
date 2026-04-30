/**
 * ReceitaFácil — Shopper Page
 * Gerencia pedidos: aceitar e marcar como entregue
 */

document.addEventListener('DOMContentLoaded', async () => {
  const pendingList   = $('#pending-list');
  const acceptedList  = $('#accepted-list');
  const pendingCount  = $('#pending-count');
  const acceptedCount = $('#accepted-count');
  const refreshBtn    = $('#refresh-btn');

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function sumItemsPrices(items) {
    if (!items || !items.length) return null;
    let s = 0;
    let any = false;
    for (const it of items) {
      const p =
        it.price != null && it.price !== '' ? Number(it.price) : NaN;
      if (!Number.isNaN(p)) {
        s += p;
        any = true;
      }
    }
    return any ? s : null;
  }

  function itemTagHTML(item) {
    const p =
      item.price != null && item.price !== '' ? Number(item.price) : null;
    const pricePart =
      p != null && !Number.isNaN(p)
        ? ` · <span class="item-mini-price">${formatBRL(p)}</span>`
        : '';
    return `<span class="order-item-tag">${esc(item.name)} · ${esc(formatIngredientQuantity(item.name, item.quantity))}${pricePart}</span>`;
  }

  // ── Carrega pedidos ──────────────────────────────────────
  async function loadOrders() {
    pendingList.innerHTML  = loadingHTML();
    acceptedList.innerHTML = loadingHTML();

    try {
      const orders = await API.getOrders();
      const pending  = orders.filter(o => o.status === 'pending');
      const accepted = orders.filter(o => o.status === 'accepted');

      pendingCount.textContent  = pending.length;
      acceptedCount.textContent = accepted.length;

      renderPending(pending);
      renderAccepted(accepted);
    } catch (err) {
      toast.error('Erro ao carregar pedidos', err.message);
      pendingList.innerHTML  = errorHTML();
      acceptedList.innerHTML = '';
    }
  }

  function loadingHTML() {
    return `
      <div class="loading-overlay">
        <div class="spinner"></div>
        <span>Carregando...</span>
      </div>`;
  }

  function errorHTML() {
    return `
      <div class="empty-state">
        <div class="empty-icon">⚠</div>
        <p>Erro ao carregar</p>
      </div>`;
  }

  // ── Render: pedidos pendentes ────────────────────────────
  function renderPending(orders) {
    if (!orders.length) {
      pendingList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon" style="font-size:2rem;">🛒</div>
          <p>Nenhum pedido aguardando</p>
        </div>`;
      return;
    }

    pendingList.innerHTML = orders.map((order) => {
      const total = sumItemsPrices(order.items);
      return `
      <div class="order-card animate-fade" id="order-${order.id}">
        <div class="order-card-header">
          <div>
            <span class="order-id">#${String(order.id).padStart(4, '0')}</span>
            <div style="font-size:0.82rem;color:var(--text-muted);margin-top:0.2rem;">
              ${formatDate(order.created_at)}
            </div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:0.45rem;">
            ${total != null
              ? `<div class="order-total-block">
                  <div class="order-total-label">Total</div>
                  <div class="order-total-value">${formatBRL(total)}</div>
                </div>`
              : ''}
            ${statusBadge(order.status)}
          </div>
        </div>

        <div class="order-items-list">
          ${(order.items || []).map((item) => itemTagHTML(item)).join('')}
        </div>

        <div class="order-actions">
          <button class="btn btn-primary" onclick="acceptOrder(${order.id}, this)">
            ✓ Aceitar pedido
          </button>
        </div>
      </div>`;
    }).join('');
  }

  // ── Render: pedidos aceitos ──────────────────────────────
  function renderAccepted(orders) {
    if (!orders.length) {
      acceptedList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon" style="font-size:2rem;">🛵</div>
          <p>Nenhum pedido em rota</p>
        </div>`;
      return;
    }

    acceptedList.innerHTML = orders.map((order) => {
      const total = sumItemsPrices(order.items);
      return `
      <div class="order-card animate-fade" id="order-${order.id}"
           style="border-color:rgba(59,130,246,0.25);">
        <div class="order-card-header">
          <div>
            <span class="order-id">#${String(order.id).padStart(4, '0')}</span>
            <div style="font-size:0.82rem;color:var(--text-muted);margin-top:0.2rem;">
              ${formatDate(order.created_at)}
            </div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:0.45rem;">
            ${total != null
              ? `<div class="order-total-block">
                  <div class="order-total-label">Total</div>
                  <div class="order-total-value">${formatBRL(total)}</div>
                </div>`
              : ''}
            ${statusBadge(order.status)}
          </div>
        </div>

        <div class="order-items-list">
          ${(order.items || []).map((item) => itemTagHTML(item)).join('')}
        </div>

        <div class="order-actions">
          <button class="btn btn-orange" onclick="deliverOrder(${order.id}, this)">
            🏠 Marcar entregue
          </button>
        </div>
      </div>`;
    }).join('');
  }

  // ── Aceitar pedido ────────────────────────────────────────
  window.acceptOrder = async (id, btn) => {
    setLoading(btn, true);
    try {
      await API.acceptOrder(id);
      toast.success('Pedido aceito!', `Pedido #${String(id).padStart(4,'0')} em rota.`);
      await loadOrders();
    } catch (err) {
      toast.error('Erro', err.message);
      setLoading(btn, false);
    }
  };

  // ── Entregar pedido ───────────────────────────────────────
  window.deliverOrder = async (id, btn) => {
    setLoading(btn, true);
    try {
      await API.deliverOrder(id);
      toast.success('Entregue!', `Pedido #${String(id).padStart(4,'0')} foi entregue.`);

      // Anima remoção do card
      const card = $(`#order-${id}`);
      if (card) {
        card.style.transition = 'all 0.35s ease';
        card.style.opacity = '0';
        card.style.transform = 'translateX(40px)';
        setTimeout(() => loadOrders(), 350);
      } else {
        await loadOrders();
      }
    } catch (err) {
      toast.error('Erro', err.message);
      setLoading(btn, false);
    }
  };

  // ── Refresh ───────────────────────────────────────────────
  refreshBtn.addEventListener('click', async () => {
    setLoading(refreshBtn, true);
    await loadOrders();
    setLoading(refreshBtn, false);
    toast.info('Atualizado', 'Lista de pedidos recarregada.');
  });

  // ── Auto-refresh a cada 30s ────────────────────────────────
  let autoRefreshInterval = setInterval(loadOrders, 30_000);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearInterval(autoRefreshInterval);
    } else {
      loadOrders();
      autoRefreshInterval = setInterval(loadOrders, 30_000);
    }
  });

  // ── Carga inicial ─────────────────────────────────────────
  await loadOrders();
});
