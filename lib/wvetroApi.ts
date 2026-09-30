const WVETRO_BASE_URL_PADRAO = 'https://api.wvetro.com.br/wvetro/rest/api/v2'

export type WVetroProdutoTipo = 'A' | 'P' | 'E'

export interface WVetroConfiguracaoStatus {
  baseUrl: string
  licencaConfigurada: boolean
  usuarioConfigurado: boolean
  senhaConfigurada: boolean
  pronto: boolean
}

interface WVetroCredenciais {
  baseUrl: string
  licencaId: string
  username: string
  password: string
}

let tokenCache: { token: string; expiraEm: number } | null = null

export function statusConfiguracaoWVetro(): WVetroConfiguracaoStatus {
  const licenca = String(process.env.WVETRO_LICENSE_ID || '').trim()
  const usuario = String(process.env.WVETRO_USERNAME || '').trim()
  const senha = String(process.env.WVETRO_PASSWORD || '').trim()
  const baseUrl = String(process.env.WVETRO_BASE_URL || WVETRO_BASE_URL_PADRAO).replace(/\/$/, '')

  return {
    baseUrl,
    licencaConfigurada: !!licenca,
    usuarioConfigurado: !!usuario,
    senhaConfigurada: !!senha,
    pronto: !!licenca && !!usuario && !!senha,
  }
}

function credenciaisWVetro(): WVetroCredenciais {
  const status = statusConfiguracaoWVetro()
  if (!status.pronto) {
    throw new Error('Credenciais da API W.Vetro não configuradas no ambiente do servidor.')
  }

  return {
    baseUrl: status.baseUrl,
    licencaId: String(process.env.WVETRO_LICENSE_ID).trim(),
    username: String(process.env.WVETRO_USERNAME).trim(),
    password: String(process.env.WVETRO_PASSWORD).trim(),
  }
}

function tokenJwtDaString(valorBruto: string): string | null {
  const valor = valorBruto
    .trim()
    .replace(/^"|"$/g, '')
    .replace(/^Bearer\s+/i, '')
    .trim()

  const jwt = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/
  return jwt.test(valor) ? valor : null
}

function extrairToken(payload: unknown, profundidade = 0): string | null {
  if (profundidade > 8) return null

  if (typeof payload === 'string') return tokenJwtDaString(payload)

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const token = extrairToken(item, profundidade + 1)
      if (token) return token
    }
    return null
  }

  if (!payload || typeof payload !== 'object') return null

  const obj = payload as Record<string, unknown>
  const chavesPrioritarias = Object.keys(obj).filter((chave) => /token|jwt|access|auth/i.test(chave))

  for (const chave of chavesPrioritarias) {
    const token = extrairToken(obj[chave], profundidade + 1)
    if (token) return token
  }

  for (const valor of Object.values(obj)) {
    const token = extrairToken(valor, profundidade + 1)
    if (token) return token
  }

  return null
}

function descreverEstruturaAutenticacao(payload: unknown): string {
  if (Array.isArray(payload)) return `array(${payload.length})`
  if (payload && typeof payload === 'object') {
    const chaves = Object.keys(payload as Record<string, unknown>).slice(0, 12)
    return chaves.length ? `objeto com campos: ${chaves.join(', ')}` : 'objeto vazio'
  }
  if (typeof payload === 'string') return `texto (${payload.length} caracteres)`
  return typeof payload
}

async function fetchWVetro(url: URL, init: RequestInit, contexto: string) {
  try {
    return await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(45_000),
    })
  } catch (e) {
    const nome = e instanceof Error ? e.name : ''
    if (nome === 'TimeoutError' || nome === 'AbortError') {
      throw new Error(`Timeout W.Vetro em ${contexto} após 45s.`)
    }
    throw e
  }
}

async function autenticarWVetro(force = false): Promise<string> {
  const agora = Date.now()
  if (!force && tokenCache && tokenCache.expiraEm > agora + 60_000) return tokenCache.token

  const cfg = credenciaisWVetro()
  const url = new URL(`${cfg.baseUrl}/Integracao/ValidarUsuario`)
  url.searchParams.set('Licencaid', cfg.licencaId)
  url.searchParams.set('Secusername', cfg.username)
  url.searchParams.set('Secuserpassword', cfg.password)

  const resposta = await fetchWVetro(url, { method: 'GET', cache: 'no-store' }, '/Integracao/ValidarUsuario')
  const texto = await resposta.text()

  if (!resposta.ok) throw new Error(`W.Vetro recusou a autenticação (${resposta.status}).`)

  let payload: unknown = texto
  try {
    payload = JSON.parse(texto)
  } catch {
    // Algumas APIs legadas retornam o JWT como texto puro.
  }

  const token = extrairToken(payload)
  if (!token) {
    throw new Error(
      `A API W.Vetro respondeu, mas não retornou um JWT reconhecível (${descreverEstruturaAutenticacao(payload)}).`,
    )
  }

  tokenCache = { token, expiraEm: agora + 23 * 60 * 60 * 1000 }
  return token
}

async function requisicaoWVetro<T>(
  caminho: string,
  query?: Record<string, string | number | undefined>,
): Promise<T> {
  const cfg = credenciaisWVetro()
  const url = new URL(`${cfg.baseUrl}${caminho.startsWith('/') ? caminho : `/${caminho}`}`)

  Object.entries(query || {}).forEach(([chave, valor]) => {
    if (valor !== undefined && valor !== '') url.searchParams.set(chave, String(valor))
  })

  async function executar(token: string) {
    return fetchWVetro(
      url,
      {
        method: 'GET',
        cache: 'no-store',
        headers: { token, Accept: 'application/json' },
      },
      caminho,
    )
  }

  let resposta = await executar(await autenticarWVetro())
  if (resposta.status === 401 || resposta.status === 403) {
    tokenCache = null
    resposta = await executar(await autenticarWVetro(true))
  }

  const texto = await resposta.text()
  if (!resposta.ok) {
    throw new Error(`Erro W.Vetro ${resposta.status} em ${caminho}: ${texto.slice(0, 300)}`)
  }

  if (!texto.trim()) return null as T
  try {
    return JSON.parse(texto) as T
  } catch {
    return texto as T
  }
}

export async function listarLinhasWVetro<T = unknown>(): Promise<T> {
  return requisicaoWVetro<T>('/Produtos/linhas')
}

export async function listarCoresWVetro<T = unknown>(): Promise<T> {
  return requisicaoWVetro<T>('/Produtos/cores')
}

export async function listarVidrosWVetro<T = unknown>(): Promise<T> {
  return requisicaoWVetro<T>('/Produtos/vidros')
}

export async function buscarProdutoWVetro<T = unknown>(tipo: WVetroProdutoTipo, codigo: string): Promise<T> {
  return requisicaoWVetro<T>('/Produtos/produtoByKey', {
    Produtotipo: tipo,
    Produtocodigo: codigo,
  })
}

// A documentação chama o recurso de produtoByKey. Algumas instalações GeneXus
// retornam a coleção do tipo quando Produtocodigo é omitido; outras exigem o código.
// A auditoria tenta este modo apenas como descoberta. Se a instalação recusar,
// o Atlas usa os códigos já preservados nos exports + códigos encontrados nas vendas.
export async function listarProdutosWVetroPorTipo<T = unknown>(tipo: WVetroProdutoTipo): Promise<T> {
  return requisicaoWVetro<T>('/Produtos/produtoByKey', { Produtotipo: tipo })
}

export async function listarOrcamentosWVetro<T = unknown>(inicio: string, fim: string): Promise<T> {
  return requisicaoWVetro<T>('/vendas/orcamentos', {
    Dtcadastroinicial: inicio,
    Dtcadastrofinal: fim,
  })
}

export async function listarPedidosWVetro<T = unknown>(inicio: string, fim: string): Promise<T> {
  return requisicaoWVetro<T>('/vendas/pedidos', {
    Dtvendainicial: inicio,
    Dtvendafinal: fim,
  })
}

export async function buscarPedidoWVetro<T = unknown>(orcamentoId: string | number): Promise<T> {
  return requisicaoWVetro<T>('/vendas/pedidoByKey', { Orcamentoid: orcamentoId })
}

export async function listarPessoasWVetro<T = unknown>(params: {
  pessoaId?: string | number
  tipoPessoa?: string
} = {}): Promise<T> {
  return requisicaoWVetro<T>('/pessoa/listPessoa', {
    Pessoaid: params.pessoaId,
    Tipopessoa: params.tipoPessoa,
  })
}

export async function listarTiposPessoaWVetro<T = unknown>(): Promise<T> {
  return requisicaoWVetro<T>('/pessoa/listTipo')
}

export async function listarVendedoresWVetro<T = unknown>(vendedorId?: string | number): Promise<T> {
  return requisicaoWVetro<T>('/pessoa/listVendedor', {
    Vendedorid: vendedorId,
  })
}

export async function listarMetasWVetro<T = unknown>(params: {
  vendedorId?: string | number
  linhaId?: string | number
  ano: number
  mes: number
}): Promise<T> {
  return requisicaoWVetro<T>('/vendas/listMetas', {
    Vendedorid: params.vendedorId,
    Linhaid: params.linhaId,
    Ano: params.ano,
    Mes: String(params.mes).padStart(2, '0'),
  })
}

export async function listarNotasEntradaWVetro<T = unknown>(inicio: string, fim: string): Promise<T> {
  return requisicaoWVetro<T>('/compras/nf', {
    Dtentradainicio: inicio,
    Dtentradafinal: fim,
  })
}

export async function listarItensNotaEntradaWVetro<T = unknown>(nfId: string | number): Promise<T> {
  return requisicaoWVetro<T>('/compras/itemNf', { Nfid: nfId })
}

export async function listarMovimentosEstoqueWVetro<T = unknown>(
  inicio: string,
  fim: string,
  filtros: {
    tipo?: string
    produtoCodigo?: string
    corNome?: string
  } = {},
): Promise<T> {
  return requisicaoWVetro<T>('/estoque/movimentoEstoque', {
    Dtmovimentoinicio: inicio,
    Dtmovimentofinal: fim,
    Tipo: filtros.tipo,
    Produtocodigo: filtros.produtoCodigo,
    Cornome: filtros.corNome,
  })
}

export async function listarTitulosWVetro<T = unknown>(
  inicio: string,
  fim: string,
  tituloTipo?: string,
): Promise<T> {
  return requisicaoWVetro<T>('/Financeiro/listTitulos', {
    Dtvencimentoinicial: inicio,
    Dtvencimentofinal: fim,
    Titulotipo: tituloTipo,
  })
}

export async function listarTitulosBaixadosWVetro<T = unknown>(
  inicio: string,
  fim: string,
  tituloTipo?: string,
): Promise<T> {
  return requisicaoWVetro<T>('/Financeiro/listTitulosBaixados', {
    Dtbaixainicial: inicio,
    Dtbaixafinal: fim,
    Titulotipo: tituloTipo,
  })
}

export async function listarContasWVetro<T = unknown>(contaNro?: string): Promise<T> {
  return requisicaoWVetro<T>('/Financeiro/listContas', { Contanro: contaNro })
}

export async function listarPlanoContasWVetro<T = unknown>(): Promise<T> {
  return requisicaoWVetro<T>('/Financeiro/listPlanoContas')
}

export async function listarExtratoWVetro<T = unknown>(
  inicio: string,
  fim: string,
  filtros: {
    contaNro?: string
    tipo?: string
  } = {},
): Promise<T> {
  return requisicaoWVetro<T>('/Financeiro/listExtrato', {
    Dtcontabilinicial: inicio,
    Dtcontabilfinal: fim,
    Contanro: filtros.contaNro,
    Lancamentobancotipo: filtros.tipo,
  })
}

export async function listarLotesProducaoWVetro<T = unknown>(params: {
  loteNro?: string | number
  inicio: string
  fim: string
  produzido?: boolean
}): Promise<T> {
  return requisicaoWVetro<T>('/producao/lotes', {
    Loteproducaonro: params.loteNro,
    Dtprogramadoinicio: params.inicio,
    Dtprogramadofinal: params.fim,
    Produzido: params.produzido === undefined ? undefined : String(params.produzido),
  })
}

export async function listarProducaoProjetoWVetro<T = unknown>(params: {
  loteNro?: string | number
  inicio: string
  fim: string
}): Promise<T> {
  return requisicaoWVetro<T>('/producao/producaoProjeto', {
    Loteproducaonro: params.loteNro,
    Dtproduzidoinicial: params.inicio,
    Dtproduzidofinal: params.fim,
  })
}

export async function listarInstalacoesWVetro<T = unknown>(params: {
  programacaoNro?: string | number
  inicio: string
  fim: string
}): Promise<T> {
  return requisicaoWVetro<T>('/producao/instalacoes', {
    Proginstalacaonro: params.programacaoNro,
    Dtinicio: params.inicio,
    Dtfinal: params.fim,
  })
}
