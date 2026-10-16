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
      if (!obraId && destino !== 'estoque') return falha('Informe a obra ou o estoque.')
      const consulta = db.from('compras_entradas_manuais_destinos')
        .select('id,entrada_id,item_id,destino,quantidade,obra_id,local_id')
        .eq('empresa_id', empresa).limit(1000)
      const result = obraId ? await consulta.eq('obra_id', obraId)
        : await consulta.eq('destino', 'estoque')
      if (result.error) throw result.error
      const alocacoes = result.data || []
      const ids = [...new Set(alocacoes.map(x => x.entrada_id))]
      const itemIds = [...new Set(alocacoes.map(x => x.item_id))]
      if (!ids.length) return NextResponse.json({ entradas: [], itens: [] })
      const [rEntradas, rItens] = await Promise.all([
        db.from('compras_entradas_manuais')
          .select('id,fornecedor_nome,numero_romaneio,data_documento,destino,created_at,criado_por_nome')
          .eq('empresa_id', empresa).in('id', ids).order('created_at', { ascending: false }).limit(1000),
        db.from('compras_entradas_manuais_itens')
          .select('id,entrada_id,produto_id,descricao,unidade,custo_unitario,produto:produtos(foto_url,codigo)')
          .eq('empresa_id', empresa).in('id', itemIds).limit(1000),
      ])
      if (rEntradas.error || rItens.error) throw rEntradas.error || rItens.error
      const porId = new Map((rItens.data || []).map(i => [i.id, i]))
      const itens = alocacoes.flatMap(a => {
        const item = porId.get(a.item_id)
        return item ? [{ ...item, id: a.id, quantidade: a.quantidade, entrada_id: a.entrada_id }] : []
      })
      return NextResponse.json({ entradas: rEntradas.data || [], itens })
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
  if (!valido(p.chaveIdempotencia)) return falha('Identificador da operação inválido.')
  const fornecedor = String(p.fornecedor || '').trim()
  const numero = String(p.numeroRomaneio || '').trim()
  if (!fornecedor || fornecedor.length > 200 || !numero || numero.length > 100) return falha('Informe o fornecedor e o número do romaneio.')
  if (typeof p.dataDocumento !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(p.dataDocumento)) return falha('Informe a data do romaneio.')
  const parcelas = p.parcelas
  if (!Array.isArray(parcelas) || parcelas.length < 1 || parcelas.length > 36)
    return falha('Informe de 1 a 36 parcelas.')
  for (const [indice, parcela] of parcelas.entries()) {
    const vencimento = parcela?.vencimento
    const valor = Number(parcela?.valor)
    const data = typeof vencimento === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(vencimento)
      ? new Date(vencimento + 'T12:00:00Z') : null
    if (!data || Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== vencimento)
      return falha(`Parcela ${indice + 1}: informe um vencimento válido.`)
    if (!['boleto', 'pix', 'cheque'].includes(parcela?.forma))
      return falha(`Parcela ${indice + 1}: informe boleto, Pix ou cheque.`)
    if (!Number.isFinite(valor) || valor <= 0 || valor > 1000000000
      || Math.abs(valor * 100 - Math.round(valor * 100)) > 0.00001)
      return falha(`Parcela ${indice + 1}: informe um valor monetário válido.`)
  }
  const itens = p.itens
  if (!Array.isArray(itens) || itens.length < 1 || itens.length > 100) return falha('Informe de 1 a 100 produtos.')
  const inteiro4 = (valor: number) => Math.round(valor * 10000)
  for (const [indice, item] of itens.entries()) {
    const quantidade = Number(item?.quantidade)
    const custo = Number(item?.custoUnitario)
    if (!valido(item?.produtoId) || !Number.isFinite(quantidade) || quantidade <= 0 || quantidade > 100000000
      || !Number.isFinite(custo) || custo < 0 || custo > 100000000
      || Math.abs(quantidade * 10000 - inteiro4(quantidade)) > 0.00001
      || Math.abs(custo * 10000 - inteiro4(custo)) > 0.00001
      || !Array.isArray(item.destinos) || !item.destinos.length || item.destinos.length > 20
      || item.custoUnitario === null || item.custoUnitario === undefined || item.custoUnitario === '') {
      return falha(`Produto ${indice + 1}: informe quantidade, custo e destinos válidos.`)
    }
    let total = 0
    for (const destino of item.destinos) {
      const n = Number(destino?.quantidade)
      if (!Number.isFinite(n) || n <= 0 || Math.abs(n * 10000 - inteiro4(n)) > 0.00001) {
        return falha(`Produto ${indice + 1}: confira as quantidades distribuídas.`)
      }
      if (destino.destino === 'obra') {
        if (!valido(destino.clienteId) || !valido(destino.obraId)) return falha(`Produto ${indice + 1}: selecione cliente e obra.`)
      } else if (destino.destino === 'estoque') {
        if (!valido(destino.localId)) return falha(`Produto ${indice + 1}: escolha o Estoque Geral.`)
      } else return falha(`Produto ${indice + 1}: destino inválido.`)
      total += inteiro4(n)
    }
    if (total !== inteiro4(quantidade)) return falha(`Produto ${indice + 1}: a distribuição deve somar exatamente ${quantidade}.`)
  }
  try {
    const { data, error } = await db.rpc('registrar_entrada_manual_romaneio_parcelado', {
      p_empresa_id: a.usuario.empresa_id,
      p_usuario_id: a.usuario.id,
      p_chave_idempotencia: p.chaveIdempotencia,
      p_fornecedor_nome: fornecedor,
      p_numero_romaneio: numero,
      p_data_documento: p.dataDocumento,
      p_observacoes: String(p.observacoes || '').slice(0, 2000),
      p_parcelas: parcelas.map((parcela: { valor: number; vencimento: string; forma: string }) => ({
        valor: Number(parcela.valor).toFixed(2),
        vencimento: parcela.vencimento,
        forma: parcela.forma,
      })),
      p_itens: itens,
    })
    if (error) {
      const msg = String(error.message || '')
      if (/já possuem uma entrada|duplicate key|romaneio.*já/i.test(msg)) return falha('Este fornecedor e número de romaneio já foram registrados. Confira o histórico antes de lançar novamente.', 409)
      if (/obra não pertence|Local de Estoque|local de Estoque|Produto não encontrado|Quantidade|quantidade|obrigatóri|inválid|não pertence|fornecedor|número do romaneio|destino|custo|limite|soma/i.test(msg)) return falha(msg, 409)
      console.error('[entrada manual RPC]', error)
      return falha('Não foi possível salvar o romaneio. Confira se a atualização de banco foi aplicada.', 503)
    }
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[entrada manual POST]', error)
    return falha('Não foi possível registrar a entrada.', 503)
  }
}
