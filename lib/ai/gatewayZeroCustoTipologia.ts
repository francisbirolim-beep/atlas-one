/**
 * IA de custo zero para projetos de tipologia.
 *
 * Não faz chamadas a modelos pagos. Consulta sempre o catálogo público de preços
 * antes de solicitar qualquer inferência. Em caso de dúvida, falha sem cobrar.
 * Os documentos são enviados apenas após consentimento explícito no frontend.
 */
export type ErroGatewayZeroCustoCodigo =
  | 'sem_modelo_gratuito'
  | 'autenticacao_indisponivel'
  | 'acesso_negado'
  | 'limite_gratuito'
  | 'provedor_indisponivel'
  | 'resposta_invalida'

export class ErroGatewayZeroCusto extends Error {
  constructor(public readonly codigo: ErroGatewayZeroCustoCodigo, mensagem: string) {
    super(mensagem)
    this.name = 'ErroGatewayZeroCusto'
  }
}

type ModeloCatalogo = {
  id?: string
  pricing?: { input?: string | number; output?: string | number; varies_by_provider?: boolean }
  modalities?: { input?: string[]; output?: string[] }
}
type Entrada = { system: string; prompt: string; imagem?: { mime: string; base64: string } }
export type RespostaGatewayZeroCusto = { resposta: string; modelo: string; origem: 'vercel-ai-gateway-gratuito' }

const ENDPOINT = 'https://ai-gateway.vercel.sh/v1'
const TEXTOS_PRIORITARIOS = ['nvidia/nemotron-3.5-lightning-free', 'reflection/beam-free']
const TEMPO_CACHE_MS = 5 * 60 * 1000

let catalogoMemoria: { data: ModeloCatalogo[]; expiresAt: number } | null = null

export function ehModeloGratuito(modelo: ModeloCatalogo, modalidade: 'text' | 'image'): boolean {
  const preco = modelo.pricing
  const nome = String(modelo.id || '')
  return Boolean(
    nome && nome.endsWith('-free') &&
    preco && preco.varies_by_provider !== true &&
    preco.input != null && preco.output != null &&
    Number(preco.input) === 0 && Number(preco.output) === 0 &&
    Array.isArray(modelo.modalities?.input) &&
    modelo.modalities?.input?.includes(modalidade) &&
    modelo.modalities?.output?.includes('text')
  )
}

export function escolherModelosGratuitos(
  catalogo: ModeloCatalogo[], modalidade: 'text' | 'image',
): string[] {
  const encontrados = catalogo.filter(m => ehModeloGratuito(m, modalidade)).map(m => m.id!)
  const preferidos = modalidade === 'text' ? TEXTOS_PRIORITARIOS : []
  return [...preferidos.filter(m => encontrados.includes(m)), ...encontrados.filter(m => !preferidos.includes(m))].slice(0, 3)
}

async function carregarModelosGratuitos(): Promise<ModeloCatalogo[]> {
  if (catalogoMemoria && catalogoMemoria.expiresAt > Date.now()) return catalogoMemoria.data
  const c = new AbortController()
  const timer = setTimeout(() => c.abort(), 8500)
  try {
    const r = await fetch(ENDPOINT + '/models', { signal: c.signal, cache: 'no-store' })
    if (!r.ok) throw Error('catalogo-http-' + r.status)
    const json = await r.json()
    if (!Array.isArray(json?.data) || !json.data.length)
      throw Error('catalogo-invalido')
    catalogoMemoria = { data: json.data as ModeloCatalogo[], expiresAt: Date.now() + TEMPO_CACHE_MS }
    return catalogoMemoria.data
  } catch {
    throw new ErroGatewayZeroCusto('provedor_indisponivel',
      'Não foi possível conferir os preços dos modelos gratuitos. Nenhuma chamada de IA foi realizada.')
  } finally {
    clearTimeout(timer)
  }
}

function tokenGateway(): string {
  // Token OIDC é injetado automaticamente nas funções Vercel. Nunca é enviado
  // ao navegador, retornado na API ou registrado nos logs.
  return String(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || '').trim()
}

function respostaTexto(data: any): string {
  const conteudo = data?.choices?.[0]?.message?.content
  if (typeof conteudo === 'string') return conteudo.trim()
  if (Array.isArray(conteudo)) return conteudo
    .map((x: any) => typeof x?.text === 'string' ? x.text : '')
    .filter(Boolean).join('\n').trim()
  return ''
}

function statusDeErro(status: number): ErroGatewayZeroCusto {
  if (status === 401 || status === 403) {
    return new ErroGatewayZeroCusto('acesso_negado',
      'O serviço de IA gratuito não autorizou a conexão do Atlas (HTTP ' + status + '). A leitura local permanece disponível.')
  }
  if (status === 402 || status === 429) {
    return new ErroGatewayZeroCusto('limite_gratuito',
      'O limite gratuito do provedor foi atingido. Não foi utilizado nenhum modelo pago.')
  }
  return new ErroGatewayZeroCusto('provedor_indisponivel',
    'O serviço de IA gratuito não respondeu corretamente (HTTP ' + status + ').')
}

export async function analisarComGatewayZeroCusto(entrada: Entrada): Promise<RespostaGatewayZeroCusto> {
  const modalidade: 'text' | 'image' = entrada.imagem ? 'image' : 'text'
  const modelos = escolherModelosGratuitos(await carregarModelosGratuitos(), modalidade)
  if (!modelos.length) throw new ErroGatewayZeroCusto('sem_modelo_gratuito',
    modalidade === 'image'
      ? 'Não há um modelo gratuito de leitura de imagens disponível no momento. Envie um PDF com texto ou informe os perfis manualmente.'
      : 'Não há modelos gratuitos de texto disponíveis no catálogo atual. A leitura local continua disponível.')
  const token = tokenGateway()
  if (!token) throw new ErroGatewayZeroCusto('autenticacao_indisponivel',
    'A autenticação do serviço gratuito de IA não está disponível no servidor do Atlas.')

  const conteudo = entrada.imagem
    ? [{ type: 'text', text: entrada.prompt }, {
      type: 'image_url',
      image_url: { url: 'data:' + entrada.imagem.mime + ';base64,' + entrada.imagem.base64 },
    }]
    : entrada.prompt
  let ultimoErro: ErroGatewayZeroCusto | null = null
  for (const modelo of modelos) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 20000)
    try {
      const resposta = await fetch(ENDPOINT + '/chat/completions', {
        method: 'POST',
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({
          model: modelo,
          messages: [
            { role: 'system', content: entrada.system.slice(0, 7000) },
            { role: 'user', content: conteudo },
          ],
          max_tokens: 1800,
          stream: false,
        }),
      })
      if (!resposta.ok) {
        ultimoErro = statusDeErro(resposta.status)
        // Rate limit pode afetar somente um modelo gratuito: tentar outro também gratuito.
        // HTTP 402 e autenticação negada são limites da conta, por isso param a busca.
        if (ultimoErro.codigo === 'acesso_negado' || resposta.status === 402) break
        continue
      }
      const json = await resposta.json().catch(() => ({}))
      const respostaFinal = respostaTexto(json)
      if (!respostaFinal) {
        ultimoErro = new ErroGatewayZeroCusto('resposta_invalida',
          'O modelo gratuito não retornou uma análise legível. O arquivo pode ser conferido manualmente.')
        continue
      }
      return { resposta: respostaFinal, modelo, origem: 'vercel-ai-gateway-gratuito' }
    } catch (erro) {
      ultimoErro = erro instanceof ErroGatewayZeroCusto ? erro :
        new ErroGatewayZeroCusto('provedor_indisponivel',
          'Não foi possível conectar ao serviço gratuito de IA. A leitura local continua funcionando.')
    } finally {
      clearTimeout(timer)
    }
  }
  throw ultimoErro || new ErroGatewayZeroCusto('provedor_indisponivel',
    'Nenhum modelo gratuito respondeu. A leitura local continua disponível.')
}

export function limparDadosPessoaisRelatorio(texto: string): string {
  return String(texto || '')
    .replace(/[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/g, '[email omitido]')
    .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, '[CPF omitido]')
    .replace(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g, '[CNPJ omitido]')
    .replace(/\b(?:\+?55\s*)?\(?\d{2}\)?\s*9?\d{4}[- ]?\d{4}\b/g, '[telefone omitido]')
}
