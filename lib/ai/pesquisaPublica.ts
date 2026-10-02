export type FontePesquisaPublica = {
  titulo: string
  url: string
  trecho: string
}

export type ResultadoPesquisaPublica = {
  consulta: string
  fontes: FontePesquisaPublica[]
  provedor: 'tavily' | 'duckduckgo' | 'nenhum'
  erro?: string
}

const INTERNO_BLOQUEADO = [
  /contas?\s+a\s+receber/i,
  /contas?\s+a\s+pagar/i,
  /clientes?\s+devendo/i,
  /inadimpl[eê]n/i,
  /financeir/i,
  /folha\s+de\s+pagamento/i,
  /sal[aá]rio/i,
  /margem/i,
  /custos?\s+(?:da|do|intern)/i,
  /faturamento/i,
  /fluxo\s+de\s+caixa/i,
  /\bor[cç]amentos?\b/i,
  /\bcrm\b/i,
  /assist[eê]ncias?/i,
  /ordens?\s+de\s+produ[cç][aã]o/i,
  /\bestoque\b/i,
  /\bvendas?\b/i,
]

const RESPOSTA_SEM_DADO = [
  /n[aã]o\s+tenho\s+acesso/i,
  /n[aã]o\s+encontrei/i,
  /n[aã]o\s+est[aá]\s+dispon[ií]vel/i,
  /n[aã]o\s+foi\s+disponibilizad/i,
  /n[aã]o\s+consta/i,
  /fora\s+do\s+contexto/i,
  /consulte\s+um\s+servi[cç]o/i,
  /contexto\s+do\s+atlas/i,
]

function limparTextoHtml(valor: string) {
  return String(valor || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function urlRealDuckDuckGo(href: string) {
  let valor = limparTextoHtml(href)
  if (valor.startsWith('//')) valor = 'https:' + valor
  try {
    const u = new URL(valor)
    const destino = u.searchParams.get('uddg')
    if (destino) return decodeURIComponent(destino)
    return u.toString()
  } catch {
    return valor
  }
}

function normalizarConsulta(pergunta: string) {
  let consulta = String(pergunta || '').trim()
  const perguntaSemAcento = consulta.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

  const perguntaClima = /\b(chov[^\s?]*|chuva[^\s?]*|tempo|previsao|temperatura|clima)\b/i.test(perguntaSemAcento)
  const temLocalExplicito = /\b(em|para|de)\s+[A-Za-zÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç][^?]{2,}/i.test(consulta)
  if (perguntaClima && !temLocalExplicito) {
    consulta += ' em José Bonifácio SP Brasil'
  }

  if (/\b(perfil|perfis|linha)\b/i.test(perguntaSemAcento) && /suprema/i.test(perguntaSemAcento)) {
    consulta += ' esquadrias de alumínio'
  }

  return consulta
}

export function podePesquisarPublicamente(pergunta: string) {
  const texto = String(pergunta || '').trim()
  if (!texto) return false

  // Dados operacionais da empresa nunca podem ser reconstruídos pela internet.
  if (INTERNO_BLOQUEADO.some((r) => r.test(texto))) return false

  return true
}

export function respostaIndicaFaltaDeDado(resposta: string) {
  const texto = String(resposta || '')
  return RESPOSTA_SEM_DADO.some((r) => r.test(texto))
}

async function pesquisarTavily(consulta: string, limite: number): Promise<ResultadoPesquisaPublica | null> {
  const apiKey = String(process.env.TAVILY_API_KEY || '').trim()
  if (!apiKey) return null

  try {
    const resp = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query: consulta,
        search_depth: 'basic',
        max_results: limite,
        include_answer: false,
        include_raw_content: false,
        include_images: false,
      }),
      cache: 'no-store',
    })

    if (!resp.ok) return null
    const data = await resp.json()
    const fontes: FontePesquisaPublica[] = (Array.isArray(data?.results) ? data.results : [])
      .map((r: any) => ({
        titulo: String(r?.title || r?.url || '').trim(),
        url: String(r?.url || '').trim(),
        trecho: String(r?.content || '').replace(/\s+/g, ' ').trim().slice(0, 900),
      }))
      .filter((r: FontePesquisaPublica) => r.titulo && /^https?:\/\//i.test(r.url))
      .slice(0, limite)

    return { consulta, fontes, provedor: 'tavily' }
  } catch {
    return null
  }
}

async function pesquisarDuckDuckGo(consulta: string, limite: number): Promise<ResultadoPesquisaPublica> {
  try {
    const url = 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(consulta)
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AtlasOne/1.0; +https://atlas-one-eight-rho.vercel.app)',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.7',
      },
      cache: 'no-store',
    })

    if (!resp.ok) {
      return { consulta, fontes: [], provedor: 'nenhum', erro: 'Pesquisa pública indisponível no momento.' }
    }

    const html = await resp.text()
    const titulos: Array<{ href: string; titulo: string; indice: number }> = []
    const regexTitulo = /<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
    let m: RegExpExecArray | null
    while ((m = regexTitulo.exec(html)) && titulos.length < limite * 2) {
      titulos.push({ href: m[1], titulo: limparTextoHtml(m[2]), indice: m.index })
    }

    const fontes: FontePesquisaPublica[] = []
    for (let i = 0; i < titulos.length && fontes.length < limite; i++) {
      const atual = titulos[i]
      const fim = titulos[i + 1]?.indice || Math.min(html.length, atual.indice + 6000)
      const bloco = html.slice(atual.indice, fim)
      const snippetMatch = bloco.match(/<(?:a|div)[^>]+class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/(?:a|div)>/i)
      const fonte = {
        titulo: atual.titulo,
        url: urlRealDuckDuckGo(atual.href),
        trecho: limparTextoHtml(snippetMatch?.[1] || '').slice(0, 900),
      }
      if (fonte.titulo && /^https?:\/\//i.test(fonte.url)) fontes.push(fonte)
    }

    return { consulta, fontes, provedor: fontes.length ? 'duckduckgo' : 'nenhum' }
  } catch (e: any) {
    return {
      consulta,
      fontes: [],
      provedor: 'nenhum',
      erro: String(e?.message || 'Pesquisa pública indisponível no momento.').slice(0, 300),
    }
  }
}

export async function pesquisarPublicamente(pergunta: string, limite = 5): Promise<ResultadoPesquisaPublica> {
  const consulta = normalizarConsulta(pergunta)
  const max = Math.max(1, Math.min(Number(limite) || 5, 8))

  const tavily = await pesquisarTavily(consulta, max)
  if (tavily?.fontes?.length) return tavily

  return pesquisarDuckDuckGo(consulta, max)
}

export function formatarFontesParaPrompt(resultado: ResultadoPesquisaPublica) {
  if (!resultado.fontes.length) return ''
  return resultado.fontes
    .map((f, i) => `[${i + 1}] ${f.titulo}\nURL: ${f.url}\nTrecho: ${f.trecho || '(sem trecho)'}`)
    .join('\n\n')
}
