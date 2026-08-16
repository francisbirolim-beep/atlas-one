import { supabase } from './supabase'
import type { Usuario } from './tipos'
import type { ComponenteReceita } from './engenhariaReceitas'

export type EngenhariaVariavel = {
  id: string
  chave: string
  label: string
  ordem: number
  created_at: string
}

export type EngenhariaVariavelOpcao = {
  id: string
  variavel_id: string
  chave: string
  label: string
  ordem: number
  created_at: string
}

export type TipologiaVariavel = {
  id: string
  tipologia_id: string
  variavel_id: string
  ordem: number
  obrigatorio: boolean
  created_at: string
}

export type TipologiaVariavelComVariavel = TipologiaVariavel & { variavel: EngenhariaVariavel }

export type ComponenteVariante = {
  id: string
  componente_id: string
  condicoes: Record<string, string>
  produto_id?: string | null
  nome?: string | null
  quantidade_base?: number | null
  formula_quantidade?: string | null
  formula_corte?: string | null
  observacao?: string | null
  ativo: boolean
  ordem: number
  created_at: string
  updated_at: string
}

export type VariaveisPreset = {
  id: string
  tipologia_id: string
  produto_id?: string | null
  nome: string
  valores: Record<string, string>
  padrao: boolean
  criado_por_id?: string | null
  criado_por_nome?: string | null
  created_at: string
  updated_at: string
}

function slug(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

// Catálogo global de variáveis (ex.: mão de amigo, reforço, fechadura)
export async function listarVariaveis(): Promise<EngenhariaVariavel[]> {
  const { data, error } = await supabase.from('engenharia_variaveis').select('*').order('ordem')
  if (error || !data) return []
  return data as EngenhariaVariavel[]
}

export async function criarVariavel(label: string): Promise<EngenhariaVariavel | null> {
  const chave = slug(label) || `variavel_${Date.now()}`
  const { data: maior } = await supabase.from('engenharia_variaveis').select('ordem').order('ordem', { ascending: false }).limit(1)
  const ordem = ((maior?.[0]?.ordem as number | undefined) ?? -1) + 1
  const { data, error } = await supabase.from('engenharia_variaveis').insert({ chave, label: label.trim(), ordem }).select().single()
  if (error) { console.error('Erro ao criar variável:', error); return null }
  return data as EngenhariaVariavel
}

// Opções de cada variável (ex.: reforço -> interno / externo / sem)
export async function listarTodasOpcoes(): Promise<EngenhariaVariavelOpcao[]> {
  const { data, error } = await supabase.from('engenharia_variavel_opcoes').select('*').order('ordem')
  if (error || !data) return []
  return data as EngenhariaVariavelOpcao[]
}

export async function criarOpcao(variavelId: string, label: string): Promise<EngenhariaVariavelOpcao | null> {
  const chave = slug(label) || `opcao_${Date.now()}`
  const { data: maior } = await supabase.from('engenharia_variavel_opcoes').select('ordem').eq('variavel_id', variavelId).order('ordem', { ascending: false }).limit(1)
  const ordem = ((maior?.[0]?.ordem as number | undefined) ?? -1) + 1
  const { data, error } = await supabase.from('engenharia_variavel_opcoes').insert({ variavel_id: variavelId, chave, label: label.trim(), ordem }).select().single()
  if (error) { console.error('Erro ao criar opção:', error); return null }
  return data as EngenhariaVariavelOpcao
}

export async function excluirOpcao(id: string): Promise<boolean> {
  const { error } = await supabase.from('engenharia_variavel_opcoes').delete().eq('id', id)
  return !error
}

// Vínculo variável <-> tipologia (quais variáveis abrem para cada tipologia)
export async function listarVariaveisDaTipologia(tipologiaId: string): Promise<TipologiaVariavelComVariavel[]> {
  const { data, error } = await supabase
    .from('engenharia_tipologia_variaveis')
    .select('*, variavel:engenharia_variaveis(*)')
    .eq('tipologia_id', tipologiaId)
    .order('ordem')
  if (error || !data) return []
  return data as unknown as TipologiaVariavelComVariavel[]
}

export async function vincularVariavelATipologia(tipologiaId: string, variavelId: string, obrigatorio = false): Promise<boolean> {
  const { data: maior } = await supabase.from('engenharia_tipologia_variaveis').select('ordem').eq('tipologia_id', tipologiaId).order('ordem', { ascending: false }).limit(1)
  const ordem = ((maior?.[0]?.ordem as number | undefined) ?? -1) + 1
  const { error } = await supabase.from('engenharia_tipologia_variaveis').insert({ tipologia_id: tipologiaId, variavel_id: variavelId, ordem, obrigatorio })
  return !error
}

export async function desvincularVariavelDaTipologia(id: string): Promise<boolean> {
  const { error } = await supabase.from('engenharia_tipologia_variaveis').delete().eq('id', id)
  return !error
}

// Variantes condicionais de um componente da receita: quando a combinação de
// variáveis escolhidas bate com 'condicoes', os campos preenchidos aqui
// substituem os do componente base (produto, fórmula etc). Sem eval — apenas
// comparação de igualdade declarada no cadastro (ver DECISIONS.md).
export async function listarVariantesComponente(componenteId: string): Promise<ComponenteVariante[]> {
  const { data, error } = await supabase.from('engenharia_componente_variantes').select('*').eq('componente_id', componenteId).order('ordem')
  if (error || !data) return []
  return data as ComponenteVariante[]
}

export async function criarVarianteComponente(componenteId: string, dados: {
  condicoes: Record<string, string>
  produto_id?: string | null
  nome?: string | null
  quantidade_base?: number | null
  formula_quantidade?: string | null
  formula_corte?: string | null
  observacao?: string | null
}): Promise<ComponenteVariante | null> {
  const { data: maior } = await supabase.from('engenharia_componente_variantes').select('ordem').eq('componente_id', componenteId).order('ordem', { ascending: false }).limit(1)
  const ordem = ((maior?.[0]?.ordem as number | undefined) ?? -1) + 1
  const { data, error } = await supabase.from('engenharia_componente_variantes').insert({ ...dados, componente_id: componenteId, ordem }).select().single()
  if (error) { console.error('Erro ao criar variante:', error); return null }
  return data as ComponenteVariante
}

export async function excluirVarianteComponente(id: string): Promise<boolean> {
  const { error } = await supabase.from('engenharia_componente_variantes').delete().eq('id', id)
  return !error
}

// Entre as variantes cujas condições batem 100% com as variáveis escolhidas,
// vence a mais específica (mais condições). Se nenhuma bater, retorna null e
// quem chamar deve usar o componente base — nunca inventar uma variante.
export function resolverVarianteComponente(
  variantes: ComponenteVariante[],
  variaveisSelecionadas: Record<string, string | undefined>
): ComponenteVariante | null {
  const candidatas = variantes.filter(v => {
    const condicoes = v.condicoes || {}
    const chaves = Object.keys(condicoes)
    if (chaves.length === 0) return false
    return v.ativo && chaves.every(chave => (variaveisSelecionadas[chave] || '') === condicoes[chave])
  })
  if (candidatas.length === 0) return null
  return candidatas.sort((a, b) => Object.keys(b.condicoes).length - Object.keys(a.condicoes).length)[0]
}

// Aplica a variante (se houver) sobre o componente base da receita, gerando
// o componente que efetivamente vai para o snapshot do Plano de Corte.
export function aplicarVarianteAoComponente(componente: ComponenteReceita, variante: ComponenteVariante | null): ComponenteReceita {
  if (!variante) return componente
  return {
    ...componente,
    produto_id: variante.produto_id !== undefined && variante.produto_id !== null ? variante.produto_id : componente.produto_id,
    nome: variante.nome || componente.nome,
    quantidade_base: variante.quantidade_base ?? componente.quantidade_base,
    formula_quantidade: variante.formula_quantidade ?? componente.formula_quantidade,
    formula_corte: variante.formula_corte ?? componente.formula_corte,
  }
}

// Presets fixos: o usuário escolhe as variáveis uma vez, salva com um nome,
// e pode marcar como padrão para pré-carregar automaticamente da próxima vez.
export async function listarPresets(tipologiaId: string, produtoId?: string | null): Promise<VariaveisPreset[]> {
  const { data, error } = await supabase
    .from('engenharia_variaveis_preset')
    .select('*')
    .eq('tipologia_id', tipologiaId)
    .order('padrao', { ascending: false })
    .order('nome')
  if (error || !data) return []
  const todos = data as VariaveisPreset[]
  if (!produtoId) return todos.filter(p => !p.produto_id)
  return todos.filter(p => !p.produto_id || p.produto_id === produtoId)
}

export async function salvarPreset(dados: {
  tipologia_id: string
  produto_id?: string | null
  nome: string
  valores: Record<string, string>
  padrao?: boolean
  usuario: Usuario | null
}): Promise<VariaveisPreset | null> {
  if (dados.padrao) {
    let query = supabase.from('engenharia_variaveis_preset').update({ padrao: false }).eq('tipologia_id', dados.tipologia_id)
    query = dados.produto_id ? query.eq('produto_id', dados.produto_id) : query.is('produto_id', null)
    await query
  }
  const { data, error } = await supabase.from('engenharia_variaveis_preset').insert({
    tipologia_id: dados.tipologia_id,
    produto_id: dados.produto_id || null,
    nome: dados.nome.trim(),
    valores: dados.valores,
    padrao: Boolean(dados.padrao),
    criado_por_id: dados.usuario?.id || null,
    criado_por_nome: dados.usuario?.nome || null,
    updated_at: new Date().toISOString(),
  }).select().single()
  if (error) { console.error('Erro ao salvar preset:', error); return null }
  return data as VariaveisPreset
}

export async function excluirPreset(id: string): Promise<boolean> {
  const { error } = await supabase.from('engenharia_variaveis_preset').delete().eq('id', id)
  return !error
}
