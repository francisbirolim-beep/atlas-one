import type { PecaFormula } from '@/lib/formulasCorteEngine'

/** Propostas técnicas não são receitas validadas e nunca ativam a produção. */
export type ComponenteCandidato = {
  codigo: string
  descricao: string
  tipo: 'perfil' | 'acessorio'
  eixo: 'L' | 'H' | ''
  comprimento_mm: number | null
  quantidade: number
  unidade?: string
  observacao?: string
}

const codigoSeguro = /^[A-Z0-9][A-Z0-9_.-]{0,39}$/
const limpar = (valor: unknown, limite = 160) => String(valor ?? '').replace(/[\x00-\x1f]/g, ' ').trim().slice(0, limite)

export function normalizarComponentes(entrada: unknown): ComponenteCandidato[] {
  if (!Array.isArray(entrada)) return []
  const resultado: ComponenteCandidato[] = []
  for (const item of entrada.slice(0, 200)) {
    if (!item || typeof item !== 'object') continue
    const codigo = limpar(item.codigo, 40).toUpperCase()
    const tipo = limpar(item.tipo || item.categoria, 30).toLowerCase().includes('acess') ? 'acessorio' : 'perfil'
    const eixoBruto = limpar(item.eixo, 10).toUpperCase()
    const eixo = eixoBruto === 'L' || eixoBruto === 'H' ? eixoBruto : ''
    const comprimento = item.comprimento_mm == null || item.comprimento_mm === '' ? null : Number(String(item.comprimento_mm).replace(',', '.'))
    const quantidade = Number(item.quantidade ?? 1)
    // Acessorios podem ter quantidade fracionaria (fita em metros, silicone em tubos).
    if (!codigoSeguro.test(codigo) || !Number.isFinite(quantidade) || quantidade <= 0 ||
      (tipo === 'perfil' ? !Number.isSafeInteger(quantidade) || quantidade > 500 : quantidade > 10000)) continue
    if (comprimento !== null && (!Number.isFinite(comprimento) || comprimento <= 0 || comprimento > 20000)) continue
    resultado.push({ codigo, descricao: limpar(item.descricao || item.nome || codigo), tipo, eixo,
      comprimento_mm: comprimento, quantidade,
      ...(tipo === 'acessorio' ? {
        unidade: limpar(item.unidade || 'UN', 8).toUpperCase(),
        observacao: limpar(item.observacao, 160),
      } : {}) })
  }
  return resultado
}

export function extrairCortesTexto(texto: string): ComponenteCandidato[] {
  const dados: unknown[] = []
  for (const linha of String(texto).split(/\r?\n/).slice(0, 1500)) {
    // A lista técnica deve ter código, eixo, corte e quantidade identificáveis.
    // Não usar números soltos do orçamento para deduzir cortes.
    const separadores = linha.includes(';') ? linha.split(';') : linha.split(/\s*\t+\s*/)
    if (separadores.length < 4) continue
    const [codigo, eixo, comprimento, quantidade] = separadores
    dados.push({ codigo: String(codigo).trim(), eixo: String(eixo).trim(), comprimento_mm: comprimento, quantidade })
  }
  return normalizarComponentes(dados)
}

export function extrairRespostaIA(texto: string): { componentes: ComponenteCandidato[]; descricao: string; tipo_croqui: string } {
  let dados: Record<string, unknown> = {}
  const bruto = String(texto || '').replace(/```(?:json)?/gi, '').trim()
  try {
    dados = JSON.parse(bruto)
  } catch {
    const inicio = bruto.indexOf('{'), fim = bruto.lastIndexOf('}')
    if (inicio >= 0 && fim > inicio) {
      try { dados = JSON.parse(bruto.slice(inicio, fim + 1)) } catch { /* manter vazio */ }
    }
  }
  const lista = dados.componentes || dados.perfis || dados.cortes || []
  return {
    componentes: normalizarComponentes(lista),
    descricao: limpar(dados.descricao || dados.observacoes, 800),
    tipo_croqui: limpar(dados.tipo_croqui, 60),
  }
}

export function formulaHipotese(c: ComponenteCandidato, largura: number, altura: number): PecaFormula {
  const eixo = c.eixo === 'H' ? 'H' : 'L'
  const base = eixo === 'H' ? 'Altura' : 'Largura'
  const referencia = eixo === 'H' ? altura : largura
  // Um único exemplo permite obter apenas um desconto observado, não provar
  // que ele se mantém para outras medidas ou quando o perfil é substituído.
  const desconto = c.comprimento_mm == null ? null : Number((referencia - c.comprimento_mm).toFixed(2))
  const calculo = desconto == null || !Number.isFinite(desconto) || Math.abs(desconto) > 5000
    ? base
    : desconto === 0 ? base : base + (desconto > 0 ? ' - ' + desconto : ' + ' + Math.abs(desconto))
  return {
    codigo: c.codigo, descricao: c.descricao || c.codigo, eixo, formula: calculo,
    formula_quantidade: String(c.quantidade),
    composicao_desconto: 'HIPÓTESE: derivada de um exemplo; verificar folgas, encaixes e variações antes da validação.',
  }
}

export function tipoCroquiSeguro(valor: unknown): 'integrada' | 'correr' | 'abrir' | 'janela' | 'outro' {
  const v = limpar(valor, 90).toLowerCase()
  if (v.includes('integr')) return 'integrada'
  if (v.includes('correr')) return 'correr'
  if (v.includes('abrir') || v.includes('pivot')) return 'abrir'
  if (v.includes('janela') || v.includes('maxim')) return 'janela'
  return 'outro'
}
