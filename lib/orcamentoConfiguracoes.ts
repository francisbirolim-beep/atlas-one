import { supabase } from './supabase'
import { tokenAtual } from './auth'

export type ConfiguracaoOrcamento = {
  id: string
  tipologia_id: string
  produto_id?: string | null
  nome: string
  valores: Record<string, string>
  imagem_url?: string | null
  padrao: boolean
  usar_no_orcamento?: boolean
  validado?: boolean
  validado_em?: string | null
  validado_por_id?: string | null
  validado_por_nome?: string | null
  evidencia_validacao?: string | null
  ativo?: boolean
  criado_por_id?: string | null
  criado_por_nome?: string | null
  created_at: string
  updated_at: string
}

export async function listarConfiguracoesValidadasOrcamento(): Promise<ConfiguracaoOrcamento[]> {
  const { data, error } = await supabase
    .from('engenharia_variaveis_preset')
    .select('*')
    .order('nome')

  if (error || !data) return []
  return (data as ConfiguracaoOrcamento[]).filter(item =>
    item.ativo !== false
    && item.usar_no_orcamento === true
    && item.validado === true
  )
}

export async function listarConfiguracoesOrcamentoAdministracao(): Promise<ConfiguracaoOrcamento[]> {
  const { data, error } = await supabase
    .from('engenharia_variaveis_preset')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error || !data) return []
  return data as ConfiguracaoOrcamento[]
}

export async function criarConfiguracaoValidadaOrcamento(dados: {
  tipologiaId: string
  produtoId?: string | null
  nome: string
  valores: Record<string, string>
  evidencia: string
  imagemUrl?: string | null
}): Promise<{ ok: boolean; error?: string; configuracao?: ConfiguracaoOrcamento }> {
  const token = await tokenAtual()
  if (!token) return { ok: false, error: 'Sessao expirada. Entre novamente no Atlas.' }

  try {
    const resp = await fetch('/api/engenharia/configuracoes-orcamento', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(dados),
    })
    const json = await resp.json().catch(() => ({}))
    if (!resp.ok) return { ok: false, error: json.error || 'Nao foi possivel salvar a configuracao.' }
    return { ok: true, configuracao: json.configuracao as ConfiguracaoOrcamento }
  } catch {
    return { ok: false, error: 'Nao foi possivel conectar ao servidor para salvar a configuracao.' }
  }
}

export async function alternarConfiguracaoOrcamento(id: string, ativo: boolean): Promise<{ ok: boolean; error?: string }> {
  const token = await tokenAtual()
  if (!token) return { ok: false, error: 'Sessao expirada. Entre novamente no Atlas.' }
  try {
    const resp = await fetch('/api/engenharia/configuracoes-orcamento', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ id, ativo }),
    })
    const json = await resp.json().catch(() => ({}))
    return resp.ok ? { ok: true } : { ok: false, error: json.error || 'Nao foi possivel alterar a configuracao.' }
  } catch {
    return { ok: false, error: 'Nao foi possivel conectar ao servidor.' }
  }
}
