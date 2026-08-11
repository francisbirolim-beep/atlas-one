'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, CheckCircle2, CircleAlert, ClipboardCheck, FileText, Loader2, Ruler, Save, ShieldAlert, Wrench, X } from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import { listarPermissoesUsuario, nivelEfetivo } from '@/lib/setores'
import type { NivelPermissao, Usuario, SetorKanbanColuna } from '@/lib/tipos'
import {
  carregarDetalheObraEngenharia,
  carregarQuadroEngenharia,
  localizarSetorEngenharia,
  moverObraEngenharia,
  type DetalheObraEngenharia,
  type ObraEngenharia,
} from '@/lib/engenharia'
import {
  listarConferenciasEngenharia,
  salvarConferenciaEngenharia,
  resumoConferencias,
  type ConferenciaEngenharia,
  type StatusConferenciaEngenharia,
} from '@/lib/engenhariaConferencia'

function formatarData(valor?: string | null) {
  if (!valor) return '—'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(valor))
}

function medida(valor?: number | null) {
  return typeof valor === 'number' ? `${valor} mm` : '—'
}

export default function EngenhariaPage() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [nivel, setNivel] = useState<NivelPermissao>('oculto')
  const [colunas, setColunas] = useState<SetorKanbanColuna[]>([])
  const [obras, setObras] = useState<ObraEngenharia[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [selecionada, setSelecionada] = useState<ObraEngenharia | null>(null)
  const [detalhe, setDetalhe] = useState<DetalheObraEngenharia | null>(null)
  const [conferencias, setConferencias] = useState<Record<string, ConferenciaEngenharia>>({})
  const [rascunhos, setRascunhos] = useState<Record<string, string>>({})
  const [salvandoItem, setSalvandoItem] = useState<string | null>(null)
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false)
  const [colunaHover, setColunaHover] = useState<string | null>(null)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setCarregando(true)
    setErro(null)
    const [me, setor] = await Promise.all([usuarioAtual(), localizarSetorEngenharia()])
    setUsuario(me)

    if (!setor) {
      setErro('O setor Engenharia não foi encontrado no cadastro de setores.')
      setCarregando(false)
      return
    }

    let mapa: Record<string, NivelPermissao> = {}
    if (me && me.role !== 'master') mapa = await listarPermissoesUsuario(me.id)
    const acesso = nivelEfetivo(me, setor.id, mapa)
    setNivel(acesso)

    if (acesso !== 'oculto') {
      const quadro = await carregarQuadroEngenharia(setor.id)
      setColunas(quadro.colunas)
      setObras(quadro.obras)
    }
    setCarregando(false)
  }

  const totais = useMemo(() => {
    const porNome = (termo: string) => {
      const ids = colunas.filter(c => c.nome.toLowerCase().includes(termo)).map(c => c.id)
      return obras.filter(o => ids.includes(o.coluna_id)).length
    }
    return { total: obras.length, conferencia: porNome('confer'), desenvolvimento: porNome('desenvol'), liberadas: porNome('liberad') }
  }, [colunas, obras])

  const resumoAtual = useMemo(() => {
    if (!detalhe) return { total: 0, conferidas: 0, pendencias: 0, pendentes: 0, completa: false }
    return resumoConferencias(detalhe.itens.map(i => i.id), conferencias)
  }, [detalhe, conferencias])

  async function abrirDetalhe(obra: ObraEngenharia) {
    setSelecionada(obra)
    setDetalhe(null)
    setConferencias({})
    setRascunhos({})
    setCarregandoDetalhe(true)
    const dados = await carregarDetalheObraEngenharia(obra)
    setDetalhe(dados)
    const mapa = await listarConferenciasEngenharia(dados.itens.map(i => i.id))
    setConferencias(mapa)
    const obs: Record<string, string> = {}
    dados.itens.forEach(item => { obs[item.id] = mapa[item.id]?.observacao || '' })
    setRascunhos(obs)
    setCarregandoDetalhe(false)
  }

  async function registrarConferencia(itemId: string, status: StatusConferenciaEngenharia) {
    if (nivel !== 'edicao') return
    setSalvandoItem(itemId)
    const salvo = await salvarConferenciaEngenharia(itemId, status, rascunhos[itemId] || '', usuario)
    if (salvo) setConferencias(prev => ({ ...prev, [itemId]: salvo }))
    else alert('Não foi possível salvar a conferência técnica desta peça.')
    setSalvandoItem(null)
  }

  async function soltar(e: React.DragEvent, colunaId: string) {
    e.preventDefault()
    setColunaHover(null)
    if (nivel !== 'edicao') return
    const cardId = e.dataTransfer.getData('text/plain')
    if (!cardId) return

    const destino = colunas.find(c => c.id === colunaId)
    const obra = obras.find(o => o.id === cardId)
    if (destino?.nome.toLowerCase().includes('liberad') && obra) {
      const dados = await carregarDetalheObraEngenharia(obra)
      const mapa = await listarConferenciasEngenharia(dados.itens.map(i => i.id))
      const resumo = resumoConferencias(dados.itens.map(i => i.id), mapa)
      if (!resumo.completa) {
        alert(`Liberação bloqueada. Faltam ${resumo.total - resumo.conferidas} peça(s) para concluir a conferência técnica.`)
        return
      }
    }

    const anterior = obras
    setObras(prev => prev.map(obraAtual => obraAtual.id === cardId ? { ...obraAtual, coluna_id: colunaId } : obraAtual))
    const ok = await moverObraEngenharia(cardId, colunaId)
    if (!ok) {
      setObras(anterior)
      alert('Não foi possível mover a obra. Se o destino for Produção, confira todas as peças antes da liberação.')
    }
  }

  if (carregando) return <div className="atlas-eng-center"><Loader2 className="animate-spin" size={24} /> Carregando Engenharia...</div>
  if (erro) return <div className="atlas-eng-center text-red-600">{erro}</div>
  if (nivel === 'oculto') return <div className="atlas-eng-center flex-col text-center"><ShieldAlert size={38} className="text-slate-300" /><p className="max-w-md text-slate-500">Você não tem acesso ao módulo de Engenharia.</p></div>

  return (
    <div className="atlas-eng-page">
      <section className="atlas-eng-hero">
        <div><p className="atlas-eng-eyebrow">Técnico · Engenharia</p><h1>Engenharia de obras</h1><p>Obras com Medição Final aprovada entram aqui automaticamente para conferência e desenvolvimento técnico.</p></div>
        <div className="atlas-eng-hero-status"><CheckCircle2 size={18} /> Fluxo conectado à Medição Final</div>
      </section>

      <section className="atlas-eng-kpis">
        <article><span><FileText size={17} /> Obras no fluxo</span><strong>{totais.total}</strong></article>
        <article><span><ClipboardCheck size={17} /> Em conferência</span><strong>{totais.conferencia}</strong></article>
        <article><span><Wrench size={17} /> Em desenvolvimento</span><strong>{totais.desenvolvimento}</strong></article>
        <article><span><CheckCircle2 size={17} /> Liberadas</span><strong>{totais.liberadas}</strong></article>
      </section>

      <section className="atlas-eng-board-wrap">
        <div className="atlas-eng-board-heading"><div><h2>Fluxo técnico</h2><p>{nivel === 'edicao' ? 'Arraste as obras entre as etapas. A liberação exige conferência completa.' : 'Modo consulta — movimentações bloqueadas.'}</p></div><span>{obras.reduce((soma, obra) => soma + obra.totalPecas, 0)} peças aprovadas</span></div>
        <div className="atlas-eng-board">
          {colunas.map(coluna => {
            const cards = obras.filter(obra => obra.coluna_id === coluna.id)
            return <div key={coluna.id} className={`atlas-eng-column ${colunaHover === coluna.id ? 'is-hover' : ''}`} onDragOver={e => { if (nivel === 'edicao') { e.preventDefault(); setColunaHover(coluna.id) } }} onDragLeave={() => setColunaHover(null)} onDrop={e => soltar(e, coluna.id)}>
              <div className="atlas-eng-column-head"><div><span>{coluna.nome}</span><small>{cards.length}</small></div></div>
              <div className="atlas-eng-column-body">
                {cards.map(obra => <button key={obra.id} draggable={nivel === 'edicao'} onDragStart={e => e.dataTransfer.setData('text/plain', obra.id)} onClick={() => abrirDetalhe(obra)} className="atlas-eng-card">
                  <div className="atlas-eng-card-top"><strong>{obra.titulo}</strong><ArrowRight size={15} /></div>
                  <p>{obra.medicao?.cidade || 'Cidade não informada'}</p>
                  <div className="atlas-eng-card-meta"><span><Ruler size={13} /> {obra.totalPecas || '—'} peça(s)</span><span>Aprovada {formatarData(obra.medicao?.aprovado_em)}</span></div>
                </button>)}
                {cards.length === 0 && <div className="atlas-eng-empty">Nenhuma obra nesta etapa.</div>}
              </div>
            </div>
          })}
        </div>
      </section>

      {selecionada && <div className="atlas-eng-modal-backdrop" onMouseDown={() => setSelecionada(null)}><div className="atlas-eng-modal" onMouseDown={e => e.stopPropagation()}>
        <div className="atlas-eng-modal-head"><div><p>Conferência técnica</p><h2>{selecionada.titulo}</h2></div><button onClick={() => setSelecionada(null)}><X size={20} /></button></div>
        {carregandoDetalhe ? <div className="atlas-eng-modal-loading"><Loader2 className="animate-spin" size={22} /> Carregando peças...</div> : detalhe ? <div className="atlas-eng-modal-content">
          <div className="atlas-eng-client-grid"><div><span>Cliente</span><strong>{detalhe.medicao?.cliente_nome || detalhe.card.titulo}</strong></div><div><span>Cidade</span><strong>{detalhe.medicao?.cidade || '—'}</strong></div><div><span>Endereço</span><strong>{[detalhe.medicao?.endereco, detalhe.medicao?.bairro].filter(Boolean).join(' · ') || '—'}</strong></div><div><span>Aprovação</span><strong>{formatarData(detalhe.medicao?.aprovado_em)}</strong></div></div>
          {detalhe.medicao?.id && <Link href={`/producao/medicao-final/${detalhe.medicao.id}`} className="atlas-eng-source-link">Abrir Medição Final original <ArrowRight size={15} /></Link>}

          <div className={`rounded-2xl border p-4 ${resumoAtual.completa ? 'border-emerald-200 bg-emerald-50' : resumoAtual.pendencias > 0 ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
            <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Progresso da conferência</p><p className="mt-1 text-sm font-semibold text-slate-900">{resumoAtual.conferidas} de {resumoAtual.total} peças conferidas</p></div><div className="flex gap-2 text-xs"><span className="rounded-full bg-white px-3 py-1.5 font-medium text-slate-600">{resumoAtual.pendentes} pendentes</span>{resumoAtual.pendencias > 0 && <span className="rounded-full bg-amber-100 px-3 py-1.5 font-medium text-amber-800">{resumoAtual.pendencias} com pendência</span>}</div></div>
          </div>

          <div className="atlas-eng-pieces"><div className="atlas-eng-pieces-title"><h3>Peças para conferência</h3><span>{detalhe.itens.length}</span></div>
            {detalhe.itens.map((item, index) => {
              const conf = conferencias[item.id]
              const status = conf?.status || 'pendente'
              return <article key={item.id} className="atlas-eng-piece">
                <div className="atlas-eng-piece-title"><div><span>Peça {index + 1}</span><strong>{item.descricao || item.tipo_outro_texto || item.tipo_esquadria}</strong></div><small>{item.tipo_esquadria}</small></div>
                <div className="atlas-eng-measures"><div><span>Larguras · baixo / meio / cima</span><strong>{medida(item.largura_baixo_mm)} · {medida(item.largura_meio_mm)} · {medida(item.largura_cima_mm)}</strong></div><div><span>Alturas · direita / meio / esquerda</span><strong>{medida(item.altura_direita_mm)} · {medida(item.altura_meio_mm)} · {medida(item.altura_esquerda_mm)}</strong></div></div>
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <div className="flex flex-wrap gap-2">
                    {(['pendente','conferida','pendencia'] as StatusConferenciaEngenharia[]).map(opcao => <button key={opcao} disabled={nivel !== 'edicao' || salvandoItem === item.id} onClick={() => registrarConferencia(item.id, opcao)} className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${status === opcao ? opcao === 'conferida' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : opcao === 'pendencia' ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-slate-300 bg-slate-100 text-slate-700' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'} disabled:opacity-50`}>
                      {opcao === 'pendente' ? 'Pendente' : opcao === 'conferida' ? 'Conferida' : 'Pendência'}
                    </button>)}
                  </div>
                  <textarea value={rascunhos[item.id] || ''} disabled={nivel !== 'edicao'} onChange={e => setRascunhos(prev => ({ ...prev, [item.id]: e.target.value }))} placeholder="Observação técnica da peça..." rows={2} className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400 disabled:bg-slate-50" />
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400"><span>{conf?.responsavel_nome ? `Responsável: ${conf.responsavel_nome}` : 'Sem responsável registrado'}</span>{nivel === 'edicao' && <button onClick={() => registrarConferencia(item.id, status)} disabled={salvandoItem === item.id} className="inline-flex items-center gap-1.5 font-semibold text-slate-600 hover:text-slate-900"><Save size={13} /> Salvar observação</button>}</div>
                  {status === 'pendencia' && <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800"><CircleAlert size={15} className="mt-0.5 shrink-0" /> Esta peça impede a liberação da obra para Produção até ser marcada como conferida.</div>}
                </div>
              </article>
            })}
            {detalhe.itens.length === 0 && <div className="atlas-eng-empty">Nenhuma peça vinculada à Medição Final.</div>}
          </div>
        </div> : null}
      </div></div>}
    </div>
  )
}
