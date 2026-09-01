/* =========================================================================
   base.mjs · Armazenamento da base do Painel de Distribuição de Materiais
   -------------------------------------------------------------------------
   Netlify Function. Guarda a base num Netlify Blobs store, que sobrevive a
   novos deploys do site.

     GET   /.netlify/functions/base   -> devolve a base ativa e a anterior
     POST  /.netlify/functions/base   -> grava uma base nova, arquivando a atual

   A planilha é lida e validada no navegador; aqui chega só o resultado em
   JSON, que é conferido de novo antes de qualquer gravação.

   ANTES DE USAR: defina a variável de ambiente SENHA_PAINEL no Netlify, em
   Site configuration > Environment variables. Ela é a senha exigida para
   atualizar a base.
   ========================================================================= */

import { getStore } from '@netlify/blobs';

const NOME_STORE = 'painel-distribuicao-bahia';
const CHAVE_ATUAL = 'base_atual';
const CHAVE_ANTERIOR = 'base_anterior';

const LIMITE_BYTES = 2 * 1024 * 1024;   // 2 MB de corpo, folga larga
const MAX_LINHAS = 1000;                // a Bahia tem 417 municípios
const MAX_TERRITORIOS = 200;

const CABECALHOS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

const responder = (codigo, corpo) =>
  new Response(JSON.stringify(corpo), { status: codigo, headers: CABECALHOS });

/* Confere a estrutura da base. Nunca confiar apenas na validação do navegador. */
function validarBase(b) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return 'corpo não é um objeto';
  if (!Array.isArray(b.territorios)) return 'lista de territórios ausente';
  if (!Array.isArray(b.rows)) return 'lista de municípios ausente';

  const nt = b.territorios.length;
  if (nt < 1 || nt > MAX_TERRITORIOS) return 'quantidade de territórios fora do esperado';
  for (const t of b.territorios) {
    if (typeof t !== 'string' || t === '' || t.length > 120) return 'nome de território inválido';
  }

  const n = b.rows.length;
  if (n < 1 || n > MAX_LINHAS) return 'quantidade de municípios fora do esperado';
  for (const r of b.rows) {
    if (!Array.isArray(r) || r.length !== 4) return 'linha com formato inválido';
    if (typeof r[0] !== 'string' || r[0] === '' || r[0].length > 120) return 'nome de município inválido';
    if (!Number.isInteger(r[1]) || r[1] < 0 || r[1] >= nt) return 'índice de território inválido';
    if (typeof r[2] !== 'number' || !isFinite(r[2]) || r[2] < 0) return 'eleitorado inválido';
    if (typeof r[3] !== 'number' || !isFinite(r[3]) || r[3] < 0) return 'materiais inválidos';
  }
  return null;
}

/* Comparação de senha em tempo constante, para não vazar o tamanho pelo tempo. */
function senhaConfere(informada, esperada) {
  if (typeof informada !== 'string' || typeof esperada !== 'string') return false;
  if (informada.length !== esperada.length) return false;
  let dif = 0;
  for (let i = 0; i < esperada.length; i++) dif |= informada.charCodeAt(i) ^ esperada.charCodeAt(i);
  return dif === 0;
}

export default async (req) => {
  const store = getStore(NOME_STORE);

  // -------------------------------------------------------------------
  // GET: entrega a base ativa e a anterior
  // -------------------------------------------------------------------
  if (req.method === 'GET') {
    try {
      const [atual, anterior] = await Promise.all([
        store.get(CHAVE_ATUAL, { type: 'json' }),
        store.get(CHAVE_ANTERIOR, { type: 'json' }),
      ]);
      return responder(200, { ok: true, atual: atual ?? null, anterior: anterior ?? null });
    } catch (e) {
      return responder(500, { ok: false, erro: 'Falha ao ler a base gravada: ' + (e?.message || e) });
    }
  }

  if (req.method !== 'POST') {
    return responder(405, { ok: false, erro: 'Método não permitido.' });
  }

  // -------------------------------------------------------------------
  // POST: grava a base nova
  // -------------------------------------------------------------------
  const esperada = process.env.SENHA_PAINEL;
  if (!esperada || esperada.length < 12) {
    return responder(500, {
      ok: false,
      erro: 'A variável de ambiente SENHA_PAINEL não está definida no Netlify, ou tem menos de 12 caracteres.',
    });
  }

  let bruto;
  try {
    bruto = await req.text();
  } catch {
    return responder(400, { ok: false, erro: 'Não foi possível ler o corpo da requisição.' });
  }
  if (!bruto) return responder(400, { ok: false, erro: 'Corpo da requisição vazio.' });
  if (bruto.length > LIMITE_BYTES) return responder(413, { ok: false, erro: 'Base grande demais.' });

  let pedido;
  try {
    pedido = JSON.parse(bruto);
  } catch {
    return responder(400, { ok: false, erro: 'JSON inválido.' });
  }

  if (!senhaConfere(pedido?.senha, esperada)) {
    await new Promise((r) => setTimeout(r, 400));   // atrasa tentativa por tentativa
    return responder(403, { ok: false, erro: 'Senha de atualização incorreta.' });
  }

  const base = pedido?.base;
  const problema = validarBase(base);
  if (problema !== null) {
    return responder(400, { ok: false, erro: 'Base recusada: ' + problema + '.' });
  }

  // carimba a gravação do lado do servidor
  base.updatedAt = new Date().toISOString();
  base.filename = typeof base.filename === 'string' ? base.filename.slice(0, 160) : 'planilha enviada';

  try {
    const atual = await store.get(CHAVE_ATUAL, { type: 'json' });
    // arquiva a atual antes de substituir
    if (atual) await store.setJSON(CHAVE_ANTERIOR, atual);
    await store.setJSON(CHAVE_ATUAL, base);
    return responder(200, { ok: true, atual: base, anterior: atual ?? null });
  } catch (e) {
    return responder(500, { ok: false, erro: 'Falha ao gravar: ' + (e?.message || e) });
  }
};
