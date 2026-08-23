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

function extrairToken(payload: unknown): string | null {
  if (typeof payload === 'string') {
    const valor = payload.trim().replace(/^"|"$/g, '')
    return valor.length >= 20 ? valor : null
  }

  if (!payload || typeof payload !== 'object') return null
  const obj = payload as Record<string, unknown>
  const chaves = ['token', 'Token', 'access_token', 'AccessToken', 'jwt', 'Jwt', 'data', 'Data', 'result', 'Result']

  for (const chave of chaves) {
    if (!(chave in obj)) continue
    const token = extrairToken(obj[chave])
    if (token) return token
  }

  return null
}

async function autenticarWVetro(force = false): Promise<string> {
  const agora = Date.now()
  if (!force && tokenCache && tokenCache.expiraEm > agora + 60_000) return tokenCache.token

  const cfg = credenciaisWVetro()
  const url = new URL(`${cfg.baseUrl}/Integracao/ValidarUsuario`)
  url.searchParams.set('Licencaid', cfg.licencaId)
  url.searchParams.set('Secusername', cfg.username)
  url.searchParams.set('Secuserpassword', cfg.password)

  const resposta = await fetch(url, { method: 'GET', cache: 'no-store' })
  const texto = await resposta.text()

  if (!resposta.ok) {
    throw new Error(`W.Vetro recusou a autenticação (${resposta.status}).`)
  }

  let payload: unknown = texto
  try {
    payload = JSON.parse(texto)
  } catch {
    // Algumas APIs legadas retornam o JWT como texto puro.
  }

  const token = extrairToken(payload)
  if (!token) throw new Error('A API W.Vetro respondeu, mas não retornou um token reconhecível.')

  // A documentação informa validade de 24h. Guardamos por 23h para renovar com folga.
  tokenCache = { token, expiraEm: agora + 23 * 60 * 60 * 1000 }
  return token
}

async function requisicaoWVetro<T>(caminho: string, query?: Record<string, string | number | undefined>): Promise<T> {
  const cfg = credenciaisWVetro()
  const url = new URL(`${cfg.baseUrl}${caminho.startsWith('/') ? caminho : `/${caminho}`}`)

  Object.entries(query || {}).forEach(([chave, valor]) => {
    if (valor !== undefined && valor !== '') url.searchParams.set(chave, String(valor))
  })

  async function executar(token: string) {
    return fetch(url, {
      method: 'GET',
      cache: 'no-store',
      headers: { token, Accept: 'application/json' },
    })
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

export async function buscarProdutoWVetro<T = unknown>(tipo: WVetroProdutoTipo, codigo: string): Promise<T> {
  return requisicaoWVetro<T>('/Produtos/produtoByKey', {
    Produtotipo: tipo,
    Produtocodigo: codigo,
  })
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
