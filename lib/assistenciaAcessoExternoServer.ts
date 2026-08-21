import { createHash, randomBytes } from 'crypto'
import { supabaseAdmin } from './supabaseAdmin'

export type AcessoExternoAssistencia = {
  id: string
  assistencia_id: string
  nome_tecnico: string | null
  telefone_tecnico: string | null
  expira_em: string | null
  revogado_em: string | null
  primeiro_acesso_em: string | null
  ultimo_acesso_em: string | null
  criado_por_id: string | null
  criado_por_nome: string | null
  created_at: string
}

export function gerarTokenAcessoAssistencia() {
  return randomBytes(32).toString('base64url')
}

export function hashTokenAcessoAssistencia(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function buscarAcessoValidoAssistencia(
  token: string,
  tocar = true,
): Promise<AcessoExternoAssistencia | null> {
  if (!token || token.length < 32) return null

  const tokenHash = hashTokenAcessoAssistencia(token)
  const { data, error } = await supabaseAdmin
    .from('assistencia_acessos_externos')
    .select('id, assistencia_id, nome_tecnico, telefone_tecnico, expira_em, revogado_em, primeiro_acesso_em, ultimo_acesso_em, criado_por_id, criado_por_nome, created_at')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (error || !data) return null
  if (data.revogado_em) return null
  if (data.expira_em && new Date(data.expira_em).getTime() < Date.now()) return null

  if (tocar) {
    const agora = new Date().toISOString()
    await supabaseAdmin
      .from('assistencia_acessos_externos')
      .update({
        primeiro_acesso_em: data.primeiro_acesso_em || agora,
        ultimo_acesso_em: agora,
      })
      .eq('id', data.id)
  }

  return data as AcessoExternoAssistencia
}

function lerJsonSeguro(valor: unknown): Record<string, unknown> | null {
  if (typeof valor !== 'string' || !valor) return null
  try {
    const parsed = JSON.parse(valor)
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null
  } catch {
    return null
  }
}

export async function carregarDadosExternosAssistencia(token: string) {
  const acesso = await buscarAcessoValidoAssistencia(token)
  if (!acesso) return null

  const [assistenciaResp, empresaResp] = await Promise.all([
    supabaseAdmin
      .from('assistencias')
      .select('id, created_at, cliente_nome, cliente_whatsapp, cidade, endereco, numero, bairro, descricao_problema, fotos_urls, status, coluna_id, criado_por_nome, tecnico_nome, data_atendimento, servico_realizado, materiais_utilizados, observacoes_atendimento, assinatura_tecnico, assinatura_cliente, atendimento_iniciado_em, atendimento_concluido_em, duracao_atendimento_segundos, gps_inicio_latitude, gps_inicio_longitude, gps_inicio_precisao_m, gps_inicio_capturado_em, gps_fim_latitude, gps_fim_longitude, gps_fim_precisao_m, gps_fim_capturado_em')
      .eq('id', acesso.assistencia_id)
      .maybeSingle(),
    supabaseAdmin
      .from('configuracoes_gerais')
      .select('valor')
      .eq('chave', 'dados_empresa')
      .maybeSingle(),
  ])

  if (assistenciaResp.error || !assistenciaResp.data) return null

  let etapa = ''
  const colunaId = assistenciaResp.data.coluna_id
  if (colunaId) {
    const { data: coluna } = await supabaseAdmin
      .from('assistencia_colunas')
      .select('nome')
      .eq('id', colunaId)
      .maybeSingle()
    etapa = coluna?.nome || ''
  }

  const empresa = lerJsonSeguro(empresaResp.data?.valor)

  return {
    acesso: {
      id: acesso.id,
      nome_tecnico: acesso.nome_tecnico,
      telefone_tecnico: acesso.telefone_tecnico,
      expira_em: acesso.expira_em,
    },
    assistencia: assistenciaResp.data,
    empresa,
    etapa,
  }
}
