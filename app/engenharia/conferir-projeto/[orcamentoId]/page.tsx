'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, History, Save, AlertTriangle, GitCompareArrows } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { carregarVendaPorOrcamento, registrarRevisaoVenda, type VendaObraRevisao, type VendaObraResumo } from '@/lib/vendaRevisoes'
import { moverItemSetor } from '@/lib/setorKanban'

type EstadoVenda = {
  valor_venda?: number | null
  custo_previsto?: number | null
  itens_snapshot?: any[]
  config_snapshot?: Record<string, any>
  versao?: number
}

function numeroOuNull(valor: string) {
  if (!valor.trim()) return null
  const n = Number(valor.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function clonar<T>(v: T): T { return JSON.parse(JSON.stringify(v)) }

export default function ConferirProjetoPage() {
  const params = useParams()
  const router = useRouter()
  const orcamentoId = String(params?.orcamentoId || '')
  const [carregando, setCarregando] = useState(true)
  const [orcamento, setOrcamento] = useState<any>(null)
  const [venda, setVenda] = useState<VendaObraResumo | null>(null)
  const [estadoOriginal, setEstadoOriginal] = useState<EstadoVenda | null>(null)
  const [estadoAtual, setEstadoAtual] = useState<EstadoVenda | null>(null)
  const [editado, setEditado] = useState<EstadoVenda | null>(null)
  const [revisoes, setRevisoes] = useState<VendaObraRevisao[]>([])
  const [cardId, setCardId] = useState('')
  const [colunaConferidoId, setColunaConferidoId] = useState('')
  const [justificativa, setJustificativa] = useState('')
  const [impactoValor, setImpactoValor] = useState('')
  const [impactoCusto, setImpactoCusto] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')

  async function carregar() {
    setCarregando(true); setErro('')
    const [{ data: orc }, vendaDados, { data: cols }, { data: cards }] = await Promise.all([
      supabase.from('orcamentos').select('*').eq('id', orcamentoId).maybeSingle(),
      carregarVendaPorOrcamento(orcamentoId),
      supabase.from('setor_kanban_colunas').select('id,nome').eq('setor_id', 'engenharia-projeto').order('ordem'),
      supabase.from('setor_kanban_itens').select('id,coluna_id').eq('orcamento_id', orcamentoId),
    ])
    setOrcamento(orc || null)
    setVenda(vendaDados.venda)
    setRevisoes(vendaDados.revisoes)
    if (vendaDados.venda) {
      const original: EstadoVenda = {
        valor_venda: Number(vendaDados.venda.valor_venda || 0),
        custo_previsto: vendaDados.venda.custo_previsto == null ? null : Number(vendaDados.venda.custo_previsto),
        itens_snapshot: clonar(vendaDados.venda.itens_snapshot || []),
        config_snapshot: clonar(vendaDados.venda.config_snapshot || {}),
        versao: 1,
      }
      const atual = (vendaDados.estadoAtual || original) as EstadoVenda
      setEstadoOriginal(original); setEstadoAtual(clonar(atual)); setEditado(clonar(atual))
    } else {
      setEstadoOriginal(null); setEstadoAtual(null); setEditado(null)
    }
    const conferido = (cols || []).find((c: any) => String(c.nome).toLowerCase() === 'projeto conferido')
    setColunaConferidoId(conferido?.id || '')
    const idsCols = (cols || []).map((c: any) => c.id)
    const card = (cards || []).find((c: any) => idsCols.includes(c.coluna_id))
    setCardId(card?.id || '')
    setCarregando(false)
  }

  useEffect(() => { if (orcamentoId) void carregar() }, [orcamentoId])

  function patchConfig(chave: string, valor: any) {
    setEditado(prev => prev ? { ...prev, config_snapshot: { ...(prev.config_snapshot || {}), [chave]: valor } } : prev)
  }

  function patchItem(indice: number, chave: string, valor: any) {
    setEditado(prev => {
      if (!prev) return prev
      const itens = clonar(prev.itens_snapshot || [])
      itens[indice] = { ...itens[indice], [chave]: valor }
      return { ...prev, itens_snapshot: itens }
    })
  }

  function patchVariavel(indice: number, chave: string, valor: any) {
    setEditado(prev => {
      if (!prev) return prev
      const itens = clonar(prev.itens_snapshot || [])
      itens[indice] = { ...itens[indice], variaveis: { ...(itens[indice]?.variaveis || {}), [chave]: valor } }
      return { ...prev, itens_snapshot: itens }
    })
  }

  const mudou = !!estadoAtual && !!editado && JSON.stringify(estadoAtual) !== JSON.stringify(editado)

  async function salvarRevisao() {
    if (!venda || !editado || !mudou) return
    if (justificativa.trim().length < 3) { setErro('Informe por que o projeto/venda foi alterado.'); return }
    setSalvando(true); setErro(''); setMensagem('')
    const r = await registrarRevisaoVenda({
      vendaId: venda.id,
      justificativa: justificativa.trim(),
      depois: editado,
      impactoValor: numeroOuNull(impactoValor),
      impactoCusto: numeroOuNull(impactoCusto),
    })
    setSalvando(false)
    if (!r.ok) { setErro(r.error || 'Não foi possível registrar a revisão.'); return }
    setMensagem('Revisão registrada. A venda original foi preservada e esta versão passa a orientar o processo operacional.')
    setJustificativa(''); setImpactoValor(''); setImpactoCusto('')
    await carregar()
  }

  async function concluirProjeto() {
    if (!cardId || !colunaConferidoId) { setErro('Card/coluna de Conferir Projeto não encontrados.'); return }
    if (mudou) { setErro('Existem alterações ainda não registradas. Salve a revisão antes de concluir o projeto.'); return }
    setSalvando(true); setErro('')
    const ok = await moverItemSetor(cardId, colunaConferidoId)
    setSalvando(false)
    if (!ok) { setErro('Não foi possível concluir o projeto.'); return }
    router.push('/producao')
  }

  if (carregando) return <div className="min-h-screen grid place-items-center text-slate-400">Carregando conferência...</div>
  if (!orcamento) return <div className="min-h-screen grid place-items-center text-slate-500">Orçamento não encontrado.</div>

  if (!venda || !editado) {
    return <div className="min-h-screen bg-slate-50"><div className="max-w-3xl mx-auto px-4 py-10"><Link href="/setor/engenharia-projeto" className="inline-flex items-center gap-2 text-sm text-slate-500"><ArrowLeft size={16}/> Voltar</Link><div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-6"><div className="flex gap-3"><AlertTriangle className="text-amber-600"/><div><h1 className="font-bold text-amber-900">Venda legada ainda não regularizada</h1><p className="mt-2 text-sm text-amber-800">Este orçamento aparece como vendido, mas ainda não possui o snapshot oficial da venda. Regularize primeiro para criar Financeiro + Conferir Projeto corretamente e só depois registre ajustes.</p><Link href={`/vendas/confirmar?orcamento=${orcamentoId}`} className="mt-4 inline-flex rounded-xl bg-brand-navy px-4 py-2 text-sm font-semibold text-white">Regularizar / confirmar venda</Link></div></div></div></div></div>
  }

  const originalContramarco = String(estadoOriginal?.config_snapshot?.contramarco || 'sem')
  const atualContramarco = String(editado.config_snapshot?.contramarco || 'sem')

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200"><div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3"><Link href="/setor/engenharia-projeto" className="p-2 rounded-xl hover:bg-slate-100 text-slate-500"><ArrowLeft size={18}/></Link><div><p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Engenharia</p><h1 className="text-lg font-bold text-brand-navy">Conferir Projeto · Orçamento #{orcamento.numero || '-'}</h1><p className="text-xs text-slate-500">Venda original preservada · versão operacional atual {venda.versao || 1}</p></div></div></header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-5">
        {erro && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}
        {mensagem && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{mensagem}</div>}

        <section className="grid md:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Cliente</p><p className="mt-1 text-sm font-bold text-slate-900">{orcamento.cliente_nome}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Valor vendido</p><p className="mt-1 text-lg font-bold text-slate-900">R$ {Number(venda.valor_venda || 0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Revisões</p><p className="mt-1 text-lg font-bold text-slate-900">{revisoes.length}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Contramarco</p><p className="mt-1 text-sm font-bold text-slate-900">Original: {originalContramarco} · Atual: {atualContramarco}</p></div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2"><GitCompareArrows size={18} className="text-brand-navy"/><div><h2 className="font-bold text-slate-900">Versão atual do projeto</h2><p className="text-xs text-slate-500">Altere o que foi confirmado com o cliente. Qualquer mudança exige justificativa antes de salvar.</p></div></div>
          <div className="mt-4 grid md:grid-cols-3 gap-3">
            <label><span className="block text-xs font-medium text-slate-600 mb-1">Contramarco</span><select value={atualContramarco} onChange={e => patchConfig('contramarco',e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="sem">Sem contramarco</option><option value="com">Com contramarco</option></select></label>
            <label><span className="block text-xs font-medium text-slate-600 mb-1">Impacto no valor da venda (R$)</span><input value={impactoValor} onChange={e => setImpactoValor(e.target.value)} inputMode="decimal" placeholder="Se houver" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"/></label>
            <label><span className="block text-xs font-medium text-slate-600 mb-1">Impacto no custo previsto (R$)</span><input value={impactoCusto} onChange={e => setImpactoCusto(e.target.value)} inputMode="decimal" placeholder="Se souber" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"/></label>
          </div>

          <div className="mt-5 space-y-4">{(editado.itens_snapshot || []).map((item:any,idx:number) => <article key={item.id || idx} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-center justify-between gap-2"><div><p className="text-xs text-slate-400">Item {idx+1}</p><p className="font-semibold text-slate-800">{item.ambiente || item.tipo_outro_texto || item.tipo_esquadria || `Item ${idx+1}`}</p></div><span className="text-xs rounded-full bg-slate-100 px-2 py-1">qtd {item.quantidade || 1}</span></div><div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="lg:col-span-2"><span className="block text-[11px] text-slate-500 mb-1">Tipologia / descrição</span><input value={item.tipo_outro_texto || item.descricao || ''} onChange={e => patchItem(idx,item.tipo_outro_texto != null ? 'tipo_outro_texto' : 'descricao',e.target.value)} className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm"/></label>
            <label><span className="block text-[11px] text-slate-500 mb-1">Linha</span><input value={item.linha_nome || ''} onChange={e => patchItem(idx,'linha_nome',e.target.value)} placeholder="Ex.: Suprema" className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm"/></label>
            <label><span className="block text-[11px] text-slate-500 mb-1">Quantidade</span><input type="number" min={1} value={item.quantidade || 1} onChange={e => patchItem(idx,'quantidade',Number(e.target.value||1))} className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm"/></label>
            <label><span className="block text-[11px] text-slate-500 mb-1">Largura (mm)</span><input type="number" value={item.largura_mm || ''} onChange={e => patchItem(idx,'largura_mm',Number(e.target.value||0))} className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm"/></label>
            <label><span className="block text-[11px] text-slate-500 mb-1">Altura (mm)</span><input type="number" value={item.altura_mm || ''} onChange={e => patchItem(idx,'altura_mm',Number(e.target.value||0))} className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm"/></label>
            <label><span className="block text-[11px] text-slate-500 mb-1">Montagem</span><input value={item.variaveis?.montagem || ''} onChange={e => patchVariavel(idx,'montagem',e.target.value)} className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm"/></label>
            <label><span className="block text-[11px] text-slate-500 mb-1">Folhas</span><input value={item.variaveis?.folhas || item.folhas || ''} onChange={e => patchVariavel(idx,'folhas',e.target.value)} className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm"/></label>
            <label><span className="block text-[11px] text-slate-500 mb-1">Trilho</span><input value={item.variaveis?.trilho || ''} onChange={e => patchVariavel(idx,'trilho',e.target.value)} className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm"/></label>
            <label><span className="block text-[11px] text-slate-500 mb-1">Fechadura</span><input value={item.variaveis?.fechadura || ''} onChange={e => patchVariavel(idx,'fechadura',e.target.value)} className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm"/></label>
            <label><span className="block text-[11px] text-slate-500 mb-1">Puxador</span><input value={item.variaveis?.puxador || ''} onChange={e => patchVariavel(idx,'puxador',e.target.value)} className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm"/></label>
          </div></article>)}</div>

          {mudou && <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="font-semibold text-amber-900">Alteração detectada</p><label className="mt-3 block"><span className="block text-xs font-medium text-amber-900 mb-1">Justificativa obrigatória *</span><textarea value={justificativa} onChange={e => setJustificativa(e.target.value)} rows={3} placeholder="Ex.: Cliente pediu contramarco depois da venda." className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm"/></label><button onClick={salvarRevisao} disabled={salvando || justificativa.trim().length<3} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-brand-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"><Save size={15}/> Registrar revisão</button></div>}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-2"><History size={18} className="text-slate-500"/><h2 className="font-bold text-slate-900">Histórico de alterações</h2></div>{revisoes.length===0 ? <p className="mt-3 text-sm text-slate-400">Nenhuma revisão registrada. A versão atual é a venda original.</p> : <div className="mt-3 space-y-2">{revisoes.map(r => <div key={r.id} className="rounded-xl border border-slate-100 p-3"><div className="flex justify-between gap-2"><p className="text-sm font-semibold text-slate-800">Versão {r.versao}</p><p className="text-xs text-slate-400">{new Date(r.created_at).toLocaleString('pt-BR')}</p></div><p className="mt-1 text-sm text-slate-600">{r.justificativa}</p><p className="mt-1 text-xs text-slate-400">{r.criado_por_nome || 'Usuário'}{r.impacto_valor != null ? ` · impacto venda R$ ${Number(r.impacto_valor).toLocaleString('pt-BR',{minimumFractionDigits:2})}` : ''}{r.impacto_custo != null ? ` · impacto custo R$ ${Number(r.impacto_custo).toLocaleString('pt-BR',{minimumFractionDigits:2})}` : ''}</p></div>)}</div>}</section>

        <section className="rounded-2xl bg-brand-navy p-5 text-white flex flex-wrap items-center justify-between gap-4"><div><p className="font-semibold">Projeto revisado e correto?</p><p className="text-xs text-white/70 mt-1">Ao concluir, o Atlas cria Medição Final, Perfis, Acessórios, Outros e as Ordens de Produção. Vidros continuam aguardando a Medição Final.</p></div><button onClick={concluirProjeto} disabled={salvando || mudou} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-brand-navy disabled:opacity-40"><CheckCircle2 size={16}/> Projeto conferido</button></section>
      </main>
    </div>
  )
}
