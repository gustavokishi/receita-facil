/**
 * Estimativa de preço (R$) quando a IA não envia valor — referência grosseira para mercado BR.
 */
function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ç/g, 'c');
}

const RULES = [
  [/ovo/, 9],
  [/leite/, 6],
  [/manteiga|margarina/, 12],
  [/queijo|mussarela|parmesao|ricota/, 18],
  [/farinha/, 8],
  [/acucar|mel\b/, 10],
  [/cacau|chocolate/, 15],
  [/fermento/, 8],
  [/tomate|extrato/, 7],
  [/cebola/, 5],
  [/alho/, 4],
  [/cenoura/, 5],
  [/batata/, 6],
  [/lim[aã]o|laranja/, 6],
  [/frango|peito/, 22],
  [/carne|bacon|linguica|mo[ií]da/, 28],
  [/peixe|salmao|camarao/, 35],
  [/arroz\b/, 12],
  [/feij[aã]o/, 9],
  [/macarrao|massa|espaguete/, 10],
  [/azeite|[oó]leo/, 14],
  [/batata-palha/, 16],
  [/creme de leite/, 8],
  [/leite condensado/, 10],
  [/coco\b/, 7],
];

function clampMoney(n) {
  const x = Math.round(Number(n) * 100) / 100;
  if (!Number.isFinite(x) || x < 2) return 5;
  return Math.min(x, 999);
}

/**
 * @param {string} name
 * @param {string} [_quantity]
 * @returns {number}
 */
function estimateFallbackPrice(name, _quantity) {
  const n = norm(name);
  for (const [re, base] of RULES) {
    if (re.test(n)) return clampMoney(base);
  }
  return 12;
}

module.exports = { estimateFallbackPrice, clampMoney };
