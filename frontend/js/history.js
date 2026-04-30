/**
 * ReceitaFácil — History Page
 * Lista pedidos entregues e permite avaliação por estrelas
 */

document.addEventListener('DOMContentLoaded', async () => {
  const historyList  = $('#history-list');
  const emptyState   = $('#empty-state');
  const totalOrders  = $('#total-orders');
  const avgRating    = $('#avg-rating');
  const refreshBtn   = $('#refresh-btn');

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

  // ── Carrega histórico ─────────────────────────────────────
  async function loadHistory() {
    historyList.innerHTML = `
      <div class="loading-overlay">
        <div class="spinner spinner-lg"></div>
        <span>Carregando histórico...</span>
      </div>`;
    emptyState.style.display = 'none';

    try {
      const entries = await API.getHistory();
      renderHistory(entries);
    } catch (err) {
      toast.error('Erro ao carregar histórico', err.message);
      historyList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚠</div>
          <p>Erro ao carregar. Tente novamente.</p>
        </div>`;
    }
  }

  // ── Render ────────────────────────────────────────────────
  function renderHistory(entries) {
    // Estatísticas
    totalOrders.textContent = entries.length;
    const rated = entries.filter(e => e.rating > 0);
    const avg   = rated.length
      ? (rated.reduce((s, e) => s + e.rating, 0) / rated.length).toFixed(1)
      : '—';
    avgRating.textContent = avg;

    if (!entries.length) {
      historyList.innerHTML = '';
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';
    historyList.innerHTML = entries.map((entry, idx) => {
      const total = sumItemsPrices(entry.items);
      return `
      <div class="history-card animate-fade" style="animation-delay:${idx * 0.04}s">
        <div class="history-card-header">
          <div>
            <div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.3rem;flex-wrap:wrap;">
              <span class="order-id">#${String(entry.order_id).padStart(4,'0')}</span>
              <span class="badge badge-green">Entregue</span>
              ${total != null
                ? `<span class="badge badge-orange">${formatBRL(total)}</span>`
                : ''}
            </div>
            <div style="font-weight:700;font-size:1rem;color:var(--text-primary);">
              ${esc(entry.recipe_title || 'Pedido avulso')}
            </div>
            <div style="font-size:0.78rem;color:var(--text-muted);margin-top:0.2rem;">
              ${formatDate(entry.delivered_at)}
            </div>
          </div>

          <!-- Widget de avaliação -->
          <div class="rating-widget">
            <div class="rating-label">Avaliação</div>
            ${entry.rating > 0
              ? `<div>
                  ${starsHTML(entry.rating)}
                  <div style="font-size:0.78rem;color:var(--text-muted);text-align:right;margin-top:0.2rem;">
                    ${entry.rating}/5
                  </div>
                </div>`
              : starsHTML(0, true, entry.order_id)
            }
          </div>
        </div>

        <!-- Itens do pedido -->
        <div class="order-items-list">
          ${(entry.items || []).map((item) => itemTagHTML(item)).join('')}
          ${!entry.items?.length ? '<span class="text-muted text-small">Sem itens registrados</span>' : ''}
        </div>

        ${entry.rating === 0 ? `
          <div class="card-footer" style="justify-content:center;">
            <span style="font-size:0.8rem;color:var(--text-muted);">
              Clique nas estrelas para avaliar
            </span>
          </div>
        ` : ''}
      </div>`;
    }).join('');

    // Ativa eventos de rating nas estrelas interativas
    $$('.stars[id^="stars-"]').forEach(starsEl => {
      const orderId = parseInt(starsEl.dataset.orderId);
      starsEl.querySelectorAll('.star').forEach(star => {
        // Hover preview
        star.addEventListener('mouseenter', () => {
          const val = parseInt(star.dataset.value);
          starsEl.querySelectorAll('.star').forEach((s, i) => {
            s.style.color = i < val ? '#f59e0b' : 'var(--text-muted)';
          });
        });

        star.addEventListener('mouseleave', () => {
          starsEl.querySelectorAll('.star').forEach(s => {
            s.style.color = s.classList.contains('active') ? '#f59e0b' : 'var(--text-muted)';
          });
        });

        // Click → salva rating
        star.addEventListener('click', async () => {
          const rating = parseInt(star.dataset.value);
          await submitRating(orderId, rating, starsEl);
        });
      });
    });
  }

  // ── Submit rating ─────────────────────────────────────────
  async function submitRating(orderId, rating, starsEl) {
    // Otimistic UI
    starsEl.querySelectorAll('.star').forEach((s, i) => {
      s.style.color    = i < rating ? '#f59e0b' : 'var(--text-muted)';
      s.style.transform = i < rating ? 'scale(1.1)' : 'scale(1)';
    });

    try {
      await API.rateOrder(orderId, rating);
      toast.success('Avaliação salva!', `${rating} estrela${rating > 1 ? 's' : ''} — obrigado!`);
      // Recarrega para refletir o estado persistido
      setTimeout(loadHistory, 1200);
    } catch (err) {
      toast.error('Erro', err.message);
      // Reverte
      starsEl.querySelectorAll('.star').forEach(s => {
        s.style.color = 'var(--text-muted)';
        s.style.transform = 'scale(1)';
      });
    }
  }

  // ── Refresh ───────────────────────────────────────────────
  refreshBtn.addEventListener('click', async () => {
    setLoading(refreshBtn, true);
    await loadHistory();
    setLoading(refreshBtn, false);
    toast.info('Atualizado', 'Histórico recarregado.');
  });

  // ── Carga inicial ─────────────────────────────────────────
  await loadHistory();
});
