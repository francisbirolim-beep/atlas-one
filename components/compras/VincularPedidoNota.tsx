'use client'

import { useEffect, useMemo, useState } from 'react'
import { Link2, Loader2, RefreshCw, Trash2 } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'

type Item = {
  id: string
  produto_id: string | null
  codigo_fornecedor: string | null
  descricao: string
  quantidade: number
  unidade: string | null
  produto: { id: string; codigo: string | null; nome: string; foto_url: string | null } | null
}
type Pedido = {
  id: string
  produto_id: string | null
  descricao: string
  quantidade: number
  quantidade_vinculada: number
  unidade: string
  destino: 'estoque' | 'obra' | null
  cliente_nome: string | null
  obra_nome: string | null
  status: string
  fornecedor_conferido: boolean
}
type Vinculo = { id: string; nf_item_id: string; necessidade_id: string; quantidade: number }
type Dados = { itens: Item[]; pedidos: Pedido[]; vinculos: Vinculo[]; aviso: string }

const qtd = (valor: number) => Number(valor).toLocaleString('pt-BR', { maximumFractionDigits: 3 })
const unidadeIgual = (a: string | null, b: string | null) => (a || '').trim().toUpperCase() === (b || '').trim().toUpperCase()

export default function VincularPedidoNota({ nfId }: { nfId: string }) {
  const [dados, setDados] = useState<Dados | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [pedidosEscolhidos, setPedidosEscolhidos] = useState<Record<string, string>>({})
  const [quantidades, setQuantidades] = useState<Record<string, string>>({})

  async function carregar() {
    setCarregando(true)
    setErro('')
    try {
      const token = await tokenAtual()
      if (!token) throw new Error('Sessão expirada.')
      const resposta = await fetch(`/api/compras/nfs/${nfId}/pedidos`, {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
      })
      const json = await resposta.json().catch(() => ({}))
      if (!resposta.ok) throw new Error(json.error || 'Falha ao buscar pedidos.')
      setDados(json)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao consultar pedidos.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => { carregar() }, [nfId])

  const usadosNF = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const v of dados?.vinculos || []) mapa.set(v.nf_item_id, (mapa.get(v.nf_item_id) || 0) + Number(v.quantidade))
    return mapa
  }, [dados])

  function candidatos(item: Item) {
    return (dados?.pedidos || []).filter(p =>
      p.fornecedor_conferido &&
      unidadeIgual(p.unidade, item.unidade) &&
      (!item.produto_id || !p.produto_id || item.produto_id === p.produto_id) &&
      Number(p.quantidade) - Number(p.quantidade_vinculada) > 0.000001,
    )
  }

  async function executar(metodo: 'POST' | 'DELETE', payload: Record<string, unknown>) {
    setOcupado(true); setErro(''); setAviso('')
    try {
      const token = await tokenAtual()
      if (!token) throw new Error('Sessão expirada.')
      const resp = await fetch(`/api/compras/nfs/${nfId}/pedidos`, {
        method: metodo, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(json.error || 'Operação não concluída.')
      setAviso(metodo === 'POST' ? 'Pedido vinculado à NF. A conferência do material e o estoque não foram alterados.' : 'Vínculo removido; nenhuma movimentação de estoque foi realizada.')
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao gravar vínculo.')
    } finally {
      setOcupado(false)
    }
  }

  if (carregando && !dados) return <section className="rounded-2xl border bg-white p-5 text-sm text-slate-500"><Loader2 className="mr-2 inline animate-spin" size={16} /> Consultando pedidos de compra da nota...</section>

  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2"><Link2 size={20} className="text-blue-700" /><h2 className="font-bold text-slate-900">Vincular nota ao pedido de compra</h2></div>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">Selecione o pedido para indicar se o material foi comprado para o <strong>estoque</strong> ou para um <strong>cliente/obra</strong>. Os vínculos são por item e aceitam entregas em mais de uma NF.</p>
      </div>
      <button type="button" onClick={carregar} disabled={carregando || ocupado} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40"><RefreshCw size={14} /> Atualizar pedidos</button>
    </div>
    <p className="mt-3 text-xs text-amber-800">{dados?.aviso || 'Esta etapa apenas identifica o destino; a conferência física e o estoque são operações independentes.'}</p>
    {erro && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
    {aviso && <p role="status" className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{aviso}</p>}
    {dados && <div className="mt-4 space-y-4">
      {dados.itens.map(item => {
        const usados = usadosNF.get(item.id) || 0
        const restante = Math.max(0, Number(item.quantidade) - usados)
        const disponiveis = candidatos(item)
        const pedidoId = pedidosEscolhidos[item.id] || ''
        const escolhido = disponiveis.find(p => p.id === pedidoId)
        const qtdMaxima = escolhido ? Math.min(restante, Number(escolhido.quantidade) - Number(escolhido.quantidade_vinculada)) : restante
        const anexos = dados.vinculos.filter(v => v.nf_item_id === item.id)
        return <div key={item.id} className="rounded-xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-start gap-3">
            {item.produto?.foto_url ? <img src={item.produto.foto_url} alt={item.produto.nome} loading="lazy" className="h-16 w-16 shrink-0 rounded-lg border bg-white object-contain" /> : <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-dashed bg-slate-50 p-1 text-center text-[10px] text-slate-500">Imagem não cadastrada</div>}
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-slate-900">{item.codigo_fornecedor || item.produto?.codigo || '—'} — {item.descricao}</h3>
              <p className="mt-1 text-xs text-slate-500">Na NF: {qtd(Number(item.quantidade))} {item.unidade || ''} · Vinculado: {qtd(usados)} · Sem destino: <strong>{qtd(restante)}</strong></p>
            </div>
          </div>
          {anexos.length > 0 && <div className="mt-3 space-y-2">
            {anexos.map(v => {
              const pedido = dados.pedidos.find(p => p.id === v.necessidade_id)
              const destino = pedido?.destino === 'obra' ? `Cliente/obra: ${pedido.cliente_nome || '—'} · ${pedido.obra_nome || '—'}` : pedido?.destino === 'estoque' ? 'Estoque' : 'Pedido vinculado'
              return <div key={v.id} className="flex items-start justify-between gap-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-900">
                <span><strong>{qtd(Number(v.quantidade))} {item.unidade || ''}</strong> → {pedido?.descricao || v.necessidade_id} · {destino}</span>
                <button type="button" disabled={ocupado} title="Desvincular antes do recebimento" onClick={() => executar('DELETE', { vinculoId: v.id })} className="shrink-0 rounded p-1 hover:bg-red-50 hover:text-red-700 disabled:opacity-40"><Trash2 size={14} /></button>
              </div>
            })}
          </div>}
          {restante > 0.000001 && <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_135px_auto] md:items-end">
            <label className="block text-xs font-medium text-slate-600">Pedido aprovado deste fornecedor
              <select value={pedidoId} onChange={e => { setPedidosEscolhidos(v => ({ ...v, [item.id]: e.target.value })); setQuantidades(v => ({ ...v, [item.id]: '' })) }} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm">
                <option value="">Selecione o pedido...</option>
                {disponiveis.map(p => <option key={p.id} value={p.id}>{p.descricao} · {p.destino === 'obra' ? `Obra ${p.cliente_nome || ''} / ${p.obra_nome || ''}` : 'Estoque'} · Pendente {qtd(Number(p.quantidade) - Number(p.quantidade_vinculada))} {p.unidade}</option>)}
              </select>
            </label>
            <label className="block text-xs font-medium text-slate-600">Quantidade
              <input type="number" min="0.001" max={qtdMaxima} step="any" value={quantidades[item.id] ?? ''} placeholder={qtdMaxima.toString()} onChange={e => setQuantidades(v => ({ ...v, [item.id]: e.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
            </label>
            <button type="button" onClick={() => executar('POST', { nfItemId: item.id, necessidadeId: pedidoId, quantidade: quantidades[item.id] === '' ? qtdMaxima : Number(quantidades[item.id]) })} disabled={!escolhido || ocupado || qtdMaxima <= 0 || (quantidades[item.id] !== '' && (!Number.isFinite(Number(quantidades[item.id])) || Number(quantidades[item.id]) <= 0 || Number(quantidades[item.id]) > qtdMaxima))} className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">Vincular pedido</button>
          </div>}
          {restante > 0 && !disponiveis.length && <p className="mt-2 text-xs text-amber-800">Nenhum pedido aprovado compatível com fornecedor, produto e unidade. Confira cotação, cadastro ou unidade de compra; não será criado vínculo automático.</p>}
        </div>
      })}
    </div>}
  </section>
}
