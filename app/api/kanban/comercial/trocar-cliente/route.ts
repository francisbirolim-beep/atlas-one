import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import { supabaseAdmin as db } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const mensagem = (error: string, status = 400) => NextResponse.json(
  { error }, { status, headers: { 'Cache-Control': 'no-store' } },
)
const uuid = (v: unknown): v is string => typeof v === 'string' &&
  /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(v)
const txt = (v: unknown) => typeof v === 'string' ? v.trim() : ''

type Identidade = { id: string; nome: string; whatsapp?: string | null; telefone?: string | null; cidade?: string | null; ativo?: boolean | null }
type ObraAlvo = { id: string; nome: string; cliente_id: string; endereco: string | null; numero_endereco: string | null; bairro: string | null; cidade: string | null; uf: string | null; cep: string | null; observacoes: string | null }

const tabelasDependentes = [
  'financeiro_contas_receber', 'ordens_producao', 'vendas_obras',
  'venda_instalacao_itens', 'medicoes_finais', 'setor_kanban_itens',
  'pacotes_tecnicos', 'planos_corte', 'crm_interacoes', 'crm_tarefas',
] as const

async function bloqueios(empresaId: string, card: any) {
  const motivos: string[] = []
  if (card.eh_assistencia || card.assistencia_id) motivos.push('Este card pertence a uma assistência técnica.')
  if (card.orcamento_finalizado_em || card.status === 'convertido' || card.status === 'aprovado') {
    motivos.push('Este orçamento já foi finalizado, convertido ou aprovado.')
  }
  const w = card.wvetro_fluxo && typeof card.wvetro_fluxo === 'object' ? card.wvetro_fluxo : {}
  if (w.numero || w.numero_wvetro) {
    motivos.push('Este orçamento já tem número W.Vetro; a mudança de cliente deve ser revisada pela reconciliação.')
  }
  const consultas = await Promise.all(tabelasDependentes.map(async tabela => {
    const r = await db.from(tabela).select('id', { count: 'exact', head: true })
      .eq('empresa_id', empresaId).eq('orcamento_id', card.id)
    if (r.error) throw r.error
    return { tabela, count: r.count || 0 }
  }))
  const dependencias = consultas.filter(x => x.count > 0)
  if (dependencias.length) {
    motivos.push('O orçamento possui registros vinculados em outros módulos (' +
      dependencias.map(x => x.tabela.replace(/_/g, ' ')).join(', ') +
      '). Para não deixar referências em clientes diferentes, a troca automática foi bloqueada.')
  }
  return motivos
}

async function contexto(empresaId: string, cardId: string, clienteId: string) {
  const [c, destino] = await Promise.all([
    db.from('orcamentos').select('*')
      .eq('empresa_id', empresaId).eq('id', cardId).maybeSingle(),
    db.from('clientes').select('id,nome,whatsapp,telefone,cidade,ativo')
      .eq('empresa_id', empresaId).eq('id', clienteId).maybeSingle(),
  ])
  if (c.error) throw c.error
  if (destino.error) throw destino.error
  const card = c.data
  const cliente = destino.data as Identidade | null
  if (!card || !cliente) return { card, cliente, origem: null, obras: [] as ObraAlvo[], obraAnterior: null, motivos: ['Card ou cliente não encontrado.'] }
  const origemResponse = card.cliente_id
    ? await db.from('clientes').select('id,nome,ativo')
      .eq('empresa_id', empresaId).eq('id', card.cliente_id).maybeSingle()
    : {data:null,error:null}
  if (origemResponse.error) throw origemResponse.error
  const origem = origemResponse.data as {id:string;nome:string;ativo:boolean|null} | null
  const [obras, anterior, motivos] = await Promise.all([
    db.from('obras').select('id,nome,cliente_id,endereco,numero_endereco,bairro,cidade,uf,cep,observacoes')
      .eq('empresa_id', empresaId).eq('cliente_id', clienteId)
      .order('nome').limit(80),
    card.obra_id
      ? db.from('obras').select('id,nome,cliente_id')
        .eq('empresa_id', empresaId).eq('id', card.obra_id).maybeSingle()
      : Promise.resolve({data:null,error:null}),
    bloqueios(empresaId,card),
  ])
  if (obras.error) throw obras.error
  if (anterior.error) throw anterior.error
  const erros = [...motivos]
  if (cliente.ativo === false) erros.push('O cadastro selecionado está inativo.')
  if (card.cliente_id === cliente.id) erros.push('Este card já está vinculado ao cliente selecionado.')
  if (!card.cliente_id || !origem) erros.push('O cadastro original do card não pôde ser confirmado.')
  return {
    card, cliente, origem, obras: (obras.data || []) as ObraAlvo[],
    obraAnterior: anterior.data, motivos: erros,
  }
}

export async function GET(req: NextRequest) {
  const u = await autenticarTenant(req)
  if (!u) return mensagem('Sessão inválida.', 401)
  // Troca de titularidade exige Master; edição comum não delega este privilégio.
  if (u.role !== 'master') return mensagem('Somente o Master pode trocar o cliente de um card.', 403)
  try {
    const q = txt(req.nextUrl.searchParams.get('busca')).slice(0, 80)
    if (q) {
      if (q.length < 2) return mensagem('Informe pelo menos dois caracteres.')
      const termo = q.replace(/[\\%_]/g, '\\$&')
      const r = await db.from('clientes')
        .select('id,nome,cidade,whatsapp,telefone,ativo')
        .eq('empresa_id', u.empresa_id).eq('ativo', true)
        .ilike('nome', '%' + termo + '%').order('nome').limit(35)
      if (r.error) throw r.error
      return NextResponse.json({ clientes: r.data || [] }, { headers: { 'Cache-Control': 'no-store' } })
    }
    const cardId = txt(req.nextUrl.searchParams.get('cardId'))
    const clienteId = txt(req.nextUrl.searchParams.get('clienteId'))
    if (!uuid(cardId) || !uuid(clienteId)) return mensagem('Selecione um cliente válido para conferir a troca.')
    const p = await contexto(u.empresa_id, cardId, clienteId)
    if (!p.card || !p.cliente) return mensagem('Card ou cliente não encontrado nesta empresa.', 404)
    return NextResponse.json({
      cardId, atualizadoEm: p.card.updated_at,
      clienteAnterior: { id: p.origem?.id || p.card.cliente_id, nome: p.origem?.nome || p.card.cliente_nome },
      nomeExibidoNoCard: p.card.cliente_nome,
      clienteNovo: p.cliente, obraAnterior: p.obraAnterior,
      obrasDestino: p.obras, motivosBloqueio: p.motivos,
      whatsappAtual: p.card.cliente_whatsapp || null,
      novoWhatsapp: p.cliente.whatsapp || p.cliente.telefone || p.card.cliente_whatsapp || null,
      mudaSomenteCadastro: true,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('[Kanban trocar cliente] falha na consulta', e)
    return mensagem('Não foi possível conferir os cadastros; nenhuma alteração foi feita.', 503)
  }
}

export async function POST(req: NextRequest) {
  const u = await autenticarTenant(req)
  if (!u) return mensagem('Sessão inválida.', 401)
  if (u.role !== 'master') return mensagem('Somente o Master pode trocar o cliente de um card.', 403)
  const b = await req.json().catch(() => ({}))
  const cardId = txt(b.cardId), clienteId = txt(b.clienteId)
  const origemId = txt(b.clienteOrigemId), atualizadoEm = txt(b.atualizadoEm)
  const obraId = b.novaObraId === null ? null : txt(b.novaObraId)
  const motivo = txt(b.motivo)
  if (!uuid(cardId) || !uuid(clienteId) || !uuid(origemId) ||
      !atualizadoEm || !(obraId === null || uuid(obraId)) ||
      motivo.length < 8 || motivo.length > 500 || b.confirmou !== true) {
    return mensagem('Confira cliente, obra e justificativa (8 a 500 caracteres) antes de confirmar.')
  }
  try {
    const p = await contexto(u.empresa_id, cardId, clienteId)
    if (!p.card || !p.cliente) return mensagem('Card ou cliente não encontrado.', 404)
    if (p.motivos.length) return mensagem(p.motivos.join(' '), 409)
    if (p.card.cliente_id !== origemId || String(p.card.updated_at || '') !== atualizadoEm) {
      return mensagem('O card mudou após a conferência. Reabra a prévia antes de trocar o cliente.', 409)
    }
    if (obraId && !p.obras.some(obra => obra.id === obraId)) {
      return mensagem('A obra escolhida não pertence ao novo cliente. Nada foi alterado.', 409)
    }
    if (p.card.obra_id && p.obraAnterior?.cliente_id !== origemId) {
      return mensagem('A obra atual já possui outro titular. A troca requer revisão manual.', 409)
    }
    const novoWhatsapp = p.cliente.whatsapp || p.cliente.telefone || p.card.cliente_whatsapp || null
    const agora = new Date().toISOString()
    const r = await db.from('orcamentos').update({
      cliente_id: clienteId,
      cliente_nome: p.cliente.nome,
      cliente_whatsapp: novoWhatsapp,
      obra_id: obraId,
      updated_at: agora,
    })
      .eq('empresa_id', u.empresa_id).eq('id', cardId)
      .eq('cliente_id', origemId).eq('updated_at', atualizadoEm)
      .select('*').maybeSingle()
    if (r.error) throw r.error
    if (!r.data) return mensagem('Outro usuário alterou o card. Nenhuma troca foi aplicada.', 409)

    // Nenhuma informação técnica, financeira ou anexo é regravado.
    const historico = await db.from('historico').insert({
      orcamento_id: cardId,
      usuario_id: u.id,
      usuario_nome: u.nome || 'Master',
      acao: 'Corrigiu cliente vinculado ao orçamento no Kanban Comercial',
      detalhes: [
        'Cadastro anterior: ' + (p.origem?.nome || p.card.cliente_nome) + ' (' + origemId + ')',
        'Cadastro correto: ' + p.cliente.nome + ' (' + clienteId + ')',
        'Obra anterior: ' + (p.obraAnterior?.nome || 'sem obra'),
        'Obra selecionada: ' + (p.obras.find(o => o.id === obraId)?.nome || 'sem obra vinculada'),
        'Justificativa: ' + motivo,
      ].join(' | '),
    })
    if (historico.error) console.error('[Kanban trocar cliente] card alterado, mas histórico falhou', historico.error)
    return NextResponse.json({
      ok: true,
      orcamento: r.data,
      obra: p.obras.find(o => o.id === obraId) || null,
      clienteNovo: { id: p.cliente.id, nome: p.cliente.nome },
      aviso: historico.error
        ? 'Cliente alterado. Não foi possível gravar o histórico desta ação; avise o administrador.'
        : 'Cliente vinculado corrigido. Orçamento, fotos, medidas, anexos e valores preservados.',
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('[Kanban trocar cliente] falha ao confirmar', e)
    return mensagem('Falha ao trocar cliente. Confira o card antes de repetir a operação.', 503)
  }
}