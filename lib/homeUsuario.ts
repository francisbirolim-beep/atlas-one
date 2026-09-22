import { supabase } from './supabase'
import type { Usuario } from './tipos'

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
export type DashboardId = 'geral' | 'comercial' | 'orcamentos' | 'engenharia' | 'producao' | 'instalacao' | 'financeiro' | 'pessoal' | 'assistencias'

export const DASHBOARDS = [
  { id: 'geral', label: 'Geral' },
  { id: 'comercial', label: 'Comercial' },
  { id: 'orcamentos', label: 'Orçamentos' },
  { id: 'engenharia', label: 'Engenharia' },
  { id: 'producao', label: 'Produção' },
  { id: 'instalacao', label: 'Instalação' },
  { id: 'financeiro', label: 'Financeiro' },
  { id: 'pessoal', label: 'Pessoal' },
  { id: 'assistencias', label: 'Assistências' },
] as const

export interface HomeUsuarioConfig {
  modulos: HomeModuloId[]
  assistenciasEscopo: EscopoAssistencias
  dashboards?: DashboardId[]
  dashboardPrincipal?: DashboardId
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
    dashboards: role === 'master' ? DASHBOARDS.map(d => d.id) : ['comercial', 'pessoal'],
    dashboardPrincipal: role === 'master' ? 'geral' : 'comercial',
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
  const validos = new Set<DashboardId>(DASHBOARDS.map(d => d.id))
  const dashboards = Array.isArray(bruto.dashboards) ? bruto.dashboards.filter((id): id is DashboardId => typeof id === 'string' && validos.has(id as DashboardId)) : padrao.dashboards
  const dashboardPrincipal = bruto.dashboardPrincipal && validos.has(bruto.dashboardPrincipal) && dashboards?.includes(bruto.dashboardPrincipal) ? bruto.dashboardPrincipal : dashboards?.[0] || padrao.dashboardPrincipal

  return {
    modulos: Array.from(new Set(modulos)),
    assistenciasEscopo: role === 'master' ? 'todas' : assistenciasEscopo,
    dashboards: role === 'master' ? DASHBOARDS.map(d => d.id) : dashboards,
    dashboardPrincipal: role === 'master' && !dashboardPrincipal ? 'geral' : dashboardPrincipal,
  }
}

export async function lerHomeUsuarioConfig(usuario: Pick<Usuario, 'id' | 'role'>): Promise<HomeUsuarioConfig> {
  const chaveLocal = `atlas_home_config:${usuario.id}:v1`

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    try {
      const salvo = window.localStorage.getItem(chaveLocal)
      if (salvo) return normalizarConfig(JSON.parse(salvo), usuario.role)
    } catch {}
    return homeConfigPadrao(usuario.role)
  }

  try {
    const { data, error } = await supabase
      .from('configuracoes_gerais')
      .select('valor')
      .eq('chave', chave(usuario.id))
      .maybeSingle()

    if (error || !data?.valor) return homeConfigPadrao(usuario.role)
    const parsed = typeof data.valor === 'string' ? JSON.parse(data.valor) : data.valor
    const config = normalizarConfig(parsed, usuario.role)
    try { window.localStorage.setItem(chaveLocal, JSON.stringify(config)) } catch {}
    return config
  } catch {
    try {
      const salvo = window.localStorage.getItem(chaveLocal)
      if (salvo) return normalizarConfig(JSON.parse(salvo), usuario.role)
    } catch {}
    return homeConfigPadrao(usuario.role)
  }
}

export async function salvarHomeUsuarioConfig(usuarioId: string, config: HomeUsuarioConfig): Promise<boolean> {
  const normalizada: HomeUsuarioConfig = {
    modulos: Array.from(new Set(config.modulos.filter(id => MODULOS_VALIDOS.has(id)))),
    assistenciasEscopo: config.assistenciasEscopo === 'todas' ? 'todas' : 'proprias',
    dashboards: config.dashboards || ['comercial', 'pessoal'],
    dashboardPrincipal: config.dashboardPrincipal || config.dashboards?.[0] || 'comercial',
  }

  const { error } = await supabase
    .from('configuracoes_gerais')
    .upsert({
      chave: chave(usuarioId),
      valor: JSON.stringify(normalizada),
      updated_at: new Date().toISOString(),
    })

  if (error) console.error('Erro ao salvar personalização da Home:', error)
  return !error
}

export function temModulo(config: HomeUsuarioConfig, modulo: HomeModuloId) {
  return config.modulos.includes(modulo)
}
