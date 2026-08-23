import { supabaseAdmin } from '@/lib/supabaseAdmin'

export type NFeItemNormalizado = {
  codigoFornecedor: string
  descricao: string
  ncm: string
  cfop: string
  unidade: string
  quantidade: number | null
  valorUnitario: number | null
  valorTotal: number | null
  produtoId?: string | null
  produtoCodigo?: string | null
  produtoNome?: string | null
  vinculoStatus?: 'vinculado' | 'pendente' | 'ambiguo'
  candidatos?: Array<{ id: string; codigo: string; nome: string }>
  dadosOrigem?: Record<string, unknown>
}

export type NFeNormalizada = {
  origem: 'xml' | 'pdf' | 'manual'
  chaveAcesso: string
  numero: string
  serie: string
  dataEmissao: string
  fornecedorId?: string | null
  fornecedorNome: string
  fornecedorCnpj: string
  valorProdutos: number | null
  valorTotal: number | null
  itens: NFeItemNormalizado[]
  avisos: string[]
  diagnostico?: string
}

function decodificarXml(valor: string) {
  return valor
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim()
}

function tag(xml: string, nome: string) {
  const rx = new RegExp(`<(?:[A-Za-z0-9_]+:)?${nome}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[A-Za-z0-9_]+:)?${nome}>`, 'i')
  const m = xml.match(rx)
  return m ? decodificarXml(m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')) : ''
}

function bloco(xml: string, nome: string) {
  const rx = new RegExp(`<(?:[A-Za-z0-9_]+:)?${nome}(?:\\s[^>]*)?>[\\s\\S]*?<\\/(?:[A-Za-z0-9_]+:)?${nome}>`, 'i')
  return xml.match(rx)?.[0] || ''
}

function blocos(xml: string, nome: string) {
  const rx = new RegExp(`<(?:[A-Za-z0-9_]+:)?${nome}(?:\\s[^>]*)?>[\\s\\S]*?<\\/(?:[A-Za-z0-9_]+:)?${nome}>`, 'gi')
  return Array.from(xml.matchAll(rx)).map(m => m[0])
}

function numero(valor: string | number | null | undefined): number | null {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null
  const txt = String(valor ?? '').trim()
  if (!txt) return null
  const normalizado = txt.includes(',') ? txt.replace(/\./g, '').replace(',', '.') : txt
  const n = Number(normalizado)
  return Number.isFinite(n) ? n : null
}

function isoData(valor: string) {
  if (!valor) return ''
  const d = new Date(valor)
  return Number.isNaN(d.getTime()) ? valor : d.toISOString()
}

function somenteDigitos(valor: string) {
  return valor.replace(/\D/g, '')
}

export function normalizarCodigo(valor: unknown) {
  return String(valor ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, '')
}

export function lerXmlNFe(xml: string): NFeNormalizada {
  const avisos: string[] = []
  const ide = bloco(xml, 'ide')
  const emit = bloco(xml, 'emit')
  const total = bloco(xml, 'ICMSTot') || bloco(xml, 'total')

  const idInf = xml.match(/<(?:[A-Za-z0-9_]+:)?infNFe\b[^>]*\bId=["']NFe(\d{44})["']/i)?.[1] || ''
  const chaveAcesso = somenteDigitos(idInf || tag(xml, 'chNFe')).slice(0, 44)

  const cnpj = somenteDigitos(tag(emit, 'CNPJ') || tag(emit, 'CPF'))
  const fornecedorNome = tag(emit, 'xNome') || tag(emit, 'xFant')
  const numeroNf = tag(ide, 'nNF')
  const serie = tag(ide, 'serie')
  const emissao = tag(ide, 'dhEmi') || tag(ide, 'dEmi')

  const itens: NFeItemNormalizado[] = blocos(xml, 'det').map(det => {
    const prod = bloco(det, 'prod') || det
    const qtd = numero(tag(prod, 'qCom'))
    const unitario = numero(tag(prod, 'vUnCom'))
    const totalItem = numero(tag(prod, 'vProd'))
    return {
      codigoFornecedor: tag(prod, 'cProd'),
      descricao: tag(prod, 'xProd') || 'Item sem descrição',
      ncm: tag(prod, 'NCM'),
      cfop: tag(prod, 'CFOP'),
      unidade: tag(prod, 'uCom'),
      quantidade: qtd,
      valorUnitario: unitario,
      valorTotal: totalItem ?? (qtd !== null && unitario !== null ? qtd * unitario : null),
      dadosOrigem: {
        cEAN: tag(prod, 'cEAN'),
        cEANTrib: tag(prod, 'cEANTrib'),
        uTrib: tag(prod, 'uTrib'),
        qTrib: numero(tag(prod, 'qTrib')),
        vUnTrib: numero(tag(prod, 'vUnTrib')),
      },
    }
  })

  if (!numeroNf) avisos.push('Número da NF não foi identificado no XML.')
  if (!fornecedorNome && !cnpj) avisos.push('Emitente/fornecedor não foi identificado no XML.')
  if (!itens.length) avisos.push('Nenhum item <det> foi encontrado no XML enviado.')

  return {
    origem: 'xml',
    chaveAcesso,
    numero: numeroNf,
    serie,
    dataEmissao: isoData(emissao),
    fornecedorNome,
    fornecedorCnpj: cnpj,
    valorProdutos: numero(tag(total, 'vProd')),
    valorTotal: numero(tag(total, 'vNF')),
    itens,
    avisos,
  }
}

function totalPertoDoRotulo(texto: string, rotulo: RegExp) {
  const m = rotulo.exec(texto)
  if (!m) return null
  const trecho = texto.slice(m.index, m.index + 220)
  const valores = Array.from(trecho.matchAll(/(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}|\d+\.\d{2})/g))
  for (const v of valores) {
    const n = numero(v[1])
    if (n !== null) return n
  }
  return null
}

export async function lerPdfDanfe(buffer: Buffer): Promise<NFeNormalizada> {
  const pdfParse = (await import('pdf-parse')).default
  const dados = await pdfParse(buffer)
  const texto = (dados.text || '').replace(/\u00a0/g, ' ')
  const compacto = texto.replace(/[ \t]+/g, ' ')
  const chave = compacto.match(/(?:CHAVE\s+DE\s+ACESSO[\s\S]{0,120})?(\d(?:[ .-]?\d){43})/i)?.[1] || ''
  const chaveAcesso = somenteDigitos(chave).slice(0, 44)
  const cnpj = compacto.match(/CNPJ\s*[:\-]?\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{14})/i)?.[1] || ''
  const numeroNf = compacto.match(/(?:N[º°o]\.?|NÚMERO)\s*[:\-]?\s*(\d{1,9})/i)?.[1] || ''
  const serie = compacto.match(/S[ÉE]RIE\s*[:\-]?\s*(\d{1,4})/i)?.[1] || ''
  const emissao = compacto.match(/(?:DATA\s+DE\s+EMISS[ÃA]O|EMISS[ÃA]O)\s*[:\-]?\s*(\d{2}\/\d{2}\/\d{4})/i)?.[1] || ''

  let dataEmissao = ''
  if (emissao) {
    const [d, m, y] = emissao.split('/')
    dataEmissao = `${y}-${m}-${d}T12:00:00.000Z`
  }

  const valorTotal = totalPertoDoRotulo(compacto, /VALOR\s+TOTAL\s+DA\s+NOTA/i)
  const valorProdutos = totalPertoDoRotulo(compacto, /VALOR\s+TOTAL\s+DOS\s+PRODUTOS/i)

  return {
    origem: 'pdf',
    chaveAcesso,
    numero: numeroNf,
    serie,
    dataEmissao,
    fornecedorNome: '',
    fornecedorCnpj: somenteDigitos(cnpj),
    valorProdutos,
    valorTotal,
    itens: [],
    avisos: [
      'PDF/DANFE lido em modo assistido. Confira os dados e inclua/corrija os itens antes de confirmar a entrada.',
      'Para leitura fiscal completa e automática dos itens, prefira o XML da NF-e quando estiver disponível.',
    ],
    diagnostico: texto.slice(0, 8000),
  }
}

type ProdutoCatalogo = {
  id: string
  codigo: string | null
  codigo_origem: string | null
  id_externo_wvetro: string | null
  nome: string
  custo: number | string | null
}

export async function buscarCatalogoProdutos(): Promise<ProdutoCatalogo[]> {
  const todos: ProdutoCatalogo[] = []
  let inicio = 0
  const pagina = 1000

  while (true) {
    const { data, error } = await supabaseAdmin
      .from('produtos')
      .select('id,codigo,codigo_origem,id_externo_wvetro,nome,custo')
      .eq('ativo', true)
      .order('nome')
      .range(inicio, inicio + pagina - 1)

    if (error) throw new Error(`Não foi possível carregar produtos: ${error.message}`)
    const lote = (data || []) as ProdutoCatalogo[]
    todos.push(...lote)
    if (lote.length < pagina) break
    inicio += pagina
  }

  return todos
}

export async function enriquecerVinculos(nf: NFeNormalizada) {
  const produtos = await buscarCatalogoProdutos()
  const indice = new Map<string, ProdutoCatalogo[]>()

  for (const produto of produtos) {
    const codigos = Array.from(new Set([
      normalizarCodigo(produto.codigo),
      normalizarCodigo(produto.codigo_origem),
      normalizarCodigo(produto.id_externo_wvetro),
    ].filter(Boolean)))
    for (const codigo of codigos) {
      const lista = indice.get(codigo) || []
      lista.push(produto)
      indice.set(codigo, lista)
    }
  }

  nf.itens = nf.itens.map(item => {
    const codigo = normalizarCodigo(item.codigoFornecedor)
    const candidatos = codigo ? (indice.get(codigo) || []) : []
    if (candidatos.length === 1) {
      const p = candidatos[0]
      return {
        ...item,
        produtoId: p.id,
        produtoCodigo: p.codigo || p.codigo_origem || p.id_externo_wvetro,
        produtoNome: p.nome,
        vinculoStatus: 'vinculado' as const,
        candidatos: [],
      }
    }
    if (candidatos.length > 1) {
      return {
        ...item,
        produtoId: null,
        produtoCodigo: null,
        produtoNome: null,
        vinculoStatus: 'ambiguo' as const,
        candidatos: candidatos.slice(0, 10).map(p => ({ id: p.id, codigo: p.codigo || p.codigo_origem || p.id_externo_wvetro || '', nome: p.nome })),
      }
    }
    return { ...item, produtoId: null, produtoCodigo: null, produtoNome: null, vinculoStatus: 'pendente' as const, candidatos: [] }
  })

  if (nf.fornecedorCnpj) {
    const cnpj = somenteDigitos(nf.fornecedorCnpj)
    const { data } = await supabaseAdmin.from('fornecedores').select('id,nome,cnpj_cpf').not('cnpj_cpf', 'is', null)
    const encontrado = (data || []).find(f => somenteDigitos(String(f.cnpj_cpf || '')) === cnpj)
    if (encontrado) {
      nf.fornecedorId = encontrado.id
      if (!nf.fornecedorNome) nf.fornecedorNome = encontrado.nome
    }
  }

  return nf
}
