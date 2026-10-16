import { NextRequest, NextResponse } from 'next/server'
import { autenticarCompras } from '@/lib/comprasServer'
import { obterComprasAcessos } from '@/lib/comprasPermissoesServer'
import { supabaseAdmin as db } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const falha = (message: string, status = 400) => NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } })
const limpaBusca = (v: unknown) => String(v || '').trim().replace(/[%_,()]/g, ' ').slice(0, 80)
const valido = (v: unknown): v is string => typeof v === 'string' && uuid.test(v)

async function acesso(req: NextRequest) {
  const usuario = await autenticarCompras(req)
  if (!usuario) return { erro: falha('Sessão inválida.', 401), usuario: null, podeReceber: false, podeConferir: false }
  try {
    const p = await obterComprasAcessos(usuario)
    if (!p.receber && !p.conferir) return { erro: falha('Sem permissão para consultar recebimentos.', 403), usuario: null, podeReceber: false, podeConferir: false }
    return { erro: null, usuario, podeReceber: p.receber, podeConferir: p.conferir }
  } catch {
    return { erro: falha('Não foi possível validar as permissões.', 503), usuario: null, podeReceber: false, podeConferir: false }
  }
}

export async function GET(req: NextRequest) {
  const a = await acesso(req)
  if (a.erro || !a.usuario) return a.erro
  const empresa = a.usuario.empresa_id
  const tipo = req.nextUrl.searchParams.get('tipo') || ''
  const q = limpaBusca(req.nextUrl.searchParams.get('q'))
  try {
    if (tipo === 'permissoes') return NextResponse.json({ podeReceber: a.podeReceber })
    if (tipo === 'clientes') {
      if (q.length < 3) return NextResponse.json({ clientes: [] })
      const { data, error } = await db.from('clientes').select('id,nome,cidade')
        .eq('empresa_id', empresa).ilike('nome', `%${q}%`).order('nome').limit(30)
      if (error) throw error
      return NextResponse.json({ clientes: data || [] })
    }
    if (tipo === 'clientePorId') {
      const clienteId = req.nextUrl.searchParams.get('clienteId')
      if (!valido(clienteId)) return falha('Cliente inválido.')
      const { data, error } = await db.from('clientes').select('id,nome,cidade')
        .eq('empresa_id', empresa).eq('id', clienteId).maybeSingle()
      if (error) throw error
      return NextResponse.json({ cliente: data || null })
    }
    if (tipo === 'obras') {
      const clienteId = req.nextUrl.searchParams.get('clienteId')
      if (!valido(clienteId)) return falha('Selecione um cliente válido.')
      const { data, error } = await db.from('obras').select('id,nome,numero,status')
        .eq('empresa_id', empresa).eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(100)
      if (error) throw error
      return NextResponse.json({ obras: data || [] })
    }
    if (tipo === 'produtos') {
      if (q.length < 2) return NextResponse.json({ produtos: [] })
      const termo = `%${q}%`
      const [a, b] = await Promise.all([
        db.from('produtos').select('id,codigo,nome,unidade,custo,foto_url,categoria')
          .eq('empresa_id', empresa).eq('ativo', true).ilike('nome', termo).order('nome').limit(35),
        db.from('produtos').select('id,codigo,nome,unidade,custo,foto_url,categoria')
          .eq('empresa_id', empresa).eq('ativo', true).ilike('codigo', termo).order('nome').limit(35),
      ])
      if (a.error || b.error) throw a.error || b.error
      const produtos = Array.from(new Map([...(a.data || []), ...(b.data || [])].map(x => [x.id, x])).values()).slice(0, 50)
      return NextResponse.json({ produtos })
    }
    if (tipo === 'locais') {
      const { data, error } = await db.from('estoque_locais').select('id,codigo,nome')
        .eq('empresa_id', empresa).eq('ativo', true).eq('tipo', 'geral').order('nome')
      if (error) throw error
      return NextResponse.json({ locais: data || [] })
    }
    if (tipo === 'historico') {
      const obraId = req.nextUrl.searchParams.get('obraId')
      const destino = req.nextUrl.searchParams.get('destino')
      if (obraId && !valido(obraId)) return falha('Obra inválida.')
      if (!obraId && destino !== 'estoque') return falha('Selecione a obra ou o estoque.')
      let query = db.from('compras_entradas_manuais')
        .select('id,fornecedor_nome,numero_romaneio,data_documento,destino,cliente_id,obra_id,local_id,created_at,criado_por_nome')
        .eq('empresa_id', empresa).order('created_at', { ascending: false }).limit(60)
      query = obraId ? query.eq('obra_id', obraId) : query.eq('destino', 'estoque')
      const { data, error } = await query
      if (error) throw error
      const entradas = data || []
      const ids = entradas.map(x => x.id)
      if (!ids.length) return NextResponse.json({ entradas: [], itens: [] })
      const it = await db.from('compras_entradas_manuais_itens')
        .select('id,entrada_id,produto_id,descricao,unidade,quantidade,custo_unitario,produto:produtos(foto_url,codigo)')
        .eq('empresa_id', empresa).in('entrada_id', ids).limit(1000)
      if (it.error) throw it.error
      return NextResponse.json({ entradas, itens: it.data || [] })
    }
    return falha('Consulta inválida.')
  } catch (error) {
    console.error('[entrada manual GET]', error)
    return falha('Não foi possível consultar os dados da entrada manual.', 503)
  }
}

export async function POST(req: NextRequest) {
  const a = await acesso(req)
  if (a.erro || !a.usuario) return a.erro
  if (!a.podeReceber) return falha('Sem permissão para registrar entrada de mercadoria.', 403)
  const p = await req.json().catch(() => null)
  if (!p || typeof p !== 'object') return falha('Dados inválidos.')
  const destino = p.destino
  const clienteId = destino === 'obra' ? p.clienteId : null
  const obraId = destino === 'obra' ? p.obraId : null
  const localId = destino === 'estoque' ? p.localId : null
  const itens = p.itens
  if (!valido(p.chaveIdempotencia)) return falha('Identificador da operação inválido.')
  if (!['obra', 'estoque'].includes(destino)) return falha('Selecione o destino da mercadoria.')
  if (destino === 'obra' && (!valido(clienteId) || !valido(obraId))) return falha('Selecione um cliente e uma obra.')
  if (destino === 'estoque' && !valido(localId)) return falha('Selecione o Estoque Geral.')
  const fornecedor = String(p.fornecedor || '').trim()
  const numero = String(p.numeroRomaneio || '').trim()
  if (!fornecedor || fornecedor.length > 200 || !numero || numero.length > 100) return falha('Informe o fornecedor e o número do romaneio.')
  if (typeof p.dataDocumento !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(p.dataDocumento)) return falha('Informe a data do documento.')
  if (!Array.isArray(itens) || itens.length < 1 || itens.length > 100) return falha('Informe de 1 a 100 produtos.')
  for (const [i, item] of itens.entries()) {
    if (!valido(item?.produtoId) || !Number.isFinite(Number(item?.quantidade)) || Number(item.quantidade) <= 0 || Number(item.quantidade) > 100000000
      || (item.custoUnitario !== null && item.custoUnitario !== undefined && item.custoUnitario !== '' && (!Number.isFinite(Number(item.custoUnitario)) || Number(item.custoUnitario) < 0))) {
      return falha(`Produto ${i + 1}: informe produto, quantidade positiva e custo válido.`)
    }
  }
  try {
    const { data, error } = await db.rpc('registrar_entrada_manual_romaneio', {
      p_empresa_id: a.usuario.empresa_id,
      p_usuario_id: a.usuario.id,
      p_chave_idempotencia: p.chaveIdempotencia,
      p_fornecedor_nome: fornecedor,
      p_numero_romaneio: numero,
      p_data_documento: p.dataDocumento,
      p_destino: destino,
      p_cliente_id: clienteId,
      p_obra_id: obraId,
      p_local_id: localId,
      p_observacoes: String(p.observacoes || '').slice(0, 2000),
      p_itens: itens.map((item: { produtoId: string; quantidade: number; custoUnitario?: number | null }) => ({
        produtoId: item.produtoId,
        quantidade: Number(item.quantidade),
        custoUnitario: item.custoUnitario === null || item.custoUnitario === undefined ? null : Number(item.custoUnitario),
      })),
    })
    if (error) {
      const msg = String(error.message || '')
      if (/já possuem uma entrada|duplicate key|romaneio.*já/i.test(msg)) return falha('Este fornecedor e número de romaneio já foram registrados. Confira o histórico antes de lançar novamente.', 409)
      if (/obra não pertence|Local de Estoque|local de Estoque|Produto não encontrado|Quantidade|quantidade|obrigatóri|inválid|não pertence|fornecedor|número do romaneio/i.test(msg)) return falha(msg, 409)
      console.error('[entrada manual RPC]', error)
      return falha('Não foi possível salvar o romaneio. Confira se a atualização de banco foi aplicada.', 503)
    }
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[entrada manual POST]', error)
    return falha('Não foi possível registrar a entrada.', 503)
  }
}
