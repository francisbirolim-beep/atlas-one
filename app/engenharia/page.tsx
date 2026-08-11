'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, CheckCircle2, ClipboardCheck, FileText, Loader2, Ruler, ShieldAlert, Wrench, X } from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import { listarPermissoesUsuario, nivelEfetivo } from '@/lib/setores'
import type { NivelPermissao, Usuario } from '@/lib/tipos'
import {
  carregarDetalheObraEngenharia,
  carregarQuadroEngenharia,
  localizarSetorEngenharia,
  moverObraEngenharia,
  type DetalheObraEngenharia,
  type ObraEngenharia,
} from '@/lib/engenharia'
import type { SetorKanbanColuna } from '@/lib/tipos'

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
  const [setorId, setSetorId] = useState<string | null>(null)
  const [colunas, setColunas] = useState<SetorKanbanColuna[]>([])
  const [obras, setObras] = useState<ObraEngenharia[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [selecionada, setSelecionada] = useState<ObraEngenharia | null>(null)
  const [detalhe, setDetalhe] = useState<DetalheObraEngenharia | null>(null)
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
    setSetorId(setor.id)

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
    return {
      total: obras.length,
      conferencia: porNome('confer'),
      desenvolvimento: porNome('desenvol'),
      liberadas: porNome('liberad'),
    }
  }, [colunas, obras])

  async function abrirDetalhe(obra: ObraEngenharia) {
    setSelecionada(obra)
    setDetalhe(null)
    setCarregandoDetalhe(true)
    const dados = await carregarDetalheObraEngenharia(obra)
    setDetalhe(dados)
    setCarregandoDetalhe(false)
  }

  async function soltar(e: React.DragEvent, colunaId: string) {
    e.preventDefault()
    setColunaHover(null)
    if (nivel !== 'edicao') return
    const cardId = e.dataTransfer.getData('text/plain')
    if (!cardId) return

    const anterior = obras
    setObras(prev => prev.map(obra => obra.id === cardId ? { ...obra, coluna_id: colunaId } : obra))
    const ok = await moverObraEngenharia(cardId, colunaId)
    if (!ok) setObras(anterior)
  }

  if (carregando) {
    return <div className="atlas-eng-center"><Loader2 className="animate-spin" size={24} /> Carregando Engenharia...</div>
  }

  if (erro) {
    return <div className="atlas-eng-center text-red-600">{erro}</div>
  }

  if (nivel === 'oculto') {
    return (
      <div className="atlas-eng-center flex-col text-center">
        <ShieldAlert size={38} className="text-slate-300" />
        <p className="max-w-md text-slate-500">Você não tem acesso ao módulo de Engenharia.</p>
      </div>
    )
  }

  return (
    <div className="atlas-eng-page">
      <section className="atlas-eng-hero">
        <div>
          <p className="atlas-eng-eyebrow">Técnico · Engenharia</p>
          <h1>Engenharia de obras</h1>
          <p>Obras com Medição Final aprovada entram aqui automaticamente para conferência e desenvolvimento técnico.</p>
        </div>
        <div className="atlas-eng-hero-status">
          <CheckCircle2 size={18} /> Fluxo conectado à Medição Final
        </div>
      </section>

      <section className="atlas-eng-kpis">
        <article><span><FileText size={17} /> Obras no fluxo</span><strong>{totais.total}</strong></article>
        <article><span><ClipboardCheck size={17} /> Em conferência</span><strong>{totais.conferencia}</strong></article>
        <article><span><Wrench size={17} /> Em desenvolvimento</span><strong>{totais.desenvolvimento}</strong></article>
        <article><span><CheckCircle2 size={17} /> Liberadas</span><strong>{totais.liberadas}</strong></article>
      </section>

      <section className="atlas-eng-board-wrap">
        <div className="atlas-eng-board-heading">
          <div>
            <h2>Fluxo técnico</h2>
            <p>{nivel === 'edicao' ? 'Arraste as obras entre as etapas.' : 'Modo consulta — movimentações bloqueadas.'}</p>
          </div>
          <span>{obras.reduce((soma, obra) => soma + obra.totalPecas, 0)} peças aprovadas</span>
        </div>

        <div className="atlas-eng-board">
          {colunas.map(coluna => {
            const cards = obras.filter(obra => obra.coluna_id === coluna.id)
            return (
              <div
                key={coluna.id}
                className={`atlas-eng-column ${colunaHover === coluna.id ? 'is-hover' : ''}`}
                onDragOver={e => { if (nivel === 'edicao') { e.preventDefault(); setColunaHover(coluna.id) } }}
                onDragLeave={() => setColunaHover(null)}
                onDrop={e => soltar(e, coluna.id)}
              >
                <div className="atlas-eng-column-head">
                  <div><span>{coluna.nome}</span><small>{cards.length}</small></div>
                </div>
                <div className="atlas-eng-column-body">
                  {cards.map(obra => (
                    <button
                      key={obra.id}
                      draggable={nivel === 'edicao'}
                      onDragStart={e => e.dataTransfer.setData('text/plain', obra.id)}
                      onClick={() => abrirDetalhe(obra)}
                      className="atlas-eng-card"
                    >
                      <div className="atlas-eng-card-top">
                        <strong>{obra.titulo}</strong>
                        <ArrowRight size={15} />
                      </div>
                      <p>{obra.medicao?.cidade || 'Cidade não informada'}</p>
                      <div className="atlas-eng-card-meta">
                        <span><Ruler size={13} /> {obra.totalPecas || '—'} peça(s)</span>
                        <span>Aprovada {formatarData(obra.medicao?.aprovado_em)}</span>
                      </div>
                    </button>
                  ))}
                  {cards.length === 0 && <div className="atlas-eng-empty">Nenhuma obra nesta etapa.</div>}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {selecionada && (
        <div className="atlas-eng-modal-backdrop" onMouseDown={() => setSelecionada(null)}>
          <div className="atlas-eng-modal" onMouseDown={e => e.stopPropagation()}>
            <div className="atlas-eng-modal-head">
              <div>
                <p>Detalhe técnico</p>
                <h2>{selecionada.titulo}</h2>
              </div>
              <button onClick={() => setSelecionada(null)}><X size={20} /></button>
            </div>

            {carregandoDetalhe ? (
              <div className="atlas-eng-modal-loading"><Loader2 className="animate-spin" size={22} /> Carregando peças...</div>
            ) : detalhe ? (
              <div className="atlas-eng-modal-content">
                <div className="atlas-eng-client-grid">
                  <div><span>Cliente</span><strong>{detalhe.medicao?.cliente_nome || detalhe.card.titulo}</strong></div>
                  <div><span>Cidade</span><strong>{detalhe.medicao?.cidade || '—'}</strong></div>
                  <div><span>Endereço</span><strong>{[detalhe.medicao?.endereco, detalhe.medicao?.bairro].filter(Boolean).join(' · ') || '—'}</strong></div>
                  <div><span>Aprovação</span><strong>{formatarData(detalhe.medicao?.aprovado_em)}</strong></div>
                </div>

                {detalhe.medicao?.id && (
                  <Link href={`/producao/medicao-final/${detalhe.medicao.id}`} className="atlas-eng-source-link">
                    Abrir Medição Final original <ArrowRight size={15} />
                  </Link>
                )}

                <div className="atlas-eng-pieces">
                  <div className="atlas-eng-pieces-title">
                    <h3>Peças aprovadas</h3><span>{detalhe.itens.length}</span>
                  </div>
                  {detalhe.itens.map((item, index) => (
                    <article key={item.id} className="atlas-eng-piece">
                      <div className="atlas-eng-piece-title">
                        <div><span>Peça {index + 1}</span><strong>{item.descricao || item.tipo_outro_texto || item.tipo_esquadria}</strong></div>
                        <small>{item.tipo_esquadria}</small>
                      </div>
                      <div className="atlas-eng-measures">
                        <div><span>Larguras · baixo / meio / cima</span><strong>{medida(item.largura_baixo_mm)} · {medida(item.largura_meio_mm)} · {medida(item.largura_cima_mm)}</strong></div>
                        <div><span>Alturas · direita / meio / esquerda</span><strong>{medida(item.altura_direita_mm)} · {medida(item.altura_meio_mm)} · {medida(item.altura_esquerda_mm)}</strong></div>
                      </div>
                    </article>
                  ))}
                  {detalhe.itens.length === 0 && <div className="atlas-eng-empty">Nenhuma peça vinculada à Medição Final.</div>}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
