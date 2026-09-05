import { supabaseAdmin } from '@/lib/supabaseAdmin'

const PREFIXO_APRENDIZADO = 'atlas_operacional:v1:'
const STOPWORDS = new Set(['a','o','as','os','de','da','do','das','dos','e','em','um','uma','para','por','com','na','no','nas','nos','linha','me','mostre','mostrar','quero'])

function normalizar(valor: unknown) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
}

function tokensBusca(valor: unknown) {
  return normalizar(valor)
    .split(/\s+/)
    .map(t => t.toLowerCase())
    .filter(t => t && !STOPWORDS.has(t))
}

function imagemProduto(produto: any): string | null {
  return produto?.foto_url
    || produto?.imagem_url
    || produto?.desenho_url
    || produto?.imagem_catalogo_url
    || produto?.wvetro_imagem_url
    || produto?.dados_origem?.imagem_url
    || produto?.dados_origem?.foto_url
    || null
}

function dominioPorCategoria(categoria: unknown) {
  const c = normalizar(categoria).toLowerCase()
  if (c === 'perfil') return 'perfil'
  if (c === 'acessorio') return 'acessorio'
  if (c === 'vidro') return 'vidro'
  return 'geral'
}

type MemoriaTecnica = {
  entidade_id?: string | null
  contexto?: Record<string, unknown>
  dados?: Record<string, unknown>
  evidencia?: 'observado' | 'recorrente' | 'validado'
  tipo?: string
  registrado_em?: string
}

export async function buscarBaseTecnicaAgente(input: any) {
  const busca = String(input?.busca || input?.descricao || '').trim()
  const categoria = String(input?.categoria || '').trim().toLowerCase()
  const linhaSolicitada = String(input?.linha || '').trim()
  const limite = Math.min(Math.max(Number(input?.limite) || 8, 1), 20)
  const termos = tokensBusca(`${busca} ${linhaSolicitada}`)

  const [produtosResp, linhasResp, vinculosResp, memoriasResp] = await Promise.all([
    supabaseAdmin.from('produtos').select('*').eq('ativo', true).limit(5000),
    supabaseAdmin.from('linhas_tecnicas').select('*').limit(1000),
    supabaseAdmin.from('linha_produtos').select('produto_id,linha_id').limit(20000),
    supabaseAdmin
      .from('agente_memorias')
      .select('chave,valor,created_at')
      .like('chave', `${PREFIXO_APRENDIZADO}%`)
      .order('created_at', { ascending: false })
      .limit(5000),
  ])

  if (produtosResp.error) return { erro: produtosResp.error.message }

  const linhasPorId = new Map<string, any>()
  for (const linha of linhasResp.data || []) linhasPorId.set(String(linha.id), linha)

  const linhasPorProduto = new Map<string, any[]>()
  for (const vinculo of vinculosResp.data || []) {
    const linha = linhasPorId.get(String(vinculo.linha_id))
    if (!linha) continue
    const chave = String(vinculo.produto_id)
    linhasPorProduto.set(chave, [...(linhasPorProduto.get(chave) || []), linha])
  }

  const memoriasPorProduto = new Map<string, MemoriaTecnica[]>()
  const memoriasPorCodigo = new Map<string, MemoriaTecnica[]>()
  for (const linha of memoriasResp.data || []) {
    try {
      const memoria = JSON.parse(linha.valor || '{}') as MemoriaTecnica
      if (!memoria || memoria.evidencia !== 'validado') continue
      const entidadeId = String(memoria.entidade_id || memoria.contexto?.produto_id || '')
      const codigo = normalizar(memoria.dados?.codigo || memoria.contexto?.codigo)
      if (entidadeId) memoriasPorProduto.set(entidadeId, [...(memoriasPorProduto.get(entidadeId) || []), memoria])
      if (codigo) memoriasPorCodigo.set(codigo, [...(memoriasPorCodigo.get(codigo) || []), memoria])
    } catch {
      // Memórias antigas ou de outro formato não participam da busca técnica.
    }
  }

  const resultados: Array<{ score: number; item: any }> = []

  for (const produto of produtosResp.data || []) {
    const cat = String(produto.categoria || '').toLowerCase()
    if (categoria && categoria !== 'todos' && cat !== categoria) continue

    const codigoNorm = normalizar(produto.codigo || produto.codigo_origem)
    const memorias = [
      ...(memoriasPorProduto.get(String(produto.id)) || []),
      ...(codigoNorm ? memoriasPorCodigo.get(codigoNorm) || [] : []),
    ]
    const linhas = linhasPorProduto.get(String(produto.id)) || []
    const linhasTexto = linhas.map(l => `${l.nome || ''} ${l.chave || ''} ${(l.apelidos || []).join(' ')}`).join(' ')
    const memoriaTexto = memorias.map(m => JSON.stringify({ contexto: m.contexto || {}, dados: m.dados || {}, tipo: m.tipo || '' })).join(' ')
    const base = normalizar([
      produto.codigo,
      produto.codigo_origem,
      produto.nome,
      produto.descricao,
      produto.grupo,
      produto.marca,
      produto.origem,
      produto.dados_origem ? JSON.stringify(produto.dados_origem) : '',
      linhasTexto,
      memoriaTexto,
    ].filter(Boolean).join(' '))

    const linhaNorm = normalizar(linhaSolicitada)
    if (linhaNorm && !normalizar(linhasTexto).includes(linhaNorm) && !normalizar(memoriaTexto).includes(linhaNorm)) continue

    let score = 0
    const buscaNorm = normalizar(busca)
    if (buscaNorm && base.includes(buscaNorm)) score += 50
    for (const termo of termos) {
      const t = normalizar(termo)
      if (!t) continue
      if (codigoNorm === t) score += 100
      else if (base.includes(t)) score += 12
      else score -= 8
    }
    if (memorias.length) score += 25
    if (memorias.some(m => m.evidencia === 'validado')) score += 50
    if (produto.status_validacao === 'validado' || produto.status_validacao === 'revisado') score += 5
    if (!termos.length && !buscaNorm) score += 1
    if (score <= 0) continue

    resultados.push({
      score,
      item: {
        id: produto.id,
        codigo: produto.codigo || produto.codigo_origem || null,
        nome: produto.nome || produto.descricao || 'Sem nome',
        categoria: produto.categoria || null,
        descricao: produto.descricao || null,
        imagem_url: imagemProduto(produto),
        linhas: linhas.map(l => ({ id: l.id, nome: l.nome, chave: l.chave, fabricante: l.fabricante || null })),
        conhecimento_validado: memorias.map(m => ({ tipo: m.tipo || null, contexto: m.contexto || {}, dados: m.dados || {}, registrado_em: m.registrado_em || null })),
        status_validacao: produto.status_validacao || null,
        origem: produto.origem || null,
      },
    })
  }

  resultados.sort((a, b) => b.score - a.score)
  return {
    busca,
    linha: linhaSolicitada || null,
    resultados: resultados.slice(0, limite).map(r => ({ ...r.item, score: r.score })),
    total_encontrado: resultados.length,
    regra: 'Conhecimento validado pelo usuário tem prioridade. Quando não houver validação, o Atlas deve apresentar como candidato e nunca afirmar como certeza.',
  }
}

export async function validarConhecimentoTecnicoAgente(input: any, usuarioId: string, usuarioNome: string) {
  const produtoId = String(input?.produto_id || '').trim()
  const codigoInformado = String(input?.codigo || '').trim()
  if (!produtoId && !codigoInformado) return { erro: 'Informe produto_id ou código do perfil/produto que está sendo validado.' }

  let query = supabaseAdmin.from('produtos').select('*')
  if (produtoId) query = query.eq('id', produtoId)
  else query = query.or(`codigo.eq.${codigoInformado},codigo_origem.eq.${codigoInformado}`)
  const { data: produto, error } = await query.limit(1).maybeSingle()
  if (error) return { erro: error.message }
  if (!produto) return { erro: 'Produto/perfil não encontrado na base técnica.' }

  const atributos = {
    tipo_perfil: input?.tipo_perfil || input?.tipo || null,
    numero_planos: input?.numero_planos != null ? Number(input.numero_planos) : null,
    aplicacao: input?.aplicacao || null,
    linha: input?.linha || null,
    observacao: input?.observacao || null,
    ...(input?.atributos && typeof input.atributos === 'object' ? input.atributos : {}),
  }

  const evento = {
    versao: 1,
    dominio: dominioPorCategoria(produto.categoria),
    tipo: 'classificacao_tecnica_validada',
    entidade_tipo: produto.categoria || 'produto',
    entidade_id: produto.id,
    contexto: {
      produto_id: produto.id,
      codigo: produto.codigo || produto.codigo_origem || null,
      categoria: produto.categoria || null,
      linha: input?.linha || null,
    },
    dados: {
      codigo: produto.codigo || produto.codigo_origem || null,
      nome: produto.nome || produto.descricao || null,
      ...atributos,
    },
    evidencia: 'validado',
    registrado_em: new Date().toISOString(),
    validado_por: usuarioNome,
  }

  const { error: memoriaError } = await supabaseAdmin.from('agente_memorias').insert({
    usuario_id: usuarioId,
    chave: `${PREFIXO_APRENDIZADO}${evento.dominio}`,
    valor: JSON.stringify(evento),
  })
  if (memoriaError) return { erro: memoriaError.message }

  return {
    ok: true,
    mensagem: 'Conhecimento técnico validado e salvo na memória oficial do Atlas.',
    produto: { id: produto.id, codigo: evento.dados.codigo, nome: evento.dados.nome, categoria: produto.categoria || null },
    conhecimento: atributos,
  }
}
