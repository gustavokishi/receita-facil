/**
 * Ícones por palavras-chave no nome (PT-BR), para ingredientes e utensílios.
 */
(function () {
  const norm = (s) =>
    String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ç/g, 'c');

  const INGREDIENT_RULES = [
    [/ovo|ovos/, '🥚'],
    [/leite|cream|creme de leite|nata/, '🥛'],
    [/manteiga|margarina/, '🧈'],
    [/queijo|mu[cç]arela|parmes[aã]o|ricota|requeij[aã]o/, '🧀'],
    [/farinha|trigo|fub[aá]|polvilho|amido/, '🌾'],
    [/a[cç][uú]car|mel\b|ado[cç]ante/, '🍯'],
    [/cacau|chocolate/, '🍫'],
    [/caf[eé]|caf\b/, '☕'],
    [/sal\b|sal grosso/, '🧂'],
    [/fermento/, '📦'],
    [/tomate|extrato de tomate|molho de tomate/, '🍅'],
    [/cebola|chal[oô]ta/, '🧅'],
    [/alho/, '🧄'],
    [/cenoura/, '🥕'],
    [/batata|batata-doce/, '🥔'],
    [/abobrinha|ab[oó]bora/, '🎃'],
    [/piment[aã]o|pimenta\b/, '🌶️'],
    [/lim[aã]o|lim[aã]o siciliano/, '🍋'],
    [/laranja/, '🍊'],
    [/banana/, '🍌'],
    [/ma[cç][aã]|ma[cç]ã/, '🍎'],
    [/frango|galinha|peito|coxa|asa/, '🍗'],
    [/carne|bo[lvl]inh|mo[ií]da|bacon|lingui[cç]a|presunto/, '🥩'],
    [/peixe|salm[aã]o|bacalhau|atum|til[aá]pia|camar[aã]o/, '🐟'],
    [/arroz\b/, '🍚'],
    [/feij[aã]o/, '🫘'],
    [/macarr[aã]o|espaguete|massa|lasanha|nhoque/, '🍝'],
    [/p[aã]o|rabanada|torrada/, '🍞'],
    [/azeite|[oó]leo|margarina liquida/, '🫒'],
    [/vinho\b/, '🍷'],
    [/cerveja/, '🍺'],
    [/\bagua\b|agua morna/, '💧'],
    [/coco\b|rasp[aã] de coco/, '🥥'],
    [/noz\b|am[eê]ndoas|castanha|avel[aã]/, '🌰'],
    [/hortel[aã]|manjeric[aã]o|salsinha|coentro|cebolinha|alecrim|tomilho|or[eé]gano|manjerona/, '🌿'],
    [/alface|r[uú]cula|espinafre/, '🥬'],
    [/milho\b/, '🌽'],
    [/ervilha/, '🫛'],
    [/mirtilo|morango|frutas vermelhas/, '🫐'],
    [/chantilly|nata batida/, '🍦'],
  ];

  /**
   * Quando a quantidade veio só como número inteiro (ex.: "4") e o item é tipicamente contado em unidades.
   */
  function formatIngredientQuantity(name, quantity) {
    const raw = String(quantity ?? '').trim();
    if (!raw) return '';
    if (!/^\d+$/.test(raw)) return raw;
    const n = parseInt(raw, 10);
    const nm = norm(name);
    const countable =
      /\b(ovos?|gemas?|claras?)\b/.test(nm)
      || /\b(bananas?|tomates?|laranjas?|macas?|macãs?)\b/.test(nm)
      || /\b(batatas?\b|cebolas?\b|lim(ões|ao))\b/.test(nm)
      || /\b(dentes\b|folhas\b)/.test(nm);
    if (!countable) return raw;
    return `${n} ${n === 1 ? 'unidade' : 'unidades'}`;
  }

  /** Mais específicos primeiro — ícones distintos para não repetir panela/frigideira. */
  const UTENSIL_RULES = [
    [/banho[-\s]?maria/, '♨️'],
    [/ta[cç]as?|copos?\b|ta[cç]a\b/, '🥂'],
    [/liquidificador|processador/, '🌪️'],
    [/batedeira|mixer\b|globo\b/, '🔄'],
    [/frigideira|skillet/, '🍳'],
    [/panela|caldeir[aã]o|cacarola/, '🍲'],
    [/forno|micro[- ]?ondas/, '🔥'],
    [/fouet|batedor|colher de pau/, '🥄'],
    [/forma|assadeira|tabuleiro|molde/, '📐'],
    [/rolo de massa|sova/, '🌀'],
    [/t[aá]bua/, '🪵'],
    [/faca|esp[aá]tula|picador/, '🔪'],
    [/tigela|bowl|ramequin/, '🥣'],
    [/peneira|r[aä]lo|ralador/, '🧺'],
    [/escorredor|coador/, '🫗'],
    [/term[oô]metro/, '🌡️'],
    [/concha|pegador/, '🥄'],
    [/triturador|pil[aã]o/, '⚙️'],
    [/grill|chapa|grelha/, '🍖'],
    [/pincel de cozinha/, '🖌️'],
    [/descascador|pelador/, '🔧'],
  ];

  function pickIcon(name, rules, fallback) {
    const n = norm(name);
    for (const [re, icon] of rules) {
      if (re.test(n)) return icon;
    }
    return fallback;
  }

  window.getIngredientIcon = function getIngredientIcon(name) {
    return pickIcon(name, INGREDIENT_RULES, '🛒');
  };

  window.getUtensilIcon = function getUtensilIcon(name) {
    return pickIcon(name, UTENSIL_RULES, '🧑‍🍳');
  };

  window.formatIngredientQuantity = formatIngredientQuantity;

  window.formatBRL = function formatBRL(value) {
    if (value === null || value === undefined || value === '') return '';
    const num = typeof value === 'number' ? value : parseFloat(value);
    if (Number.isNaN(num)) return '';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(num);
  };
})();
