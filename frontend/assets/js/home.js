/**
 * ReceitaFácil — Home Page
 * Lógica de extração de receita
 */

document.addEventListener('DOMContentLoaded', () => {
  const form      = $('#extract-form');
  const urlInput  = $('#url-input');
  const extractBtn = $('#extract-btn');
  const resultBox = $('#extract-result');

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  // ── Sugestões de URL ──────────────────────────────────────
  const hints = [
    'https://www.youtube.com/watch?v=JRzEuBwmqOg',
    'https://www.youtube.com/watch?v=<id-de-receita-de-frango>',
    'https://youtu.be/<id-de-receita-de-pizza>',
    'https://www.youtube.com/watch?v=<id-de-receita-de-massa>',
  ];

  // Rotaciona hint no placeholder
  let hintIdx = 0;
  urlInput.placeholder = 'Cole o link do YouTube aqui...';
  setInterval(() => {
    hintIdx = (hintIdx + 1) % hints.length;
    urlInput.placeholder = hints[hintIdx];
  }, 4000);

  // ── Submit form ───────────────────────────────────────────
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = urlInput.value.trim();

    if (!url) {
      toast.warning('URL vazia', 'Cole o link de um vídeo de receita.');
      urlInput.focus();
      return;
    }

    showSkeleton();
    setLoading(extractBtn, true);

    try {
      toast.info('Processando…', 'Baixando legenda do YouTube e extraindo ingredientes com a IA (pode levar um minuto).');
      const data = await API.extract(url);
      showResult(data);
      toast.success('Receita extraída!', data.recipe.title);

      // Salva no localStorage como cache
      localStorage.setItem('last_recipe', JSON.stringify(data));
    } catch (err) {
      hideSkeleton();
      toast.error('Erro ao extrair', err.message || 'Tente novamente.');
    } finally {
      setLoading(extractBtn, false);
    }
  });

  // ── Skeleton ──────────────────────────────────────────────
  function showSkeleton() {
    resultBox.innerHTML = `
      <div class="card animate-fade">
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton skeleton-text" style="width:80%"></div>
        <div style="margin-top:1rem;display:flex;flex-direction:column;gap:0.5rem;">
          ${Array(5).fill(0).map(() =>
            `<div class="skeleton skeleton-card" style="height:52px"></div>`
          ).join('')}
        </div>
      </div>
    `;
    resultBox.style.display = 'block';
  }

  function hideSkeleton() {
    resultBox.innerHTML = '';
    resultBox.style.display = 'none';
  }

  // ── Resultado ─────────────────────────────────────────────
  function showResult({ recipe, ingredients, utensils }) {
    const authorLine = recipe.youtube_author
      ? `<span class="chip">▶ ${recipe.youtube_author}</span> &nbsp;`
      : '';

    resultBox.innerHTML = `
      <div class="card card-accent animate-fade">
        <div class="card-header">
          <div>
            <div class="card-title">${esc(recipe.title)}</div>
            <div class="card-subtitle">
              ${authorLine}<span class="chip">${recipe.category}</span>
              &nbsp;${ingredients.length} ingredientes · ${utensils.length} utensílios
              ${recipe.ai_model ? ` · <span class="chip" title="Modelo (OpenRouter)">🤖 ${recipe.ai_model}</span>` : ''}
            </div>
          </div>
          <span class="badge badge-green">Extraído</span>
        </div>

        <div class="section-title">Ingredientes</div>
        <div style="display:flex;flex-direction:column;gap:0.4rem;margin-bottom:1rem;">
          ${ingredients.map((i) => {
            const pr = i.price != null && i.price !== '' ? Number(i.price) : null;
            const priceTxt =
              pr != null && !Number.isNaN(pr)
                ? `<span class="qty-badge" style="font-size:0.78rem;">${formatBRL(pr)}</span>`
                : '';
            return `
            <div class="checkbox-item" style="cursor:default;justify-content:space-between;">
              <span style="font-size:0.85rem;color:var(--text-primary);">${esc(i.name)}</span>
              <span style="display:flex;align-items:center;gap:0.45rem;">
                ${i.quantity ? `<span class="checkbox-qty">${formatIngredientQuantity(i.name, i.quantity)}</span>` : ''}
                ${priceTxt}
              </span>
            </div>`;
          }).join('')}
        </div>

        ${utensils.length ? `
          <div class="section-title">Utensílios</div>
          <div style="display:flex;flex-wrap:wrap;gap:0.4rem;margin-bottom:1rem;">
            ${utensils.map((u) => `<span class="chip">${getUtensilIcon(u.name)} ${esc(u.name)}</span>`).join('')}
          </div>
        ` : ''}

        <div class="divider"></div>
        <a href="dashboard.html?recipe_id=${recipe.id}" class="btn btn-primary btn-block btn-lg">
          Ir para o Dashboard →
        </a>
      </div>
    `;
    resultBox.style.display = 'block';
  }

  // ── Restaura última receita do localStorage ────────────────
  const last = localStorage.getItem('last_recipe');
  if (last) {
    try {
      const parsed = JSON.parse(last);
      // Não auto-mostra, só mantém o link disponível
      const hint = document.createElement('div');
      hint.style.cssText = `
        margin-top: 0.75rem;
        font-size: 0.82rem;
        color: var(--text-muted);
        text-align: center;
      `;
      hint.innerHTML = `
        Última receita: <a href="dashboard.html?recipe_id=${parsed.recipe.id}"
          style="color:var(--accent);">${parsed.recipe.title}</a>
      `;
      form.after(hint);
    } catch (_) { /* ignora cache inválido */ }
  }
});
