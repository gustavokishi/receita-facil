/**
 * ReceitaFácil — Dashboard
 * Gerencia ingredientes, despensa e criação de pedido
 */

document.addEventListener('DOMContentLoaded', async () => {
  const params    = new URLSearchParams(window.location.search);
  const recipeId  = params.get('recipe_id');

  const container       = $('#dashboard-container');
  const recipeTitle     = $('#recipe-title');
  const recipeSubtitle  = $('#recipe-subtitle');
  const ingredientsList = $('#ingredients-list');
  const utensilsList    = $('#utensils-list');
  const shoppingList    = $('#shopping-list');
  const shoppingSection = $('#shopping-section');
  const shoppingEmpty   = $('#shopping-empty');
  const shoppingTotalRow = $('#shopping-total-row');
  const shoppingTotalValue = $('#shopping-total-value');
  const shoppingCount   = $('#shopping-count');
  const orderBtn        = $('#create-order-btn');
  const recipeSelect    = $('#recipe-select');

  let currentRecipe = null;
  let allIngredients = [];
  let allUtensils = [];

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  // ── Inicialização ──────────────────────────────────────────
  await loadRecipes();

  if (recipeId) {
    recipeSelect.value = recipeId;
    await loadRecipeData(recipeId);
  }

  // ── Carrega receitas no seletor ───────────────────────────
  async function loadRecipes() {
    try {
      const recipes = await API.getRecipes();

      if (recipes.length === 0) {
        recipeSelect.innerHTML = '<option value="">Nenhuma receita extraída ainda</option>';
        return;
      }

      recipeSelect.innerHTML = '<option value="">— Selecione uma receita —</option>';
      recipes.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.id;
        opt.textContent = r.title;
        recipeSelect.appendChild(opt);
      });

      // Se não veio recipe_id na URL, auto-seleciona a mais recente
      if (!recipeId) {
        const latest = recipes[0]; // já ordenado por created_at DESC
        recipeSelect.value = latest.id;
        history.replaceState(null, '', `?recipe_id=${latest.id}`);
        await loadRecipeData(latest.id);
      }
    } catch (err) {
      toast.error('Erro', 'Não foi possível carregar receitas.');
    }
  }

  // ── Muda receita ao selecionar ────────────────────────────
  recipeSelect.addEventListener('change', async () => {
    const id = recipeSelect.value;
    if (!id) {
      clearDashboard();
      return;
    }
    await loadRecipeData(id);
    // Atualiza URL sem reload
    history.replaceState(null, '', `?recipe_id=${id}`);
  });

  // ── Carrega dados da receita ──────────────────────────────
  async function loadRecipeData(id) {
    showSkeletons();
    try {
      const data = await API.getRecipe(id);
      currentRecipe = data.recipe;

      // Busca estado da despensa atualizado
      const pantryItems = await API.getPantry(id);

      allIngredients = pantryItems.filter(i => i.type === 'ingredient');
      allUtensils    = pantryItems.filter(i => i.type === 'utensil');

      renderRecipeHeader();
      renderIngredients();
      renderUtensils();
      renderShoppingList();
    } catch (err) {
      toast.error('Erro ao carregar receita', err.message);
      clearDashboard();
    }
  }

  // ── Skeleton ──────────────────────────────────────────────
  function showSkeletons() {
    const skels = Array(5).fill(0).map(() =>
      `<div class="skeleton skeleton-card" style="height:52px;margin-bottom:0.5rem;"></div>`
    ).join('');
    ingredientsList.innerHTML = skels;
    utensilsList.innerHTML = `<div class="skeleton skeleton-card" style="height:80px;"></div>`;
    shoppingList.innerHTML = '';
    shoppingSection.style.display = 'none';
  }

  function clearDashboard() {
    recipeTitle.textContent = 'Selecione uma receita';
    recipeSubtitle.textContent = '';
    ingredientsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🥘</div>
        <p>Nenhuma receita selecionada</p>
      </div>`;
    utensilsList.innerHTML = '';
    shoppingList.innerHTML = '';
    shoppingSection.style.display = 'none';
    currentRecipe = null;
    allIngredients = [];
    allUtensils = [];
  }

  // ── Header da receita ─────────────────────────────────────
  function renderRecipeHeader() {
    recipeTitle.textContent = currentRecipe.title;
    const checked = allIngredients.filter(i => i.has).length;
    recipeSubtitle.textContent =
      `${checked} de ${allIngredients.length} ingredientes na despensa`;
  }

  // ── Lista de ingredientes ─────────────────────────────────
  function renderIngredients() {
    if (!allIngredients.length) {
      ingredientsList.innerHTML = '<div class="empty-state"><p>Sem ingredientes</p></div>';
      return;
    }

    ingredientsList.innerHTML = allIngredients.map((ing) => {
      const icon = getIngredientIcon(ing.name);
      const qty = ing.quantity
        ? esc(formatIngredientQuantity(ing.name, ing.quantity))
        : '';
      const pr =
        ing.price != null && ing.price !== ''
          ? Number(ing.price)
          : null;
      const priceHtml =
        pr != null && !Number.isNaN(pr)
          ? `<span class="pantry-price-readonly">${formatBRL(pr)}</span>`
          : '<span class="pantry-price-readonly pantry-price-readonly--muted">—</span>';
      return `
      <div class="checkbox-item pantry-row ${ing.has ? 'checked' : ''}"
           data-id="${ing.id}" data-type="ingredient">
        <span class="checkbox-custom"></span>
        <span class="item-icon" aria-hidden="true">${icon}</span>
        <div class="pantry-main">
          <span class="checkbox-label">${esc(ing.name)}</span>
          <div class="pantry-meta">
            ${qty ? `<span class="qty-badge">${qty}</span>` : '<span class="qty-badge qty-badge--empty">—</span>'}
            ${priceHtml}
          </div>
        </div>
      </div>`;
    }).join('');

    ingredientsList.querySelectorAll('.checkbox-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        toggleIngredient(item);
      });
    });
  }

  async function toggleIngredient(item) {
    const id = parseInt(item.dataset.id, 10);
    const has = !item.classList.contains('checked');

    item.classList.toggle('checked', has);

    const found = allIngredients.find((i) => i.id === id);
    if (found) found.has = has ? 1 : 0;

    try {
      await API.updatePantryItem(id, has);
      renderShoppingList();
      renderRecipeHeader();
    } catch (err) {
      item.classList.toggle('checked', !has);
      if (found) found.has = has ? 0 : 1;
      toast.error('Erro', 'Não foi possível atualizar a despensa.');
    }
  }

  // ── Lista de utensílios ───────────────────────────────────
  function renderUtensils() {
    if (!allUtensils.length) {
      utensilsList.innerHTML = '';
      return;
    }

    utensilsList.innerHTML = allUtensils.map((u) => {
      const icon = getUtensilIcon(u.name);
      return `
      <div class="utensil-row">
        <span class="item-icon item-icon--utensil" aria-hidden="true">${icon}</span>
        <span class="utensil-name">${esc(u.name)}</span>
      </div>`;
    }).join('');
  }

  // ── Lista de compras ──────────────────────────────────────
  function renderShoppingList() {
    const missing = allIngredients.filter((i) => !i.has);

    if (!missing.length) {
      shoppingSection.style.display = 'none';
      if (shoppingEmpty) shoppingEmpty.style.display = 'block';
      if (shoppingTotalRow) shoppingTotalRow.style.display = 'none';
      orderBtn.disabled = true;
      orderBtn.textContent = 'Você tem tudo! ✓';
      return;
    }

    shoppingSection.style.display = 'block';
    if (shoppingEmpty) shoppingEmpty.style.display = 'none';
    shoppingCount.textContent = `${missing.length} item${missing.length > 1 ? 's' : ''}`;
    orderBtn.disabled = false;
    orderBtn.innerHTML = `🛒 Criar pedido (${missing.length} itens)`;

    let sum = 0;
    let anyPrice = false;

    shoppingList.innerHTML = missing
      .map((i) => {
        const icon = getIngredientIcon(i.name);
        const qty = i.quantity
          ? esc(formatIngredientQuantity(i.name, i.quantity))
          : '—';
        const pr =
          i.price != null && i.price !== ''
            ? Number(i.price)
            : null;
        if (pr != null && !Number.isNaN(pr)) {
          sum += pr;
          anyPrice = true;
        }
        const priceCell =
          pr != null && !Number.isNaN(pr)
            ? `<span class="shopping-item-price">${formatBRL(pr)}</span>`
            : '<span class="shopping-item-price shopping-item-price--empty">—</span>';
        return `
      <div class="shopping-item animate-fade">
        <span class="shopping-item-icon" aria-hidden="true">${icon}</span>
        <span class="shopping-item-dot"></span>
        <span class="shopping-item-name">${esc(i.name)}</span>
        <span class="shopping-item-qty">${qty}</span>
        ${priceCell}
      </div>`;
      })
      .join('');

    if (shoppingTotalRow && shoppingTotalValue) {
      if (anyPrice) {
        shoppingTotalRow.style.display = 'flex';
        shoppingTotalValue.textContent = formatBRL(sum);
      } else {
        shoppingTotalRow.style.display = 'none';
      }
    }
  }

  // ── Marcar tudo / desmarcar tudo ──────────────────────────
  const checkAllBtn   = $('#check-all-btn');
  const uncheckAllBtn = $('#uncheck-all-btn');

  if (checkAllBtn) {
    checkAllBtn.addEventListener('click', async () => {
      if (!allIngredients.length) return;
      const ids = allIngredients.map(i => i.id);
      setLoading(checkAllBtn, true);
      try {
        await API.updatePantryItems(ids, true);
        allIngredients.forEach(i => (i.has = 1));
        renderIngredients();
        renderShoppingList();
        renderRecipeHeader();
        toast.success('Despensa atualizada', 'Todos os itens marcados.');
      } catch (err) {
        toast.error('Erro', err.message);
      } finally {
        setLoading(checkAllBtn, false);
      }
    });
  }

  if (uncheckAllBtn) {
    uncheckAllBtn.addEventListener('click', async () => {
      if (!allIngredients.length) return;
      const ids = allIngredients.map(i => i.id);
      setLoading(uncheckAllBtn, true);
      try {
        await API.updatePantryItems(ids, false);
        allIngredients.forEach(i => (i.has = 0));
        renderIngredients();
        renderShoppingList();
        renderRecipeHeader();
        toast.info('Despensa limpa', 'Todos os itens desmarcados.');
      } catch (err) {
        toast.error('Erro', err.message);
      } finally {
        setLoading(uncheckAllBtn, false);
      }
    });
  }

  // ── Criar pedido ──────────────────────────────────────────
  orderBtn.addEventListener('click', async () => {
    const missing = allIngredients.filter(i => !i.has);
    if (!missing.length) {
      toast.info('Nada a pedir', 'Você já tem todos os ingredientes!');
      return;
    }

    setLoading(orderBtn, true);
    try {
      const items = missing.map((i) => ({
        name: i.name,
        quantity: i.quantity || '1 un',
        price:
          i.price != null && i.price !== '' && !Number.isNaN(Number(i.price))
            ? Number(i.price)
            : null,
      }));
      const result = await API.createOrder({
        recipe_id: currentRecipe?.id || null,
        items,
      });

      toast.success(
        'Pedido criado!',
        `${items.length} item${items.length > 1 ? 's' : ''} adicionado${items.length > 1 ? 's' : ''}.`
      );

      // Navega para o shopper após 1.5s
      setTimeout(() => {
        window.location.href = 'shopper.html';
      }, 1500);
    } catch (err) {
      toast.error('Erro ao criar pedido', err.message);
    } finally {
      setLoading(orderBtn, false);
    }
  });
});
