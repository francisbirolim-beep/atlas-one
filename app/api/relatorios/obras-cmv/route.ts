import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { extrairPrevisaoWVetro } from '@/lib/wvetroCmvResumo'
import { separarLancamentosCmv } from '@/lib/vendaCmvLancamentos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const numero = (v: unknown) => Number(v || 0) || 0
const arredondar = (v: number) => Math.round(v * 100) / 100
const lista = (v: unknown): any[] => Array.isArray(v) ? v : []
const unico = (valores: (string | null | undefined)[]) => Array.from(new Set(valores.filter(Boolean) as string[]))
function valorMoeda(v: unknown): number {
  let s = String(v ?? '').replace(/[^\d,.-]/g, '')
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 ? n : 0
}
function categoria(v: string): string {
  const s = String(v || '').toLowerCase()
  if (s.includes('perfil')) return 'perfil'
  if (s.includes('vidro')) return 'vidro'
  if (s.includes('acess')) return 'acessorio'
  return 'outros'
}
const efetivada = (v: string) => ['aprovado', 'pedido_emitido', 'aguardando_entrega', 'recebido'].includes(String(v || '').toLowerCase())
async function selecionar<T = any>(tabela: string, campos: string, coluna: string, ids: string[], empresaId: string): Promise<T[]> {
  const rows: T[] = []
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await supabaseAdmin.from(tabela).select(campos).eq('empresa_id', empresaId).in(coluna, ids.slice(i, i + 100)).limit(1000)
    if (error) throw error
    if ((data || []).length === 1000) throw new Error('A consulta excedeu o limite por lote. Reduza o período para evitar um relatório incompleto.')
    rows.push(...(data || []) as T[])
  }
  return rows
}
export async function GET(req: NextRequest) {
  const u = await autenticarTenant(req)
  if (!u) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })
  // Relatório gerencial consolidado com custos e margens: restringir ao Master até existir permissão específica de relatórios.
  if (u.role !== 'master') return NextResponse.json({ error: 'Relatório gerencial disponível para o Master.' }, { status: 403 })
  const inicio = req.nextUrl.searchParams.get('inicio') || ''
  const fim = req.nextUrl.searchParams.get('fim') || ''
  const valido = /^\d{4}-\d{2}-\d{2}$/
  if (!valido.test(inicio) || !valido.test(fim) || inicio > fim) {
    return NextResponse.json({ error: 'Informe um período válido.' }, { status: 400 })
  }
  const totalDias = (Date.parse(fim + 'T12:00:00Z') - Date.parse(inicio + 'T12:00:00Z')) / 86400000
  if (!Number.isFinite(totalDias) || totalDias > 366) {
    return NextResponse.json({ error: 'Selecione um período de até 12 meses.' }, { status: 400 })
  }
  try {
    // Período por data de confirmação da venda, não por conclusão nem data das compras.
    const { data: vendas, error: erroVendas } = await supabaseAdmin.from('vendas_obras')
      .select('id,numero,cliente_id,orcamento_id,obra_id,status,valor_venda,custo_previsto,confirmado_em')
      .eq('empresa_id', u.empresa_id)
      .gte('confirmado_em', inicio + 'T00:00:00-03:00')
      .lte('confirmado_em', fim + 'T23:59:59-03:00')
      .order('confirmado_em', { ascending: false })
      .limit(501)
    if (erroVendas) throw erroVendas
    if (lista(vendas).length > 500) return NextResponse.json({ error: 'Há mais de 500 vendas no período. Selecione um intervalo menor.' }, { status: 400 })
    const base = lista(vendas).filter(v => v.status !== 'cancelada')
    if (!base.length) return NextResponse.json({ ok: true, periodo: { inicio, fim, criterio: 'confirmado_em' }, obras: [], total: { quantidade: 0, venda: 0, previsto: 0, previstoDisponivel: 0, realizado: 0, compras: 0, lancamentos: 0, concluidas: 0 }, avisos: [] })
    const clientes = await selecionar('clientes','id,nome,cidade','id',unico(base.map(v=>v.cliente_id)),u.empresa_id)
    const orcamentos = await selecionar('orcamentos','id,numero,wvetro_fluxo,custo_estimado,cliente_nome,obra_nome','id',unico(base.map(v=>v.orcamento_id)),u.empresa_id)
    const lancamentosAtuais = await selecionar('venda_cmv_lancamentos','id,venda_obra_id,categoria,origem,valor,cancelado_em','venda_obra_id',unico(base.map(v=>v.id)),u.empresa_id)
    const {ativos:lancamentos}=separarLancamentosCmv(lancamentosAtuais) // Exclusões auditadas não entram no realizado.
    const idsObras = unico(base.map(v => v.obra_id))
    const compras = await selecionar('compras_necessidades','id,obra_id,categoria,quantidade,status,observacoes','obra_id',idsObras,u.empresa_id)
    const cotacoes = await selecionar('compras_cotacoes','id,necessidade_id,preco_unitario,frete,selecionada','necessidade_id',unico(compras.map(c=>c.id)),u.empresa_id)
    const nums = unico(orcamentos.map(o => o.wvetro_fluxo?.numero || o.wvetro_fluxo?.numero_wvetro))
    const historicos = await selecionar('wvetro_orcamentos_historico','wvetro_numero,custo_sem_sobra,custo_com_sobra','wvetro_numero',nums,u.empresa_id)
    const cMap = new Map(clientes.map(c => [c.id,c]))
    const oMap = new Map(orcamentos.map(o => [o.id,o]))
    const hMap = new Map(historicos.map(h => [String(h.wvetro_numero), h]))
    const lMap = new Map<string, any[]>()
    for (const l of lancamentos) lMap.set(l.venda_obra_id,[...(lMap.get(l.venda_obra_id)||[]),l])
    const cpMap = new Map<string, any[]>()
    for (const c of compras) cpMap.set(c.obra_id,[...(cpMap.get(c.obra_id)||[]),c])
    const ctMap = new Map(cotacoes.filter(c=>c.selecionada).map(c=>[c.necessidade_id,c]))
    const obraVendas = new Map<string, number>()
    for (const v of base) if (v.obra_id) obraVendas.set(v.obra_id, (obraVendas.get(v.obra_id)||0)+1)
    const avisos: string[] = []
    const obras = base.map(v => {
      const o = oMap.get(v.orcamento_id)
      const f = o?.wvetro_fluxo || {}
      const n = String(f.numero || f.numero_wvetro || '')
      const extracao = extrairPrevisaoWVetro({...hMap.get(n), ...f})
      const previsto = extracao.total ?? (v.custo_previsto != null ? numero(v.custo_previsto) : o?.custo_estimado != null ? numero(o.custo_estimado) : null)
      const manuais = lMap.get(v.id)||[]
      const porCategoria: Record<string,number> = {}
      let manual = 0
      for (const l of manuais) { const valor = numero(l.valor); manual += valor; porCategoria[l.categoria]=(porCategoria[l.categoria]||0)+valor }
      const itens = cpMap.get(v.obra_id)||[]
      let compra = 0
      let naoPrecificada = 0
      const compartilhada = !!v.obra_id && (obraVendas.get(v.obra_id)||0)>1
      if (compartilhada) avisos.push('Há obras com mais de uma venda associada; compras compartilhadas não foram atribuídas automaticamente, para evitar contagem duplicada.')
      for (const c of compartilhada ? [] : itens) {
        if (!efetivada(c.status)) continue
        const matches = [...String(c.observacoes||'').matchAll(/Valor(?: total)?\s*:\s*([^\n]+)/gi)]
        const obsValor = matches.length ? valorMoeda(matches[matches.length - 1][1]) : 0
        const cot = ctMap.get(c.id)
        const fallback = cot ? numero(cot.preco_unitario) * numero(c.quantidade) + numero(cot.frete) : 0
        const valor = obsValor > 0 ? obsValor : fallback
        if (valor <= 0) { naoPrecificada += 1; continue }
        compra += valor
        const cat = categoria(c.categoria)
        porCategoria[cat]=(porCategoria[cat]||0)+valor
      }
      const realizado = arredondar(manual+compra)
      if (naoPrecificada) avisos.push('Há compras efetivadas sem valor cadastrado; o custo realizado pode estar incompleto.')
      if (extracao.aviso) avisos.push('Alguns orçamentos WVetro não têm todos os custos previstos detalhados.')
      return {
        id: v.id, clienteId: v.cliente_id, cliente: cMap.get(v.cliente_id)?.nome || o?.cliente_nome || 'Cliente não identificado',
        cidade: cMap.get(v.cliente_id)?.cidade || '', numero: v.numero, orcamento: n || o?.numero || '—',
        status: v.status || 'ativa', data: v.confirmado_em, venda: arredondar(numero(v.valor_venda)),
        previsto: previsto===null?null:arredondar(previsto), fontePrevisto: extracao.fonte,
        realizado, compras: arredondar(compra), lancamentos: arredondar(manual),
        parcial: v.status !== 'concluida' || naoPrecificada>0 || compartilhada,
        pendencias: naoPrecificada, compartilhada, categorias: {previsto: extracao.categorias, realizado:porCategoria},
        diferenca: previsto===null?null:arredondar(previsto-realizado),
      }
    })
    const total = {
      quantidade: obras.length, venda: arredondar(obras.reduce((s,v)=>s+v.venda,0)),
      previsto: arredondar(obras.reduce((s,v)=>s+(v.previsto||0),0)),
      previstoDisponivel: obras.filter(v=>v.previsto!==null).length,
      realizado: arredondar(obras.reduce((s,v)=>s+v.realizado,0)),
      compras: arredondar(obras.reduce((s,v)=>s+v.compras,0)),
      lancamentos: arredondar(obras.reduce((s,v)=>s+v.lancamentos,0)),
      concluidas: obras.filter(v=>v.status==='concluida').length,
    }
    return NextResponse.json({ok:true,periodo:{inicio,fim,criterio:'confirmado_em'},obras,total,avisos:unico(avisos)})
  } catch (error) {
    console.error('Erro ao gerar relatório de CMV por obras', error)
    return NextResponse.json({error:'Não foi possível gerar o relatório de obras.'},{status:500})
  }
}
