import { tokenAtual } from './auth'
import type { TarefaPessoal } from './tipos'

export type PrioridadeTarefa = 'baixa' | 'normal' | 'alta' | 'urgente'
export type CodigoErroColaboracao = 'COLABORACAO_INATIVA'

export async function atribuirTarefa(dados: {
  responsavelId: string
  titulo: string
  descricao?: string
  dataHora?: string | null
  prioridade?: PrioridadeTarefa
}): Promise<{ ok: boolean; tarefa?: TarefaPessoal; error?: string; code?: CodigoErroColaboracao; atribuidaParaOutro?: boolean }> {
  const token = await tokenAtual()
  if (!token) return { ok: false, error: 'Sessão expirada' }

  try {
    const resp = await fetch('/api/tarefas/atribuir', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(dados),
    })
    const json = await resp.json()
    if (!resp.ok) return {
      ok: false,
      error: json.error || 'Não foi possível criar a tarefa',
      code: json.code === 'COLABORACAO_INATIVA' ? 'COLABORACAO_INATIVA' : undefined,
    }
    return {
      ok: true,
      tarefa: json.tarefa as TarefaPessoal,
      atribuidaParaOutro: Boolean(json.atribuidaParaOutro),
    }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Falha de conexão ao criar a tarefa' }
  }
}
