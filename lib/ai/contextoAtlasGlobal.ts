import { supabaseAdmin } from '@/lib/supabaseAdmin'
import type { UsuarioTenant } from '@/lib/tenantServer'
import { AI_ESPECIALISTAS } from '@/lib/ai/specialists'
import type { AIModulo } from '@/lib/ai/types'
import { detectarConsultaEstimativaOrcamento, estimarOrcamentoHistorico } from '@/lib/ai/orcamentoEstimativaServer'

export type EscopoAtlas = 'nenhum' | 'proprio' | 'setor' | 'empresa'

export type AcessoAtlas = {
  permitido: boolean
  escopo: EscopoAtlas
}

const ORDEM_ESCOPO: Record<EscopoAtlas, number> = {
  nenhum: 0,
  proprio: 1,
  setor: 2,
  empresa: 3,
}

const STOPWORDS = new Set([
  'QUE','QUAL','QUAIS','COMO','ONDE','PARA','COM','SEM','UMA','UM','UNS','UMAS','DOS','DAS','DO','DA','DE',
  'TEM','TEMOS','ESTA','ESTAO','FOI','SAO','SER','SEJA','ESSE','ESSA','ISSO','ESTE','ESTA','AQUELE','AQUELA',
  'CADASTRADO','CADASTRADOS','CADASTRADA','CADASTRADAS','ATLAS','ME','MEU','MINHA','MEUS','MINHAS','NOSSO',
  'NOSSA','HOJE','AGORA','AQUI','ALI','TAMBEM','AINDA','PODE','PODERIA','QUERO','PRECISO','SOBRE','DENTRO',
])

const PALAVRAS_DOMINIO: Record<AIModulo, string[]> = {
  gestao: ['GESTAO','GESTOR','DIRECAO','EMPRESA','INDICADOR','DASHBOARD','GERAL','PANORAMA','GARGALO','PRIORIDADE'],
  comercial: ['CLIENTE','CLIENTES','CRM','LEAD','LEADS','PROSPECCAO','PROSPECCOES','FOLLOW','VISITA','OPORTUNIDADE','CARTEIRA','CONTATO'],
  orcamento: ['ORCAMENTO','ORCAMENTOS','PROPOSTA','PROPOSTAS','VENDA','VENDAS','VENDIDO','DESCONTO','PRAZO','CONDICAO','ESQUADRIA'],
  medicao_final: ['MEDICAO','MEDIDA','MEDIDAS','TRENA','VAO','PEITORIL','CONTRAMARCO','CADEIRINHA'],
  engenharia: ['ENGENHARIA','PERFIL','PERFIS','ACESSORIO','ACESSORIOS','TIPOLOGIA','TIPOLOGIAS','SUPREMA','GOLD','LINHA','LINHAS','FORMULA','CORTE','USINAGEM','VIDRO','VIDROS','ROLDANA','TRILHO','MONTANTE','TRAVESSA','LAMBRIL','PIVOTANTE'],
  compras: ['COMPRA','COMPRAS','COMPRAR','COTACAO','COTACOES','FORNECEDOR','FORNECEDORES','PEDIDO','NECESSIDADE','PRECO DE COMPRA'],
  estoque: ['ESTOQUE','SALDO','SALDOS','RESERVA','RESERVAS','SOBRA','SOBRAS','MOVIMENTO','MOVIMENTACAO','ENDERECO DE ESTOQUE'],
  producao: ['PRODUCAO','PRODUZIR','FABRICA','ORDEM DE PRODUCAO','ORDEM','PACOTE TECNICO','SEPARACAO','PLANO DE CORTE'],
  instalacao: ['INSTALACAO','INSTALAR','INSTALADOR','OBRA','OBRAS','ASSISTENCIA','POS VENDA','ATENDIMENTO TECNICO'],
  financeiro: ['FINANCEIRO','RECEBER','PAGAR','CONTAS A RECEBER','CONTAS A PAGAR','BOLETO','VENCIMENTO','DEVENDO','INADIMPLENTE','RECEBIMENTO'],
  marketing: ['MARKETING','CAMPANHA','CAMPANHAS','INSTAGRAM','FACEBOOK','GOOGLE','ANUNCIO','CONTEUDO','ORIGEM DO CLIENTE'],
  rh: ['RH','RECURSOS HUMANOS','COLABORADOR','COLABORADORES','FUNCIONARIO','FUNCIONARIOS','USUARIO','USUARIOS','EQUIPE','PESSOAS'],
  qualidade: ['QUALIDADE','NAO CONFORMIDADE','RETRABALHO','RECLAMACAO','DEFEITO','GARANTIA','ASSISTENCIA'],
  pd: ['P&D','PESQUISA','DESENVOLVIMENTO','TESTE','PROTOTIPO','INOVACAO'],
}

const TERMOS_TECNICOS = [
  'PERFIL','PERFIS','ACESSORIO','ACESSORIOS','TIPOLOGIA','TIPOLOGIAS','SUPREMA','GOLD','LINHA','LINHAS',
  'FORMULA','CORTE','VIDRO','VIDROS','ROLDANA','TRILHO','MONTANTE','TRAVESSA','LAMBRIL','PIVOTANTE','MAXI',
]

function semAcento(valor: string) {
  return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function textoNormalizado(valor: string) {
  return semAcento(valor).toUpperCase()
}

function ehConsultaAmpla(pergunta: string) {
  const t = textoNormalizado(pergunta)
  return /\b(EMPRESA|GERAL|PANORAMA|RESUMO|DASHBOARD|TUDO|TODOS OS SETORES|COMO ESTA|SITUACAO)\b/.test(t)
}

function temCodigoTecnico(pergunta: string) {
  return /\b[A-Z]{1,8}[\s-]?\d{1,6}[A-Z]?\b/i.test(pergunta)
}

function perguntaTocaDominio(pergunta: string, modulo: AIModulo) {
  const t = textoNormalizado(pergunta)
  return PALAVRAS_DOMINIO[modulo].some(p => t.includes(p))
}

function perguntaTecnica(pergunta: string) {
  if (temCodigoTecnico(pergunta)) return true
  const t = textoNormalizado(pergunta)
  return TERMOS_TECNICOS.some(p => t.includes(p))
}

function termosBusca(pergunta: string) {
  const texto = String(pergunta || '').trim()
  const codigos = texto.toUpperCase().match(/\b[A-Z]{1,8}[\s-]?\d{1,6}[A-Z]?\b/g) || []
  const palavras = texto
    .split(/\s+/)
    .map(p => p.replace(/[,%()."'?!:;\[\]{}]/g, '').trim())
    .filter(Boolean)
    .filter(p => {
      const n = textoNormalizado(p)
      return n.length >= 3 && !STOPWORDS.has(n) && !/^\d+$/.test(n)
    })

  const todos = [...codigos, ...palavras]
  const vistos = new Set<string>()
  const saida: string[] = []
  for (const termo of todos) {
    const chave = textoNormalizado(termo).replace(/[\s-]+/g, '')
    if (!chave || vistos.has(chave)) continue
    vistos.add(chave)
    saida.push(termo)
    if (saida.length >= 8) break
  }
  return saida
}

function variantesTermo(termo: string) {
  const limpo = String(termo || '').replace(/[,()."'?!:;\[\]{}]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!limpo) return []
  const compacto = textoNormalizado(limpo).replace(/[\s-]+/g, '')
  const m = compacto.match(/^([A-Z]{1,8})(\d{1,6}[A-Z]?)$/)
  if (!m) return [limpo.slice(0, 80)]
  return Array.from(new Set([
    compacto,
    `${m[1]} ${m[2]}`,
    `${m[1]}-${m[2]}`,
  ]))
}

async function carregarAcessos(usuario: UsuarioTenant): Promise<Record<AIModulo, AcessoAtlas>> {
  const resultado = {} as Record<AIModulo, AcessoAtlas>

  if (usuario.role === 'master') {
    for (const especialista of AI_ESPECIALISTAS) {
      resultado[especialista.modulo] = { permitido: true, escopo: 'empresa' }
    }
    return resultado
  }

  const [{ data: permissoes }, { data: overrides }] = await Promise.all([
    supabaseAdmin
      .from('permissoes')
      .select('setor_id,nivel')
      .eq('empresa_id', usuario.empresa_id)
      .eq('usuario_id', usuario.id),
    supabaseAdmin
      .from('ia_acessos_dominio')
      .select('dominio,escopo,permitido')
      .eq('empresa_id', usuario.empresa_id)
      .eq('usuario_id', usuario.id),
  ])

  const setores = new Set(
    (permissoes || [])
      .filter((p: any) => ['consulta', 'edicao'].includes(String(p.nivel || '')))
      .map((p: any) => String(p.setor_id)),
  )
  const mapaOverride = new Map((overrides || []).map((o: any) => [String(o.dominio), o]))

  for (const especialista of AI_ESPECIALISTAS) {
    const possuiSetor = especialista.setorIds.some(id => setores.has(id))
    if (!possuiSetor) {
      resultado[especialista.modulo] = { permitido: false, escopo: 'nenhum' }
      continue
    }

    const base: EscopoAtlas = especialista.modulo === 'comercial' ? 'proprio' : 'setor'
    const override: any = mapaOverride.get(especialista.modulo)
    if (!override) {
      resultado[especialista.modulo] = { permitido: true, escopo: base }
      continue
    }

    const configurado = String(override.escopo || 'nenhum') as EscopoAtlas
    if (override.permitido !== true || configurado === 'nenhum') {
      resultado[especialista.modulo] = { permitido: false, escopo: 'nenhum' }
      continue
    }

    resultado[especialista.modulo] = {
      permitido: true,
      escopo: ORDEM_ESCOPO[configurado] < ORDEM_ESCOPO[base] ? configurado : base,
    }
  }

  return resultado
}

async function acessoAuxiliar(usuario: UsuarioTenant, dominio: 'custos_precos' | 'fornecedores') {
  if (usuario.role === 'master') return true
  const { data } = await supabaseAdmin
    .from('ia_acessos_dominio')
    .select('escopo,permitido')
    .eq('empresa_id', usuario.empresa_id)
    .eq('usuario_id', usuario.id)
    .eq('dominio', dominio)
    .maybeSingle()
  return Boolean(data?.permitido && data?.escopo && data.escopo !== 'nenhum')
}

async function contar(table: string, empresaId?: string, filtros: Record<string, any> = {}) {
  let q: any = supabaseAdmin.from(table).select('*', { count: 'exact', head: true })
  if (empresaId) q = q.eq('empresa_id', empresaId)
  for (const [coluna, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== null) q = q.eq(coluna, valor)
  }
  const { count, error } = await q
  return error ? null : Number(count || 0)
}

type BuscaTabelaOpts = {
  table: string
  select: string
  searchColumns: string[]
  termos: string[]
  empresaId?: string
  filtros?: Record<string, any>
  escopo?: EscopoAtlas
  proprioColumn?: string
  proprioValue?: string
  order?: string
  limit?: number
}

async function buscarTabela(opts: BuscaTabelaOpts) {
  const limite = Math.max(1, Math.min(opts.limit || 10, 20))
  const resultados = new Map<string, any>()

  const aplicarBase = (query: any) => {
    let q = query
    if (opts.empresaId) q = q.eq('empresa_id', opts.empresaId)
    for (const [coluna, valor] of Object.entries(opts.filtros || {})) {
      if (valor !== undefined && valor !== null) q = q.eq(coluna, valor)
    }
    if (opts.escopo === 'proprio' && opts.proprioColumn && opts.proprioValue) {
      q = q.eq(opts.proprioColumn, opts.proprioValue)
    }
    if (opts.order) q = q.order(opts.order, { ascending: false })
    return q
  }

  const termos = opts.termos.slice(0, 5)
  if (!termos.length) {
    const { data } = await aplicarBase(
      supabaseAdmin.from(opts.table).select(opts.select),
    ).limit(limite)
    return data || []
  }

  for (const termo of termos) {
    for (const variante of variantesTermo(termo)) {
      const seguro = variante.replace(/[,()]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
      if (!seguro) continue
      const filtro = opts.searchColumns.map(c => `${c}.ilike.%${seguro}%`).join(',')
      const { data } = await aplicarBase(
        supabaseAdmin.from(opts.table).select(opts.select),
      ).or(filtro).limit(limite)

      for (const item of data || []) {
        const chave = String((item as any).id || (item as any).produto_id || JSON.stringify(item))
        resultados.set(chave, item)
        if (resultados.size >= limite) break
      }
      if (resultados.size >= limite) break
    }
    if (resultados.size >= limite) break
  }

  return Array.from(resultados.values()).slice(0, limite)
}

async function contextoTecnicoSeguro(usuario: UsuarioTenant, pergunta: string, termos: string[]) {
  if (!perguntaTecnica(pergunta) && !ehConsultaAmpla(pergunta)) return null
  const empresaId = usuario.empresa_id

  const [totalProdutos, totalPerfis, totalAcessorios, produtos, linhas, tipologias, variaveis, componentesWvetro, refsTipologias] = await Promise.all([
    contar('produtos', empresaId),
    contar('produtos', empresaId, { categoria: 'perfil' }),
    contar('produtos', empresaId, { categoria: 'acessorio' }),
    buscarTabela({
      table: 'produtos',
      select: 'id,codigo,nome,categoria,unidade,descricao,grupo,marca,linha_id,peso_kg_m,tamanho_barra_mm,foto_url,status_validacao,origem,id_externo_wvetro',
      searchColumns: ['codigo','nome','descricao','grupo','marca'],
      termos,
      empresaId,
      order: 'updated_at',
      limit: 18,
    }),
    buscarTabela({
      table: 'linhas_tecnicas',
      select: 'id,chave,nome,fabricante,descricao,apelidos,ativo,origem_referencia,linha_wvetro_raw,status_validacao',
      searchColumns: ['chave','nome','fabricante','descricao','linha_wvetro_raw'],
      termos,
      order: 'updated_at',
      limit: 10,
    }),
    buscarTabela({
      table: 'tipologias',
      select: 'id,chave,label,categoria,ativo,origem_referencia,linha_origem_wvetro,modelo_origem_wvetro,foto_url,wvetro_ocorrencias,versao_tecnica,usa_vidro',
      searchColumns: ['chave','label','categoria','linha_origem_wvetro','modelo_origem_wvetro'],
      termos,
      order: 'ordem',
      limit: 12,
    }),
    buscarTabela({
      table: 'engenharia_variaveis',
      select: 'id,chave,label,ordem',
      searchColumns: ['chave','label'],
      termos,
      order: 'ordem',
      limit: 12,
    }),
    buscarTabela({
      table: 'wvetro_referencias_componentes',
      select: 'id,tipo,codigo,codigo_wvetro,nome,cor,ncm,imagem_url,ocorrencias,produto_atlas_id,status_mapeamento,chave',
      searchColumns: ['codigo','codigo_wvetro','nome','cor','chave'],
      termos,
      order: 'ocorrencias',
      limit: 18,
    }),
    buscarTabela({
      table: 'wvetro_referencias_tipologias',
      select: 'id,linha_raw,modelo_raw,tipologia_atlas_id,imagem_url,ocorrencias,status_mapeamento,chave,largura_min_mm,largura_max_mm,altura_min_mm,altura_max_mm,ambientes_observados,nomes_observados',
      searchColumns: ['linha_raw','modelo_raw','chave'],
      termos,
      order: 'ocorrencias',
      limit: 12,
    }),
  ])

  const produtoIds = (produtos as any[]).map(p => p.id).filter(Boolean)
  const tipologiaIds = (tipologias as any[]).map(t => t.id).filter(Boolean)

  const [usosWvetro, imagens, formulas, variaveisTipologia] = await Promise.all([
    produtoIds.length
      ? supabaseAdmin
          .from('wvetro_tipologia_componentes')
          .select('referencia_tipologia_id,tipologia_atlas_id,produto_atlas_id,tipo,chave_componente,codigo,codigo_wvetro,nome,cor,unidade_origem,ocorrencias,quantidade_min,quantidade_max,medida_min,medida_max,posicoes,cortes,status_mapeamento')
          .in('produto_atlas_id', produtoIds)
          .order('ocorrencias', { ascending: false })
          .limit(50)
          .then(({ data }) => data || [])
      : Promise.resolve([]),
    produtoIds.length
      ? supabaseAdmin
          .from('produto_imagens')
          .select('produto_id,url,tipo,origem,principal,status_validacao')
          .eq('empresa_id', empresaId)
          .in('produto_id', produtoIds)
          .eq('ativo', true)
          .limit(30)
          .then(({ data }) => data || [])
      : Promise.resolve([]),
    tipologiaIds.length
      ? supabaseAdmin
          .from('engenharia_tipologia_formulas_corte')
          .select('tipologia_id,configuracao_chave,configuracao_label,status,versao,observacoes,variaveis,pecas,vidro,acessorios')
          .in('tipologia_id', tipologiaIds)
          .eq('ativo', true)
          .limit(15)
          .then(({ data }) => data || [])
      : Promise.resolve([]),
    tipologiaIds.length
      ? supabaseAdmin
          .from('engenharia_tipologia_variaveis')
          .select('tipologia_id,variavel_id,ordem,obrigatorio')
          .in('tipologia_id', tipologiaIds)
          .order('ordem', { ascending: true })
          .limit(40)
          .then(({ data }) => data || [])
      : Promise.resolve([]),
  ])

  return {
    resumo_catalogo_tecnico: {
      total_produtos: totalProdutos,
      total_perfis: totalPerfis,
      total_acessorios: totalAcessorios,
    },
    produtos,
    linhas_tecnicas: linhas,
    tipologias,
    variaveis,
    wvetro_componentes: componentesWvetro,
    wvetro_tipologias: refsTipologias,
    wvetro_usos_produtos: usosWvetro,
    imagens_produtos: imagens,
    formulas_corte_tipologias: formulas,
    variaveis_tipologias: variaveisTipologia,
    aviso: 'Catálogo técnico compartilhado sem custos/preços. Informação W.Vetro histórica deve ser tratada como referência; regra oficial depende de validação Atlas/MEE.',
  }
}

async function contextoComercial(usuario: UsuarioTenant, acesso: AcessoAtlas, termos: string[]) {
  if (!acesso.permitido) return null
  const empresaId = usuario.empresa_id
  const clientes = await buscarTabela({
    table: 'clientes',
    select: 'id,nome,cidade,bairro,origem,responsavel,observacoes,created_at,updated_at',
    searchColumns: ['nome','cidade','bairro','origem','responsavel','observacoes'],
    termos,
    empresaId,
    escopo: acesso.escopo,
    proprioColumn: 'responsavel',
    proprioValue: usuario.nome,
    order: 'updated_at',
    limit: 12,
  })
  const prospeccoes = await buscarTabela({
    table: 'prospeccoes',
    select: 'id,nome_cliente,nome_obra,cidade,bairro,fase_obra,interesses,temperatura,status,observacoes,responsavel_id,responsavel_nome,proxima_acao,proxima_acao_em,created_at,updated_at',
    searchColumns: ['nome_cliente','nome_obra','cidade','bairro','fase_obra','interesses','status','observacoes','responsavel_nome'],
    termos,
    empresaId,
    escopo: acesso.escopo,
    proprioColumn: 'responsavel_id',
    proprioValue: usuario.id,
    order: 'updated_at',
    limit: 12,
  })
  return {
    escopo: acesso.escopo,
    clientes,
    prospeccoes,
    total_clientes: acesso.escopo === 'proprio' ? null : await contar('clientes', empresaId),
    total_prospeccoes: acesso.escopo === 'proprio' ? null : await contar('prospeccoes', empresaId),
  }
}

async function contextoOrcamento(usuario: UsuarioTenant, acesso: AcessoAtlas, termos: string[], podeCustos: boolean) {
  if (!acesso.permitido) return null
  const empresaId = usuario.empresa_id
  const select = podeCustos
    ? 'id,numero,cliente_nome,cidade,tipo_esquadria,status,temperatura,valor_estimado,custo_estimado,acabamento,contramarco,forma_pagamento,prazo_entrega_dias,obra_nome,created_at,updated_at,criado_por_id,criado_por_nome'
    : 'id,numero,cliente_nome,cidade,tipo_esquadria,status,temperatura,valor_estimado,acabamento,contramarco,forma_pagamento,prazo_entrega_dias,obra_nome,created_at,updated_at,criado_por_id,criado_por_nome'

  const orcamentos = await buscarTabela({
    table: 'orcamentos',
    select,
    searchColumns: ['numero','cliente_nome','cidade','tipo_esquadria','status','temperatura','descricao_livre','obra_nome'],
    termos,
    empresaId,
    escopo: acesso.escopo,
    proprioColumn: 'criado_por_id',
    proprioValue: usuario.id,
    order: 'updated_at',
    limit: 15,
  })
  const obras = await buscarTabela({
    table: 'obras',
    select: 'id,numero,nome,status,bairro,cidade,uf,responsavel,data_inicio,previsao_entrega,observacoes,created_at,updated_at,criado_por_id,criado_por_nome',
    searchColumns: ['numero','nome','status','bairro','cidade','uf','responsavel','observacoes'],
    termos,
    empresaId,
    escopo: acesso.escopo,
    proprioColumn: 'criado_por_id',
    proprioValue: usuario.id,
    order: 'updated_at',
    limit: 10,
  })

  return {
    escopo: acesso.escopo,
    custos_liberados: podeCustos,
    orcamentos,
    obras,
    total_orcamentos: acesso.escopo === 'proprio' ? null : await contar('orcamentos', empresaId),
  }
}

async function contextoMedicao(usuario: UsuarioTenant, acesso: AcessoAtlas, termos: string[]) {
  if (!acesso.permitido) return null
  const empresaId = usuario.empresa_id
  const medicoes = await buscarTabela({
    table: 'medicoes_finais',
    select: 'id,orcamento_id,cliente_id,cliente_nome,endereco,bairro,cidade,status_operacional,responsavel_id,responsavel_nome,versao,observacoes,created_at,concluido_em,aprovado_em,criado_por_id,criado_por_nome',
    searchColumns: ['cliente_nome','endereco','bairro','cidade','status_operacional','responsavel_nome','observacoes'],
    termos,
    empresaId,
    escopo: acesso.escopo,
    proprioColumn: 'criado_por_id',
    proprioValue: usuario.id,
    order: 'created_at',
    limit: 12,
  })
  const ids = (medicoes as any[]).map(m => m.id).filter(Boolean)
  const itens = ids.length
    ? await supabaseAdmin
        .from('medicao_itens')
        .select('id,medicao_id,tipo_esquadria,descricao,quantidade,largura_baixo_mm,largura_meio_mm,largura_cima_mm,altura_direita_mm,altura_meio_mm,altura_esquerda_mm,campos_extras,referencia_vista,contramarco,cadeirinha,observacoes_medicao,status_medicao')
        .eq('empresa_id', empresaId)
        .in('medicao_id', ids)
        .limit(40)
        .then(({ data }) => data || [])
    : []

  return { escopo: acesso.escopo, medicoes, itens }
}

async function contextoCompras(usuario: UsuarioTenant, acesso: AcessoAtlas, termos: string[], fornecedoresLiberados: boolean) {
  if (!acesso.permitido) return null
  const empresaId = usuario.empresa_id
  const necessidades = await buscarTabela({
    table: 'compras_necessidades',
    select: 'id,status,produto_id,descricao,categoria,quantidade,unidade,prioridade,data_limite,obra_referencia,observacoes,responsavel_id,responsavel_nome,cliente_nome,obra_nome,created_at,updated_at,criado_por_id,criado_por_nome',
    searchColumns: ['status','descricao','categoria','prioridade','obra_referencia','observacoes','responsavel_nome','cliente_nome','obra_nome'],
    termos,
    empresaId,
    escopo: acesso.escopo,
    proprioColumn: 'criado_por_id',
    proprioValue: usuario.id,
    order: 'updated_at',
    limit: 15,
  })
  const fornecedores = fornecedoresLiberados
    ? await buscarTabela({
        table: 'fornecedores',
        select: 'id,nome,cidade,contato,ativo,pedido_minimo,frete_gratis_minimo,prazo_medio_dias,condicao_pagamento_padrao,prazo_entrega_dias,observacoes_comerciais,updated_at',
        searchColumns: ['nome','cidade','contato','observacoes_comerciais'],
        termos,
        empresaId,
        order: 'updated_at',
        limit: 12,
      })
    : []

  return {
    escopo: acesso.escopo,
    necessidades,
    fornecedores_liberados: fornecedoresLiberados,
    fornecedores,
  }
}

async function contextoEstoque(usuario: UsuarioTenant, acesso: AcessoAtlas, termos: string[], podeCustos: boolean) {
  if (!acesso.permitido) return null
  const empresaId = usuario.empresa_id
  const produtos = await buscarTabela({
    table: 'produtos',
    select: 'id,codigo,nome,categoria,unidade,estoque_minimo,estoque_ideal',
    searchColumns: ['codigo','nome','categoria'],
    termos,
    empresaId,
    limit: 15,
  })
  const ids = (produtos as any[]).map(p => p.id).filter(Boolean)
  const selectSaldo = podeCustos
    ? 'produto_id,unidade,quantidade,quantidade_reservada,custo_medio,valor_estoque,updated_at,local_id,endereco_id'
    : 'produto_id,unidade,quantidade,quantidade_reservada,updated_at,local_id,endereco_id'
  const saldos = ids.length
    ? await supabaseAdmin.from('estoque_saldos').select(selectSaldo).eq('empresa_id', empresaId).in('produto_id', ids).limit(30).then(({ data }) => data || [])
    : []
  const sobras = ids.length
    ? await supabaseAdmin
        .from('estoque_sobras_perfis')
        .select('id,produto_id,cor_ref,comprimento_mm,status,obra_origem_id,obra_reserva_id,observacoes,created_at,updated_at')
        .eq('empresa_id', empresaId)
        .in('produto_id', ids)
        .limit(25)
        .then(({ data }) => data || [])
    : []

  return { escopo: acesso.escopo, custos_liberados: podeCustos, produtos, saldos, sobras }
}

async function contextoProducao(usuario: UsuarioTenant, acesso: AcessoAtlas, termos: string[]) {
  if (!acesso.permitido) return null
  const empresaId = usuario.empresa_id
  const ordens = await buscarTabela({
    table: 'ordens_producao',
    select: 'id,numero,cliente_id,obra_id,orcamento_id,item_ref,tipo_producao,titulo,quantidade,largura_mm,altura_mm,status,bloqueada,bloqueio_motivo,origem,created_at,updated_at,criado_por_id,criado_por_nome',
    searchColumns: ['numero','item_ref','tipo_producao','titulo','status','bloqueio_motivo','origem'],
    termos,
    empresaId,
    escopo: acesso.escopo,
    proprioColumn: 'criado_por_id',
    proprioValue: usuario.id,
    order: 'updated_at',
    limit: 15,
  })
  return { escopo: acesso.escopo, ordens, total_ordens: await contar('ordens_producao', empresaId) }
}

async function contextoInstalacaoQualidade(usuario: UsuarioTenant, acesso: AcessoAtlas, termos: string[]) {
  if (!acesso.permitido) return null
  const empresaId = usuario.empresa_id
  const assistencias = await buscarTabela({
    table: 'assistencias',
    select: 'id,numero,cliente_nome,cidade,bairro,descricao_problema,status,tecnico_nome,data_atendimento,servico_realizado,materiais_utilizados,observacoes_atendimento,created_at,atendimento_concluido_em,obra_id,criado_por_id,criado_por_nome',
    searchColumns: ['numero','cliente_nome','cidade','bairro','descricao_problema','status','tecnico_nome','servico_realizado','materiais_utilizados','observacoes_atendimento'],
    termos,
    empresaId,
    escopo: acesso.escopo,
    proprioColumn: 'criado_por_id',
    proprioValue: usuario.id,
    order: 'created_at',
    limit: 15,
  })
  return { escopo: acesso.escopo, assistencias }
}

async function contextoFinanceiro(usuario: UsuarioTenant, acesso: AcessoAtlas, termos: string[]) {
  if (!acesso.permitido) return null
  const empresaId = usuario.empresa_id
  const receber = await buscarTabela({
    table: 'financeiro_contas_receber',
    select: 'id,cliente_nome,documento,parcela,total_parcelas,data_emissao,vencimento,valor,status,forma,data_pagamento,valor_pago,observacoes,created_at,orcamento_id,obra_id,criado_por_id,criado_por_nome',
    searchColumns: ['cliente_nome','documento','status','forma','observacoes'],
    termos,
    empresaId,
    escopo: acesso.escopo,
    proprioColumn: 'criado_por_id',
    proprioValue: usuario.id,
    order: 'created_at',
    limit: 18,
  })
  const pagar = await buscarTabela({
    table: 'financeiro_contas_pagar',
    select: 'id,fornecedor_nome,documento,parcela,descricao,data_emissao,vencimento,valor,status,data_pagamento,valor_pago,forma_pagamento,observacoes,created_at,criado_por_id,criado_por_nome',
    searchColumns: ['fornecedor_nome','documento','descricao','status','forma_pagamento','observacoes'],
    termos,
    empresaId,
    escopo: acesso.escopo,
    proprioColumn: 'criado_por_id',
    proprioValue: usuario.id,
    order: 'created_at',
    limit: 18,
  })
  return {
    escopo: acesso.escopo,
    contas_receber: receber,
    contas_pagar: pagar,
    total_titulos_receber: await contar('financeiro_contas_receber', empresaId),
    total_titulos_pagar: await contar('financeiro_contas_pagar', empresaId),
  }
}

async function contextoRh(usuario: UsuarioTenant, acesso: AcessoAtlas, termos: string[]) {
  if (!acesso.permitido) return null
  const usuarios = await buscarTabela({
    table: 'usuarios',
    select: 'id,nome,role,created_at',
    searchColumns: ['nome','role'],
    termos,
    empresaId: usuario.empresa_id,
    order: 'created_at',
    limit: 15,
  })
  return { escopo: acesso.escopo, usuarios }
}

async function contextoPessoal(usuario: UsuarioTenant, pergunta: string, termos: string[]) {
  const t = textoNormalizado(pergunta)
  if (!/(TAREFA|TAREFAS|AGENDA|EVENTO|EVENTOS|COMPROMISSO|LEMBRETE)/.test(t)) return null

  const [tarefas, eventos] = await Promise.all([
    buscarTabela({
      table: 'tarefas',
      select: 'id,titulo,descricao,data_hora,concluida_em,recorrencia_tipo',
      searchColumns: ['titulo','descricao'],
      termos,
      filtros: { usuario_id: usuario.id },
      order: 'data_hora',
      limit: 15,
    }),
    buscarTabela({
      table: 'eventos',
      select: 'id,titulo,local,data_inicio,data_fim,recorrencia_tipo',
      searchColumns: ['titulo','local'],
      termos,
      filtros: { usuario_id: usuario.id },
      order: 'data_inicio',
      limit: 15,
    }),
  ])

  return { tarefas, eventos }
}


function perguntaPedeHistoricoWvetro(pergunta: string) {
  const t = textoNormalizado(pergunta)
  return t.includes('WVETRO') || t.includes('HISTORICO') || t.includes('LEGADO')
}

async function contextoHistoricoWvetro(
  usuario: UsuarioTenant,
  acessos: Record<AIModulo, AcessoAtlas>,
  termos: string[],
  podeCustos: boolean,
) {
  const empresaId = usuario.empresa_id
  const resultado: Record<string, any> = {}

  if (acessos.orcamento?.permitido || acessos.gestao?.permitido) {
    const acesso = acessos.orcamento?.permitido ? acessos.orcamento : acessos.gestao
    const selectOrc = podeCustos
      ? 'id,wvetro_numero,cliente_nome,cidade,obra_nome,vendedor_nome,situacao,data_emissao,data_venda,valor_bruto,valor_total,custo_com_sobra,custo_sem_sobra,total_m2,itens_qtd,match_status,match_metodo,capturado_em'
      : 'id,wvetro_numero,cliente_nome,cidade,obra_nome,vendedor_nome,situacao,data_emissao,data_venda,valor_bruto,valor_total,total_m2,itens_qtd,match_status,match_metodo,capturado_em'

    resultado.orcamentos = await buscarTabela({
      table: 'wvetro_orcamentos_historico',
      select: selectOrc,
      searchColumns: ['wvetro_numero','cliente_nome','cidade','obra_nome','vendedor_nome','situacao'],
      termos,
      empresaId,
      escopo: acesso?.escopo,
      proprioColumn: 'vendedor_nome',
      proprioValue: usuario.nome,
      order: 'data_emissao',
      limit: 15,
    })
  }

  if (acessos.financeiro?.permitido) {
    resultado.financeiro = await buscarTabela({
      table: 'wvetro_historico_financeiro',
      select: 'id,titulo_id_wvetro,fonte_wvetro,tipo_titulo,origem_titulo,documento,pessoa_razao,orcamento_wvetro,data_emissao,data_vencimento,data_baixa,valor_titulo,valor_recebido,valor_saldo,grupo_custo_descricao,centro_custo_descricao,tipo_lancamento,usuario_wvetro,status_vinculo',
      searchColumns: ['titulo_id_wvetro','fonte_wvetro','tipo_titulo','origem_titulo','documento','pessoa_razao','orcamento_wvetro','grupo_custo_descricao','centro_custo_descricao','tipo_lancamento','usuario_wvetro'],
      termos,
      empresaId,
      order: 'data_emissao',
      limit: 18,
    })
  }

  if (acessos.producao?.permitido || acessos.instalacao?.permitido || acessos.qualidade?.permitido) {
    resultado.operacional = await buscarTabela({
      table: 'wvetro_historico_operacional',
      select: 'id,tipo_registro,chave_externa,numero_wvetro,data_programacao,data_inicio,data_termino,status_vinculo,equipe_nome,observacao,quantidade_prevista,quantidade_realizada,orcamentos_wvetro,projetos',
      searchColumns: ['tipo_registro','chave_externa','numero_wvetro','status_vinculo','equipe_nome','observacao'],
      termos,
      empresaId,
      order: 'data_programacao',
      limit: 15,
    })
  }

  if (acessos.compras?.permitido || acessos.estoque?.permitido) {
    const selectSuprimentos = podeCustos
      ? 'id,tipo_registro,chave_externa,data_referencia,data_lancamento,documento,pessoa_nome,produto_codigo,produto_descricao,produto_tipo,cor_nome,local_estoque,movimento_tipo,quantidade,valor_unitario,valor_total,nota_numero,fornecedor_nome,data_emissao,data_entrada,valor_contabil,valor_produto,valor_frete,finalizada,resumo,produto_atlas_id,produto_vinculo_status'
      : 'id,tipo_registro,chave_externa,data_referencia,data_lancamento,documento,pessoa_nome,produto_codigo,produto_descricao,produto_tipo,cor_nome,local_estoque,movimento_tipo,quantidade,nota_numero,fornecedor_nome,data_emissao,data_entrada,finalizada,resumo,produto_atlas_id,produto_vinculo_status'

    resultado.suprimentos = await buscarTabela({
      table: 'wvetro_historico_suprimentos',
      select: selectSuprimentos,
      searchColumns: ['tipo_registro','chave_externa','documento','pessoa_nome','produto_codigo','produto_descricao','produto_tipo','cor_nome','local_estoque','movimento_tipo','nota_numero','fornecedor_nome','resumo'],
      termos,
      empresaId,
      order: 'data_referencia',
      limit: 18,
    })
  }

  return Object.keys(resultado).length
    ? {
        ...resultado,
        somente_historico: true,
        aviso: 'Dados W.Vetro históricos são somente consulta e não substituem os registros operacionais atuais do Atlas.',
      }
    : null
}

export async function montarContextoAtlasGlobal(params: {
  usuario: UsuarioTenant
  especialistaAtual: AIModulo
  pergunta: string
}) {
  const { usuario, especialistaAtual, pergunta } = params
  const termos = termosBusca(pergunta)
  const acessos = await carregarAcessos(usuario)
  const amplo = ehConsultaAmpla(pergunta)
  const podeCustos = await acessoAuxiliar(usuario, 'custos_precos')
  const fornecedoresLiberados = await acessoAuxiliar(usuario, 'fornecedores')

  const tocados = new Set<AIModulo>([especialistaAtual])
  for (const especialista of AI_ESPECIALISTAS) {
    if (perguntaTocaDominio(pergunta, especialista.modulo)) tocados.add(especialista.modulo)
  }
  if (amplo) {
    for (const especialista of AI_ESPECIALISTAS) {
      if (acessos[especialista.modulo]?.permitido) tocados.add(especialista.modulo)
    }
  }

  const bloqueadosSolicitados = Array.from(tocados).filter(m => !acessos[m]?.permitido && m !== especialistaAtual)
  const consultarTodosPermitidos = termos.length > 0 || amplo
  const permitidosConsultados = consultarTodosPermitidos
    ? AI_ESPECIALISTAS.filter(e => acessos[e.modulo]?.permitido).map(e => e.modulo)
    : Array.from(tocados).filter(m => acessos[m]?.permitido)

  const jobs: Array<Promise<[string, any]>> = []
  const add = (nome: string, promessa: Promise<any>) => jobs.push(promessa.then(valor => [nome, valor]))

  // Catálogo técnico sem preços/custos é conhecimento operacional compartilhado e pode ser consultado por qualquer usuário.
  if (perguntaTecnica(pergunta) || amplo || especialistaAtual === 'engenharia' || especialistaAtual === 'orcamento' || especialistaAtual === 'producao') {
    add('catalogo_tecnico', contextoTecnicoSeguro(usuario, pergunta, termos))
  }

  // Busca federada: cada pergunta relevante procura, em paralelo, em TODOS os domínios permitidos.
  // O especialista define a interpretação; não limita a fonte de dados.
  const consultar = (modulo: AIModulo) => consultarTodosPermitidos || tocados.has(modulo)

  if (consultar('comercial') && acessos.comercial?.permitido) add('comercial', contextoComercial(usuario, acessos.comercial, termos))
  if (consultar('orcamento') && acessos.orcamento?.permitido) add('orcamento', contextoOrcamento(usuario, acessos.orcamento, termos, podeCustos))
  if (consultar('medicao_final') && acessos.medicao_final?.permitido) add('medicao_final', contextoMedicao(usuario, acessos.medicao_final, termos))
  if (consultar('compras') && acessos.compras?.permitido) add('compras', contextoCompras(usuario, acessos.compras, termos, fornecedoresLiberados))
  if (consultar('estoque') && acessos.estoque?.permitido) add('estoque', contextoEstoque(usuario, acessos.estoque, termos, podeCustos))
  if (consultar('producao') && acessos.producao?.permitido) add('producao', contextoProducao(usuario, acessos.producao, termos))
  if (consultar('instalacao') && acessos.instalacao?.permitido) add('instalacao', contextoInstalacaoQualidade(usuario, acessos.instalacao, termos))
  if (consultar('qualidade') && acessos.qualidade?.permitido) add('qualidade', contextoInstalacaoQualidade(usuario, acessos.qualidade, termos))
  if (consultar('financeiro') && acessos.financeiro?.permitido) add('financeiro', contextoFinanceiro(usuario, acessos.financeiro, termos))
  if (consultar('rh') && acessos.rh?.permitido) add('rh', contextoRh(usuario, acessos.rh, termos))

  if (perguntaPedeHistoricoWvetro(pergunta) || amplo) {
    add('historico_wvetro', contextoHistoricoWvetro(usuario, acessos, termos, podeCustos))
  }

  const pedidoEstimativa = detectarConsultaEstimativaOrcamento(pergunta)
  if (pedidoEstimativa.solicitado && acessos.orcamento?.permitido) {
    add('estimativa_orcamento_historica', estimarOrcamentoHistorico({
      empresaId: usuario.empresa_id,
      pergunta,
    }))
  }

  add('pessoal', contextoPessoal(usuario, pergunta, termos))

  const pares = await Promise.all(jobs)
  const dados: Record<string, any> = {}
  for (const [nome, valor] of pares) {
    if (valor) dados[nome] = valor
  }

  return {
    estrategia: 'busca_sob_demanda_em_todo_atlas_permitido',
    especialista_principal: especialistaAtual,
    consulta_ampla: amplo,
    termos_busca: termos,
    dominios_permitidos: AI_ESPECIALISTAS
      .filter(e => acessos[e.modulo]?.permitido)
      .map(e => ({ modulo: e.modulo, escopo: acessos[e.modulo].escopo })),
    dominios_consultados_nesta_pergunta: permitidosConsultados,
    dominios_bloqueados_solicitados: bloqueadosSolicitados,
    custos_precos_liberados: podeCustos,
    fornecedores_liberados: fornecedoresLiberados,
    dados,
    politica: {
      especialista_define_prioridade_e_forma_de_responder: true,
      permissao_do_usuario_define_limite_dos_dados: true,
      catalogo_tecnico_sem_preco_compartilhado: true,
      busca_externa_so_depois_da_busca_interna: true,
      nao_incluir_segredos_runtime_credenciais_diario_privado: true,
    },
  }
}