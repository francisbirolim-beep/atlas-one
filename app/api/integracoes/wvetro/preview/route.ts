import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import {
  buscarProdutoWVetro,
  listarLinhasWVetro,
  listarOrcamentosWVetro,
  listarPedidosWVetro,
  statusConfiguracaoWVetro,
  WVetroProdutoTipo,
} from '@/lib/wvetroApi'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function autenticarMaster(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data?.user) return null
  const { data: usuario } = await supabaseAdmin.from('usuarios').select('id, nome, role').eq('id', data.user.id).maybeSingle()
  if (!usuario || usuario.role !== 'master') return null
  return usuario
}

function dataIsoValida(valor: string | null): valor is string {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false
  return !Number.isNaN(new Date(`${valor}T00:00:00Z`).getTime())
}

function intervaloDias(inicio: string, fim: string) {
  return Math.floor((new Date(`${fim}T00:00:00Z`).getTime() - new Date(`${inicio}T00:00:00Z`).getTime()) / 86_400_000)
}

function numero(valor: unknown): number | null {
  if (typeof valor === 'number' && Number.isFinite(valor)) return valor
  const bruto = String(valor ?? '').trim()
  if (!bruto) return null
  if (/^-?\d+(?:\.\d+)?$/.test(bruto)) {
    const n = Number(bruto)
    return Number.isFinite(n) ? n : null
  }
  const txt = bruto.replace(/\./g, '').replace(',', '.')
  const n = Number(txt)
  return Number.isFinite(n) ? n : null
}

function normalizarTexto(valor: unknown) {
  return String(valor ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toLocaleUpperCase('pt-BR')
}

function normalizarCodigo(valor: unknown) {
  return normalizarTexto(valor).replace(/\s+/g, '')
}

function normalizarLinhas(payload: unknown) {
  const mapa = new Map<string, { id: string; nome: string }>()
  function visitar(valor: unknown) {
    if (Array.isArray(valor)) return valor.forEach(visitar)
    if (!valor || typeof valor !== 'object') return
    const obj = valor as Record<string, unknown>
    const id = String(obj.LinhaId ?? obj.linhaId ?? '').trim()
    const nome = String(obj.LinhaNome ?? obj.linhaNome ?? '').trim()
    if (id && nome) mapa.set(`${id}::${nome.toLowerCase()}`, { id, nome })
    Object.values(obj).forEach(visitar)
  }
  visitar(payload)
  return Array.from(mapa.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

type TipologiaResumo = { linha: string; modelo: string; ocorrencias: number }

function paresLinhaModelo(payload: unknown): TipologiaResumo[] {
  const encontrados = new Map<string, TipologiaResumo>()
  function visitar(valor: unknown) {
    if (Array.isArray(valor)) return valor.forEach(visitar)
    if (!valor || typeof valor !== 'object') return
    const obj = valor as Record<string, unknown>
    const linha = String(obj.Linha ?? obj.linha ?? '').trim()
    const modelo = String(obj.Modelo ?? obj.modelo ?? '').trim()
    if (linha && modelo) {
      const chave = `${linha.toLocaleLowerCase('pt-BR')}::${modelo.toLocaleLowerCase('pt-BR')}`
      const atual = encontrados.get(chave)
      if (atual) atual.ocorrencias += 1
      else encontrados.set(chave, { linha, modelo, ocorrencias: 1 })
    }
    Object.values(obj).forEach(visitar)
  }
  visitar(payload)
  return Array.from(encontrados.values()).sort((a, b) => a.linha.localeCompare(b.linha, 'pt-BR') || a.modelo.localeCompare(b.modelo, 'pt-BR'))
}

type ComponenteResumo = {
  codigo: string
  codigoWvetro: string
  nome: string
  cor: string
  ocorrencias: number
  custoMin: number | null
  custoMax: number | null
  vendaMin: number | null
  vendaMax: number | null
}

function resumoComponentes(payload: unknown) {
  const mapas = {
    perfis: new Map<string, ComponenteResumo>(),
    acessorios: new Map<string, ComponenteResumo>(),
    vidros: new Map<string, ComponenteResumo>(),
  }

  function adicionar(tipo: keyof typeof mapas, valor: unknown) {
    if (!valor || typeof valor !== 'object') return
    const obj = valor as Record<string, unknown>
    const codigo = String(obj.SeuCodigo ?? obj.seuCodigo ?? obj.Codigo ?? obj.codigo ?? '').trim()
    const codigoWvetro = String(obj.Codigo ?? obj.codigo ?? '').trim()
    const nome = String(obj.Nome ?? obj.nome ?? obj.Especificacao ?? obj.especificacao ?? '').trim()
    const cor = String(obj.Cor ?? obj.cor ?? '').trim()
    if (!codigo && !nome) return
    const chave = `${codigo.toLowerCase()}::${nome.toLowerCase()}::${cor.toLowerCase()}`
    const custo = numero(obj.CustoVlr ?? obj.custoVlr)
    const venda = numero(obj.VendaVlr ?? obj.vendaVlr)
    const atual = mapas[tipo].get(chave)
    if (!atual) {
      mapas[tipo].set(chave, {
        codigo: codigo || codigoWvetro || nome,
        codigoWvetro,
        nome,
        cor,
        ocorrencias: 1,
        custoMin: custo,
        custoMax: custo,
        vendaMin: venda,
        vendaMax: venda,
      })
      return
    }
    atual.ocorrencias += 1
    if (custo !== null) {
      atual.custoMin = atual.custoMin === null ? custo : Math.min(atual.custoMin, custo)
      atual.custoMax = atual.custoMax === null ? custo : Math.max(atual.custoMax, custo)
    }
    if (venda !== null) {
      atual.vendaMin = atual.vendaMin === null ? venda : Math.min(atual.vendaMin, venda)
      atual.vendaMax = atual.vendaMax === null ? venda : Math.max(atual.vendaMax, venda)
    }
  }

  function visitar(valor: unknown) {
    if (Array.isArray(valor)) return valor.forEach(visitar)
    if (!valor || typeof valor !== 'object') return
    const obj = valor as Record<string, unknown>
    for (const [chave, conteudo] of Object.entries(obj)) {
      const k = chave.toLowerCase()
      if (Array.isArray(conteudo)) {
        if (k === 'perfil' || k === 'perfis') conteudo.forEach(v => adicionar('perfis', v))
        if (k === 'acessorios' || k === 'acessórios') conteudo.forEach(v => adicionar('acessorios', v))
        if (k === 'vidros' || k === 'vidro') conteudo.forEach(v => adicionar('vidros', v))
      }
      visitar(conteudo)
    }
  }

  visitar(payload)
  const ordenar = (m: Map<string, ComponenteResumo>) => Array.from(m.values()).sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR'))
  return {
    perfis: ordenar(mapas.perfis),
    acessorios: ordenar(mapas.acessorios),
    vidros: ordenar(mapas.vidros),
  }
}

type ProdutoAtlas = {
  id: string
  codigo: string | null
  codigo_origem: string | null
  id_externo_wvetro: string | null
  nome: string
  categoria: string
  custo: number | string | null
  preco: number | string | null
  origem: string
  status_validacao: string
}

type LinhaTecnicaAtlas = {
  id: string
  chave: string
  nome: string
  apelidos: string[] | null
}

type TipologiaAtlas = {
  id: string
  chave: string
  label: string
}

type VinculoLinhaTipologia = {
  linha_id: string
  tipologia_id: string
}

type StatusComparacao = 'existente' | 'novo' | 'divergente' | 'linha_nao_mapeada'

type ComponenteComparado = ComponenteResumo & {
  statusComparacao: Exclude<StatusComparacao, 'linha_nao_mapeada'>
  produtoAtlasId: string | null
  codigoAtlas: string | null
  nomeAtlas: string | null
  custoAtlas: number | null
  precoAtlas: number | null
  motivos: string[]
}

type TipologiaComparada = TipologiaResumo & {
  statusComparacao: StatusComparacao
  linhaAtlasId: string | null
  linhaAtlasNome: string | null
  tipologiaAtlasId: string | null
  tipologiaAtlasLabel: string | null
  motivos: string[]
}

function dentroDaFaixa(valor: number, minimo: number | null, maximo: number | null) {
  if (minimo === null && maximo === null) return true
  const min = minimo ?? maximo!
  const max = maximo ?? minimo!
  return valor >= min - 0.01 && valor <= max + 0.01
}

function compararComponente(componente: ComponenteResumo, indice: Map<string, ProdutoAtlas[]>): ComponenteComparado {
  const chaves = Array.from(new Set([normalizarCodigo(componente.codigo), normalizarCodigo(componente.codigoWvetro)].filter(Boolean)))
  const encontrados = new Map<string, ProdutoAtlas>()
  for (const chave of chaves) {
    for (const produto of indice.get(chave) || []) encontrados.set(produto.id, produto)
  }

  const candidatos = Array.from(encontrados.values())
  if (candidatos.length === 0) {
    return {
      ...componente,
      statusComparacao: 'novo',
      produtoAtlasId: null,
      codigoAtlas: null,
      nomeAtlas: null,
      custoAtlas: null,
      precoAtlas: null,
      motivos: ['Código não encontrado no cadastro atual do Atlas.'],
    }
  }

  if (candidatos.length > 1) {
    return {
      ...componente,
      statusComparacao: 'divergente',
      produtoAtlasId: null,
      codigoAtlas: null,
      nomeAtlas: null,
      custoAtlas: null,
      precoAtlas: null,
      motivos: [`O mesmo código encontrou ${candidatos.length} produtos no Atlas; exige conferência.`],
    }
  }

  const produto = candidatos[0]
  const custoAtlas = numero(produto.custo)
  const precoAtlas = numero(produto.preco)
  const motivos: string[] = []

  if ((componente.custoMin !== null || componente.custoMax !== null) && (custoAtlas === null || !dentroDaFaixa(custoAtlas, componente.custoMin, componente.custoMax))) {
    motivos.push('Custo atual do Atlas está fora da faixa encontrada no histórico W.Vetro.')
  }
  if ((componente.vendaMin !== null || componente.vendaMax !== null) && (precoAtlas === null || !dentroDaFaixa(precoAtlas, componente.vendaMin, componente.vendaMax))) {
    motivos.push('Preço atual do Atlas está fora da faixa encontrada no histórico W.Vetro.')
  }

  return {
    ...componente,
    statusComparacao: motivos.length ? 'divergente' : 'existente',
    produtoAtlasId: produto.id,
    codigoAtlas: produto.codigo || produto.codigo_origem || produto.id_externo_wvetro,
    nomeAtlas: produto.nome,
    custoAtlas,
    precoAtlas,
    motivos,
  }
}

function modeloDoLabelAtlas(label: string) {
  return label.replace(/\s*\([^)]*\)\s*$/, '').trim()
}

function compararTipologias(
  tipologias: TipologiaResumo[],
  linhasAtlas: LinhaTecnicaAtlas[],
  tipologiasAtlas: TipologiaAtlas[],
  vinculos: VinculoLinhaTipologia[],
): TipologiaComparada[] {
  const tipologiaPorId = new Map(tipologiasAtlas.map(t => [t.id, t]))
  const tipologiasPorLinha = new Map<string, TipologiaAtlas[]>()
  for (const vinculo of vinculos) {
    const tipologia = tipologiaPorId.get(vinculo.tipologia_id)
    if (!tipologia) continue
    const lista = tipologiasPorLinha.get(vinculo.linha_id) || []
    lista.push(tipologia)
    tipologiasPorLinha.set(vinculo.linha_id, lista)
  }

  return tipologias.map(item => {
    const linhaNormalizada = normalizarTexto(item.linha)
    const linhasCompativeis = linhasAtlas.filter(linha => {
      const nomes = [linha.nome, ...(linha.apelidos || [])].map(normalizarTexto)
      return nomes.includes(linhaNormalizada)
    })

    if (linhasCompativeis.length === 0) {
      return {
        ...item,
        statusComparacao: 'linha_nao_mapeada',
        linhaAtlasId: null,
        linhaAtlasNome: null,
        tipologiaAtlasId: null,
        tipologiaAtlasLabel: null,
        motivos: ['A linha do W.Vetro não possui correspondência exata nas linhas técnicas do Atlas.'],
      }
    }

    if (linhasCompativeis.length > 1) {
      return {
        ...item,
        statusComparacao: 'divergente',
        linhaAtlasId: null,
        linhaAtlasNome: null,
        tipologiaAtlasId: null,
        tipologiaAtlasLabel: null,
        motivos: ['A linha do W.Vetro corresponde a mais de uma linha técnica do Atlas.'],
      }
    }

    const linha = linhasCompativeis[0]
    const modeloNormalizado = normalizarTexto(item.modelo)
    const modelos = (tipologiasPorLinha.get(linha.id) || []).filter(t => normalizarTexto(modeloDoLabelAtlas(t.label)) === modeloNormalizado)

    if (modelos.length === 0) {
      return {
        ...item,
        statusComparacao: 'novo',
        linhaAtlasId: linha.id,
        linhaAtlasNome: linha.nome,
        tipologiaAtlasId: null,
        tipologiaAtlasLabel: null,
        motivos: ['Linha reconhecida, mas o modelo não está vinculado a ela no Atlas.'],
      }
    }

    if (modelos.length > 1) {
      return {
        ...item,
        statusComparacao: 'divergente',
        linhaAtlasId: linha.id,
        linhaAtlasNome: linha.nome,
        tipologiaAtlasId: null,
        tipologiaAtlasLabel: null,
        motivos: [`O modelo encontrou ${modelos.length} tipologias vinculadas à mesma linha no Atlas.`],
      }
    }

    return {
      ...item,
      statusComparacao: 'existente',
      linhaAtlasId: linha.id,
      linhaAtlasNome: linha.nome,
      tipologiaAtlasId: modelos[0].id,
      tipologiaAtlasLabel: modelos[0].label,
      motivos: [],
    }
  })
}

function contarStatus<T extends { statusComparacao: StatusComparacao }>(itens: T[]) {
  return itens.reduce((acc, item) => {
    acc[item.statusComparacao] = (acc[item.statusComparacao] || 0) + 1
    return acc
  }, { existente: 0, novo: 0, divergente: 0, linha_nao_mapeada: 0 } as Record<StatusComparacao, number>)
}

async function reconciliarComAtlas(tipologias: TipologiaResumo[], componentes: ReturnType<typeof resumoComponentes>) {
  const [produtosResp, linhasResp, tipologiasResp, vinculosResp] = await Promise.all([
    supabaseAdmin.from('produtos').select('id,codigo,codigo_origem,id_externo_wvetro,nome,categoria,custo,preco,origem,status_validacao'),
    supabaseAdmin.from('linhas_tecnicas').select('id,chave,nome,apelidos'),
    supabaseAdmin.from('tipologias').select('id,chave,label'),
    supabaseAdmin.from('linha_tipologias').select('linha_id,tipologia_id'),
  ])

  const erro = produtosResp.error || linhasResp.error || tipologiasResp.error || vinculosResp.error
  if (erro) throw new Error(`Não foi possível comparar com os cadastros do Atlas: ${erro.message}`)

  const produtos = (produtosResp.data || []) as ProdutoAtlas[]
  const linhas = (linhasResp.data || []) as LinhaTecnicaAtlas[]
  const tipologiasAtlas = (tipologiasResp.data || []) as TipologiaAtlas[]
  const vinculos = (vinculosResp.data || []) as VinculoLinhaTipologia[]

  const indiceProdutos = new Map<string, ProdutoAtlas[]>()
  for (const produto of produtos) {
    const codigos = Array.from(new Set([
      normalizarCodigo(produto.codigo),
      normalizarCodigo(produto.codigo_origem),
      normalizarCodigo(produto.id_externo_wvetro),
    ].filter(Boolean)))
    for (const codigo of codigos) {
      const lista = indiceProdutos.get(codigo) || []
      lista.push(produto)
      indiceProdutos.set(codigo, lista)
    }
  }

  const tipologiasComparadas = compararTipologias(tipologias, linhas, tipologiasAtlas, vinculos)
  const perfis = componentes.perfis.map(item => compararComponente(item, indiceProdutos))
  const acessorios = componentes.acessorios.map(item => compararComponente(item, indiceProdutos))
  const vidros = componentes.vidros.map(item => compararComponente(item, indiceProdutos))

  return {
    regra: 'comparacao-exata-sem-fuzzy',
    somenteLeitura: true,
    baseAtlas: {
      produtos: produtos.length,
      tipologias: tipologiasAtlas.length,
      linhasTecnicas: linhas.length,
      vinculosLinhaTipologia: vinculos.length,
    },
    totais: {
      tipologias: contarStatus(tipologiasComparadas),
      perfis: contarStatus(perfis),
      acessorios: contarStatus(acessorios),
      vidros: contarStatus(vidros),
    },
    tipologias: tipologiasComparadas,
    perfis,
    acessorios,
    vidros,
  }
}

export async function GET(req: NextRequest) {
  const usuario = await autenticarMaster(req)
  if (!usuario) return NextResponse.json({ error: 'Acesso restrito a usuário master.' }, { status: 401 })

  const status = statusConfiguracaoWVetro()
  const recurso = req.nextUrl.searchParams.get('recurso') || 'status'
  if (recurso === 'status') return NextResponse.json({ ok: true, modo: 'somente-leitura', configuracao: status })

  if (!status.pronto) {
    return NextResponse.json({ error: 'A integração W.Vetro está preparada, mas faltam credenciais no ambiente da Vercel.', configuracao: status }, { status: 503 })
  }

  try {
    if (recurso === 'linhas') {
      const dados = await listarLinhasWVetro()
      const linhas = normalizarLinhas(dados)
      return NextResponse.json({ ok: true, recurso, modo: 'somente-leitura', total: linhas.length, linhas, dados })
    }

    if (recurso === 'produto') {
      const tipo = String(req.nextUrl.searchParams.get('tipo') || '').toUpperCase() as WVetroProdutoTipo
      const codigo = String(req.nextUrl.searchParams.get('codigo') || '').trim()
      if (!['A', 'P', 'E'].includes(tipo) || !codigo) return NextResponse.json({ error: 'Informe tipo=A|P|E e codigo do produto.' }, { status: 400 })
      const dados = await buscarProdutoWVetro(tipo, codigo)
      return NextResponse.json({ ok: true, recurso, modo: 'somente-leitura', dados })
    }

    if (['orcamentos', 'pedidos', 'resumo'].includes(recurso)) {
      const inicio = req.nextUrl.searchParams.get('inicio')
      const fim = req.nextUrl.searchParams.get('fim')
      if (!dataIsoValida(inicio) || !dataIsoValida(fim)) return NextResponse.json({ error: 'Informe inicio e fim no formato YYYY-MM-DD.' }, { status: 400 })
      const dias = intervaloDias(inicio, fim)
      if (dias < 0 || dias > 90) return NextResponse.json({ error: 'O período de prévia deve ter entre 0 e 90 dias.' }, { status: 400 })

      const fonte = recurso === 'resumo' ? String(req.nextUrl.searchParams.get('fonte') || 'orcamentos') : recurso
      if (!['orcamentos', 'pedidos'].includes(fonte)) return NextResponse.json({ error: 'Fonte inválida. Use orcamentos ou pedidos.' }, { status: 400 })
      const dados = fonte === 'orcamentos' ? await listarOrcamentosWVetro(inicio, fim) : await listarPedidosWVetro(inicio, fim)
      const tipologias = paresLinhaModelo(dados)

      if (recurso === 'resumo') {
        const componentes = resumoComponentes(dados)
        const reconciliacao = await reconciliarComAtlas(tipologias, componentes)
        return NextResponse.json({
          ok: true,
          recurso,
          fonte,
          modo: 'somente-leitura',
          periodo: { inicio, fim },
          totais: {
            tipologias: tipologias.length,
            perfis: componentes.perfis.length,
            acessorios: componentes.acessorios.length,
            vidros: componentes.vidros.length,
          },
          tipologias,
          ...componentes,
          reconciliacao,
        })
      }

      return NextResponse.json({ ok: true, recurso, modo: 'somente-leitura', periodo: { inicio, fim }, tipologiasEncontradas: tipologias, dados })
    }

    return NextResponse.json({ error: 'Recurso inválido. Use status, linhas, produto, orcamentos, pedidos ou resumo.' }, { status: 400 })
  } catch (error) {
    console.error('Erro na prévia da API W.Vetro:', error)
    const mensagem = error instanceof Error ? error.message : 'Erro desconhecido ao consultar W.Vetro.'
    return NextResponse.json({ error: mensagem }, { status: 502 })
  }
}
