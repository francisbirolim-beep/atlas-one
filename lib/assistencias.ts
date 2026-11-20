import { supabase } from './supabase'
import { obterOuCriarCliente } from './clientes'
import { uploadFoto } from './upload'
import { usuarioAtual } from './auth'
import { primeiraColunaAssistenciaId } from './assistenciaKanban'
import { executarAutomacoesAssistencia } from './automacoesAssistencia'
import { primeiraColunaId } from './kanban'
import { v4 as uuidv4 } from 'uuid'
import type { AssistenciaItem } from './tipos'

export interface ItemAssistenciaForm {
  id: string
  titulo: string
  descricao: string
  fotos: File[]
}

export interface DadosAssistenciaForm {
  clienteId?: string | null
  obraId?: string | null
  clienteNome: string
  clienteWhatsapp: string
  cidade: string
  endereco: string
  numero: string
  bairro: string
  descricao: string
  fotos: File[]
  itens?: ItemAssistenciaForm[]
  responsavelAberturaNome?: string
  dataAssistencia?: string
}

function dataAssistenciaParaIso(dataAssistencia?: string) {
  if (!dataAssistencia) return new Date().toISOString()
  const [ano, mes, dia] = dataAssistencia.split('-').map(Number)
  if (!ano || !mes || !dia) return new Date().toISOString()

  const agora = new Date()
  agora.setFullYear(ano, mes - 1, dia)
  return agora.toISOString()
}

// Faz de fato a gravacao no Supabase. Usada tanto pelo formulario (quando ha
// internet na hora) quanto pelo sincronizador da fila offline.
export async function criarAssistenciaNoServidor(
  dados: DadosAssistenciaForm
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const { clienteId: clienteIdInformado, clienteNome, clienteWhatsapp, cidade, endereco, numero, bairro, descricao, fotos, dataAssistencia } = dados
  const itensValidos = (dados.itens || []).filter(item => item.titulo.trim() || item.descricao.trim() || item.fotos.length > 0)
  const obraId = dados.obraId || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('obra') : null)

  const [clienteId, usuario, colunaAssistenciaId, colunaOrcamentoId] = await Promise.all([
    clienteIdInformado
      ? Promise.resolve(clienteIdInformado)
      : obterOuCriarCliente({ nome: clienteNome, whatsapp: clienteWhatsapp, cidade }),
    usuarioAtual(),
    primeiraColunaAssistenciaId(),
    primeiraColunaId(),
  ])

  const fotosUrls: string[] = []
  for (const f of fotos) {
    const url = await uploadFoto(f)
    if (url) fotosUrls.push(url)
  }

  const itensSalvos: AssistenciaItem[] = []
  for (const item of itensValidos) {
    const urls: string[] = []
    for (const foto of item.fotos) {
      const url = await uploadFoto(foto)
      if (!url) return { ok: false, error: 'Não foi possível enviar uma das fotos dos itens. Tente novamente.' }
      urls.push(url)
    }
    itensSalvos.push({ id: item.id || uuidv4(), titulo: item.titulo.trim() || `Item ${itensSalvos.length + 1}`, descricao: item.descricao.trim(), fotos_urls: urls })
  }
  const descricaoResumo = descricao.trim() || itensSalvos.map((item, i) => `${i + 1}. ${item.titulo}${item.descricao ? `: ${item.descricao}` : ''}`).join('\n')

  const novaAssistenciaId = uuidv4()
  const criadaEm = dataAssistenciaParaIso(dataAssistencia)

  const { error } = await supabase.from('assistencias').insert({
    id: novaAssistenciaId,
    created_at: criadaEm,
    cliente_id: clienteId,
    obra_id: obraId || null,
    cliente_nome: clienteNome,
    cliente_whatsapp: clienteWhatsapp || null,
    cidade: cidade || null,
    endereco: endereco || null,
    numero: numero || null,
    bairro: bairro || null,
    descricao_problema: descricaoResumo,
    itens: itensSalvos,
    responsavel_abertura_nome: dados.responsavelAberturaNome?.trim() || usuario?.nome || null,
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
      obra_id: obraId || null,
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
      descricao_livre: descricaoResumo,
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