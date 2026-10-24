import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant, type UsuarioTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { usuarioPodeAcaoServer } from '@/lib/acessoUsuarioServer'
import { assinaturaListaSeparacao, conferirPacoteDaPeca, pecaAprovadaParaSeparacao, podeConcluirSeparacao } from '@/lib/producaoSeparacaoRegras'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const respostaErro = (error: string, status = 400) => NextResponse.json({ error }, { status })

async function acesso(req: NextRequest, editar: boolean) {
  const usuario = await autenticarTenant(req)
  if (!usuario) return null
  const permitido = await usuarioPodeAcaoServer({
    usuarioId: usuario.id, role: usuario.role, empresaId: usuario.empresa_id,
    setorId: 'producao',
    acaoId: editar ? 'producao.separacao.editar' : 'producao.separacao.consultar',
    minimo: editar ? 'edicao' : 'consulta',
  })
  return permitido ? usuario : null
}

async function listar(usuario: UsuarioTenant, medicaoId?: string) {
  let consulta = supabaseAdmin.from('medicoes_finais')
    .select('id,orcamento_id,cliente_id,cliente_nome,obra_id,created_at')
    .eq('empresa_id', usuario.empresa_id).eq('tipo_medicao', 'tipologia')
    .order('created_at', { ascending: false }).limit(300)
  if (medicaoId) consulta = consulta.eq('id', medicaoId)
  const { data: medicoes, error: erroMedicoes } = await consulta
  if (erroMedicoes) throw erroMedicoes
  if (!medicoes?.length) return []
  const { data: itens, error: erroItens } = await supabaseAdmin.from('medicao_itens')
    .select('id,medicao_id,ordem,descricao,ambiente,tipo_esquadria,medido,status_medicao,quantidade,producao_largura_mm,producao_altura_mm,largura_baixo_mm,largura_meio_mm,largura_cima_mm,altura_direita_mm,altura_meio_mm,altura_esquerda_mm')
    .eq('empresa_id', usuario.empresa_id).in('medicao_id', medicoes.map(m => m.id))
    .eq('status_medicao', 'aprovada').eq('medido', true)
    .order('ordem').limit(2000)
  if (erroItens) throw erroItens
  const aprovadas = (itens || []).filter(pecaAprovadaParaSeparacao)
  if (!aprovadas.length) return []
  const orcIds = [...new Set(medicoes.map(m => m.orcamento_id).filter((v): v is string => Boolean(v)))]
  const { data: pacotes, error: erroPacotes } = orcIds.length
    ? await supabaseAdmin.from('pacotes_tecnicos')
        .select('id,orcamento_id,snapshot_itens,status,created_at')
        .eq('empresa_id', usuario.empresa_id).in('orcamento_id', orcIds)
        .eq('origem', 'medicao_final').neq('status', 'substituido')
        .order('created_at', { ascending: false }).limit(300)
    : { data: [], error: null }
  if (erroPacotes) throw erroPacotes
  const pacoteIds = (pacotes || []).map(p => p.id)
  const [mat, sep, historico] = await Promise.all([
    pacoteIds.length ? supabaseAdmin.from('pacote_tecnico_materiais')
      .select('id,pacote_id,item_ref,medicao_item_id,status_calculo,produto_id,categoria,codigo,descricao,cor_ref,unidade,quantidade_tecnica,quantidade_ajustada,excluido')
      .eq('empresa_id', usuario.empresa_id).in('pacote_id', pacoteIds).eq('excluido', false).limit(5000)
      : Promise.resolve({ data: [], error: null }),
    supabaseAdmin.from('producao_separacao_itens')
      .select('medicao_item_id,status,motivo,materiais_conferidos,pacote_id,assinatura_lista,atualizado_por_nome,updated_at')
      .eq('empresa_id', usuario.empresa_id)
      .in('medicao_item_id', aprovadas.map(i => i.id)).limit(2000),
    supabaseAdmin.from('producao_separacao_historico')
      .select('medicao_item_id,status,motivo,usuario_nome,created_at')
      .eq('empresa_id', usuario.empresa_id)
      .in('medicao_item_id', aprovadas.map(i => i.id))
      .order('created_at', { ascending: false }).limit(2000),
  ])
  if (mat.error || sep.error || historico.error) throw (mat.error || sep.error || historico.error)
  const mapa = new Map(medicoes.map(m => [m.id, m]))
  const mapaSeparacao = new Map((sep.data || []).map(s => [s.medicao_item_id, s]))
  const minimo = (...valores: unknown[]) => {
    const positivos = valores.map(Number).filter(n => Number.isFinite(n) && n > 0)
    return positivos.length ? Math.min(...positivos) : null
  }
  return aprovadas.map(item => {
    const medicao = mapa.get(item.medicao_id)!
    // A peça é identificada pela medição, nunca só por nome ou ordem no orçamento.
    const pacote = (pacotes || []).find(p => p.orcamento_id === medicao.orcamento_id
      && Array.isArray(p.snapshot_itens)
      && p.snapshot_itens.some((i: any) => i?.medicao_final?.medicao_item_id === item.id))
    const conferencia = pacote
      ? conferirPacoteDaPeca(item.id, pacote.snapshot_itens,
          (mat.data || []).filter(m => m.pacote_id === pacote.id))
      : { disponivel: false, motivo: 'Pacote técnico individual ainda não foi gerado para esta peça.', materiais: [] }
    const registro = mapaSeparacao.get(item.id)
    const idsConferidos = Array.isArray(registro?.materiais_conferidos) ? registro.materiais_conferidos as string[] : []
    const assinaturaAtual = assinaturaListaSeparacao(pacote?.id || '', conferencia.materiais)
    const mudouPacote = registro?.status === 'separado' &&
      (!podeConcluirSeparacao(conferencia.materiais, idsConferidos, conferencia.disponivel)
        || registro.pacote_id !== pacote?.id || registro.assinatura_lista !== assinaturaAtual)
    return {
      id: item.id, medicaoId: medicao.id, clienteNome: medicao.cliente_nome,
      clienteId: medicao.cliente_id, obraId: medicao.obra_id,
      descricao: item.descricao || item.tipo_esquadria || 'Peça sem descrição',
      ambiente: item.ambiente || '', ordem: item.ordem,
      larguraMm: minimo(item.producao_largura_mm) || minimo(item.largura_baixo_mm, item.largura_meio_mm, item.largura_cima_mm),
      alturaMm: minimo(item.producao_altura_mm) || minimo(item.altura_direita_mm, item.altura_meio_mm, item.altura_esquerda_mm),
      pacoteId: pacote?.id || null, assinaturaAtual, listaDisponivel: conferencia.disponivel,
      motivoListaIndisponivel: conferencia.motivo,
      materiais: conferencia.materiais.map(m => ({
        id: m.id, categoria: m.categoria, codigo: m.codigo,
        descricao: (m as any).descricao, cor: (m as any).cor_ref,
        unidade: (m as any).unidade, quantidade: m.quantidade_ajustada ?? m.quantidade_tecnica,
      })),
      status: mudouPacote ? 'pendente' : registro?.status || 'aguardando',
      motivo: mudouPacote ? 'Lista técnica alterada ou incompleta. Revalidar a separação antes de continuar.' : registro?.motivo || '',
      materiaisConferidos: idsConferidos,
      historico: (historico.data || []).filter(h => h.medicao_item_id === item.id).slice(0, 8),
      atualizadoPor: registro?.atualizado_por_nome || null, atualizadoEm: registro?.updated_at || null,
    }
  })
}

export async function GET(req: NextRequest) {
  const usuario = await acesso(req, false)
  if (!usuario) return respostaErro('Sem permissão para consultar a Separação de Materiais.', 403)
  const medicaoId = req.nextUrl.searchParams.get('medicao') || undefined
  if (medicaoId && !UUID.test(medicaoId)) return respostaErro('Medição inválida.')
  try {
    return NextResponse.json({ ok: true, itens: await listar(usuario, medicaoId) })
  } catch (e) {
    console.error('[Produção/Separação] Falha na leitura:', e)
    return respostaErro('Falha ao carregar separação; verificar se a migração foi aplicada.', 500)
  }
}

export async function POST(req: NextRequest) {
  const usuario = await acesso(req, true)
  if (!usuario) return respostaErro('Sem permissão para editar a Separação de Materiais.', 403)
  try {
    const body = await req.json().catch(() => ({}))
    const id = String(body?.medicaoItemId || '')
    const status = String(body?.status || '')
    const motivo = String(body?.motivo || '').trim()
    const ids = body?.materiaisConferidos
    if (!UUID.test(id) || !['aguardando', 'pendente', 'separado'].includes(status)) return respostaErro('Peça ou situação inválida.')
    if (!Array.isArray(ids) || ids.length > 1000 || !ids.every((v: unknown) => typeof v === 'string' && UUID.test(v))) return respostaErro('Materiais conferidos inválidos.')
    if (motivo.length > 1000 || (status === 'pendente' && motivo.length < 5)) return respostaErro('Informe um motivo da pendência com pelo menos cinco caracteres.')
    const { data: item, error } = await supabaseAdmin.from('medicao_itens')
      .select('id,medicao_id,medido,status_medicao,quantidade')
      .eq('empresa_id', usuario.empresa_id).eq('id', id).maybeSingle()
    if (error || !item) return respostaErro('Peça não localizada nesta empresa.', 404)
    if (!pecaAprovadaParaSeparacao(item)) return respostaErro('A peça precisa estar medida e aprovada individualmente.', 409)
    const pecas = await listar(usuario, item.medicao_id)
    const peca = pecas.find(p => p.id === id)
    if (!peca) return respostaErro('Peça não está mais disponível.', 409)
    const idsValidos = new Set(peca.materiais.map(m => m.id))
    if (ids.some((v: string) => !idsValidos.has(v))) return respostaErro('Há material de outra peça ou de um pacote substituído.', 409)
    if (status === 'separado' && !podeConcluirSeparacao(
      peca.materiais.map(m => ({ id: m.id })), ids, peca.listaDisponivel
    )) return respostaErro('Não é possível concluir: faltam itens ou pacote técnico individual.', 409)
    const { error: erroGravacao } = await supabaseAdmin.from('producao_separacao_itens').upsert({
      empresa_id: usuario.empresa_id, medicao_item_id: id, status,
      pacote_id: peca.pacoteId, assinatura_lista: peca.assinaturaAtual,
      motivo: motivo || null, materiais_conferidos: [...new Set(ids)],
      atualizado_por_id: usuario.id, atualizado_por_nome: usuario.nome,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'medicao_item_id' })
    if (erroGravacao) throw erroGravacao
    return NextResponse.json({ ok: true, mensagem: status === 'separado'
      ? 'Conferência concluída. Esta etapa ainda não movimenta estoque nem libera a ordem de produção.'
      : status === 'pendente' ? 'Pendência registrada somente para esta peça.' : 'Conferência salva.' })
  } catch (e) {
    console.error('[Produção/Separação] Falha na gravação:', e)
    return respostaErro('Não foi possível salvar a separação.', 500)
  }
}
