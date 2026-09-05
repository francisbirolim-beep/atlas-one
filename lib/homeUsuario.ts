import { supabase } from './supabase'
import type { Usuario } from './tipos'
import { salvarConfiguracaoGeralTenant } from './configuracoesGeraisTenant'

export const HOME_MODULOS = [
  { id: 'orcamentos', label: 'Orçamentos', descricao: 'Atalho para novo orçamento e bloco de últimos orçamentos.' },
  { id: 'clientes', label: 'Clientes', descricao: 'Atalho rápido para cadastrar cliente.' },
  { id: 'kanban', label: 'Kanban comercial', descricao: 'Resumo das etapas do funil comercial e acesso ao Kanban.' },
  { id: 'tarefas', label: 'Minhas tarefas', descricao: 'Tarefas do próprio usuário e criação rápida.' },
  { id: 'calendario', label: 'Calendário', descricao: 'Agenda do usuário e criação de compromissos.' },
  { id: 'notificacoes', label: 'Notificações', descricao: 'Alertas e notificações operacionais do usuário.' },
  { id: 'assistencias', label: 'Assistências', descricao: 'Abertura e acompanhamento de chamados de assistência.' },
  { id: 'indicadores', label: 'Indicadores', descricao: 'Cards de acompanhamento geral da operação.' },
] as const

export type HomeModuloId = typeof HOME_MODULOS[number]['id']
export type EscopoAssistencias = 'proprias' | 'todas'

export interface HomeUsuarioConfig {
  modulos: HomeModuloId[]
  assistenciasEscopo: EscopoAssistencias
}

const MODULOS_VALIDOS = new Set<HomeModuloId>(HOME_MODULOS.map(m => m.id))
const MODULOS_MASTER = HOME_MODULOS.map(m => m.id) as HomeModuloId[]
const MODULOS_FUNCIONARIO: HomeModuloId[] = [
  'orcamentos',
  'kanban',
  'tarefas',
  'calendario',
  'notificacoes',
  'assistencias',
]

function chave(usuarioId: string) {
  return `home_usuario:${usuarioId}`
}

export function homeConfigPadrao(role: Usuario['role'] = 'funcionario'): HomeUsuarioConfig {
  return {
    modulos: role === 'master' ? [...MODULOS_MASTER] : [...MODULOS_FUNCIONARIO],
    assistenciasEscopo: role === 'master' ? 'todas' : 'proprias',
  }
}

function normalizarConfig(valor: unknown, role: Usuario['role']): HomeUsuarioConfig {
  const padrao = homeConfigPadrao(role)
  if (!valor || typeof valor !== 'object') return padrao

  const bruto = valor as Partial<HomeUsuarioConfig>
  const modulos = Array.isArray(bruto.modulos)
    ? bruto.modulos.filter((id): id is HomeModuloId => typeof id === 'string' && MODULOS_VALIDOS.has(id as HomeModuloId))
    : padrao.modulos

  const assistenciasEscopo: EscopoAssistencias = bruto.assistenciasEscopo === 'todas' ? 'todas' : 'proprias'

  return {
    modulos: Array.from(new Set(modulos)),
    assistenciasEscopo: role === 'master' ? 'todas' : assistenciasEscopo,
  }
}

export async function lerHomeUsuarioConfig(usuario: Pick<Usuario, 'id' | 'role'>): Promise<HomeUsuarioConfig> {
  const { data, error } = await supabase
    .from('configuracoes_gerais')
    .select('valor')
    .eq('chave', chave(usuario.id))
    .maybeSingle()

  if (error || !data?.valor) return homeConfigPadrao(usuario.role)

  try {
    const parsed = typeof data.valor === 'string' ? JSON.parse(data.valor) : data.valor
    return normalizarConfig(parsed, usuario.role)
  } catch {
    return homeConfigPadrao(usuario.role)
  }
}

export async function salvarHomeUsuarioConfig(usuarioId: string, config: HomeUsuarioConfig): Promise<boolean> {
  const normalizada: HomeUsuarioConfig = {
    modulos: Array.from(new Set(config.modulos.filter(id => MODULOS_VALIDOS.has(id)))),
    assistenciasEscopo: config.assistenciasEscopo === 'todas' ? 'todas' : 'proprias',
  }

  const ok = await salvarConfiguracaoGeralTenant(chave(usuarioId), JSON.stringify(normalizada))
  if (!ok) console.error('Erro ao salvar personalização da Home')
  return ok
}

export function temModulo(config: HomeUsuarioConfig, modulo: HomeModuloId) {
  return config.modulos.includes(modulo)
}
