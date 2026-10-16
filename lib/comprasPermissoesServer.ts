import { lerAcessoConfigServer } from '@/lib/acessoUsuarioServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export type ComprasAcessos = {
  consultar: boolean
  verProprios: boolean
  editarProprios: boolean
  editarTodos: boolean
  financeiro: boolean
  solicitar: boolean
  cotar: boolean
  aprovar: boolean
  comprar: boolean
  cancelar: boolean
  notasConsultar: boolean
  notasLancar: boolean
  receber: boolean
  conferir: boolean
  gerenciarKanban: boolean
}

const ACOES: Record<keyof ComprasAcessos, { setor: string; acao: string; minimo: 'consulta'|'edicao' }> = {
  consultar: { setor: 'compras', acao: 'compras.geral.consultar', minimo: 'consulta' },
  verProprios: { setor: 'compras', acao: 'compras.geral.ver_proprios', minimo: 'consulta' },
  editarProprios: { setor: 'compras', acao: 'compras.geral.editar_proprios', minimo: 'edicao' },
  editarTodos: { setor: 'compras', acao: 'compras.geral.editar_todos', minimo: 'edicao' },
  financeiro: { setor: 'compras', acao: 'compras.geral.financeiro', minimo: 'consulta' },
  solicitar: { setor: 'compras', acao: 'compras.geral.solicitar', minimo: 'edicao' },
  cotar: { setor: 'compras', acao: 'compras.geral.cotar', minimo: 'edicao' },
  aprovar: { setor: 'compras', acao: 'compras.geral.aprovar', minimo: 'edicao' },
  comprar: { setor: 'compras', acao: 'compras.geral.comprar', minimo: 'edicao' },
  cancelar: { setor: 'compras', acao: 'compras.geral.cancelar', minimo: 'edicao' },
  notasConsultar: { setor: 'compras', acao: 'compras.notas.consultar', minimo: 'consulta' },
  notasLancar: { setor: 'compras', acao: 'compras.notas.lancar', minimo: 'edicao' },
  receber: { setor: 'recebimento', acao: 'compras.recebimento.receber', minimo: 'edicao' },
  conferir: { setor: 'recebimento', acao: 'compras.recebimento.conferir', minimo: 'edicao' },
  gerenciarKanban: { setor: 'compras', acao: 'compras.kanban.gerenciar', minimo: 'edicao' },
}

const peso = { oculto: 0, consulta: 1, edicao: 2 } as const
type Nivel = keyof typeof peso
function nivel(valor: unknown): Nivel {
  return valor === 'edicao' || valor === 'consulta' ? valor : 'oculto'
}

/** Lê os níveis já definidos em Configurações > Usuários.
 * Nunca concede acesso de módulo só porque existe uma rota.
 * Master mantém acesso total, conforme o comportamento homologado.
 */
export async function obterComprasAcessos(usuario: { id: string; empresa_id: string; role?: string | null }): Promise<ComprasAcessos> {
  const chaves = Object.keys(ACOES) as (keyof ComprasAcessos)[]
  if (usuario.role === 'master') {
    return Object.fromEntries(chaves.map(k => [k, true])) as ComprasAcessos
  }
  const [{ data: setores, error: erroSetor }, configuracao] = await Promise.all([
    supabaseAdmin.from('permissoes').select('setor_id,nivel')
      .eq('empresa_id', usuario.empresa_id).eq('usuario_id', usuario.id).in('setor_id', ['compras','recebimento']),
    lerAcessoConfigServer(usuario.id,usuario.empresa_id),
  ])
  if (erroSetor) throw new Error('Falha ao conferir permissões de Compras')
  let conf: { acoes?: Record<string, unknown> } = {}
  try {
    const valor = configuracao
    const parseado = typeof valor === 'string' ? JSON.parse(valor) : valor
    if (parseado && typeof parseado === 'object') conf = parseado
  } catch { throw new Error('Configuração de acesso inválida') }
  const niveis = new Map((setores || []).map(s => [s.setor_id, nivel(s.nivel)]))
  return Object.fromEntries(chaves.map(k => {
    const regra = ACOES[k]
    const base = niveis.get(regra.setor) || 'oculto'
    const novoEscopo = ['verProprios','editarProprios','editarTodos','financeiro','gerenciarKanban'].includes(k)
    const explicito = conf.acoes && Object.prototype.hasOwnProperty.call(conf.acoes, regra.acao)
      ? nivel(conf.acoes[regra.acao]) : (novoEscopo ? 'oculto' : base)
    return [k, Math.min(peso[base], peso[explicito]) >= peso[regra.minimo]]
  })) as ComprasAcessos
}
