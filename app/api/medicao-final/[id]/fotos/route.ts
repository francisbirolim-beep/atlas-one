import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function autorizar(req: NextRequest, medicaoId: string, editar: boolean) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer /, '')
  const { data: auth, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !auth.user) return null
  const { data: usuario } = await supabaseAdmin.from('usuarios').select('id,nome,role,empresa_id').eq('id', auth.user.id).maybeSingle()
  if (!usuario?.empresa_id) return null
  const { data: medicao } = await supabaseAdmin.from('medicoes_finais').select('id,status_operacional').eq('id', medicaoId).eq('empresa_id', usuario.empresa_id).maybeSingle()
  if (!medicao) return null
  if (usuario.role !== 'master') {
    const { data: setor } = await supabaseAdmin.from('setores').select('id').eq('rota', '/producao/medicao-final').eq('ativo', true).maybeSingle()
    if (!setor) return null
    const { data: permissao } = await supabaseAdmin.from('permissoes').select('nivel').eq('usuario_id', usuario.id).eq('setor_id', setor.id).maybeSingle()
    if (!permissao || (editar ? permissao.nivel !== 'edicao' : !['consulta', 'edicao'].includes(permissao.nivel))) return null
  }
  return { usuario, medicao }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'Medição inválida.' }, { status: 400 })
  const acesso = await autorizar(req, params.id, false)
  if (!acesso) return NextResponse.json({ error: 'Sem acesso à medição.' }, { status: 403 })
  const { data, error } = await supabaseAdmin.from('medicao_revisoes')
    .select('id,snapshot,criado_por_nome,created_at').eq('medicao_id', params.id)
    .eq('empresa_id', acesso.usuario.empresa_id).eq('motivo', 'Correção de foto')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'Não foi possível carregar o histórico.' }, { status: 500 })
  return NextResponse.json({ historico: data || [] })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'Medição inválida.' }, { status: 400 })
  const acesso = await autorizar(req, params.id, true)
  if (!acesso) return NextResponse.json({ error: 'Sem permissão para corrigir fotos desta medição.' }, { status: 403 })
  if (['concluido', 'aprovado'].includes(acesso.medicao.status_operacional)) return NextResponse.json({ error: 'Reabra a medição antes de corrigir fotos.' }, { status: 409 })
  const body = await req.json().catch(() => null)
  if (!body || !UUID.test(body.itemId || '') || !['larguras', 'alturas', 'galeria'].includes(body.tipo) || typeof body.url !== 'string' || typeof body.motivo !== 'string' || body.motivo.trim().length < 3 || body.motivo.length > 500 || (body.tipo === 'galeria' && !UUID.test(body.fotoId || ''))) {
    return NextResponse.json({ error: 'Informe a foto, a peça e um motivo entre 3 e 500 caracteres.' }, { status: 400 })
  }
  const { usuario } = acesso
  const { data: item } = await supabaseAdmin.from('medicao_itens').select('*').eq('id', body.itemId).eq('medicao_id', params.id).eq('empresa_id', usuario.empresa_id).maybeSingle()
  if (!item) return NextResponse.json({ error: 'Peça não encontrada.' }, { status: 404 })
  const campo = body.tipo === 'larguras' ? 'foto_larguras_url' : 'foto_alturas_url'
  let foto = null
  if (body.tipo === 'galeria') {
    const resposta = await supabaseAdmin.from('medicao_fotos').select('*').eq('id', body.fotoId).eq('item_id', item.id).eq('medicao_id', params.id).eq('empresa_id', usuario.empresa_id).maybeSingle()
    foto = resposta.data
    if (!foto) return NextResponse.json({ error: 'Foto não encontrada.' }, { status: 404 })
    if (foto.categoria.startsWith('checklist:')) return NextResponse.json({ error: 'Esta foto está vinculada a uma resposta do checklist e não pode ser removida pela galeria.' }, { status: 409 })
  }
  if ((foto?.url || item[campo]) !== body.url) return NextResponse.json({ error: 'A foto mudou. Atualize a tela antes de excluir.' }, { status: 409 })

  // Fail closed: retain the original photo and verified actor BEFORE detaching it.
  // No Storage deletion: the original remains available in the correction history.
  const snapshot = { evento: 'correcao_foto', resultado: 'solicitada', item_id: item.id, descricao: item.descricao || item.tipo_outro_texto || item.tipo_esquadria, tipo: body.tipo, campo: body.tipo === 'galeria' ? null : campo, foto_id: foto?.id || null, foto_anterior: body.url, registro_anterior: foto || { [campo]: item[campo] }, motivo: body.motivo.trim() }
  let auditoriaId: string | null = null
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const { data: ultima, error: erroVersao } = await supabaseAdmin.from('medicao_revisoes').select('versao').eq('medicao_id', params.id).order('versao', { ascending: false }).limit(1).maybeSingle()
    if (erroVersao) break
    const { data: registro, error: erroRegistro } = await supabaseAdmin.from('medicao_revisoes').insert({ medicao_id: params.id, empresa_id: usuario.empresa_id, versao: (ultima?.versao || 0) + 1, motivo: 'Correção de foto', snapshot, criado_por_id: usuario.id, criado_por_nome: usuario.nome }).select('id').single()
    if (registro) { auditoriaId = registro.id; break }
    if (erroRegistro?.code !== '23505') break
  }
  if (!auditoriaId) return NextResponse.json({ error: 'Não foi possível registrar o histórico. A foto foi mantida.' }, { status: 500 })
  const operacao = body.tipo === 'galeria'
    ? supabaseAdmin.from('medicao_fotos').delete().eq('id', body.fotoId).eq('item_id', item.id).eq('medicao_id', params.id).eq('empresa_id', usuario.empresa_id).eq('url', body.url)
    : supabaseAdmin.from('medicao_itens').update({ [campo]: null }).eq('id', item.id).eq('medicao_id', params.id).eq('empresa_id', usuario.empresa_id).eq(campo, body.url)
  const { data: alterados, error: erroRemocao } = await operacao.select('id')
  const removeu = !erroRemocao && alterados?.length === 1
  const { error: erroResultado } = await supabaseAdmin.from('medicao_revisoes').update({ snapshot: { ...snapshot, resultado: removeu ? 'excluida' : 'nao_realizada' } }).eq('id', auditoriaId).eq('empresa_id', usuario.empresa_id)
  if (!removeu) return NextResponse.json({ error: 'A exclusão não foi realizada. Atualize a tela e tente novamente.' }, { status: 409 })
  return NextResponse.json({ ok: true, mensagem: erroResultado ? 'Foto excluída. A foto anterior e o autor estão preservados no histórico; a confirmação do resultado ficou pendente.' : 'Foto excluída. Foto anterior, autor e motivo preservados no histórico.' })
}
