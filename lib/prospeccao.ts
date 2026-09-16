import { usuarioAtual } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import type { Cliente, Usuario } from '@/lib/tipos'

export type StatusProspeccao =
  | 'nova'
  | 'tentando_contato'
  | 'contato_realizado'
  | 'aguardando_retorno'
  | 'aguardando_projeto'
  | 'visita_agendada'
  | 'oportunidade_qualificada'
  | 'convertido'
  | 'sem_interesse'

export type TipoInteracaoProspeccao = 'visita' | 'ligacao' | 'whatsapp' | 'nota' | 'status' | 'agenda' | 'conversao' | 'outro'
export type PapelContatoProspeccao = 'cliente' | 'pedreiro' | 'mestre_obra' | 'arquiteto' | 'engenheiro' | 'construtora' | 'outro'

export const STATUS_PROSPECCAO: { id: StatusProspeccao; label: string; cor: string }[] = [
  { id: 'nova', label: 'Nova obra', cor: 'bg-blue-500' },
  { id: 'tentando_contato', label: 'Tentando contato', cor: 'bg-sky-500' },
  { id: 'contato_realizado', label: 'Contato realizado', cor: 'bg-cyan-500' },
  { id: 'aguardando_retorno', label: 'Aguardando retorno', cor: 'bg-amber-500' },
  { id: 'aguardando_projeto', label: 'Aguardando projeto', cor: 'bg-orange-500' },
  { id: 'visita_agendada', label: 'Visita agendada', cor: 'bg-violet-500' },
  { id: 'oportunidade_qualificada', label: 'Oportunidade qualificada', cor: 'bg-emerald-500' },
  { id: 'convertido', label: 'Convertido', cor: 'bg-green-700' },
  { id: 'sem_interesse', label: 'Sem interesse', cor: 'bg-slate-400' },
]

export const PAPEIS_CONTATO: { id: PapelContatoProspeccao; label: string }[] = [
  { id: 'cliente', label: 'Cliente / proprietário' },
  { id: 'pedreiro', label: 'Pedreiro' },
  { id: 'mestre_obra', label: 'Mestre de obras' },
  { id: 'arquiteto', label: 'Arquiteto' },
  { id: 'engenheiro', label: 'Engenheiro' },
  { id: 'construtora', label: 'Construtora' },
  { id: 'outro', label: 'Outro' },
]

export interface Prospeccao {
  id: string
  nome_cliente: string
  telefone?: string | null
  nome_obra?: string | null
  cidade?: string | null
  bairro?: string | null
  endereco?: string | null
  complemento?: string | null
  latitude?: number | null
  longitude?: number | null
  precisao_m?: number | null
  localizacao_capturada_em?: string | null
  fase_obra?: string | null
  interesses: string[]
  temperatura: 'frio' | 'morno' | 'quente'
  status: StatusProspeccao
  observacoes?: string | null
  responsavel_id: string
  responsavel_nome: string
  proxima_acao?: string | null
  proxima_acao_em?: string | null
  agenda_evento_id?: string | null
  cliente_id?: string | null
  obra_id?: string | null
  convertido_em?: string | null
  status_atualizado_em: string
  created_at: string
  updated_at: string
}

export interface ContatoProspeccao {
  id: string
  prospeccao_id: string
  papel: PapelContatoProspeccao
  nome: string
  telefone?: string | null
  empresa?: string | null
  observacoes?: string | null
  created_at: string
}

export interface InteracaoProspeccao {
  id: string
  prospeccao_id: string
  tipo: TipoInteracaoProspeccao
  descricao: string
  status_anterior?: string | null
  status_novo?: string | null
  proxima_acao?: string | null
  proxima_acao_em?: string | null
  usuario_id: string
  usuario_nome: string
  created_at: string
}

export interface NovaProspeccao {
  nome_cliente: string
  telefone?: string
  nome_obra?: string
  cidade?: string
  bairro?: string
  endereco?: string
  complemento?: string
  latitude?: number | null
  longitude?: number | null
  precisao_m?: number | null
  fase_obra?: string
  interesses?: string[]
  temperatura?: 'frio' | 'morno' | 'quente'
  observacoes?: string
  proxima_acao?: string
  proxima_acao_em?: string
  contatos?: Array<{ papel: PapelContatoProspeccao; nome: string; telefone?: string; empresa?: string }>
}

function textoOuNulo(valor?: string | null) {
  return valor?.trim() || null
}

export async function listarProspeccoes(): Promise<Prospeccao[]> {
  const { data, error } = await supabase.from('prospeccoes').select('*').order('status_atualizado_em', { ascending: false })
  if (error) { console.error('Erro ao listar prospecções', error); return [] }
  return (data || []) as Prospeccao[]
}

export async function listarEquipeProspeccao(): Promise<Pick<Usuario, 'id' | 'nome'>[]> {
  const { data } = await supabase.from('usuarios').select('id,nome').order('nome')
  return (data || []) as Pick<Usuario, 'id' | 'nome'>[]
}

export async function criarProspeccao(dados: NovaProspeccao): Promise<{ ok: boolean; id?: string; error?: string }> {
  const usuario = await usuarioAtual()
  if (!usuario) return { ok: false, error: 'Sessão expirada. Entre novamente.' }
  if (!dados.nome_cliente.trim()) return { ok: false, error: 'Informe o nome do cliente ou uma identificação da obra.' }

  const { data, error } = await supabase.from('prospeccoes').insert({
    nome_cliente: dados.nome_cliente.trim(),
    telefone: textoOuNulo(dados.telefone),
    nome_obra: textoOuNulo(dados.nome_obra),
    cidade: textoOuNulo(dados.cidade),
    bairro: textoOuNulo(dados.bairro),
    endereco: textoOuNulo(dados.endereco),
    complemento: textoOuNulo(dados.complemento),
    latitude: dados.latitude ?? null,
    longitude: dados.longitude ?? null,
    precisao_m: dados.precisao_m ?? null,
    localizacao_capturada_em: dados.latitude != null && dados.longitude != null ? new Date().toISOString() : null,
    fase_obra: textoOuNulo(dados.fase_obra),
    interesses: dados.interesses || [],
    temperatura: dados.temperatura || 'frio',
    observacoes: textoOuNulo(dados.observacoes),
    responsavel_id: usuario.id,
    responsavel_nome: usuario.nome,
    proxima_acao: textoOuNulo(dados.proxima_acao),
    proxima_acao_em: dados.proxima_acao_em || null,
  }).select('id').single()
  if (error || !data) return { ok: false, error: error?.message || 'Não foi possível criar a prospecção.' }

  const contatos = (dados.contatos || []).filter(c => c.nome.trim()).map(c => ({
    prospeccao_id: data.id,
    papel: c.papel,
    nome: c.nome.trim(),
    telefone: textoOuNulo(c.telefone),
    empresa: textoOuNulo(c.empresa),
  }))
  await Promise.all([
    supabase.from('prospeccao_interacoes').insert({
      prospeccao_id: data.id,
      tipo: 'visita',
      descricao: 'Prospecção registrada em campo.',
      proxima_acao: textoOuNulo(dados.proxima_acao),
      proxima_acao_em: dados.proxima_acao_em || null,
      usuario_id: usuario.id,
      usuario_nome: usuario.nome,
    }),
    contatos.length ? supabase.from('prospeccao_contatos').insert(contatos) : Promise.resolve({ error: null }),
  ])

  if (dados.proxima_acao_em && dados.proxima_acao?.trim()) {
    await sincronizarAgenda(data.id, usuario, dados.nome_cliente, dados.proxima_acao, dados.proxima_acao_em, dados.endereco)
  }
  return { ok: true, id: data.id }
}

export async function buscarProspeccao(id: string): Promise<{ prospeccao: Prospeccao | null; contatos: ContatoProspeccao[]; interacoes: InteracaoProspeccao[] }> {
  const [p, c, i] = await Promise.all([
    supabase.from('prospeccoes').select('*').eq('id', id).maybeSingle(),
    supabase.from('prospeccao_contatos').select('*').eq('prospeccao_id', id).order('created_at'),
    supabase.from('prospeccao_interacoes').select('*').eq('prospeccao_id', id).order('created_at', { ascending: false }),
  ])
  return { prospeccao: (p.data as Prospeccao) || null, contatos: (c.data || []) as ContatoProspeccao[], interacoes: (i.data || []) as InteracaoProspeccao[] }
}

export async function atualizarProspeccao(id: string, patch: Partial<NovaProspeccao & { responsavel_id: string; responsavel_nome: string }>) {
  const payload: Record<string, unknown> = { ...patch }
  delete payload.contatos
  Object.keys(payload).forEach(chave => { if (typeof payload[chave] === 'string' && chave !== 'proxima_acao_em') payload[chave] = textoOuNulo(payload[chave] as string) })
  const { error } = await supabase.from('prospeccoes').update(payload).eq('id', id)
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function adicionarContato(prospeccaoId: string, contato: Omit<ContatoProspeccao, 'id' | 'prospeccao_id' | 'created_at'>) {
  const { error } = await supabase.from('prospeccao_contatos').insert({ ...contato, prospeccao_id: prospeccaoId, nome: contato.nome.trim(), telefone: textoOuNulo(contato.telefone), empresa: textoOuNulo(contato.empresa), observacoes: textoOuNulo(contato.observacoes) })
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function moverProspeccao(prospeccao: Prospeccao, novoStatus: StatusProspeccao) {
  if (prospeccao.status === novoStatus) return { ok: true }
  const usuario = await usuarioAtual()
  if (!usuario) return { ok: false, error: 'Sessão expirada.' }
  const { error } = await supabase.from('prospeccoes').update({ status: novoStatus, status_atualizado_em: new Date().toISOString() }).eq('id', prospeccao.id)
  if (error) return { ok: false, error: error.message }
  await supabase.from('prospeccao_interacoes').insert({ prospeccao_id: prospeccao.id, tipo: 'status', descricao: `Etapa alterada para ${STATUS_PROSPECCAO.find(s => s.id === novoStatus)?.label || novoStatus}.`, status_anterior: prospeccao.status, status_novo: novoStatus, usuario_id: usuario.id, usuario_nome: usuario.nome })
  return { ok: true }
}

export async function registrarInteracao(prospeccao: Prospeccao, dados: { tipo: TipoInteracaoProspeccao; descricao: string; proxima_acao?: string; proxima_acao_em?: string; status_novo?: StatusProspeccao }) {
  const usuario = await usuarioAtual()
  if (!usuario) return { ok: false, error: 'Sessão expirada.' }
  if (!dados.descricao.trim()) return { ok: false, error: 'Descreva o que aconteceu no contato.' }
  const { error } = await supabase.from('prospeccao_interacoes').insert({
    prospeccao_id: prospeccao.id,
    tipo: dados.tipo,
    descricao: dados.descricao.trim(),
    status_anterior: dados.status_novo ? prospeccao.status : null,
    status_novo: dados.status_novo || null,
    proxima_acao: textoOuNulo(dados.proxima_acao),
    proxima_acao_em: dados.proxima_acao_em || null,
    usuario_id: usuario.id,
    usuario_nome: usuario.nome,
  })
  if (error) return { ok: false, error: error.message }

  const patch: Record<string, unknown> = {}
  if (dados.status_novo) { patch.status = dados.status_novo; patch.status_atualizado_em = new Date().toISOString() }
  if (dados.proxima_acao?.trim() || dados.proxima_acao_em) {
    patch.proxima_acao = textoOuNulo(dados.proxima_acao)
    patch.proxima_acao_em = dados.proxima_acao_em || null
  }
  if (Object.keys(patch).length) await supabase.from('prospeccoes').update(patch).eq('id', prospeccao.id)
  if (dados.proxima_acao_em && dados.proxima_acao?.trim()) await sincronizarAgenda(prospeccao.id, usuario, prospeccao.nome_cliente, dados.proxima_acao, dados.proxima_acao_em, prospeccao.endereco, prospeccao.agenda_evento_id)
  return { ok: true }
}

async function sincronizarAgenda(prospeccaoId: string, usuario: Usuario, nomeCliente: string, acao: string, inicioIso: string, endereco?: string | null, eventoId?: string | null) {
  const inicio = new Date(inicioIso)
  const fim = new Date(inicio.getTime() + 30 * 60 * 1000)
  const evento = { usuario_id: usuario.id, titulo: `Prospecção · ${nomeCliente}`, descricao: `${acao}\n/prospeccao/${prospeccaoId}`, local: textoOuNulo(endereco), data_inicio: inicio.toISOString(), data_fim: fim.toISOString() }
  if (eventoId) {
    const { error } = await supabase.from('eventos').update(evento).eq('id', eventoId)
    if (!error) return
  }
  const { data } = await supabase.from('eventos').insert(evento).select('id').single()
  if (data?.id) await supabase.from('prospeccoes').update({ agenda_evento_id: data.id }).eq('id', prospeccaoId)
}

export async function buscarClientesSemelhantes(nome: string, telefone?: string | null): Promise<Cliente[]> {
  const digitos = (telefone || '').replace(/\D/g, '')
  const { data } = await supabase.from('clientes').select('*').order('created_at', { ascending: false }).limit(500)
  const termo = nome.trim().toLocaleLowerCase('pt-BR')
  return ((data || []) as Cliente[]).filter(c => {
    const mesmoTelefone = digitos.length >= 8 && `${c.whatsapp || ''}${c.telefone || ''}`.replace(/\D/g, '').includes(digitos)
    const mesmoNome = termo.length >= 3 && c.nome.toLocaleLowerCase('pt-BR').includes(termo)
    return mesmoTelefone || mesmoNome
  }).slice(0, 8)
}

export async function converterProspeccao(id: string, clienteExistenteId: string | null, criarObra: boolean) {
  const { data, error } = await supabase.rpc('fn_converter_prospeccao_v1', { p_prospeccao_id: id, p_cliente_existente_id: clienteExistenteId, p_criar_obra: criarObra })
  if (error) return { ok: false, error: error.message }
  return { ok: true, clienteId: data?.cliente_id as string, obraId: (data?.obra_id as string | null) || null }
}
