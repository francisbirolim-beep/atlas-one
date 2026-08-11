import { createHash, randomBytes } from 'crypto'
import { supabaseAdmin } from './supabaseAdmin'

export type AcessoExternoMedicao = {
  id: string
  medicao_id: string
  nome_convidado: string | null
  telefone_convidado: string | null
  expira_em: string | null
  revogado_em: string | null
  primeiro_acesso_em: string | null
  ultimo_acesso_em: string | null
  criado_por_id: string | null
  criado_por_nome: string | null
  created_at: string
}

export function gerarTokenAcessoMedicao() {
  return randomBytes(32).toString('base64url')
}

export function hashTokenAcessoMedicao(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function buscarAcessoValidoMedicao(token: string, tocar = true): Promise<AcessoExternoMedicao | null> {
  if (!token || token.length < 32) return null

  const tokenHash = hashTokenAcessoMedicao(token)
  const { data, error } = await supabaseAdmin
    .from('medicao_acessos_externos')
    .select('id, medicao_id, nome_convidado, telefone_convidado, expira_em, revogado_em, primeiro_acesso_em, ultimo_acesso_em, criado_por_id, criado_por_nome, created_at')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (error || !data) return null
  if (data.revogado_em) return null
  if (data.expira_em && new Date(data.expira_em).getTime() < Date.now()) return null

  if (tocar) {
    const agora = new Date().toISOString()
    await supabaseAdmin
      .from('medicao_acessos_externos')
      .update({
        primeiro_acesso_em: data.primeiro_acesso_em || agora,
        ultimo_acesso_em: agora,
      })
      .eq('id', data.id)
  }

  return data as AcessoExternoMedicao
}

export async function carregarDadosExternosMedicao(token: string) {
  const acesso = await buscarAcessoValidoMedicao(token)
  if (!acesso) return null

  const [medicaoResp, itensResp, camposResp, respostasResp, fotosResp] = await Promise.all([
    supabaseAdmin
      .from('medicoes_finais')
      .select('id, cliente_nome, cliente_whatsapp, endereco, bairro, cidade, cep, status_operacional, responsavel_nome, iniciado_em, concluido_em, observacoes')
      .eq('id', acesso.medicao_id)
      .maybeSingle(),
    supabaseAdmin
      .from('medicao_itens')
      .select('id, medicao_id, tipo_esquadria, tipo_outro_texto, descricao, quantidade, ordem, largura_baixo_mm, largura_meio_mm, largura_cima_mm, altura_direita_mm, altura_meio_mm, altura_esquerda_mm, foto_larguras_url, foto_alturas_url, campos_extras, medido, medido_em, medido_por_nome')
      .eq('medicao_id', acesso.medicao_id)
      .order('ordem', { ascending: true }),
    supabaseAdmin
      .from('tipologia_campos_extras')
      .select('id, tipo_esquadria, chave, nome, tipo_valor, obrigatorio, ordem, secao, opcoes, regra_condicional, exigir_foto_quando, ativo')
      .eq('ativo', true)
      .order('ordem', { ascending: true }),
    supabaseAdmin
      .from('medicao_respostas')
      .select('id, medicao_id, item_id, campo_id, campo_chave, valor, observacao, foto_urls, respondido_por_nome, respondido_em, updated_at')
      .eq('medicao_id', acesso.medicao_id),
    supabaseAdmin
      .from('medicao_fotos')
      .select('id, medicao_id, item_id, categoria, url, legenda, criado_por_nome, created_at')
      .eq('medicao_id', acesso.medicao_id)
      .order('created_at', { ascending: true }),
  ])

  if (medicaoResp.error || !medicaoResp.data) return null

  return {
    acesso: {
      id: acesso.id,
      nome_convidado: acesso.nome_convidado,
      telefone_convidado: acesso.telefone_convidado,
      expira_em: acesso.expira_em,
    },
    medicao: medicaoResp.data,
    itens: itensResp.data || [],
    campos: camposResp.data || [],
    respostas: respostasResp.data || [],
    fotos: fotosResp.data || [],
  }
}
