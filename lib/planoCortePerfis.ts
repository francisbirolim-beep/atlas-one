import { supabase } from './supabase'
import type { ResultadoPeca } from './formulasCorteEngine'

export type PerfilCatalogoPlano = {
  codigo: string
  nome: string
  foto_url: string | null
  peso_kg_m: number | null
}

export type LinhaPlanoCorte = {
  codigo: string
  descricao: string
  tamanho: number
  eixo: 'L' | 'H' | null
  quantidade: number | null
  peso_kg: number | null
  imagem_url: string | null
}

const TIPOLOGIA_PC3_SUPREMA = 'dce9da1d-7e03-4c1c-ad1b-2f101b51a52e'

// Figuras recortadas diretamente de fontes técnicas identificadas por código.
// SU289 e SU290 foram extraídos do orientativo W.Vetro nº 994 da própria
// configuração PC3 validada. Códigos sem uma figura identificada na fonte
// ficam sem imagem em vez de receber inferência por semelhança.
const IMAGENS_TECNICAS_VALIDADAS: Record<string, string> = {
  SU010: '/perfis/plano-corte/SU010.png',
  SU012: '/perfis/plano-corte/SU012.png',
  SU008: '/perfis/plano-corte/SU008.png',
  SU280: '/perfis/plano-corte/SU280.png',
  SU243: '/perfis/plano-corte/SU243.png',
  SU242: '/perfis/plano-corte/SU242.png',
  SU289: '/perfis/plano-corte/SU289.png',
  SU290: '/perfis/plano-corte/SU290.png',
  SU053: '/perfis/plano-corte/SU053.png',
  SU225: '/perfis/plano-corte/SU225.png',
  SU102: '/perfis/plano-corte/SU102.png',
}

const QUANTIDADES_PC3: Record<string, number> = {
  SU010: 1,
  TMC: 3,
  SU012: 2,
  SU008: 2,
  SU280: 2,
  SU040: 2,
  SU041: 2,
  SU047: 2,
  SU049: 2,
  SU242: 2,
  SU243: 2,
  SU289: 2,
  SU290: 2,
  SU053: 3,
  SU225: 3,
}

const EIXOS_PC3: Record<string, 'L' | 'H'> = {
  SU010: 'L', TMC: 'L', SU012: 'H', SU008: 'H', SU280: 'H',
  SU040: 'H', SU041: 'H', SU047: 'H', SU049: 'H', SU242: 'H',
  SU243: 'H', SU289: 'H', SU290: 'H', SU053: 'L', SU225: 'L',
}

const ORDEM_PC3: Record<string, number> = {
  SU010: 10,
  TMC: 20,
  SU012: 30,
  SU008: 40,
  SU053: 50,
  SU225: 60,
  SU280: 70,
  SU040: 80,
  SU047: 80,
  SU243: 80,
  SU289: 80,
  SU041: 90,
  SU049: 90,
  SU242: 90,
  SU290: 90,
}

function codigoBase(codigo: string) {
  return codigo.replace(/\([^)]*\)$/g, '').trim().toUpperCase()
}

function descricaoCatalogo(perfil: PerfilCatalogoPlano | undefined, fallback: string) {
  if (!perfil?.nome) return fallback
  return perfil.nome.replace(new RegExp(`^${perfil.codigo}\\s*-\\s*`, 'i'), '').trim() || fallback
}

function montarLinha(
  codigo: string,
  descricao: string,
  tamanho: number,
  eixo: 'L' | 'H' | null,
  quantidade: number | null,
  catalogo: Map<string, PerfilCatalogoPlano>
): LinhaPlanoCorte {
  const base = codigoBase(codigo)
  const perfil = catalogo.get(base)
  const pesoMetro = perfil?.peso_kg_m ?? null
  const peso = quantidade && pesoMetro != null ? (tamanho / 1000) * quantidade * pesoMetro : null
  return {
    codigo: base,
    descricao: descricaoCatalogo(perfil, descricao),
    tamanho,
    eixo,
    quantidade,
    peso_kg: peso,
    imagem_url: perfil?.foto_url || IMAGENS_TECNICAS_VALIDADAS[base] || null,
  }
}

export async function listarPerfisPlanoCorte(codigos: string[]): Promise<PerfilCatalogoPlano[]> {
  const unicos = Array.from(new Set(codigos.map(codigoBase).filter(Boolean)))
  if (unicos.length === 0) return []
  const { data, error } = await supabase
    .from('produtos')
    .select('codigo,nome,foto_url,peso_kg_m')
    .in('codigo', unicos)
    .eq('categoria', 'perfil')
  if (error) {
    console.error('Erro ao carregar perfis do plano de corte:', error)
    return []
  }
  return ((data as Array<{ codigo?: string | null; nome?: string | null; foto_url?: string | null; peso_kg_m?: number | string | null }>) || [])
    .filter(item => item.codigo && item.nome)
    .map(item => ({
      codigo: String(item.codigo).toUpperCase(),
      nome: String(item.nome),
      foto_url: item.foto_url || null,
      peso_kg_m: item.peso_kg_m == null ? null : Number(item.peso_kg_m),
    }))
}

export function codigosNecessariosPlanoCorte(resultados: ResultadoPeca[]) {
  const codigos = resultados.flatMap(item => {
    if (item.codigo === 'travessas') return ['SU053', 'SU225', 'SU102']
    if (item.codigo === 'SU102(H)') return ['SU102']
    return [codigoBase(item.codigo)]
  })
  return Array.from(new Set(codigos))
}

export function montarLinhasPlanoCorte(params: {
  tipologiaId: string
  resultados: ResultadoPeca[]
  perfis: PerfilCatalogoPlano[]
}): LinhaPlanoCorte[] {
  const catalogo = new Map(params.perfis.map(perfil => [perfil.codigo.toUpperCase(), perfil]))

  // Receitas novas já carregam quantidade e eixo na própria definição. Assim o
  // plano deixa de depender de hardcode por tipologia e pode ser editado na Engenharia.
  const declarativa = params.resultados.some(item => item.quantidade != null)
  if (params.tipologiaId !== TIPOLOGIA_PC3_SUPREMA || declarativa) {
    return params.resultados.map(item => montarLinha(
      item.codigo,
      item.descricao || '—',
      item.tamanho,
      item.eixo || null,
      item.quantidade ?? null,
      catalogo
    ))
  }

  // Compatibilidade com a definição PC3 legada, anterior às quantidades declarativas.
  const linhas: LinhaPlanoCorte[] = []
  for (const item of params.resultados) {
    if (item.codigo === 'travessas') {
      linhas.push(montarLinha('SU053', 'Travessa da folha', item.tamanho, 'L', 3, catalogo))
      linhas.push(montarLinha('SU225', 'Travessa inferior da folha', item.tamanho, 'L', 3, catalogo))
      linhas.push(montarLinha('SU102', 'Baguete', item.tamanho, 'L', 6, catalogo))
      continue
    }
    if (item.codigo === 'SU102(H)') {
      linhas.push(montarLinha('SU102', 'Baguete', item.tamanho, 'H', 6, catalogo))
      continue
    }
    const codigo = codigoBase(item.codigo)
    linhas.push(montarLinha(codigo, item.descricao || '—', item.tamanho, item.eixo || EIXOS_PC3[codigo] || null, QUANTIDADES_PC3[codigo] ?? null, catalogo))
  }

  return linhas.sort((a, b) => {
    const ordemA = a.codigo === 'SU102' ? (a.eixo === 'L' ? 100 : 110) : (ORDEM_PC3[a.codigo] ?? 999)
    const ordemB = b.codigo === 'SU102' ? (b.eixo === 'L' ? 100 : 110) : (ORDEM_PC3[b.codigo] ?? 999)
    return ordemA - ordemB
  })
}
