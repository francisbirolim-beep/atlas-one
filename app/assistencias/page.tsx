'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, FileText, Plus, Pencil, Trash2, X, Phone, MapPin, Search, User, Wrench, CalendarDays, Save } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AssistenciaColuna, Assistencia } from '@/lib/tipos'
import {
  listarColunasAssistencia,
  criarColunaAssistencia,
  renomearColunaAssistencia,
  excluirColunaAssistencia,
  moverCardAssistencia,
  excluirAssistencia,
} from '@/lib/assistenciaKanban'
import { usuarioAtual } from '@/lib/auth'
import { lerHomeUsuarioConfig, type EscopoAssistencias } from '@/lib/homeUsuario'
import { Usuario } from '@/lib/tipos'

function dataParaInput(dataIso: string) {
  const data = new Date(dataIso)
  if (Number.isNaN(data.getTime())) return ''
  const local = new Date(data.getTime() - data.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

export default function Assistencias() {
  const [colunas, setColunas] = useState<AssistenciaColuna[]>([])
  const [cards, setCards] = useState<Assistencia[]>([])
  const [carregando, setCarregando] = useState(true)
  const [selecionado, setSelecionado] = useState<Assistencia | null>(null)
  const [dataSelecionada, setDataSelecionada] = useState('')
  const [salvandoData, setSalvandoData] = useState(false)
  const [erroData, setErroData] = useState('')
  const [colunaArrastando, setColunaArrastando] = useState<string | null>(null)
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [escopo, setEscopo] = useState<EscopoAssistencias>('proprias')
  const [busca, setBusca] = useState('')

  useEffect(() => { void carregar() }, [])

  async function carregar() {
    setCarregando(true)
    const u = await usuarioAtual()
    setUsuario(u)

    const config = u ? await lerHomeUsuarioConfig(u) : null
    const escopoEfetivo: EscopoAssistencias = u?.role === 'master' ? 'todas' : (config?.assistenciasEscopo || 'proprias')
    setEscopo(escopoEfetivo)

    const cols = await listarColunasAssistencia()
    let query = supabase.from('assistencias').select('*').order('created_at', { ascending: false })
    if (u && u.role !== 'master' && escopoEfetivo !== 'todas') query = query.eq('criado_por_id', u.id)
    const { data } = await query

    setColunas(cols)
    setCards((data as Assistencia[]) || [])
    setCarregando(false)
  }

  function passaFiltro(c: Assistencia): boolean {
    if (!busca.trim()) return true
    const alvo = busca.trim().toLowerCase()
    return (
      (c.cliente_nome || '').toLowerCase().includes(alvo) ||
      (c.cidade || '').toLowerCase().includes(alvo) ||
      (c.endereco || '').toLowerCase().includes(alvo) ||
      (c.bairro || '').toLowerCase().includes(alvo) ||
      (c.descricao_problema || '').toLowerCase().includes(alvo) ||
      (c.criado_por_nome || '').toLowerCase().includes(alvo)
    )
  }

  function cardsDaColuna(colunaId: string, index: number) {
    return cards
      .filter(c => (c.coluna_id || colunas[0]?.id) === colunaId || (!c.coluna_id && index === 0))
      .filter(passaFiltro)
  }

  function enderecoCompleto(a: Assistencia): string {
    const partes = [a.endereco, a.numero, a.bairro].filter(Boolean)
    return partes.join(', ')
  }

  function abrirAssistencia(card: Assistencia) {
    setSelecionado(card)
    setDataSelecionada(dataParaInput(card.created_at))
    setErroData('')
  }

  async function handleDrop(e: React.DragEvent, colunaId: string) {
    e.preventDefault()
    setColunaArrastando(null)
    const cardId = e.dataTransfer.getData('text/plain')
    if (!cardId) return
    setCards(prev => prev.map(c => (c.id === cardId ? { ...c, coluna_id: colunaId, coluna_atualizada_em: new Date().toISOString() } : c)))
    await moverCardAssistencia(cardId, colunaId)
  }

  async function novaColuna() {
    if (usuario?.role !== 'master') return
    const nome = window.prompt('Nome da nova etapa:')
    if (!nome || !nome.trim()) return
    const col = await criarColunaAssistencia(nome.trim())
    if (col) setColunas(prev => [...prev, col])
  }

  async function editarColuna(col: AssistenciaColuna) {
    if (usuario?.role !== 'master') return
    const novoNome = window.prompt('Renomear etapa:', col.nome)
    if (!novoNome || !novoNome.trim() || novoNome === col.nome) return
    const ok = await renomearColunaAssistencia(col.id, novoNome.trim())
    if (ok) setColunas(prev => prev.map(c => (c.id === col.id ? { ...c, nome: novoNome.trim() } : c)))
  }

  async function apagarColuna(col: AssistenciaColuna) {
    if (usuario?.role !== 'master') return
    if (colunas.length <= 1) {
      alert('Precisa ter pelo menos uma etapa.')
      return
    }
    const outras = colunas.filter(c => c.id !== col.id)
    const destino = outras[0]
    const qtd = cards.filter(c => (c.coluna_id || colunas[0]?.id) === col.id).length
    const msg = qtd > 0
      ? `Essa etapa tem ${qtd} chamado(s). Eles vão pra etapa "${destino.nome}". Apagar mesmo assim?`
      : `Apagar a etapa "${col.nome}"?`
    if (!window.confirm(msg)) return

    const ok = await excluirColunaAssistencia(col.id, destino.id)
    if (ok) {
      setColunas(prev => prev.filter(c => c.id !== col.id))
      setCards(prev => prev.map(c => (c.coluna_id === col.id ? { ...c, coluna_id: destino.id } : c)))
    }
  }

  async function mudarColunaSelecionado(colunaId: string) {
    if (!selecionado) return
    setCards(prev => prev.map(c => (c.id === selecionado.id ? { ...c, coluna_id: colunaId, coluna_atualizada_em: new Date().toISOString() } : c)))
    setSelecionado(prev => (prev ? { ...prev, coluna_id: colunaId } : prev))
    await moverCardAssistencia(selecionado.id, colunaId)
  }

  async function salvarDataSelecionada() {
    if (!selecionado || !dataSelecionada) return
    setSalvandoData(true)
    setErroData('')

    const [ano, mes, dia] = dataSelecionada.split('-').map(Number)
    const dataAtual = new Date(selecionado.created_at)
    if (!ano || !mes || !dia || Number.isNaN(dataAtual.getTime())) {
      setErroData('Data inválida.')
      setSalvandoData(false)
      return
    }

    dataAtual.setFullYear(ano, mes - 1, dia)
    const novoCreatedAt = dataAtual.toISOString()
    const { error } = await supabase.from('assistencias').update({ created_at: novoCreatedAt }).eq('id', selecionado.id)

    if (error) {
      setErroData('Não foi possível alterar a data.')
      setSalvandoData(false)
      return
    }

    const atualizado = { ...selecionado, created_at: novoCreatedAt }
    setSelecionado(atualizado)
    setCards(prev => prev.map(c => (c.id === atualizado.id ? atualizado : c)).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
    setSalvandoData(false)
  }

  async function excluirSelecionado() {
    if (!selecionado || usuario?.role !== 'master') return
    if (!window.confirm(`Excluir o chamado de ${selecionado.cliente_nome}? Essa ação não pode ser desfeita.`)) return
    const ok = await excluirAssistencia(selecionado.id)
    if (ok) {
      setCards(prev => prev.filter(c => c.id !== selecionado.id))
      setSelecionado(null)
    }
  }

  if (carregando) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Carregando...</div>
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-wrap items-center gap-4">
          <Link href="/" className="p-2 hover:bg-slate-100 rounded-lg transition"><ArrowLeft size={20} /></Link>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-mark.png" alt="" className="w-8 h-8" />
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-slate-800">Assistências Técnicas</h1>
            <p className="text-sm text-slate-500">{escopo === 'todas' ? 'Visualizando todas as assistências liberadas para este usuário.' : 'Visualizando somente as assistências abertas por você.'}</p>
          </div>
          <Link href="/assistencia" className="inline-flex items-center gap-2 rounded-xl bg-brand-teal px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"><Plus size={16}/> Nova assistência</Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="relative mb-4 max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por cliente, cidade, endereço..." className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-sm bg-white" />
        </div>

        <div className="flex gap-4 overflow-x-auto pb-4">
          {colunas.map((col, index) => {
            const cardsColuna = cardsDaColuna(col.id, index)
            return (
              <div key={col.id} onDragOver={e => { e.preventDefault(); setColunaArrastando(col.id) }} onDragLeave={() => setColunaArrastando(null)} onDrop={e => handleDrop(e, col.id)} className={`flex-shrink-0 w-72 bg-slate-100 rounded-2xl p-3 transition ${colunaArrastando === col.id ? 'ring-2 ring-brand-navy bg-brand-navyLight' : ''}`}>
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2"><h3 className="font-medium text-slate-700 text-sm">{col.nome}</h3><span className="text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full">{cardsColuna.length}</span></div>
                  {usuario?.role === 'master' && <div className="flex items-center gap-1"><button onClick={() => editarColuna(col)} className="p-1 text-slate-400 hover:text-slate-600"><Pencil size={13} /></button><button onClick={() => apagarColuna(col)} className="p-1 text-slate-400 hover:text-red-500"><Trash2 size={13} /></button></div>}
                </div>

                <div className="space-y-2 min-h-[80px]">
                  {cardsColuna.map(card => (
                    <div key={card.id} draggable onDragStart={e => e.dataTransfer.setData('text/plain', card.id)} onClick={() => abrirAssistencia(card)} className="rounded-xl border-2 border-slate-200 bg-white p-3 cursor-pointer hover:shadow-md transition">
                      <div className="flex items-center gap-2 mb-1"><div className="p-1 rounded bg-brand-tealLight"><Wrench size={12} className="text-brand-teal" /></div><p className="font-medium text-sm truncate flex-1 text-slate-800">{card.cliente_nome}</p></div>
                      <p className="text-xs mb-1 text-slate-500 truncate">{card.cidade ? `${card.cidade} — ` : ''}{new Date(card.created_at).toLocaleDateString('pt-BR')}</p>
                      <p className="text-xs line-clamp-2 text-slate-400">{card.descricao_problema || 'Sem descrição informada'}</p>
                      {card.criado_por_nome && <p className="text-xs flex items-center gap-1 mt-1 text-slate-400"><User size={11} /> {card.criado_por_nome}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          {usuario?.role === 'master' && <button onClick={novaColuna} className="flex-shrink-0 w-72 h-12 flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 text-slate-400 hover:border-brand-navy hover:text-brand-navy transition"><Plus size={16} /> Nova etapa</button>}
        </div>
      </main>

      {selecionado && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white"><h3 className="font-bold text-slate-800">Chamado de assistência</h3><button onClick={() => setSelecionado(null)} className="p-1 text-slate-400 hover:text-slate-600"><X size={18} /></button></div>

            <div className="p-5 space-y-4">
              <div><p className="text-xs text-slate-400 uppercase tracking-wide">Cliente</p><p className="text-lg font-bold text-slate-800">{selecionado.cliente_nome}</p></div>
              <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                {selecionado.cliente_whatsapp && <span className="flex items-center gap-1.5"><Phone size={14} className="text-slate-400" /> {selecionado.cliente_whatsapp}</span>}
                {enderecoCompleto(selecionado) && <span className="flex items-center gap-1.5"><MapPin size={14} className="text-slate-400" /> {enderecoCompleto(selecionado)}</span>}
              </div>
              {selecionado.criado_por_nome && <p className="text-xs text-slate-400 flex items-center gap-1.5"><User size={13} /> Registrado por {selecionado.criado_por_nome}</p>}

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"><CalendarDays size={13}/> Data da assistência</label>
                <div className="flex gap-2">
                  <input type="date" value={dataSelecionada} onChange={e => setDataSelecionada(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                  <button type="button" onClick={salvarDataSelecionada} disabled={salvandoData || !dataSelecionada} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-teal px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><Save size={13}/>{salvandoData ? 'Salvando' : 'Salvar data'}</button>
                </div>
                {erroData && <p className="mt-2 text-xs text-red-500">{erroData}</p>}
                <p className="mt-2 text-[11px] text-slate-400">A nova data também aparece no card e na Ordem de Serviço.</p>
              </div>

              <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-lg p-3">{selecionado.descricao_problema || 'Sem descrição informada.'}</p>

              {selecionado.fotos_urls && selecionado.fotos_urls.length > 0 && (
                <div className="flex flex-wrap gap-2">{selecionado.fotos_urls.map((url, i) => <a key={i} href={url} target="_blank" rel="noopener noreferrer">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={url} alt="Foto do problema" className="w-20 h-20 object-cover rounded-lg border border-slate-200" /></a>)}</div>
              )}

              <div><label className="block text-xs text-slate-500 mb-1">Etapa</label><select value={selecionado.coluna_id || colunas[0]?.id || ''} onChange={e => mudarColunaSelecionado(e.target.value)} className="w-full border border-slate-300 rounded-xl p-3 text-sm">{colunas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>

              <Link href={`/assistencias/${selecionado.id}/os`} className="w-full py-2.5 flex items-center justify-center gap-2 bg-brand-navy text-white rounded-xl text-sm font-medium hover:bg-brand-navyDark transition"><FileText size={15}/> Imprimir / PDF da OS</Link>

              {usuario?.role === 'master' && <button onClick={excluirSelecionado} className="w-full py-2 flex items-center justify-center gap-1.5 text-red-500 text-xs font-medium hover:bg-red-50 rounded-lg transition"><Trash2 size={13} /> Excluir este chamado</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
