function norm(v: string) {
  return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function palavras(v: string) {
  return norm(v).split(/[^a-z0-9]+/).filter(x => x.length >= 3)
}

function rotulo(path: string) {
  return path.replace(/\./g, ' › ').replace(/_/g, ' ')
}

function itemCurto(item: any) {
  if (item == null) return ''
  if (typeof item !== 'object') return String(item)
  const campos = ['codigo','nome','titulo','cliente_nome','fornecedor_nome','descricao','status','cidade','valor_estimado','valor','quantidade','qtd']
  const partes = campos
    .filter(k => item[k] !== undefined && item[k] !== null && String(item[k]).trim() !== '')
    .slice(0, 5)
    .map(k => String(item[k]))
  return partes.join(' — ')
}

export function respostaFallbackContexto(params: {
  pergunta: string
  area: string
  contexto: any
  anexoTexto?: string
}) {
  const termos = new Set(palavras(params.pergunta))
  const fatos: string[] = []
  const listas: Array<{ path: string; itens: any[]; score: number }> = []
  const vistos = new Set<any>()

  function andar(valor: any, path = '', depth = 0) {
    if (depth > 5 || valor == null) return
    if (typeof valor === 'object') {
      if (vistos.has(valor)) return
      vistos.add(valor)
    }

    if (Array.isArray(valor)) {
      const p = norm(path)
      const score = Array.from(termos).reduce((s, t) => s + (p.includes(t) ? 2 : 0), 0)
      listas.push({ path, itens: valor, score })
      fatos.push(rotulo(path || 'lista') + ': ' + valor.length + ' registro(s) carregado(s)')
      return
    }

    if (typeof valor !== 'object') return

    for (const [k, v] of Object.entries(valor)) {
      const proximo = path ? path + '.' + k : k
      if (v == null) continue
      if (typeof v === 'number' && /resumo|total|quant|qtd|saldo|valor|contagem|count/i.test(k)) {
        fatos.push(rotulo(proximo) + ': ' + v)
      } else if (typeof v === 'string' && /erro|mensagem/i.test(k) && v.trim()) {
        fatos.push(rotulo(proximo) + ': ' + v.slice(0, 240))
      } else {
        andar(v, proximo, depth + 1)
      }
      if (fatos.length >= 24) break
    }
  }

  andar(params.contexto)

  listas.sort((a, b) => b.score - a.score)
  const relevante = listas.find(x => x.itens.length && x.score > 0) || listas.find(x => x.itens.length)
  const amostra = relevante
    ? relevante.itens.slice(0, 8).map(itemCurto).filter(Boolean)
    : []

  const anexo = String(params.anexoTexto || '').trim()
  const blocos = [
    'Estou operando em modo interno do Atlas e consultei os dados disponíveis para ' + params.area + '.',
  ]

  if (fatos.length) blocos.push('\nDados objetivos encontrados:\n' + fatos.slice(0, 16).map(v => '- ' + v).join('\n'))
  if (amostra.length) blocos.push('\nRegistros relacionados:\n' + amostra.map(v => '- ' + v).join('\n'))
  if (anexo) blocos.push('\nConteúdo extraído do anexo:\n' + anexo.slice(0, 1800))

  if (!fatos.length && !amostra.length && !anexo) {
    blocos.push('\nNão encontrei um dado objetivo no contexto carregado para responder sem inferir.')
  }

  return blocos.join('\n')
}
