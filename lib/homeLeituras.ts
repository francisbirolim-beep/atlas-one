// Compartilha apenas leituras simultâneas da Home. Sem cache persistente
// ou reaproveitamento de respostas entre usuários.
import { tokenAtual } from './auth'
import { listarColunasTarefas, listarTarefas } from './tarefas'
import { listarEventosDoUsuario, listarConclusoesEventosUsuario } from './eventos'
import { listarEquipe } from './tarefasEquipeCliente'
import type { TarefaPessoal } from './tipos'

type Delegada = TarefaPessoal & { responsavel_nome: string; coluna_nome: string }

export function leituraSimultanea<T>() {
  const emCurso = new Map<string, Promise<T>>()
  return (chave: string, ler: () => Promise<T>): Promise<T> => {
    const atual = emCurso.get(chave)
    if (atual) return atual
    const pedido = Promise.resolve().then(ler)
    emCurso.set(chave, pedido)
    const limpar = () => { if (emCurso.get(chave) === pedido) emCurso.delete(chave) }
    void pedido.then(limpar, limpar)
    return pedido
  }
}

export async function buscarDelegadasHome(): Promise<Delegada[]> {
  const token = await tokenAtual()
  if (!token) return []
  try {
    const r = await fetch('/api/tarefas/delegadas', { cache: 'no-store', headers: { Authorization: 'Bearer ' + token } })
    if (!r.ok) return []
    const json = await r.json()
    return Array.isArray(json.tarefas) ? json.tarefas : []
  } catch { return [] }
}

function lerAgenda(usuarioId: string) {
  return Promise.all([listarEventosDoUsuario(usuarioId), listarConclusoesEventosUsuario(usuarioId)])
}
const agendaInicial = leituraSimultanea<Awaited<ReturnType<typeof lerAgenda>>>()
export function carregarAgendaHome(usuarioId: string) {
  return agendaInicial(usuarioId, () => lerAgenda(usuarioId))
}

async function lerTrabalho(usuarioId: string) {
  const [colunas, tarefas, delegadas, equipe, [eventos, conclusoes]] = await Promise.all([
    listarColunasTarefas(usuarioId), listarTarefas(usuarioId), buscarDelegadasHome(),
    listarEquipe().catch(() => []), carregarAgendaHome(usuarioId),
  ])
  return { colunas, tarefas, delegadas, equipe, eventos, conclusoes }
}
const trabalhoInicial = leituraSimultanea<Awaited<ReturnType<typeof lerTrabalho>>>()
export function carregarTrabalhoHome(usuarioId: string) {
  return trabalhoInicial(usuarioId, () => lerTrabalho(usuarioId))
}
