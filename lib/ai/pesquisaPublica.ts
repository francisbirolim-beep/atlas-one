export type FontePesquisaPublica = {
  titulo: string
  url: string
  trecho: string
}

export type ResultadoPesquisaPublica = {
  consulta: string
  fontes: FontePesquisaPublica[]
  provedor: 'open-meteo' | 'duckduckgo' | 'nenhum'
  erro?: string
}

const INTERNO_BLOQUEADO = [
  /contas?\s+a\s+receber/i,
  /contas?\s+a\s+pagar/i,
  /clientes?\s+devendo/i,
  /inadimpl[eê]n/i,
  /financeir/i,
  /folha\s+de\s+pagamento/i,
  /sal[aá]rio\s+(?:do|da|de|dos|das|meu|minha|nosso|nossa)/i,
  /margem\s+(?:da|do|de|nossa|empresa)/i,
  /custos?\s+(?:da|do|intern|nosso|empresa)/i,
  /faturamento\s+(?:da|do|de|nosso|empresa)/i,
  /fluxo\s+de\s+caixa/i,
  /quanto\s+(?:a\s+)?esquadrif[aá]cio\s+(?:vende|vendeu|deve|fatura|tem)/i,
  /quanto\s+(?:a\s+)?empresa\s+(?:vende|vendeu|deve|fatura|tem)/i,
  /\bmeus?\s+or[cç]amentos?\b/i,
  /\bor[cç]amentos?\s+(?:da|do|de|meus?|nossos?|hoje)/i,
  /\bcrm\s+(?:da|do|de|nosso|empresa)/i,
  /assist[eê]ncias?\s+(?:da|do|de|nossas?|empresa)/i,
  /ordens?\s+de\s+produ[cç][aã]o\s+(?:da|do|de|nossas?|empresa)/i,
  /\bestoque\s+(?:da|do|de|nosso|empresa)/i,
  /\bvendas?\s+(?:da|do|de|nossas?|empresa|hoje|m[eê]s)/i,
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

function semAcento(valor: string) {
  return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function limparTextoHtml(valor: string) {
  return String(valor || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
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

function perguntaEhClima(pergunta: string) {
  const t = semAcento(pergunta).toLowerCase()
  return /\b(chov\w*|chuva\w*|tempo|previsao\s+do\s+tempo|temperatura|clima|garoa|tempestade)\b/.test(t)
}

function extrairLocalClima(pergunta: string) {
  const texto = String(pergunta || '').trim()
  const sem = semAcento(texto)

  const candidatos = [
    /\b(?:em|para)\s+([^?.,]+?)(?:\s+(?:hoje|amanha|agora|esta\s+semana|no\s+fim\s+de\s+semana)|[?.,]|$)/i,
    /\btempo\s+(?:de|em)\s+([^?.,]+?)(?:\s+(?:hoje|amanha|agora)|[?.,]|$)/i,
  ]

  for (const regex of candidatos) {
    const m = sem.match(regex)
    if (m?.[1]?.trim()) return m[1].trim()
  }

  // Base operacional da Esquadrifácio quando o usuário não informa outra cidade.
  return 'José Bonifácio, São Paulo, Brasil'
}

function normalizarConsulta(pergunta: string) {
  let consulta = String(pergunta || '').trim()
  const perguntaSemAcento = semAcento(consulta).toLowerCase()

  if (/\b(perfil|perfis|linha)\b/i.test(perguntaSemAcento) && /suprema/i.test(perguntaSemAcento)) {
    consulta += ' esquadrias de alumínio'
  }

  return consulta
}

async function pesquisarClimaOpenMeteo(pergunta: string): Promise<ResultadoPesquisaPublica> {
  const local = extrairLocalClima(pergunta)
  try {
    const geoUrl = 'https://geocoding-api.open-meteo.com/v1/search?name=' +
      encodeURIComponent(local) + '&count=5&language=pt&format=json'
    const geoResp = await fetch(geoUrl, { cache: 'no-store' })
    if (!geoResp.ok) {
      return { consulta: pergunta, fontes: [], provedor: 'nenhum', erro: 'Não consegui localizar a cidade para a previsão.' }
    }

    const geo = await geoResp.json()
    const locais = Array.isArray(geo?.results) ? geo.results : []
    const lugar = locais[0]
    if (!lugar?.latitude || !lugar?.longitude) {
      return { consulta: pergunta, fontes: [], provedor: 'nenhum', erro: 'Cidade não encontrada para a previsão.' }
    }

    const forecastUrl = 'https://api.open-meteo.com/v1/forecast?' + new URLSearchParams({
      latitude: String(lugar.latitude),
      longitude: String(lugar.longitude),
      current: 'temperature_2m,apparent_temperature,precipitation,rain,weather_code,cloud_cover,wind_speed_10m',
      hourly: 'precipitation_probability,precipitation,rain,weather_code',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,rain_sum,precipitation_probability_max',
      timezone: 'auto',
      forecast_days: '2',
    }).toString()

    const forecastResp = await fetch(forecastUrl, { cache: 'no-store' })
    if (!forecastResp.ok) {
      return { consulta: pergunta, fontes: [], provedor: 'nenhum', erro: 'Previsão meteorológica indisponível no momento.' }
    }

    const f = await forecastResp.json()
    const nomeLocal = [lugar.name, lugar.admin1, lugar.country].filter(Boolean).join(', ')
    const atual = f?.current || {}
    const diario = f?.daily || {}
    const horaAtual = String(atual.time || '')
    const horas: string[] = Array.isArray(f?.hourly?.time) ? f.hourly.time : []
    const probs: number[] = Array.isArray(f?.hourly?.precipitation_probability) ? f.hourly.precipitation_probability : []
    const idxAtual = Math.max(0, horas.findIndex((h) => h >= horaAtual))
    const proximas = probs.slice(idxAtual, idxAtual + 12).filter((x) => Number.isFinite(Number(x))).map(Number)
    const maxProx12h = proximas.length ? Math.max(...proximas) : null

    const trecho = [
      'Local: ' + nomeLocal + '.',
      atual.temperature_2m != null ? 'Temperatura atual: ' + atual.temperature_2m + ' °C.' : '',
      atual.apparent_temperature != null ? 'Sensação: ' + atual.apparent_temperature + ' °C.' : '',
      atual.rain != null ? 'Chuva agora: ' + atual.rain + ' mm.' : '',
      maxProx12h != null ? 'Maior probabilidade de precipitação nas próximas 12h: ' + maxProx12h + '%.' : '',
      diario.precipitation_probability_max?.[0] != null ? 'Probabilidade máxima de precipitação hoje: ' + diario.precipitation_probability_max[0] + '%.' : '',
      diario.rain_sum?.[0] != null ? 'Chuva prevista acumulada hoje: ' + diario.rain_sum[0] + ' mm.' : '',
      diario.temperature_2m_min?.[0] != null && diario.temperature_2m_max?.[0] != null
        ? 'Mínima/máxima de hoje: ' + diario.temperature_2m_min[0] + ' °C / ' + diario.temperature_2m_max[0] + ' °C.'
        : '',
      'Horário da observação: ' + (horaAtual || 'não informado') + '.',
    ].filter(Boolean).join(' ')

    return {
      consulta: pergunta,
      provedor: 'open-meteo',
      fontes: [{
        titulo: 'Open-Meteo — previsão para ' + nomeLocal,
        url: 'https://open-meteo.com/',
        trecho,
      }],
    }
  } catch (e: any) {
    return {
      consulta: pergunta,
      fontes: [],
      provedor: 'nenhum',
      erro: String(e?.message || 'Previsão meteorológica indisponível no momento.').slice(0, 300),
    }
  }
}

async function pesquisarDuckDuckGo(consulta: string, limite: number): Promise<ResultadoPesquisaPublica> {
  try {
    const url = 'https://lite.duckduckgo.com/lite/?q=' + encodeURIComponent(consulta)
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
    const encontrados: Array<{ href: string; titulo: string; indice: number }> = []
    const regexAnchor = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi
    let m: RegExpExecArray | null

    while ((m = regexAnchor.exec(html)) && encontrados.length < limite * 3) {
      const attrs = m[1] || ''
      if (!/class\s*=\s*["'][^"']*result-link[^"']*["']/i.test(attrs)) continue
      const hrefMatch = attrs.match(/href\s*=\s*["']([^"']+)["']/i)
      if (!hrefMatch?.[1]) continue
      encontrados.push({
        href: hrefMatch[1],
        titulo: limparTextoHtml(m[2]),
        indice: m.index,
      })
    }

    const fontes: FontePesquisaPublica[] = []
    const vistos = new Set<string>()

    for (let i = 0; i < encontrados.length && fontes.length < limite; i++) {
      const atual = encontrados[i]
      const fim = encontrados[i + 1]?.indice || Math.min(html.length, atual.indice + 8000)
      const bloco = html.slice(atual.indice, fim)
      const snippetMatch = bloco.match(/<td[^>]+class\s*=\s*["'][^"']*result-snippet[^"']*["'][^>]*>([\s\S]*?)<\/td>/i)
      const fonte = {
        titulo: atual.titulo,
        url: urlRealDuckDuckGo(atual.href),
        trecho: limparTextoHtml(snippetMatch?.[1] || '').slice(0, 900),
      }
      if (!fonte.titulo || !/^https?:\/\//i.test(fonte.url) || vistos.has(fonte.url)) continue
      vistos.add(fonte.url)
      fontes.push(fonte)
    }

    return {
      consulta,
      fontes,
      provedor: fontes.length ? 'duckduckgo' : 'nenhum',
      ...(fontes.length ? {} : { erro: 'Nenhum resultado público encontrado.' }),
    }
  } catch (e: any) {
    return {
      consulta,
      fontes: [],
      provedor: 'nenhum',
      erro: String(e?.message || 'Pesquisa pública indisponível no momento.').slice(0, 300),
    }
  }
}

export function podePesquisarPublicamente(pergunta: string) {
  const texto = String(pergunta || '').trim()
  if (!texto) return false

  // Nunca usar a internet para reconstruir dado interno ou contornar uma permissão.
  if (INTERNO_BLOQUEADO.some((r) => r.test(texto))) return false

  return true
}

export function respostaIndicaFaltaDeDado(resposta: string) {
  const texto = String(resposta || '')
  return RESPOSTA_SEM_DADO.some((r) => r.test(texto))
}

export async function pesquisarPublicamente(pergunta: string, limite = 5): Promise<ResultadoPesquisaPublica> {
  if (!podePesquisarPublicamente(pergunta)) {
    return {
      consulta: String(pergunta || '').trim(),
      fontes: [],
      provedor: 'nenhum',
      erro: 'Consulta pública bloqueada para preservar permissões de dados internos do Atlas.',
    }
  }

  if (perguntaEhClima(pergunta)) {
    return pesquisarClimaOpenMeteo(pergunta)
  }

  const consulta = normalizarConsulta(pergunta)
  const max = Math.max(1, Math.min(Number(limite) || 5, 8))
  return pesquisarDuckDuckGo(consulta, max)
}

export function formatarFontesParaPrompt(resultado: ResultadoPesquisaPublica) {
  if (!resultado.fontes.length) return ''
  return resultado.fontes
    .map((f, i) => '[' + (i + 1) + '] ' + f.titulo + '\nURL: ' + f.url + '\nTrecho: ' + (f.trecho || '(sem trecho)'))
    .join('\n\n')
}