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

export interface CadastrosUsuarioConfig {
  visiveis: Cadastro360Id[]
}

const IDS_VALIDOS = new Set<Cadastro360Id>(CADASTROS_360.map(item => item.id))
const TODOS = CADASTROS_360.map(item => item.id) as Cadastro360Id[]

function chave(usuarioId: string) {
  return `cadastros_360_usuario:${usuarioId}`
}

export function cadastrosConfigPadrao(_role: Usuario['role'] = 'funcionario'): CadastrosUsuarioConfig {
  // Mantém compatibilidade para usuários existentes. O master pode restringir
  // cada funcionário explicitamente na tela Usuários e Acesso.
  return { visiveis: [...TODOS] }
}

function normalizar(valor: unknown, role: Usuario['role']): CadastrosUsuarioConfig {
  if (role === 'master') return cadastrosConfigPadrao('master')
  if (!valor || typeof valor !== 'object') return cadastrosConfigPadrao(role)
  const bruto = valor as Partial<CadastrosUsuarioConfig>
  if (!Array.isArray(bruto.visiveis)) return cadastrosConfigPadrao(role)
  return {
    visiveis: Array.from(new Set(bruto.visiveis.filter(
      (id): id is Cadastro360Id => typeof id === 'string' && IDS_VALIDOS.has(id as Cadastro360Id)
    ))),
  }
}

export async function lerCadastrosUsuarioConfig(usuario: Pick<Usuario, 'id' | 'role'>): Promise<CadastrosUsuarioConfig> {
  if (usuario.role === 'master') return cadastrosConfigPadrao('master')
  const { data, error } = await supabase
    .from('configuracoes_gerais')
    .select('valor')
    .eq('chave', chave(usuario.id))
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
  const { error } = await supabase.from('configuracoes_gerais').upsert({
    chave: chave(usuarioId),
    valor: JSON.stringify(normalizada),
    updated_at: new Date().toISOString(),
  })
  if (error) console.error('Erro ao salvar Cadastros 360 do usuário:', error)
  return !error
}

