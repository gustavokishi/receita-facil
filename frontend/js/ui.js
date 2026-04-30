/**
 * ReceitaFácil — UI Utilities
 * Toast, skeleton, helpers de DOM
 */

// ── Toast ────────────────────────────────────────────────────
function getToastContainer() {
  let c = document.getElementById('toast-container');
  if (!c) {
    c = document.createElement('div');
    c.id = 'toast-container';
    document.body.appendChild(c);
  }
  return c;
}

/**
 * Exibe um toast
 * @param {'success'|'error'|'info'|'warning'} type
 * @param {string} title
 * @param {string} [message]
 * @param {number} [duration=3500]
 */
function showToast(type, title, message = '', duration = 3500) {
  const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
  const container = getToastContainer();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || 'ℹ'}</span>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      ${message ? `<div class="toast-message">${message}</div>` : ''}
    </div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('hide');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, duration);
}

window.toast = {
  success: (t, m, d) => showToast('success', t, m, d),
  error:   (t, m, d) => showToast('error', t, m, d),
  info:    (t, m, d) => showToast('info', t, m, d),
  warning: (t, m, d) => showToast('warning', t, m, d),
};

// ── Helpers de DOM ───────────────────────────────────────────
/**
 * Query helper
 * @param {string} sel
 * @param {Element} [ctx=document]
 */
function $(sel, ctx = document) {
  return ctx.querySelector(sel);
}

function $$(sel, ctx = document) {
  return [...ctx.querySelectorAll(sel)];
}

/** Define loading state em um botão */
function setLoading(btn, loading) {
  if (loading) {
    btn.dataset.originalText = btn.innerHTML;
    btn.classList.add('btn-loading');
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-text">...</span>';
  } else {
    btn.classList.remove('btn-loading');
    btn.disabled = false;
    btn.innerHTML = btn.dataset.originalText || btn.innerHTML;
  }
}

/** Formata data ISO para pt-BR */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/** Gera estrelas HTML */
function starsHTML(rating, interactive = false, orderId = null) {
  if (interactive) {
    return `
      <div class="stars" id="stars-${orderId}" data-order-id="${orderId}">
        ${[1,2,3,4,5].map(n => `
          <span class="star ${rating >= n ? 'active' : ''}"
                data-value="${n}"
                title="${n} estrela${n > 1 ? 's' : ''}">★</span>
        `).join('')}
      </div>
    `;
  }
  return `
    <div class="stars stars-display">
      ${[1,2,3,4,5].map(n => `
        <span class="star ${rating >= n ? 'active' : ''}">★</span>
      `).join('')}
    </div>
  `;
}

/** Ativa link de navbar correspondente à página atual */
function highlightNav() {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  $$('.nav-link').forEach(link => {
    const href = link.getAttribute('href');
    if (href === path || (path === '' && href === 'index.html')) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

/** Status → badge HTML */
function statusBadge(status) {
  const map = {
    pending:   ['badge-yellow',  'Aguardando'],
    accepted:  ['badge-blue',    'Aceito'],
    delivered: ['badge-green',   'Entregue'],
  };
  const [cls, label] = map[status] || ['badge-gray', status];
  return `<span class="badge ${cls}">${label}</span>`;
}

// Expõe globais
window.$ = $;
window.$$ = $$;
window.setLoading = setLoading;
window.formatDate = formatDate;
window.starsHTML = starsHTML;
window.highlightNav = highlightNav;
window.statusBadge = statusBadge;

document.addEventListener('DOMContentLoaded', highlightNav);
