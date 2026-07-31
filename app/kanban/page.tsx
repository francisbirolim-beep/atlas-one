'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Plus, Pencil, Trash2, X, Phone, MapPin, Camera, FileText, User, Building2, Clock, Play, Paperclip, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { KanbanColuna, OrcamentoRapido, ItemEsquadria, TipoEsquadria, HistoricoItem, Usuario } from '@/lib/tipos'
import { listarColunas, criarColuna, renomearColuna, excluirColuna, moverCard } from '@/lib/kanban'
import { usuarioAtual } from '@/lib/auth'
import { registrarHistorico, listarHistorico } from '@/lib/historico'
import { uploadFoto, uploadArquivo } from '@/lib/upload'
import { corTextoParaFundo } from '@/lib/cor'
import { v4 as uuidv4 } from 'uuid'

const tipoLabels: Record<string, string> = {
  porta_correr: 'Porta de Correr',
  porta_pivotante: 'Porta Pivotante',
  porta_abrir: 'Porta de Abrir',
  janela_correr: 'Janela de Correr',
  janela_maximiar: 'Janela Maximiar',
  janela_basculante: 'Janela Basculante',
  vitro: 'Vitrô',
  fachada: 'Fachada',
  box: 'Box de Banheiro',
  outro: 'Outro',
}

function novoItemEdit(): ItemEsquadria {
  return { id: uuidv4(), tipo_esquadria: 'porta_correr', largura_mm: 0, altura_mm: 0, quantidade: 1 }
}

function formatarDuracao(inicioIso: string, fimIso: string): string {
  const ms = Math.max(0, new Date(fimIso).getTime() - new Date(inicioIso).getTime())
  const totalMin = Math.floor(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m}min`
  return `${h}h${m > 0 ? ` ${m}min` : ''}`
}

export default function Kanban() {
  const [colunas, setColunas] = useState<KanbanColuna[]>([])
  const [cards, setCards] = useState<OrcamentoRapido[]>([])
  const [carregando, setCarregando] = useState(true)
  const [cardSelecionado, setCardSelecionado] = useState<OrcamentoRapido | null>(null)
  const [editando, setEditando] = useState<OrcamentoRapido | null>(null)
  const [historico, setHistorico] = useState<HistoricoItem[]>([])
  const [salvando, setSalvando] = useState(false)
  const [colunaArrastando, setColunaArrastando] = useState<string | null>(null)
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [agora, setAgora] = useState(Date.now())

  useEffect(() => {
    carregar()
    usuarioAtual().then(setUsuario)
    const t = setInterval(() => setAgora(Date.now()), 60000)
    return () => clearInterval(t)
  }, [])

  async function carregar() {
    setCarregando(true)
    const [cols, { data: orc }] = await Promise.all([
      listarColunas(),
      supabase
        .from('orcamentos')
        .select('*')
        .order('created_at', { ascending: false }),
    ])
    setColunas(cols)
    if (orc) setCards(orc as OrcamentoRapido[])
    setCarregando(false)
  }

  function cardsDaColuna(colunaId: string, index: number) {
    return cards.filter(c => (c.coluna_id || colunas[0]?.id) === colunaId || (!c.coluna_id && index === 0))
  }

  function estiloCard(card: OrcamentoRapido, coluna: KanbanColuna | undefined): { fundo: string; texto: string; alerta: boolean } | null {
    if (!coluna) return null
    const base = card.coluna_atualizada_em || card.created_at
    if (base) {
      const horas = (agora - new Date(base).getTime()) / 3600000
      if (coluna.sla_vermelho_horas != null && horas >= coluna.sla_vermelho_horas) {
        const cor = coluna.sla_vermelho_cor || '#ef4444'
        return { fundo: cor, texto: corTextoParaFundo(cor), alerta: true }
      }
      if (coluna.sla_amarelo_horas != null && horas >= coluna.sla_amarelo_horas) {
        const cor = coluna.sla_amarelo_cor || '#f59e0b'
        return { fundo: cor, texto: corTextoParaFundo(cor), alerta: true }
      }
    }
    if (coluna.cor_cards) {
      return { fundo: coluna.cor_cards, texto: corTextoParaFundo(coluna.cor_cards), alerta: false }
    }
    return null
  }

  async function handleDrop(e: React.DragEvent, colunaId: string) {
    e.preventDefault()
    setColunaArrastando(null)
    const cardId = e.dataTransfer.getData('text/plain')
    if (!cardId) return
    const card = cards.find(c => c.id === cardId)
    const colunaAnterior = colunas.find(c => c.id === (card?.coluna_id || colunas[0]?.id))
    const colunaNova = colunas.find(c => c.id === colunaId)
    const agoraIso = new Date().toISOString()
    setCards(prev => prev.map(c => (c.id === cardId ? { ...c, coluna_id: colunaId, coluna_atualizada_em: agoraIso } : c)))
    await moverCard(cardId, colunaId)
    if (colunaAnterior?.id !== colunaNova?.id) {
      registrarHistorico(cardId, usuario, 'Moveu no painel', `${colunaAnterior?.nome || '—'} → ${colunaNova?.nome || '—'}`)
    }
  }

  async function novaColuna() {
    const nome = window.prompt('Nome da nova coluna:')
    if (!nome || !nome.trim()) return
    const col = await criarColuna(nome.trim())
    if (col) setColunas(prev => [...prev, col])
  }

  async function editarColuna(col: KanbanColuna) {
    const novoNome = window.prompt('Renomear coluna:', col.nome)
    if (!novoNome || !novoNome.trim() || novoNome === col.nome) return
    const ok = await renomearColuna(col.id, novoNome.trim())
    if (ok) setColunas(prev => prev.map(c => (c.id === col.id ? { ...c, nome: novoNome.trim() } : c)))
  }

  async function apagarColuna(col: KanbanColuna) {
    if (colunas.length <= 1) {
      alert('Precisa ter pelo menos uma coluna.')
      return
    }
    const outras = colunas.filter(c => c.id !== col.id)
    const destino = outras[0]
    const qtd = cards.filter(c => (c.coluna_id || colunas[0]?.id) === col.id).length
    const msg = qtd > 0
      ? `Essa coluna tem ${qtd} card(s). Eles vão pra coluna "${destino.nome}". Apagar mesmo assim?`
      : `Apagar a coluna "${col.nome}"?`
    if (!window.confirm(msg)) return

    const ok = await excluirColuna(col.id, destino.id)
    if (ok) {
      setColunas(prev => prev.filter(c => c.id !== col.id))
      setCards(prev => prev.map(c => (c.coluna_id === col.id ? { ...c, coluna_id: destino.id } : c)))
    }
  }

  function abrirCard(card: OrcamentoRapido) {
    setCardSelecionado(card)
    setEditando({ ...card, itens: card.itens ? card.itens.map(it => ({ ...it })) : [] })
    listarHistorico(card.id).then(setHistorico)
  }

  function atualizarCampo(campo: keyof OrcamentoRapido, valor: any) {
    setEditando(prev => (prev ? { ...prev, [campo]: valor } : prev))
  }

  function atualizarItemEdit(id: string, campo: keyof ItemEsquadria, valor: any) {
    setEditando(prev =>
      prev ? { ...prev, itens: (prev.itens || []).map(it => (it.id === id ? { ...it, [campo]: valor } : it)) } : prev
    )
  }

  function adicionarItemEdit() {
    setEditando(prev => (prev ? { ...prev, itens: [...(prev.itens || []), novoItemEdit()] } : prev))
  }

  function removerItemEdit(id: string) {
    setEditando(prev => (prev ? { ...prev, itens: (prev.itens || []).filter(it => it.id !== id) } : prev))
  }

  async function trocarFotoItem(id: string, file: File | undefined) {
    if (!file) return
    const url = await uploadFoto(file)
    if (url) atualizarItemEdit(id, 'foto_url', url)
  }

  async function iniciarOrcamento() {
    if (!cardSelecionado) return
    const agoraIso = new Date().toISOString()
    const { error } = await supabase
      .from('orcamentos')
      .update({ orcamento_iniciado_em: agoraIso })
      .eq('id', cardSelecionado.id)
    if (!error) {
      setEditando(prev => (prev ? { ...prev, orcamento_iniciado_em: agoraIso } : prev))
      setCardSelecionado(prev => (prev ? { ...prev, orcamento_iniciado_em: agoraIso } : prev))
      setCards(prev => prev.map(c => (c.id === cardSelecionado.id ? { ...c, orcamento_iniciado_em: agoraIso } : c)))
      await registrarHistorico(cardSelecionado.id, usuario, 'Iniciou o orçamento')
    }
  }

  async function anexarArquivoOrcamento(file: File | undefined) {
    if (!file) return
    const url = await uploadArquivo(file)
    if (url) setEditando(prev => (prev ? { ...prev, anexo_url: url, anexo_nome: file.name } : prev))
  }

  async function finalizarOrcamento() {
    if (!cardSelecionado || !editando) return
    if (!editando.anexo_url) {
      alert('Anexe o arquivo do orçamento antes de finalizar.')
      return
    }
    if (editando.valor_estimado == null) {
      alert('Informe o valor total do orçamento antes de finalizar.')
      return
    }
    setSalvando(true)
    const agoraIso = new Date().toISOString()
    const { error } = await supabase
      .from('orcamentos')
      .update({
        anexo_url: editando.anexo_url,
        anexo_nome: editando.anexo_nome,
        valor_estimado: editando.valor_estimado,
        orcamento_finalizado_em: agoraIso,
      })
      .eq('id', cardSelecionado.id)
    setSalvando(false)
    if (!error) {
      const duracao = editando.orcamento_iniciado_em ? formatarDuracao(editando.orcamento_iniciado_em, agoraIso) : null
      const atualizado = { ...editando, orcamento_finalizado_em: agoraIso }
      setCards(prev => prev.map(c => (c.id === cardSelecionado.id ? atualizado : c)))
      await registrarHistorico(cardSelecionado.id, usuario, 'Finalizou o orçamento', duracao ? `Levou ${duracao}` : undefined)
      setCardSelecionado(null)
      setEditando(null)
    }
  }

  function tentarFechar() {
    if (editando?.orcamento_iniciado_em && !editando?.orcamento_finalizado_em) {
      const motivo = window.prompt(
        'Você iniciou esse orçamento e ainda não finalizou. Por que está saindo agora? (fica registrado no histórico)'
      )
      if (!motivo || !motivo.trim()) {
        alert('Precisa informar o motivo pra sair sem finalizar.')
        return
      }
      if (cardSelecionado) registrarHistorico(cardSelecionado.id, usuario, 'Saiu sem finalizar o orçamento', motivo.trim())
    }
    setCardSelecionado(null)
    setEditando(null)
  }

  function resumoMudancas(original: OrcamentoRapido, novo: OrcamentoRapido): string {
    const partes: string[] = []
    if (original.cliente_nome !== novo.cliente_nome) partes.push('nome')
    if (original.cidade !== novo.cidade) partes.push('cidade')
    if (original.acabamento !== novo.acabamento) partes.push('cor')
    if (original.contramarco !== novo.contramarco) partes.push('contramarco')
    if (original.arquiteto_nome !== novo.arquiteto_nome) partes.push('arquiteto/engenheiro')
    if (original.valor_estimado !== novo.valor_estimado) partes.push('valor')
    if (original.coluna_id !== novo.coluna_id) partes.push('coluna')
    if ((original.itens?.length || 0) !== (novo.itens?.length || 0)) partes.push('esquadrias (quantidade)')
    else if (JSON.stringify(original.itens) !== JSON.stringify(novo.itens)) partes.push('esquadrias (dados)')
    return partes.length > 0 ? `Alterou: ${partes.join(', ')}` : 'Salvou sem mudanças'
  }

  async function salvarCard() {
    if (!editando || !cardSelecionado) return
    setSalvando(true)

    const colunaAnterior = cardSelecionado.coluna_id
    const mudouColuna = colunaAnterior !== editando.coluna_id

    const { error } = await supabase
      .from('orcamentos')
      .update({
        cliente_nome: editando.cliente_nome,
        cliente_whatsapp: editando.cliente_whatsapp,
        cidade: editando.cidade,
        acabamento: editando.acabamento,
        contramarco: editando.contramarco,
        arquiteto_nome: editando.arquiteto_nome,
        arquiteto_contato: editando.arquiteto_contato,
        itens: editando.itens,
        valor_estimado: editando.valor_estimado,
        coluna_id: editando.coluna_id,
        coluna_atualizada_em: mudouColuna ? new Date().toISOString() : cardSelecionado.coluna_atualizada_em,
      })
      .eq('id', cardSelecionado.id)

    setSalvando(false)
    if (!error) {
      const atualizado = {
        ...editando,
        coluna_atualizada_em: mudouColuna ? new Date().toISOString() : cardSelecionado.coluna_atualizada_em,
      }
      setCards(prev => prev.map(c => (c.id === cardSelecionado.id ? atualizado : c)))
      const resumo = resumoMudancas(cardSelecionado, editando)
      await registrarHistorico(cardSelecionado.id, usuario, 'Editou o orçamento', resumo)
      setCardSelecionado(null)
      setEditando(null)
    }
  }

  if (carregando) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Carregando...</div>
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/" className="p-2 hover:bg-slate-100 rounded-lg transition">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Painel de Orçamentos</h1>
            <p className="text-sm text-slate-500">Arraste os cards entre as colunas</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-4 overflow-x-auto pb-4">
          {colunas.map((col, index) => {
            const cardsColuna = cardsDaColuna(col.id, index)
            return (
              <div
                key={col.id}
                onDragOver={e => { e.preventDefault(); setColunaArrastando(col.id) }}
                onDragLeave={() => setColunaArrastando(null)}
                onDrop={e => handleDrop(e, col.id)}
                className={`flex-shrink-0 w-72 bg-slate-100 rounded-2xl p-3 transition ${
                  colunaArrastando === col.id ? 'ring-2 ring-blue-400 bg-blue-50' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-slate-700 text-sm">{col.nome}</h3>
                    <span className="text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full">
                      {cardsColuna.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => editarColuna(col)} className="p-1 text-slate-400 hover:text-slate-600">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => apagarColuna(col)} className="p-1 text-slate-400 hover:text-red-500">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 min-h-[80px]">
                  {cardsColuna.map(card => {
                    const est = estiloCard(card, col)
                    return (
                      <div
                        key={card.id}
                        draggable
                        onDragStart={e => e.dataTransfer.setData('text/plain', card.id)}
                        onClick={() => abrirCard(card)}
                        style={est ? { backgroundColor: est.fundo, borderColor: est.fundo } : undefined}
                        className={`rounded-xl border-2 p-3 cursor-pointer hover:shadow-md transition ${
                          est ? (est.alerta ? 'shadow-md' : 'shadow-sm') : 'bg-white border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div
                            className="p-1 rounded"
                            style={est ? { backgroundColor: 'rgba(255,255,255,0.3)' } : undefined}
                          >
                            {(card as any).modo_entrada === 'detalhado'
                              ? <Camera size={12} style={{ color: est ? est.texto : '#059669' }} />
                              : <FileText size={12} style={{ color: est ? est.texto : '#2563eb' }} />}
                          </div>
                          <p className="font-medium text-sm truncate" style={{ color: est ? est.texto : '#1e293b' }}>
                            {card.cliente_nome}
                          </p>
                        </div>
                        <p className="text-xs mb-1" style={{ color: est ? est.texto : '#64748b', opacity: est ? 0.9 : 1 }}>
                          {(card as any).itens?.length > 1
                            ? `${(card as any).itens.length} esquadrias`
                            : `${tipoLabels[card.tipo_esquadria] || card.tipo_esquadria}${card.largura_mm ? ` — ${card.largura_mm}×${card.altura_mm}mm` : ''}`}
                        </p>
                        {card.descricao_livre && (
                          <p className="text-xs line-clamp-2" style={{ color: est ? est.texto : '#94a3b8', opacity: est ? 0.8 : 1 }}>
                            {card.descricao_livre}
                          </p>
                        )}
                        {card.criado_por_nome && (
                          <p className="text-xs flex items-center gap-1 mt-1" style={{ color: est ? est.texto : '#94a3b8', opacity: est ? 0.85 : 1 }}>
                            <User size={11} /> {card.criado_por_nome}
                          </p>
                        )}
                        {card.valor_estimado != null && (
                          <p className="text-xs font-semibold mt-1" style={{ color: est ? est.texto : '#059669' }}>
                            R$ {card.valor_estimado.toFixed(2)}
                          </p>
                        )}
                        {card.orcamento_finalizado_em && card.orcamento_iniciado_em ? (
                          <p className="text-xs flex items-center gap-1 mt-1" style={{ color: est ? est.texto : '#94a3b8', opacity: est ? 0.85 : 1 }}>
                            <Clock size={11} /> Levou {formatarDuracao(card.orcamento_iniciado_em, card.orcamento_finalizado_em)}
                          </p>
                        ) : card.orcamento_iniciado_em ? (
                          <p className="text-xs flex items-center gap-1 mt-1" style={{ color: est ? est.texto : '#6366f1', opacity: est ? 0.9 : 1 }}>
                            <Play size={11} /> Em andamento
                          </p>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          <button
            onClick={novaColuna}
            className="flex-shrink-0 w-72 h-12 flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 text-slate-400 hover:border-blue-400 hover:text-blue-500 transition"
          >
            <Plus size={16} /> Nova coluna
          </button>
        </div>
      </main>

      {cardSelecionado && editando && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white">
              <h3 className="font-bold text-slate-800">Editar orçamento</h3>
              <button onClick={tentarFechar} className="p-1 text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {cardSelecionado.criado_por_nome && (
                <p className="text-xs text-slate-400 flex items-center gap-1.5">
                  <User size={13} /> Solicitado por {cardSelecionado.criado_por_nome}
                </p>
              )}

              <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                  <Clock size={13} /> Elaboração do orçamento
                </p>

                {!editando.orcamento_iniciado_em ? (
                  <button
                    onClick={iniciarOrcamento}
                    className="w-full py-2.5 flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
                  >
                    <Play size={14} /> Iniciar orçamento
                  </button>
                ) : editando.orcamento_finalizado_em ? (
                  <div className="text-xs text-emerald-700 space-y-1">
                    <p className="flex items-center gap-1.5">
                      <CheckCircle2 size={14} /> Finalizado — levou{' '}
                      {formatarDuracao(editando.orcamento_iniciado_em, editando.orcamento_finalizado_em)}
                    </p>
                    {editando.anexo_url && (
                      <a href={editando.anexo_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                        <Paperclip size={12} /> {editando.anexo_nome || 'Ver anexo'}
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-indigo-600">
                      Em andamento há {formatarDuracao(editando.orcamento_iniciado_em, new Date(agora).toISOString())}
                    </p>

                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Anexar arquivo do orçamento</label>
                      {editando.anexo_url ? (
                        <div className="flex items-center gap-2 text-xs text-emerald-600">
                          <Paperclip size={13} />
                          <span className="truncate">{editando.anexo_nome || 'Arquivo anexado'}</span>
                          <a href={editando.anexo_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex-shrink-0">
                            ver
                          </a>
                        </div>
                      ) : (
                        <label className="flex items-center gap-2 w-fit px-3 py-2 border border-dashed border-slate-300 rounded-lg text-xs text-slate-500 cursor-pointer hover:border-indigo-400 hover:text-indigo-600">
                          <Paperclip size={13} /> Escolher arquivo
                          <input type="file" className="hidden" onChange={e => anexarArquivoOrcamento(e.target.files?.[0])} />
                        </label>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Valor total do orçamento</label>
                      <input
                        type="text"
                        value={editando.valor_estimado != null ? String(editando.valor_estimado) : ''}
                        onChange={e =>
                          atualizarCampo('valor_estimado', e.target.value.trim() ? parseFloat(e.target.value.replace(',', '.')) : null)
                        }
                        placeholder="Ex: 2500.00"
                        className="w-full border border-slate-300 rounded-lg p-2.5 text-sm"
                      />
                    </div>

                    <button
                      onClick={finalizarOrcamento}
                      disabled={salvando || !editando.anexo_url || editando.valor_estimado == null}
                      className="w-full py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition disabled:opacity-50"
                    >
                      {salvando ? 'Finalizando...' : 'Finalizar orçamento'}
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1">Nome do cliente</label>
                <input
                  type="text"
                  value={editando.cliente_nome || ''}
                  onChange={e => atualizarCampo('cliente_nome', e.target.value)}
                  className="w-full border border-slate-300 rounded-xl p-3 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1 flex items-center gap-1"><Phone size={12} /> WhatsApp</label>
                  <input
                    type="text"
                    value={editando.cliente_whatsapp || ''}
                    onChange={e => atualizarCampo('cliente_whatsapp', e.target.value)}
                    className="w-full border border-slate-300 rounded-xl p-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1 flex items-center gap-1"><MapPin size={12} /> Cidade</label>
                  <input
                    type="text"
                    value={editando.cidade || ''}
                    onChange={e => atualizarCampo('cidade', e.target.value)}
                    className="w-full border border-slate-300 rounded-xl p-3 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Cor / Acabamento</label>
                  <input
                    type="text"
                    value={editando.acabamento || ''}
                    onChange={e => atualizarCampo('acabamento', e.target.value)}
                    className="w-full border border-slate-300 rounded-xl p-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Contramarco</label>
                  <select
                    value={editando.contramarco || ''}
                    onChange={e => atualizarCampo('contramarco', e.target.value)}
                    className="w-full border border-slate-300 rounded-xl p-3 text-sm"
                  >
                    <option value="">—</option>
                    <option value="com">Com contramarco</option>
                    <option value="sem">Sem contramarco</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1 flex items-center gap-1"><Building2 size={12} /> Arquiteto/Eng.</label>
                  <input
                    type="text"
                    value={editando.arquiteto_nome || ''}
                    onChange={e => atualizarCampo('arquiteto_nome', e.target.value)}
                    className="w-full border border-slate-300 rounded-xl p-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Contato</label>
                  <input
                    type="text"
                    value={editando.arquiteto_contato || ''}
                    onChange={e => atualizarCampo('arquiteto_contato', e.target.value)}
                    className="w-full border border-slate-300 rounded-xl p-3 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs text-slate-500">Esquadrias</label>
                  <button onClick={adicionarItemEdit} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
                    <Plus size={13} /> Adicionar
                  </button>
                </div>
                {(editando.itens || []).map((item, i) => (
                  <div key={item.id} className="bg-slate-50 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">Esquadria {i + 1}</span>
                      <button onClick={() => removerItemEdit(item.id)} className="p-1 text-red-400 hover:text-red-600">
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <select
                      value={item.tipo_esquadria}
                      onChange={e => atualizarItemEdit(item.id, 'tipo_esquadria', e.target.value as TipoEsquadria)}
                      className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                    >
                      {Object.entries(tipoLabels).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="number"
                        value={item.largura_mm || ''}
                        onChange={e => atualizarItemEdit(item.id, 'largura_mm', parseFloat(e.target.value) || 0)}
                        placeholder="Largura"
                        className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                      />
                      <input
                        type="number"
                        value={item.altura_mm || ''}
                        onChange={e => atualizarItemEdit(item.id, 'altura_mm', parseFloat(e.target.value) || 0)}
                        placeholder="Altura"
                        className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                      />
                      <input
                        type="number"
                        value={item.quantidade || ''}
                        onChange={e => atualizarItemEdit(item.id, 'quantidade', parseInt(e.target.value) || 1)}
                        placeholder="Qtd"
                        className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                      />
                    </div>
                    <textarea
                      value={item.descricao || ''}
                      onChange={e => atualizarItemEdit(item.id, 'descricao', e.target.value)}
                      placeholder="Descrição (opcional)"
                      className="w-full border border-slate-300 rounded-lg p-2 text-xs resize-none h-14"
                    />
                    <div className="flex items-center gap-2">
                      {item.foto_url && <img src={item.foto_url} alt="" className="w-12 h-12 object-cover rounded-lg" />}
                      <label className="flex items-center gap-1 px-2 py-1.5 border border-dashed border-slate-300 rounded-lg text-xs text-slate-500 cursor-pointer hover:border-blue-400">
                        <Camera size={12} /> Trocar foto
                        <input type="file" accept="image/*" className="hidden" onChange={e => trocarFotoItem(item.id, e.target.files?.[0])} />
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              {cardSelecionado.descricao_livre && (
                <p className="text-slate-500 text-sm whitespace-pre-wrap bg-slate-50 rounded-xl p-3">
                  {cardSelecionado.descricao_livre}
                </p>
              )}

              {(cardSelecionado as any).fotos_urls?.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {(cardSelecionado as any).fotos_urls.map((url: string, i: number) => (
                    <img key={i} src={url} alt={`Foto ${i + 1}`} className="w-full h-16 object-cover rounded-lg" />
                  ))}
                </div>
              )}

              <div>
                <label className="block text-xs text-slate-500 mb-1">Valor do orçamento (opcional)</label>
                <input
                  type="text"
                  value={editando.valor_estimado != null ? String(editando.valor_estimado) : ''}
                  onChange={e => atualizarCampo('valor_estimado', e.target.value.trim() ? parseFloat(e.target.value.replace(',', '.')) : null)}
                  placeholder="Ex: 2500.00"
                  className="w-full border border-slate-300 rounded-xl p-3 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1">Coluna</label>
                <select
                  value={editando.coluna_id || ''}
                  onChange={e => atualizarCampo('coluna_id', e.target.value)}
                  className="w-full border border-slate-300 rounded-xl p-3 text-sm"
                >
                  {colunas.map(c => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={salvarCard}
                disabled={salvando}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition disabled:opacity-50"
              >
                {salvando ? 'Salvando...' : 'Salvar alterações'}
              </button>

              {historico.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-2">
                    <Clock size={13} /> Histórico
                  </p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {historico.map(h => (
                      <div key={h.id} className="text-xs text-slate-500">
                        <span className="font-medium text-slate-700">{h.usuario_nome || 'Sistema'}</span>
                        {' — '}{h.acao}
                        {h.detalhes && <span className="text-slate-400"> ({h.detalhes})</span>}
                        <div className="text-slate-300">{new Date(h.created_at).toLocaleString('pt-BR')}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
