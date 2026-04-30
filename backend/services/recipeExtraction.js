const { YoutubeTranscript } = require('youtube-transcript');
const { estimateFallbackPrice, clampMoney } = require('./priceEstimate');

const DEFAULT_MODEL = 'openai/gpt-4o-mini';
const TRANSCRIPT_MAX_CHARS = 14000;

/**
 * Extrai ID do vídeo (mesma regex usada pela lib youtube-transcript).
 */
const RE_YOUTUBE =
  /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i;

function extractVideoId(urlOrId) {
  const s = String(urlOrId).trim();
  if (s.length === 11 && /^[\w-]{11}$/.test(s)) return s;
  const m = s.match(RE_YOUTUBE);
  if (m && m[1]) return m[1];
  return null;
}

/**
 * Junta segmentos da legenda em um texto único e trunca.
 */
async function fetchTranscriptText(videoUrl) {
  const id = extractVideoId(videoUrl);
  if (!id) {
    const err = new Error('Não foi possível identificar o ID do vídeo no link.');
    err.code = 'INVALID_URL';
    throw err;
  }

  let segments;
  try {
    segments = await YoutubeTranscript.fetchTranscript(videoUrl);
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    const err = new Error(
      `Legenda indisponível para este vídeo (${msg}). ` +
        'Tente outro vídeo com narração ou legendas públicas.'
    );
    err.code = 'TRANSCRIPT_UNAVAILABLE';
    err.cause = e;
    throw err;
  }

  if (!segments || !segments.length) {
    const err = new Error('Nenhum trecho de legenda retornado.');
    err.code = 'TRANSCRIPT_EMPTY';
    throw err;
  }

  const full = segments.map((s) => (s.text || '').trim()).filter(Boolean).join(' ');
  const truncated = full.length > TRANSCRIPT_MAX_CHARS
    ? full.slice(0, TRANSCRIPT_MAX_CHARS) + '\n[... texto truncado ...]'
    : full;

  return { videoId: id, text: truncated, fullLength: full.length };
}

/**
 * Remove cercas ```json do modelo, se houver.
 */
function parseJsonFromModel(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let s = raw.trim();
  const fence = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/im.exec(s);
  if (fence) s = fence[1].trim();
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function parsePriceFromItem(item) {
  const raw =
    item.price ??
    item.preco ??
    item.estimated_price ??
    item.estimatedPrice;
  if (raw === null || raw === undefined || raw === '') return null;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return null;
  return clampMoney(n);
}

/**
 * Normaliza itens do JSON da IA para o formato do banco (ingredientes com preço estimado em R$).
 */
function normalizeItems(arr, type) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const name = String(item.name || item.nome || '').trim();
    if (!name) continue;
    const quantity = String(item.quantity ?? item.quantidade ?? '').trim();
    if (type === 'ingredient') {
      let price = parsePriceFromItem(item);
      if (price == null) {
        price = estimateFallbackPrice(name, quantity);
      }
      out.push({ name, quantity, type, price });
    } else {
      out.push({ name, quantity, type });
    }
  }
  return out;
}

const SYSTEM_PROMPT = `Você é um assistente de culinária. Com base no TEXTO abaixo (legenda/narração de um vídeo de receita no YouTube), extraia:
1) Lista de INGREDIENTES: nome, quantidade quando mencionada, e **price** = estimativa do custo dessa quantidade no supermercado no Brasil, em reais (número, ex.: 8.5 para R$ 8,50). Seja realista para o volume indicado.
2) Lista de UTENSÍLIOS e equipamentos citados (panela, forma, batedeira, etc.) com nome e quantidade ou "" (sem preço).

Responda APENAS com um objeto JSON válido neste formato exato (sem markdown):
{"ingredients":[{"name":"string","quantity":"string","price":0}],"utensils":[{"name":"string","quantity":"string"}]}

Use português do Brasil. price deve ser número positivo para cada ingrediente.`;

/**
 * Cliente OpenRouter (@openrouter/sdk — carregamento dinâmico ESM).
 */
async function getOpenRouterClient() {
  const { OpenRouter } = await import('@openrouter/sdk');
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || !String(apiKey).trim()) {
    const err = new Error(
      'Configure a variável OPENROUTER_API_KEY (https://openrouter.ai/keys).'
    );
    err.code = 'OPENROUTER_CONFIG';
    throw err;
  }
  return new OpenRouter({
    apiKey: String(apiKey).trim(),
    appTitle: 'ReceitaFácil',
  });
}

/**
 * Extrai ingredientes e utensílios via OpenRouter (modelo configurável).
 */
async function extractWithOpenRouter(transcriptBlock, videoTitle) {
  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;

  const userBlock =
    `Título do vídeo (referência): ${videoTitle || '(desconhecido)'}\n\n` +
    `--- Legenda / narração ---\n${transcriptBlock}`;

  let client;
  try {
    client = await getOpenRouterClient();
  } catch (e) {
    if (e.code === 'OPENROUTER_CONFIG') throw e;
    const err = new Error(`Falha ao inicializar OpenRouter: ${e.message || e}`);
    err.code = 'OPENROUTER_CONNECTION';
    throw err;
  }

  try {
    const result = await client.chat.send(
      {
        chatRequest: {
          model,
          stream: false,
          temperature: 0.25,
          maxCompletionTokens: 8192,
          responseFormat: { type: 'json_object' },
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userBlock },
          ],
        },
      },
      { timeoutMs: 180000 }
    );

    const raw =
      result &&
      result.choices &&
      result.choices[0] &&
      result.choices[0].message &&
      typeof result.choices[0].message.content === 'string'
        ? result.choices[0].message.content
        : '';

    const parsed = parseJsonFromModel(raw);

    if (!parsed || typeof parsed !== 'object') {
      const err = new Error(
        'A IA não retornou JSON válido. Tente novamente ou ajuste OPENROUTER_MODEL.'
      );
      err.code = 'OPENROUTER_PARSE';
      throw err;
    }

    const ingredients = normalizeItems(parsed.ingredients, 'ingredient');
    const utensils = normalizeItems(parsed.utensils, 'utensil');

    if (ingredients.length === 0 && utensils.length === 0) {
      const err = new Error(
        'Nenhum ingrediente ou utensílio foi identificado na legenda. Tente um vídeo com receita narrada com mais detalhes.'
      );
      err.code = 'EMPTY_EXTRACTION';
      throw err;
    }

    const resolvedModel = result.model || model;
    return { ingredients, utensils, model: resolvedModel };
  } catch (e) {
    if (e.code && String(e.code).startsWith('OPENROUTER')) throw e;
    if (e.code === 'EMPTY_EXTRACTION') throw e;

    const msg = e.message || String(e);
    const status = e.statusCode || e.status || e.code;

    if (status === 401 || /401|unauthorized|invalid.*key/i.test(msg)) {
      const err = new Error(
        'Chave OpenRouter inválida ou ausente. Verifique OPENROUTER_API_KEY.'
      );
      err.code = 'OPENROUTER_AUTH';
      throw err;
    }

    if (
      status === 402
      || /402|payment|credit|billing/i.test(msg)
    ) {
      const err = new Error(
        'OpenRouter: créditos insuficientes ou pagamento necessário. Veja sua conta em openrouter.ai.'
      );
      err.code = 'OPENROUTER_HTTP';
      throw err;
    }

    if (
      /fetch failed|ECONNREFUSED|ENOTFOUND|network|socket/i.test(msg)
      || status === 'ECONNRESET'
    ) {
      const err = new Error(
        `Não foi possível conectar ao OpenRouter. Verifique a rede. Detalhe: ${msg}`
      );
      err.code = 'OPENROUTER_CONNECTION';
      throw err;
    }

    const err = new Error(`OpenRouter: ${msg.slice(0, 500)}`);
    err.code = 'OPENROUTER_HTTP';
    throw err;
  }
}

/**
 * Fluxo completo: legenda → OpenRouter → listas normalizadas.
 */
async function extractRecipeFromYoutube(videoUrl, videoTitle) {
  const { text } = await fetchTranscriptText(videoUrl);
  return extractWithOpenRouter(text, videoTitle);
}

module.exports = {
  extractRecipeFromYoutube,
};
