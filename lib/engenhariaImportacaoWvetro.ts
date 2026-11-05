import { normalizarComponentes, type ComponenteCandidato } from './bancadaCriacaoTipologia'

export type EstadoDocumentoTecnico =
  | 'lista_corte'
  | 'orcamento_comercial'
  | 'link_wvetro'
  | 'pdf_digitalizado'
  | 'desconhecido'

export type DiagnosticoImportacao = {
  estado: EstadoDocumentoTecnico
  mensagem: string
  componentes: ComponenteCandidato[]
  linhas_candidatas: number
  contem_texto: boolean
}

const normalizar = (valor: string) => String(valor || '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toUpperCase()
const codigo = (valor: string) => {
  const limpo = String(valor || '').trim().toUpperCase()
  // Não confundir URL, número de pedido, telefone e identificadores de tela com perfis.
  if (!/^[A-Z][A-Z0-9._/-]{1,39}$/.test(limpo) || !/\d/.test(limpo)) return ''
  if (/^(HTTP|HTTPS|WWW|URL|CLIENTE|ORCAMENTO|PEDIDO|CELULAR|TELEFONE|CNPJ|CPF|DATA|ITEM|VALOR|CEP)[0-9._-]/.test(limpo)) return ''
  return limpo.replaceAll('/', '-')
}
const numero = (texto: string): number | null => {
  const n = String(texto || '').trim().replace(/\s*mm\b/gi, '').replace(/\s+/g, '')
  const normalizado = /^\d{1,3}(?:\.\d{3})+(?:,\d{1,3})?$/.test(n)
    ? n.replace(/\./g, '').replace(',', '.')
    : /^\d{1,5}(?:[,.]\d{1,3})?$/.test(n) ? n.replace(',', '.') : ''
  if (!normalizado) return null
  const valor = Number(normalizado)
  return Number.isFinite(valor) ? valor : null
}
const inteiro = (texto: string): number | null => {
  const n = String(texto || '').trim()
  if (!/^\d{1,4}$/.test(n)) return null
  return Number(n)
}
const eixo = (texto: string): 'L' | 'H' | '' => {
  const v = normalizar(texto.trim())
  if (['L', 'HORIZONTAL', 'LARGURA'].includes(v)) return 'L'
  if (['H', 'VERTICAL', 'ALTURA'].includes(v)) return 'H'
  return ''
}
const pareceEndereco = (s: string) => {
  const v = s.trim()
  return /^(?:https?:\/\/|sistema\.wvetro\.com\.br\b)/i.test(v) ||
    /<string>https?:\/\//i.test(v) ||
    /^\[InternetShortcut\]/i.test(v) ||
    /^URL=https?:\/\//im.test(v)
}
export function pareceAtalhoWeb(nome: string, conteudo: string): boolean {
  if (/\.(webloc|url|website|inetloc)$/i.test(nome)) return true
  const s = String(conteudo || '').trim()
  if (!s) return /^https?:|wvetro\./i.test(nome)
  if (pareceEndereco(s) && s.length < 2500 &&
    (!/\b(?:perfil|corte|qtde|quantidade)\b/i.test(s) || /<plist|InternetShortcut/i.test(s))) return true
  const linhas = s.split(/\r?\n/).map(x => x.trim()).filter(Boolean)
  return linhas.length <= 3 && linhas.every(l => pareceEndereco(l) || l.length < 5)
}

function segmentar(linha: string): string[] {
  const s = linha.trim()
  if (!s) return []
  if (s.includes(';')) return s.split(';').map(x=>x.trim()).filter(Boolean)
  if (s.includes('\t')) return s.split(/\t+/).map(x=>x.trim()).filter(Boolean)
  if (s.includes('|')) return s.split('|').map(x=>x.trim()).filter(Boolean)
  return s.split(/\s{2,}/).map(x=>x.trim()).filter(Boolean)
}
const coluna = (str: string, tipo: 'codigo'|'quantidade'|'comprimento'|'eixo'|'descricao'): boolean => {
  const s = normalizar(str)
  if (tipo === 'codigo') return /\b(COD(?:IGO)?|PERFIL|REFERENCIA|REF)\b/.test(s)
  if (tipo === 'quantidade') return /\b(QTD|QTDE|QUANTIDADE|PCS|PECAS|UNID)\b/.test(s)
  if (tipo === 'comprimento') return /\b(CORTE|COMPRIMENTO|MEDIDA|TAMANHO|COMP)\b/.test(s)
  if (tipo === 'eixo') return /\b(EIXO|ORIENTACAO|SENTIDO)\b/.test(s)
  return /\b(DESCRICAO|PRODUTO|NOME)\b/.test(s)
}
type Campos = { code: number; qty: number; length: number; axis: number; desc: number }
function cabecalho(partes: string[]): Campos | null {
  if (partes.length < 3) return null
  const indice = (tipo: Parameters<typeof coluna>[1]) => partes.findIndex(c => coluna(c,tipo))
  const code = indice('codigo'), qty = indice('quantidade'), length = indice('comprimento')
  if (code < 0 || qty < 0 || length < 0 || new Set([code,qty,length]).size !== 3) return null
  return { code, qty, length, axis: indice('eixo'), desc: indice('descricao') }
}
function leituraColunas(partes: string[], campos: Campos): ComponenteCandidato | null {
  if (partes.length <= Math.max(campos.code, campos.length, campos.qty)) return null
  const cod = codigo(partes[campos.code])
  const comprimento = numero(partes[campos.length])
  const qtde = inteiro(partes[campos.qty])
  if (!cod || comprimento == null || comprimento < 10 || comprimento > 20000 ||
      qtde == null || qtde < 1 || qtde > 500) return null
  return { codigo: cod, tipo:'perfil',
    descricao: campos.desc >= 0 ? partes[campos.desc] || cod : cod,
    eixo: campos.axis >= 0 ? eixo(partes[campos.axis]) : '',
    comprimento_mm: comprimento, quantidade: qtde }
}
function leituraPosicional(partes: string[]): ComponenteCandidato | null {
  if (partes.length < 3 || partes.length > 9) return null
  const cod = codigo(partes[0])
  if (!cod) return null
  let ex = eixo(partes[1])
  // Formato técnico padrão: CÓDIGO;EIXO;COMPRIMENTO;QUANTIDADE
  if (ex && partes.length >= 4) {
    const comprimento = numero(partes[2]), qtde = inteiro(partes[3])
    if (comprimento != null && comprimento >= 10 && comprimento <= 20000 &&
        qtde != null && qtde >= 1 && qtde <= 500) {
      return { codigo:cod, tipo:'perfil', descricao:cod, eixo:ex,
        comprimento_mm:comprimento, quantidade:qtde }
    }
  }
  // Formato código;descrição;[eixo];comprimento;quantidade, onde o eixo é explícito.
  if (partes.length >= 5) {
    ex = eixo(partes[2])
    if (ex) {
      const comprimento = numero(partes[3]), qtde=inteiro(partes[4])
      if (comprimento != null && comprimento >= 10 && comprimento <= 20000 &&
          qtde != null && qtde>=1 && qtde<=500) {
        return { codigo:cod,tipo:'perfil',descricao:partes[1],eixo:ex,
          comprimento_mm:comprimento,quantidade:qtde }
      }
    }
  }
  // Nunca inventar quantidade 1 ou cadastrar uma linha sem medida verificada.
  // Quatro textos separados por tabulação podem ser URL, cliente ou cabeçalho comercial.
  // Aceitamos linha posicional somente com eixo, corte e quantidade explícitos.
  return null
}
export function extrairComponentesRelatorio(texto: string): ComponenteCandidato[] {
  const linhas = String(texto || '').split(/\r?\n/).slice(0,2000)
  const detectados: ComponenteCandidato[] = []
  let cols: Campos | null = null
  for (const linha of linhas) {
    const partes=segmentar(linha)
    if (partes.length < 3) continue
    const possivel=cabecalho(partes)
    if (possivel) {cols=possivel;continue}
    // Quando existe cabeçalho, respeitar a ordem das colunas. Não usar o parser
    // posicional como fallback: uma linha inválida do orçamento não é um perfil.
    const componente=cols ? leituraColunas(partes,cols) : leituraPosicional(partes)
    if (componente) detectados.push(componente)
  }
  // Não apagar cortes distintos do mesmo código; apenas linhas idênticas do relatório.
  const unicos=new Map<string,ComponenteCandidato>()
  for (const item of normalizarComponentes(detectados)) {
    const chave=[item.codigo,item.eixo,item.comprimento_mm,item.quantidade,item.descricao].join('|')
    if (!unicos.has(chave)) unicos.set(chave,item)
  }
  return Array.from(unicos.values()).slice(0,200)
}
export function diagnosticarRelatorio(texto: string, nome = ''): DiagnosticoImportacao {
  const bruto=String(texto || '')
  if (pareceAtalhoWeb(nome,bruto)) return {
    estado:'link_wvetro', componentes:[], linhas_candidatas:0, contem_texto:!!bruto.trim(),
    mensagem:'Este arquivo contém um link/atalho do W.Vetro, não a lista de corte. Abra o relatório no W.Vetro e use Exportar/Imprimir → Salvar como PDF, ou envie uma captura da lista. Você pode salvar o projeto em desenvolvimento agora.',
  }
  if (bruto.trim().length < 30) return {
    estado:'pdf_digitalizado',componentes:[],linhas_candidatas:0,contem_texto:!!bruto.trim(),
    mensagem:'O PDF não possui texto técnico legível. Envie o PDF original do W.Vetro ou fotos nítidas da lista de perfis e cortes. O projeto pode ser salvo em desenvolvimento.',
  }
  const componentes=extrairComponentesRelatorio(bruto)
  const qtdMedidas=componentes.filter(c=>c.comprimento_mm != null).length
  const eixosConferidos=componentes.filter(c=>c.eixo && c.comprimento_mm != null).length
  if (qtdMedidas) return {
    estado:'lista_corte',componentes,linhas_candidatas:componentes.length,contem_texto:true,
    mensagem:`Foram sugeridas ${componentes.length} linhas (${qtdMedidas} com corte, ${eixosConferidos} com eixo). Confira códigos, orientação e quantidades antes de validar.`,
  }
  const comercial=/\b(OR[ÇC]AMENTO|CLIENTE|VALOR TOTAL|PREÇO|VETRO)\b/i.test(bruto)
  return {
    estado:comercial?'orcamento_comercial':'desconhecido',
    componentes,linhas_candidatas:componentes.length,contem_texto:true,
    mensagem:comercial
      ? 'O arquivo contém dados do orçamento, mas não uma lista técnica de cortes identificável. Anexe também a Lista de Corte/Perfis do W.Vetro. Você pode salvar o projeto em desenvolvimento.'
      : 'O arquivo foi lido, mas não contém cortes verificáveis no formato reconhecido. Confira o texto original, anexe outra referência ou acrescente componentes manualmente.',
  }
}
