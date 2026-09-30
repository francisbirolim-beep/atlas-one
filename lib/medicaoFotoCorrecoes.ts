import { tokenAtual } from './auth'

export type CorrecaoFoto = {
  id: string
  criado_por_nome: string
  created_at: string
  snapshot: { item_id: string; descricao: string; tipo: string; foto_anterior: string; motivo: string; resultado: string }
}

export async function listarCorrecoesFoto(medicaoId: string): Promise<CorrecaoFoto[]> {
  const token = await tokenAtual()
  const resp = await fetch(`/api/medicao-final/${medicaoId}/fotos`, { headers: { Authorization: `Bearer ${token || ''}` }, cache: 'no-store' })
  const json = await resp.json()
  if (!resp.ok) throw new Error(json.error || 'Não foi possível carregar o histórico.')
  return json.historico
}

export async function excluirFotoComHistorico(medicaoId: string, dados: { itemId: string; tipo: 'larguras' | 'alturas' | 'galeria'; url: string; motivo: string; fotoId?: string }) {
  const token = await tokenAtual()
  const resp = await fetch(`/api/medicao-final/${medicaoId}/fotos`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` }, body: JSON.stringify(dados) })
  const json = await resp.json()
  if (!resp.ok) throw new Error(json.error || 'Não foi possível excluir a foto.')
  return json.mensagem as string
}
