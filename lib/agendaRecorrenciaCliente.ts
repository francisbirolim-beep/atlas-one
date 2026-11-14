import { tokenAtual } from './auth'
import type { FrequenciaAtlas, TipoRegistroAtlas } from './agendaRecorrencia'

export type NovaRecorrenciaAtlas = {
  tipoRegistro: TipoRegistroAtlas
  titulo: string
  descricao?: string
  baseData: string
  horaInicio: string
  frequencia: FrequenciaAtlas
  prioridade?: 'baixa' | 'normal' | 'alta' | 'urgente'
  responsaveisIds?: string[]
  convidadosIds?: string[]
  diasSemana?: number[]
  diaMes?: number
  nDiaUtil?: number
  duracaoMinutos?: number
  ateData?: string | null
  local?: string
}

export async function criarRecorrenciaAtlas(dados: NovaRecorrenciaAtlas): Promise<{
  ok: boolean; error?: string; aviso?: string
}> {
  const token = await tokenAtual()
  if (!token) return { ok: false, error: 'Sessão expirada' }
  try {
    const response = await fetch('/api/recorrencias', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
      },
      body: JSON.stringify(dados),
    })
    const json = await response.json()
    return { ok: Boolean(response.ok && json.ok), error: json.error, aviso: json.aviso }
  } catch {
    return { ok: false, error: 'Falha de conexão ao cadastrar a repetição' }
  }
}
