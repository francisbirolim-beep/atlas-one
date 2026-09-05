import { supabase } from './supabase'
import type { Usuario } from './tipos'

export const CADASTROS_360 = [
  { id: 'clientes', label: 'Clientes', grupo: 'Cadastros principais' },
  { id: 'catalogo_tecnico', label: 'Catálogo Técnico', grupo: 'Cadastros principais' },
  { id: 'produtos', label: 'Produtos', grupo: 'Cadastros principais' },
  { id: 'linhas', label: 'Linhas', grupo: 'Cadastros principais' },
  { id: 'materiais', label: 'Materiais', grupo: 'Cadastros principais' },
  { id: 'fornecedores', label: 'Fornecedores', grupo: 'Cadastros principais' },
  { id: 'historico', label: 'Histórico de Cadastros e Preços', grupo: 'Produtos e precificação' },
  { id: 'produtos_linha', label: 'Produtos por Linha', grupo: 'Produtos e precificação' },
  { id: 'precificacao', label: 'Precificação', grupo: 'Produtos e precificação' },
  { id: 'unidades', label: 'Unidades Pendentes', grupo: 'Produtos e precificação' },
  { id: 'receitas', label: 'Receitas Técnicas', grupo: 'Engenharia' },
  { id: 'formulas', label: 'Fórmulas de Corte', grupo: 'Engenharia' },
  { id: 'campos', label: 'Campos adicionais', grupo: 'Engenharia' },
  { id: 'avancados', label: 'Cadastros Avançados', grupo: 'Avançado' },
] as const

export type Cadastro360Id = typeof CADASTROS_360[number]['id']
export type Cadastro360Acao = 'ver' | 'criar' | 'editar' | 'excluir' | 'aprovar'

export const CADASTRO_360_ACOES: { id: Cadastro360Acao; label: string }[] = [
  { id: 'ver', label: 'Ver' },
  { id: 'criar', label: 'Criar' },
  { id: 'editar', label: 'Editar' },
  { id: 'excluir', label: 'Excluir' },
  { id: 'aprovar', label: 'Aprovar' },
]

export interface CadastrosUsuarioConfig {
  visiveis: Cadastro360Id[]
  acoes?: Partial<Record<Cadastro360Id, Cadastro360Acao[]>>
}

const IDS_VALIDOS = new Set<Cadastro360Id>(CADASTROS_360.map(item => item.id))
const ACOES_VALIDAS = new Set<Cadastro360Acao>(CADASTRO_360_ACOES.map(item => item.id))
const TODOS = CADASTROS_360.map(item => item.id) as Cadastro360Id[]
const TODAS_ACOES = CADASTRO_360_ACOES.map(item => item.id)

function chaveLegada(usuarioId: string) {
  return `cadastros_360_usuario:${usuarioId}`
}

function acoesCompletas(ids: Cadastro360Id[]) {
  return Object.fromEntries(ids.map(id => [id, [...TODAS_ACOES]])) as Record<Cadastro360Id, Cadastro360Acao[]>
}

export function cadastrosConfigPadrao(_role: Usuario['role'] = 'funcionario'): CadastrosUsuarioConfig {
  // Compatibilidade: usuários que já tinham acesso aos Cadastros 360 continuam
  // com as mesmas opções e, até configuração explícita, com todas as ações.
  return { visiveis: [...TODOS], acoes: acoesCompletas(TODOS) }
}

function normalizarAcoes(valor: unknown, visiveis: Cadastro360Id[], legadoSemMatriz: boolean) {
  if (legadoSemMatriz) return acoesCompletas(visiveis)
  const bruto = valor && typeof valor === 'object' ? valor as Record<string, unknown> : {}
  const saida: Partial<Record<Cadastro360Id, Cadastro360Acao[]>> = {}
  for (const id of visiveis) {
    const lista = Array.isArray(bruto[id]) ? bruto[id] : []
    const validas = Array.from(new Set(lista.filter(
      (acao): acao is Cadastro360Acao => typeof acao === 'string' && ACOES_VALIDAS.has(acao as Cadastro360Acao)
    )))
    if (validas.length && !validas.includes('ver')) validas.unshift('ver')
    saida[id] = validas
  }
  return saida
}

function normalizar(valor: unknown, role: Usuario['role']): CadastrosUsuarioConfig {
  if (role === 'master') return cadastrosConfigPadrao('master')
  if (!valor || typeof valor !== 'object') return cadastrosConfigPadrao(role)
  const bruto = valor as Partial<CadastrosUsuarioConfig>
  if (!Array.isArray(bruto.visiveis)) return cadastrosConfigPadrao(role)
  const visiveis = Array.from(new Set(bruto.visiveis.filter(
    (id): id is Cadastro360Id => typeof id === 'string' && IDS_VALIDOS.has(id as Cadastro360Id)
  )))
  const legadoSemMatriz = !bruto.acoes || typeof bruto.acoes !== 'object'
  return { visiveis, acoes: normalizarAcoes(bruto.acoes, visiveis, legadoSemMatriz) }
}

export async function lerCadastrosUsuarioConfig(usuario: Pick<Usuario, 'id' | 'role'>): Promise<CadastrosUsuarioConfig> {
  if (usuario.role === 'master') return cadastrosConfigPadrao('master')

  const { data: segura, error: erroSegura } = await supabase
    .from('usuario_cadastros_360_permissoes')
    .select('config')
    .eq('usuario_id', usuario.id)
    .maybeSingle()

  if (!erroSegura && segura?.config) return normalizar(segura.config, usuario.role)

  // Fallback temporário para instalações/usuários ainda não migrados. A gravação
  // nova nunca volta para configuracoes_gerais porque essa tabela possui legado amplo.
  const { data, error } = await supabase
    .from('configuracoes_gerais')
    .select('valor')
    .eq('chave', chaveLegada(usuario.id))
    .maybeSingle()
  if (error || !data?.valor) return cadastrosConfigPadrao(usuario.role)
  try {
    const valor = typeof data.valor === 'string' ? JSON.parse(data.valor) : data.valor
    return normalizar(valor, usuario.role)
  } catch {
    return cadastrosConfigPadrao(usuario.role)
  }
}

export async function salvarCadastrosUsuarioConfig(usuarioId: string, config: CadastrosUsuarioConfig): Promise<boolean> {
  const normalizada = normalizar(config, 'funcionario')
  const { error } = await supabase.from('usuario_cadastros_360_permissoes').upsert({
    usuario_id: usuarioId,
    config: normalizada,
    updated_at: new Date().toISOString(),
  })
  if (error) console.error('Erro ao salvar permissões dos Cadastros 360:', error)
  return !error
}

export function temPermissaoCadastro360(
  usuario: Pick<Usuario, 'role'> | null | undefined,
  config: CadastrosUsuarioConfig | null | undefined,
  cadastro: Cadastro360Id,
  acao: Cadastro360Acao = 'ver',
) {
  if (usuario?.role === 'master') return true
  if (!config?.visiveis.includes(cadastro)) return false
  const acoes = config.acoes?.[cadastro]
  if (!acoes) return true
  return acoes.includes(acao)
}

export function cadastro360PorRota(pathname: string): Cadastro360Id | null {
  const regras: { id: Cadastro360Id; teste: (path: string) => boolean }[] = [
    { id: 'produtos_linha', teste: p => p.startsWith('/cadastro/produtos/por-linha') },
    { id: 'precificacao', teste: p => p.startsWith('/cadastro/produtos/precificacao') },
    { id: 'unidades', teste: p => p.startsWith('/cadastro/produtos/unidades-pendentes') },
    { id: 'catalogo_tecnico', teste: p => p.startsWith('/cadastro/catalogo-tecnico') },
    { id: 'linhas', teste: p => p.startsWith('/cadastro/linhas') },
    { id: 'materiais', teste: p => p.startsWith('/cadastro/materiais') },
    { id: 'fornecedores', teste: p => p.startsWith('/cadastro/fornecedores') || p.startsWith('/fornecedores/') },
    { id: 'historico', teste: p => p.startsWith('/cadastro/historico') },
    { id: 'receitas', teste: p => p.startsWith('/engenharia/receitas') },
    { id: 'formulas', teste: p => p.startsWith('/engenharia/formulas-corte') },
    { id: 'campos', teste: p => p.startsWith('/configuracoes/campos') },
    { id: 'clientes', teste: p => p === '/clientes' || p.startsWith('/clientes/') },
    { id: 'produtos', teste: p => p === '/cadastro/produtos' || p.startsWith('/cadastro/produtos/') },
    { id: 'avancados', teste: p => p === '/cadastro' },
  ]
  return regras.find(regra => regra.teste(pathname))?.id || null
}
