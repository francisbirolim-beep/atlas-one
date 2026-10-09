'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, FileSpreadsheet, FileText, Loader2, LockKeyhole, Package, Play, Plus, Ruler, X, CheckCircle2, ClipboardCheck, ShieldCheck, UserRound } from 'lucide-react'
import { tokenAtual, usuarioAtual } from '@/lib/auth'
import { criarColunaSetor, listarColunasSetor, listarItensSetor, moverItemSetor } from '@/lib/setorKanban'
import type { SetorKanbanColuna, SetorKanbanItem, Usuario } from '@/lib/tipos'
import { aprovarMedicaoFinal } from '@/lib/medicaoFinalV2'
import { buscarMedicao, listarItensMedicao } from '@/lib/medicaoFinal'
import { gerarPdfMedicaoFinal } from '@/lib/medicaoFinalPdf'
import { gerarPacoteMedicaoFinal } from '@/lib/materialPlanejamento'
import {
  atualizarOrdemProducao,
  criarOrdemProducaoManual,
  listarClientesProducao,
  listarObrasProducao,
  listarOrdensProducao,
  listarVendasProducao,
  listarMedicoesFinaisProducao,
  marcarCardLiberadoProducao,
  type ClienteProducao,
  type ObraProducao,
  type OrdemProducao,
  type VendaProducao,
  type MedicaoFinalProducao,
} from '@/lib/ordensProducao'

function statusLabel(status: OrdemProducao['status']) {
  const mapa: Record<OrdemProducao['status'], string> = {
    aguardando: 'Aguardando', liberada: 'Liberada', em_producao: 'Em produção', conferencia: 'Conferência', concluida: 'Concluída', cancelada: 'Cancelada',
  }
  return mapa[status]
}

function tipoLabel(tipo: OrdemProducao['tipo_producao']) {
  return tipo === 'contramarco' ? 'Contramarco' : tipo === 'esquadria' ? 'Esquadria' : 'Personalizada'
}

export default function Producao() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [colunas, setColunas] = useState<SetorKanbanColuna[]>([])
  const [cards, setCards] = useState<SetorKanbanItem[]>([])
  const [ordens, setOrdens] = useState<OrdemProducao[]>([])
  const [clientes, setClientes] = useState<ClienteProducao[]>([])
  const [carregando, setCarregando] = useState(true)
  const [selecionado, setSelecionado] = useState<SetorKanbanItem | null>(null)
  const [novaAberta, setNovaAberta] = useState(false)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [medicoes, setMedicoes] = useState<MedicaoFinalProducao[]>([])
  const [liberandoId, setLiberandoId] = useState<string | null>(null)

  const [modo, setModo] = useState<'avulsa' | 'vinculada'>('avulsa')
  const [clienteId, setClienteId] = useState('')
  const [obraId, setObraId] = useState('')
  const [vendaId, setVendaId] = useState('')
  const [obras, setObras] = useState<ObraProducao[]>([])
  const [vendas, setVendas] = useState<VendaProducao[]>([])
  const [tipo, setTipo] = useState<OrdemProducao['tipo_producao']>('contramarco')
  const [titulo, setTitulo] = useState('')
  const [largura, setLargura] = useState('')
  const [altura, setAltura] = useState('')
  const [quantidade, setQuantidade] = useState('1')
  const [salvando, setSalvando] = useState(false)

  async function carregar() {
    setCarregando(true)
    const u = await usuarioAtual()
    if (u) {
      try {
        const token = await tokenAtual()
        if (token) {
          await fetch('/api/producao/medicoes-finais/sincronizar', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          })
        }
      } catch (e) {
        console.warn('Não foi possível sincronizar a fila da Produção nesta carga:', e)
      }
    }

    const [cols, its, ops, cls, meds] = await Promise.all([
      listarColunasSetor('producao'),
      listarItensSetor('producao'),
      listarOrdensProducao(),
      listarClientesProducao(),
      listarMedicoesFinaisProducao(),
    ])
    setUsuario(u)
    setColunas(cols)
    setCards(its)
    setOrdens(ops)
    setClientes(cls)
    setMedicoes(meds)
    setCarregando(false)
  }

  useEffect(() => { void carregar() }, [])

  useEffect(() => {
    if (!clienteId) { setObras([]); setVendas([]); setObraId(''); setVendaId(''); return }
    listarObrasProducao(clienteId).then(setObras)
    listarVendasProducao(clienteId, obraId || null).then(setVendas)
  }, [clienteId, obraId])

  const ordensPorCard = useMemo(() => {
    const mapa = new Map<string, OrdemProducao[]>()
    ordens.forEach(o => {
      if (!o.setor_card_id) return
      const lista = mapa.get(o.setor_card_id) || []
      lista.push(o); mapa.set(o.setor_card_id, lista)
    })
    return mapa
  }, [ordens])

  const medicaoPorOrcamento = useMemo(() => {
    const mapa = new Map<string, MedicaoFinalProducao>()
    medicoes.forEach(m => {
      if (m.orcamento_id && !mapa.has(m.orcamento_id)) mapa.set(m.orcamento_id, m)
    })
    return mapa
  }, [medicoes])

  function medicaoDoCard(card: SetorKanbanItem | null) {
    if (!card) return null
    if (card.orcamento_id) return medicaoPorOrcamento.get(card.orcamento_id) || null
    const marker = String(card.descricao || '').match(/\[medicao:([^\]]+)\]/)?.[1]
    return marker ? medicoes.find(m => m.id === marker) || null : null
  }

  function cardsDaColuna(id: string) { return cards.filter(c => c.coluna_id === id) }

  async function moverCard(e: React.DragEvent, colunaId: string) {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain')
    if (!id) return
    const anterior = cards
    setCards(prev => prev.map(c => c.id === id ? { ...c, coluna_id: colunaId } : c))
    const ok = await moverItemSetor(id, colunaId)
    if (!ok) setCards(anterior)
  }

  async function criarEtapa() {
    const nome = window.prompt('Nome da nova etapa da Produção:')?.trim() || ''
    if (!nome) return
    setErro('')
    const criada = await criarColunaSetor('producao', nome)
    if (!criada) {
      setErro('Não foi possível criar a nova etapa da Produção.')
      return
    }
    setColunas(prev => [...prev, criada].sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0)))
  }

  async function abrirRelatorioMedicao(medicaoId: string) {
    setErro('')
    const [medicao, itens] = await Promise.all([
      buscarMedicao(medicaoId),
      listarItensMedicao(medicaoId),
    ])
    if (!medicao) {
      setErro('Não foi possível carregar a Medição Final para gerar o relatório.')
      return
    }
    await gerarPdfMedicaoFinal(medicao, itens)
  }

  async function liberarProducao(card: SetorKanbanItem) {
    const medicao = medicaoDoCard(card)
    if (!medicao) {
      setErro('Este card ainda não possui uma Medição Final vinculada.')
      return
    }
    if (liberandoId) return

    setErro('')
    setMensagem('')
    if (!window.confirm(
      'Liberar esta Medição Final para Produção?\n\nO Atlas aprovará a medição, liberará os fluxos pós-medição e gerará o pacote técnico/plano de corte com as medidas finais.',
    )) return

    setLiberandoId(card.id)
    try {
      if (medicao.status_operacional !== 'aprovado') {
        if (medicao.status_operacional !== 'concluido') {
          setErro('A Medição Final precisa estar concluída antes de liberar a Produção.')
          return
        }
        const aprovado = await aprovarMedicaoFinal(medicao.id, usuario)
        if (!aprovado.ok) {
          setErro(aprovado.mensagem || 'Não foi possível aprovar a Medição Final.')
          return
        }
      }

      if (card.orcamento_id) {
        const pacote = await gerarPacoteMedicaoFinal(card.orcamento_id, usuario)
        if (!pacote.ok) {
          setErro(`Medição aprovada, mas o plano de corte ficou pendente: ${pacote.error}`)
          await carregar()
          return
        }
      }

      const colunaAtual = colunas.find(c => c.id === card.coluna_id)
      const proxima = colunas
        .filter(c => Number(c.ordem || 0) > Number(colunaAtual?.ordem || 0))
        .sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0))[0] || null

      const marcado = await marcarCardLiberadoProducao(card.id, proxima?.id || null, usuario)
      if (!marcado.ok) {
        setErro(marcado.error || 'A medição foi aprovada, mas não foi possível atualizar o Kanban.')
        await carregar()
        return
      }

      setMensagem(
        proxima
          ? `Produção liberada. O card avançou para “${proxima.nome}”. Vidros/MEE foram liberados pela aprovação e o plano final foi gerado.`
          : 'Produção liberada. Vidros/MEE foram liberados pela aprovação e o plano final foi gerado.',
      )
      setSelecionado(null)
      await carregar()
    } finally {
      setLiberandoId(null)
    }
  }

  async function avancarOrdem(ordem: OrdemProducao) {
    if (ordem.bloqueada || ordem.status === 'concluida' || ordem.status === 'cancelada') return
    const proximo: OrdemProducao['status'] = ordem.status === 'liberada' || ordem.status === 'aguardando'
      ? 'em_producao' : ordem.status === 'em_producao' ? 'conferencia' : 'concluida'
    const r = await atualizarOrdemProducao(ordem.id, { status: proximo })
    if (!r.ok) { setErro(r.error || 'Não foi possível atualizar a ordem.'); return }
    setOrdens(prev => prev.map(o => o.id === ordem.id ? { ...o, status: proximo } : o))
  }

  async function criarManual() {
    if (!titulo.trim()) { setErro('Informe o que será produzido.'); return }
    if (modo === 'vinculada' && !clienteId) { setErro('Selecione o cliente.'); return }
    setSalvando(true); setErro('')
    const venda = vendas.find(v => v.id === vendaId)
    const r = await criarOrdemProducaoManual({
      clienteId: modo === 'vinculada' ? clienteId : null,
      obraId: modo === 'vinculada' ? obraId || null : null,
      vendaId: modo === 'vinculada' ? vendaId || null : null,
      orcamentoId: venda?.orcamento_id || null,
      tipoProducao: tipo,
      titulo: titulo.trim(),
      quantidade: Math.max(1, Number(quantidade || 1)),
      larguraMm: largura ? Number(largura) : null,
      alturaMm: altura ? Number(altura) : null,
    })
    setSalvando(false)
    if (!r.ok) { setErro(r.error || 'Não foi possível criar a produção.'); return }
    setNovaAberta(false); setTitulo(''); setLargura(''); setAltura(''); setQuantidade('1'); setClienteId(''); setObraId(''); setVendaId('')
    await carregar()
  }

  if (carregando) return <div className="min-h-screen grid place-items-center text-slate-400">Carregando Produção...</div>

  const ordensSelecionadas = selecionado ? (ordensPorCard.get(selecionado.id) || []) : []
  const medicaoSelecionada = medicaoDoCard(selecionado)

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/setores" className="p-2 rounded-xl hover:bg-slate-100 text-slate-500"><ArrowLeft size={18}/></Link>
            <div><h1 className="text-lg font-bold text-brand-navy">Produção</h1><p className="text-xs text-slate-500">Cliente → Obra → Venda → Ordem de Produção → Plano de Corte</p></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/producao/plano-corte" className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700"><FileSpreadsheet size={16}/> Plano de Corte</Link>
            <button onClick={() => void criarEtapa()} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700"><Plus size={16}/> Nova etapa</button>
            <button onClick={() => setNovaAberta(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-navy text-white text-sm font-medium"><Plus size={16}/> Nova produção</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {erro && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}
        {mensagem && <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{mensagem}</div>}
        <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-slate-700">
          A <b>Medição Final enviada</b> entra automaticamente em <b>Liberar Produção</b>. Abra o card, confira/imprima o relatório e só então libere o plano final e os fluxos pós-medição. Use <b>+ Nova etapa</b> para acrescentar novas fases ao Kanban.
        </div>

        <div className="flex gap-4 overflow-x-auto pb-5">
          {colunas.map(col => (
            <section key={col.id} onDragOver={e => e.preventDefault()} onDrop={e => moverCard(e, col.id)} className="w-80 shrink-0 rounded-2xl bg-slate-100 p-3">
              <div className="flex items-center justify-between px-1 mb-3"><h2 className="text-sm font-semibold text-slate-700">{col.nome}</h2><span className="text-xs text-slate-400">{cardsDaColuna(col.id).length}</span></div>
              <div className="space-y-2 min-h-24">
                {cardsDaColuna(col.id).map(card => {
                  const ops = ordensPorCard.get(card.id) || []
                  const bloqueadas = ops.filter(o => o.bloqueada && o.status !== 'cancelada').length
                  const prontas = ops.filter(o => o.status === 'concluida').length
                  const medicao = medicaoDoCard(card)
                  return (
                    <button key={card.id} draggable onDragStart={e => e.dataTransfer.setData('text/plain', card.id)} onClick={() => setSelecionado(card)} className="w-full text-left rounded-xl border border-slate-200 bg-white p-3 hover:shadow-md transition">
                      <div className="flex items-start gap-2"><Package size={15} className="mt-0.5 text-brand-navy"/><div className="min-w-0 flex-1"><p className="font-medium text-sm text-slate-800 truncate">{card.titulo}</p><p className="text-[11px] text-slate-400 mt-0.5">{medicao?.orcamento_numero ? `Orçamento #${medicao.orcamento_numero} · ` : ''}{ops.length} ordem(ns)</p></div></div>
                      {medicao && <div className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${medicao.status_operacional === 'aprovado' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}><Ruler size={11}/>{medicao.status_operacional === 'aprovado' ? 'Medição final liberada' : 'Medição final enviada'}</div>}
                      {bloqueadas > 0 && <div className="mt-2 ml-1 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[11px] text-amber-700"><LockKeyhole size={11}/>{bloqueadas} bloqueada(s)</div>}
                      {prontas > 0 && <p className="mt-2 text-[11px] text-slate-400">{prontas} ordem(ns) concluída(s)</p>}
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </main>

      {selecionado && (
        <div className="fixed inset-0 z-50 bg-black/40 p-4 flex items-center justify-center">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-start justify-between gap-3">
              <div><h3 className="font-bold text-slate-900">{selecionado.titulo}</h3><p className="text-xs text-slate-500 mt-0.5">Ordens desta obra/produção</p></div>
              <button onClick={() => setSelecionado(null)} className="p-1 text-slate-400"><X size={18}/></button>
            </div>
            <div className="p-5 space-y-3">
              {medicaoSelecionada && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-600">Conferência da Medição Final</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{medicaoSelecionada.cliente_nome}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {medicaoSelecionada.orcamento_numero ? `Orçamento #${medicaoSelecionada.orcamento_numero} · ` : ''}
                        {medicaoSelecionada.status_operacional === 'aprovado' ? 'Produção liberada' : 'Aguardando liberação da Produção'}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${medicaoSelecionada.status_operacional === 'aprovado' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
                      {medicaoSelecionada.status_operacional === 'aprovado' ? 'Liberada' : 'Conferir'}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={`/producao/medicao-final/${medicaoSelecionada.id}`} className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-800"><Ruler size={14}/> Abrir Medição Final</Link>
                    <button onClick={() => void abrirRelatorioMedicao(medicaoSelecionada.id)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"><FileText size={14}/> Relatório PDF</button>
                    {selecionado?.orcamento_id && medicaoSelecionada.status_operacional === 'aprovado' && (
                      <Link href={`/orcamento/${selecionado.orcamento_id}/plano-corte`} className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800"><FileSpreadsheet size={14}/> Plano de corte final</Link>
                    )}
                    {medicaoSelecionada.status_operacional !== 'aprovado' && (
                      <button
                        onClick={() => selecionado && void liberarProducao(selecionado)}
                        disabled={liberandoId === selecionado?.id}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                      >
                        {liberandoId === selecionado?.id ? <Loader2 size={14} className="animate-spin"/> : <ShieldCheck size={14}/>}
                        {liberandoId === selecionado?.id ? 'Liberando...' : 'Liberar Produção'}
                      </button>
                    )}
                  </div>
                  <p className="mt-3 text-[11px] leading-5 text-slate-500">Ao liberar, o Atlas aprova a Medição Final, dispara os fluxos de Vidros/MEE e gera o pacote técnico usando as menores medidas finais registradas.</p>
                </div>
              )}
              {ordensSelecionadas.length === 0 && <p className="text-sm text-slate-400">As ordens de produção aparecerão aqui quando os gates técnicos e de materiais forem liberados.</p>}
              {ordensSelecionadas.map(o => (
                <div key={o.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2"><span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">OP #{o.numero}</span><span className="text-xs font-medium text-brand-navy">{tipoLabel(o.tipo_producao)}</span></div>
                      <p className="mt-2 font-medium text-slate-800">{o.titulo}</p>
                      <p className="text-xs text-slate-500 mt-1">{o.quantidade} un. {o.largura_mm && o.altura_mm ? `· ${o.largura_mm} × ${o.altura_mm} mm` : ''}</p>
                      {o.cliente_nome && <p className="text-xs text-slate-500 mt-1">{o.cliente_nome}{o.obra_nome ? ` · ${o.obra_nome}` : ''}{o.venda_numero ? ` · Venda #${o.venda_numero}` : ''}</p>}
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${o.bloqueada ? 'bg-amber-50 text-amber-700' : o.status === 'concluida' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>{o.bloqueada ? 'Bloqueada' : statusLabel(o.status)}</span>
                  </div>
                  {o.bloqueio_motivo && <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800"><b>Bloqueio:</b> {o.bloqueio_motivo}</div>}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={`/producao/plano-corte?ordem=${o.id}`} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700"><Ruler size={14}/> Abrir plano de corte</Link>
                    {!o.bloqueada && !['concluida','cancelada'].includes(o.status) && <button onClick={() => avancarOrdem(o)} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-navy px-3 py-2 text-xs font-medium text-white">{o.status === 'em_producao' ? <ClipboardCheck size={14}/> : o.status === 'conferencia' ? <CheckCircle2 size={14}/> : <Play size={14}/>} {o.status === 'em_producao' ? 'Enviar para conferência' : o.status === 'conferencia' ? 'Concluir ordem' : 'Iniciar produção'}</button>}
                    {o.cliente_id && <Link href={`/clientes/${o.cliente_id}/central?aba=andamento`} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700"><UserRound size={14}/> Cliente 360</Link>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {novaAberta && (
        <div className="fixed inset-0 z-50 bg-black/40 p-4 flex items-center justify-center">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between"><div><h3 className="font-bold text-slate-900">Nova produção</h3><p className="text-xs text-slate-500">Avulsa ou vinculada a cliente/obra.</p></div><button onClick={() => setNovaAberta(false)} className="text-slate-400"><X size={18}/></button></div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-2"><button onClick={() => setModo('avulsa')} className={`rounded-xl border px-3 py-2 text-sm ${modo === 'avulsa' ? 'border-brand-navy bg-brand-navyLight text-brand-navy font-semibold' : 'border-slate-200'}`}>Produção avulsa</button><button onClick={() => setModo('vinculada')} className={`rounded-xl border px-3 py-2 text-sm ${modo === 'vinculada' ? 'border-brand-navy bg-brand-navyLight text-brand-navy font-semibold' : 'border-slate-200'}`}>Vincular cliente/obra</button></div>

              {modo === 'vinculada' && <div className="grid md:grid-cols-2 gap-3 rounded-2xl border border-slate-200 p-4">
                <label className="md:col-span-2"><span className="block text-xs font-medium text-slate-600 mb-1">Cliente</span><select value={clienteId} onChange={e => { setClienteId(e.target.value); setObraId(''); setVendaId('') }} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="">Selecione o cliente</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
                <label><span className="block text-xs font-medium text-slate-600 mb-1">Obra</span><select value={obraId} onChange={e => { setObraId(e.target.value); setVendaId('') }} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="">Sem obra específica</option>{obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}</select></label>
                <label><span className="block text-xs font-medium text-slate-600 mb-1">Venda</span><select value={vendaId} onChange={e => setVendaId(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="">Sem venda específica</option>{vendas.map(v => <option key={v.id} value={v.id}>Venda #{v.numero}</option>)}</select></label>
              </div>}

              <div className="grid md:grid-cols-2 gap-3">
                <label><span className="block text-xs font-medium text-slate-600 mb-1">Tipo de produção</span><select value={tipo} onChange={e => setTipo(e.target.value as OrdemProducao['tipo_producao'])} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="contramarco">Contramarco</option><option value="esquadria">Esquadria / tipologia</option><option value="personalizada">Personalizada</option></select></label>
                <label><span className="block text-xs font-medium text-slate-600 mb-1">Quantidade</span><input type="number" min={1} value={quantidade} onChange={e => setQuantidade(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"/></label>
                <label className="md:col-span-2"><span className="block text-xs font-medium text-slate-600 mb-1">O que será produzido</span><input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex.: Contramarco da janela do escritório" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"/></label>
                <label><span className="block text-xs font-medium text-slate-600 mb-1">Largura (mm)</span><input type="number" value={largura} onChange={e => setLargura(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"/></label>
                <label><span className="block text-xs font-medium text-slate-600 mb-1">Altura (mm)</span><input type="number" value={altura} onChange={e => setAltura(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"/></label>
              </div>

              <button onClick={criarManual} disabled={salvando || !titulo.trim()} className="w-full rounded-xl bg-brand-navy py-2.5 text-sm font-semibold text-white disabled:opacity-40">{salvando ? 'Criando...' : 'Criar ordem de produção'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
