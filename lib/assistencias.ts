import { supabase } from './supabase'
import { obterOuCriarCliente } from './clientes'
import { uploadFoto } from './upload'
import { usuarioAtual } from './auth'
import { primeiraColunaAssistenciaId } from './assistenciaKanban'
import { executarAutomacoesAssistencia } from './automacoesAssistencia'
import { primeiraColunaId } from './kanban'
import { v4 as uuidv4 } from 'uuid'

export interface DadosAssistenciaForm {
  clienteNome: string
  clienteWhatsapp: string
  cidade: string
  endereco: string
  numero: string
  bairro: string
  descricao: string
  fotos: File[]
}

// Faz de fato a gravacao no Supabase. Usada tanto pelo formulario (quando ha
// internet na hora) quanto pelo sincronizador da fila offline.
export async function criarAssistenciaNoServidor(
  dados: DadosAssistenciaForm
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const { clienteNome, clienteWhatsapp, cidade, endereco, numero, bairro, descricao, fotos } = dados

  const [clienteId, usuario, colunaAssistenciaId, colunaOrcamentoId] = await Promise.all([
    obterOuCriarCliente({ nome: clienteNome, whatsapp: clienteWhatsapp, cidade }),
    usuarioAtual(),
    primeiraColunaAssistenciaId(),
    primeiraColunaId(),
  ])

  const fotosUrls: string[] = []
  for (const f of fotos) {
    const url = await uploadFoto(f)
    if (url) fotosUrls.push(url)
  }

  const novaAssistenciaId = uuidv4()

  const { error } = await supabase.from('assistencias').insert({
    id: novaAssistenciaId,
    cliente_id: clienteId,
    cliente_nome: clienteNome,
    cliente_whatsapp: clienteWhatsapp || null,
    cidade: cidade || null,
    endereco: endereco || null,
    numero: numero || null,
    bairro: bairro || null,
    descricao_problema: descricao,
    fotos_urls: fotosUrls,
    status: 'aberto',
    coluna_id: colunaAssistenciaId,
    coluna_atualizada_em: new Date().toISOString(),
    criado_por_nome: usuario?.nome || null,
    criado_por_id: usuario?.id || null,
  })

  if (error) return { ok: false, error: error.message }

  executarAutomacoesAssistencia({
    cliente_nome: clienteNome,
    criado_por_id: usuario?.id || null,
  }).catch(() => {})

  // Card espelho no painel de orcamento (aba "Fazer orçamento") so pra
  // avisar o time que tem um chamado de assistencia novo. Some de la sozinho
  // quando o chamado sai da primeira coluna do kanban de assistencia.
  if (colunaOrcamentoId) {
    const { error: erroEspelho } = await supabase.from('orcamentos').insert({
      id: uuidv4(),
      cliente_id: clienteId,
      cliente_nome: clienteNome,
      cliente_whatsapp: clienteWhatsapp || null,
      cidade: cidade || null,
      origem: 'outros',
      tipo_esquadria: 'outro',
      largura_mm: null,
      altura_mm: null,
      quantidade: 1,
      acabamento: 'outro',
      contramarco: 'sem',
      itens: [],
      descricao_livre: descricao,
      valor_estimado: null,
      status: 'rascunho',
      modo_entrada: 'assistencia',
      coluna_id: colunaOrcamentoId,
      coluna_atualizada_em: new Date().toISOString(),
      criado_por_nome: usuario?.nome || null,
      criado_por_id: usuario?.id || null,
      eh_assistencia: true,
      assistencia_id: novaAssistenciaId,
    })
    if (erroEspelho) console.error('Erro ao criar card espelho da assistencia:', erroEspelho)
  }

  return { ok: true, id: novaAssistenciaId }
}
