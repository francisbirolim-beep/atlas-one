'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, ShieldAlert, MapPin, User, Target, CheckSquare, Sparkles, Send, Flame, Pencil } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { usuarioAtual } from '@/lib/auth'
import { listarPermissoesUsuario, nivelEfetivo } from '@/lib/setores'
import {
  STATUS_FUNIL, calcularTaxaConversao, mesAtual, listarMetas, salvarMeta,
  listarTarefasPendentes, concluirTarefa,
} from '@/lib/crm'
import { OrcamentoRapido, Usuario, NivelPermissao, TemperaturaLead, Tarefa } from '@/lib/tipos'

const colunasTemperatura: { chave: TemperaturaLead; label: string; emoji: string; corHeader: string; corTexto: string; corBorda: string }[] = [
  { chave: 'quente', label: 'Quente', emoji: '🔥', corHeader: 'bg-red-50', corTexto: 'text-red-600', corBorda: 'border-red-200' },
  { chave: 'morno', label: 'Morno', emoji: '🌤️', corHeader: 'bg-amber-50', corTexto: 'text-amber-600', corBorda: 'border-amber-200' },
  { chave: 'frio', label: 'Frio', emoji: '❄️', corHeader: 'bg-blue-50', corTexto: 'text-blue-600', corBorda: 'border-blue-200' },
]

interface Insight {
  texto: string
  tipo: 'alerta' | 'oportunidade' | 'info'
}

export default function CRM() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [nivel, setNivel] = useState<NivelPermissao>('oculto')
  const [cards, setCards] = useState<OrcamentoRapido[]>([])
  const [ultimoContatoPorCliente, setUltimoContatoPorCliente] = useState<Record<string, string>>({})
  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  const [metas, setMetas] = useState<Record<string, { valor: string; quantidade: string }>>({})
  const [salvandoMeta, setSalvandoMeta] = useState<string | null>(null)
  const [usuariosMeta, setUsuariosMeta] = useState<{ id: string; nome: string }[]>([])
  const [metasAberto, setMetasAberto] = useState(false)
  const mesMetaAtual = mesAtual()
  const [metaGeral, setMetaGeral] = useState<{ valor: number | null; quantidade: number | null }>({ valor: null, quantidade: null })
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setCarregando(true)
    const me = await usuarioAtual()
    setUsuario(me)
    let mapa: Record<string, NivelPermissao> = {}
    if (me && me.role !== 'master') mapa = await listarPermissoesUsuario(me.id)
    const nv = nivelEfetivo(me, 'crm', mapa)
    setNivel(nv)
    if (nv !== 'oculto') {
      const [{ data: orcs }, { data: interacoes }, tarefasPendentes, metas] = await Promise.all([
        supabase.from('orcamentos').select('*').order('created_at', { ascending: false }),
        supabase.from('crm_interacoes').select('cliente_id, created_at').order('created_at', { ascending: false }).limit(1000),
        listarTarefasPendentes(),
        listarMetas(mesAtual()),
      ])
      if (orcs) setCards(orcs as OrcamentoRapido[])
      const ultimoContato: Record<string, string> = {}
      ;(interacoes || []).forEach((it: any) => {
        if (!ultimoContato[it.cliente_id]) ultimoContato[it.cliente_id] = it.created_at
      })
      setUltimoContatoPorCliente(ultimoContato)
      setTarefas(tarefasPendentes)
      const geral = metas.find(m => !m.usuario_id)
      setMetaGeral({ valor: geral?.meta_valor ?? null, quantidade: geral?.meta_quantidade ?? null })
      if (nv === 'edicao') {
        const metasIniciais: Record<string, { valor: string; quantidade: string }> = {}
        metas.forEach(m => {
          const chave = m.usuario_id || 'geral'
          metasIniciais[chave] = {
            valor: m.meta_valor != null ? String(m.meta_valor) : '',
            quantidade: m.meta_quantidade != null ? String(m.meta_quantidade) : '',
          }
        })
        setMetas(metasIniciais)
        const { data: users } = await supabase.from('usuarios').select('id, nome').order('created_at', { ascending: true })
        setUsuariosMeta(users || [])
      }
    }
    setCarregando(false)
  }

  async function alternarTarefa(t: Tarefa) {
    await concluirTarefa(t.id, true)
    setTarefas(prev => prev.filter(x => x.id !== t.id))
  }

  async function salvarMetaUsuario(usuarioId: string | null, usuarioNome: string | null) {
    const chave = usuarioId || 'geral'
    setSalvandoMeta(chave)
    const valores = metas[chave] || { valor: '', quantidade: '' }
    const metaValor = valores.valor.trim() ? parseFloat(valores.valor) : null
    const metaQuantidade = valores.quantidade.trim() ? parseInt(valores.quantidade) : null
    await salvarMeta(mesMetaAtual, usuarioId, usuarioNome, metaValor, metaQuantidade)
    setSalvandoMeta(null)
  }

  if (carregando) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Carregando...</div>
  }

  if (nivel === 'oculto') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 gap-3">
        <ShieldAlert size={40} className="text-slate-300" />
        <p className="text-slate-500">Você não tem acesso ao CRM. Fale com o administrador se precisar.</p>
        <Link href="/setores" className="text-brand-navy text-sm hover:underline">Voltar aos setores</Link>
      </div>
    )
  }

  const cardsComTemperatura = cards.filter(c => c.temperatura)
  const taxaConversao = calcularTaxaConversao(cards)

  const hojeStr = new Date().toISOString().slice(0, 10)
  const inicioMes = mesAtual() + '-01'
  const fechadosNoMes = cards.filter(
    c => (c.status === 'aprovado' || c.status === 'convertido') && c.created_at >= inicioMes
  )
  const valorFechadoMes = fechadosNoMes.reduce((s, c) => s + (c.valor_estimado || 0), 0)
  const progressoValor = metaGeral.valor ? Math.min(100, Math.round((valorFechadoMes / metaGeral.valor) * 100)) : null
  const progressoQtd = metaGeral.quantidade ? Math.min(100, Math.round((fechadosNoMes.length / metaGeral.quantidade) * 100)) : null

  const tarefasAtrasadas = tarefas.filter(t => t.data_vencimento && t.data_vencimento < hojeStr)

  const propostasEnviadas = cards
    .filter(c => c.status === 'enviado')
    .sort((a, b) => (b.valor_estimado || 0) - (a.valor_estimado || 0))

  // IA Comercial: insights automáticos baseados nos dados (regras, não geração de texto por IA externa)
  const UM_DIA_MS = 24 * 60 * 60 * 1000
  const agoraMs = Date.now()
  const insights: Insight[] = []

  cardsComTemperatura
    .filter(c => c.temperatura === 'quente' && c.status !== 'aprovado' && c.status !== 'convertido' && c.status !== 'recusado')
    .forEach(c => {
      const ultimoContato = c.cliente_id ? ultimoContatoPorCliente[c.cliente_id] : null
      const referencia = ultimoContato || c.created_at
      const diasSemContato = Math.floor((agoraMs - new Date(referencia).getTime()) / UM_DIA_MS)
      if (diasSemContato >= 2) {
        insights.push({
          texto: `${c.cliente_nome} está quente 🔥 e sem contato há ${diasSemContato} dias — vale a pena retornar hoje.`,
          tipo: 'alerta',
        })
      }
    })

  if (tarefasAtrasadas.length > 0) {
    insights.push({
      texto: `${tarefasAtrasadas.length} tarefa${tarefasAtrasadas.length > 1 ? 's' : ''} atrasada${tarefasAtrasadas.length > 1 ? 's' : ''}. Dá uma olhada na lista de tarefas abaixo.`,
      tipo: 'alerta',
    })
  }

  const melhorOportunidade = cards
    .filter(c => c.temperatura === 'quente' && c.status !== 'aprovado' && c.status !== 'convertido' && c.status !== 'recusado' && c.valor_estimado)
    .sort((a, b) => (b.valor_estimado || 0) - (a.valor_estimado || 0))[0]
  if (melhorOportunidade) {
    insights.push({
      texto: `Maior oportunidade em aberto: ${melhorOportunidade.cliente_nome} — R$ ${(melhorOportunidade.valor_estimado || 0).toFixed(2)}.`,
      tipo: 'oportunidade',
    })
  }

  if (insights.length === 0) {
    insights.push({ texto: 'Nenhum alerta agora. Continue registrando os atendimentos pra manter os insights afiados.', tipo: 'info' })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/setores" className="p-2 hover:bg-slate-100 rounded-lg transition">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-800">CRM — Comercial</h1>
            <p className="text-sm text-slate-500">Funil, tarefas, metas e histórico de vendas</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {nivel === 'consulta' && (
          <p className="text-xs text-slate-400">Seu acesso ao CRM é de somente consulta.</p>
        )}

        {/* Stats */}
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <p className="text-xs text-slate-500 mb-1">Taxa de conversão</p>
            <p className="text-2xl font-bold text-slate-800">{taxaConversao}%</p>
            <p className="text-xs text-slate-400 mt-1">Aprovados + convertidos sobre o total enviado</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between gap-1.5 text-xs text-slate-500 mb-1">
              <span className="flex items-center gap-1.5"><Target size={13} /> Meta do mês (R$)</span>
              {nivel === 'edicao' && (
                <button onClick={() => setMetasAberto(v => !v)} className="text-brand-navy hover:underline flex items-center gap-1"><Pencil size={11} /> Editar</button>
              )}
            </div>
            {metaGeral.valor ? (
              <>
                <p className="text-2xl font-bold text-slate-800">R$ {valorFechadoMes.toFixed(0)} <span className="text-sm font-normal text-slate-400">/ {metaGeral.valor.toFixed(0)}</span></p>
                <div className="w-full h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-brand-teal rounded-full" style={{ width: `${progressoValor}%` }} />
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-400">
                Sem meta definida.{' '}
                {nivel === 'edicao' && (
                  <button onClick={() => setMetasAberto(true)} className="text-brand-navy hover:underline">Configurar</button>
                )}
              </p>
            )}
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1"><Target size={13} /> Meta do mês (negócios)</div>
            {metaGeral.quantidade ? (
              <>
                <p className="text-2xl font-bold text-slate-800">{fechadosNoMes.length} <span className="text-sm font-normal text-slate-400">/ {metaGeral.quantidade}</span></p>
                <div className="w-full h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-brand-navy rounded-full" style={{ width: `${progressoQtd}%` }} />
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-400">Sem meta definida.</p>
            )}
          </div>
        </div>

        {nivel === 'edicao' && metasAberto && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Target size={16} /> Metas comerciais do mês
            </h2>
            <p className="text-xs text-slate-400">
              Meta de {new Date(mesMetaAtual + '-01T00:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}. Vale como valor fechado (aprovado/convertido) e/ou quantidade de negócios fechados no mês.
            </p>
            <div className="space-y-2">
              <div className="border border-slate-100 rounded-xl p-3">
                <p className="text-sm font-medium text-slate-700 mb-2">Empresa toda</p>
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Meta em R$</label>
                    <input
                      type="number"
                      value={metas.geral?.valor ?? ''}
                      onChange={e => setMetas(prev => ({ ...prev, geral: { ...(prev.geral || { valor: '', quantidade: '' }), valor: e.target.value } }))}
                      placeholder="Ex: 50000"
                      className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Meta em quantidade</label>
                    <input
                      type="number"
                      value={metas.geral?.quantidade ?? ''}
                      onChange={e => setMetas(prev => ({ ...prev, geral: { ...(prev.geral || { valor: '', quantidade: '' }), quantidade: e.target.value } }))}
                      placeholder="Ex: 10"
                      className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                    />
                  </div>
                </div>
                <button
                  onClick={() => salvarMetaUsuario(null, null)}
                  disabled={salvandoMeta === 'geral'}
                  className="text-xs text-brand-navy hover:underline"
                >
                  {salvandoMeta === 'geral' ? 'Salvando...' : 'Salvar meta da empresa'}
                </button>
              </div>

              {usuariosMeta.map(u => (
                <div key={u.id} className="border border-slate-100 rounded-xl p-3">
                  <p className="text-sm font-medium text-slate-700 mb-2">{u.nome}</p>
                  <div className="grid grid-cols-2 gap-3 mb-2">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Meta em R$</label>
                      <input
                        type="number"
                        value={metas[u.id]?.valor ?? ''}
                        onChange={e => setMetas(prev => ({ ...prev, [u.id]: { ...(prev[u.id] || { valor: '', quantidade: '' }), valor: e.target.value } }))}
                        placeholder="Ex: 15000"
                        className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Meta em quantidade</label>
                      <input
                        type="number"
                        value={metas[u.id]?.quantidade ?? ''}
                        onChange={e => setMetas(prev => ({ ...prev, [u.id]: { ...(prev[u.id] || { valor: '', quantidade: '' }), quantidade: e.target.value } }))}
                        placeholder="Ex: 3"
                        className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => salvarMetaUsuario(u.id, u.nome)}
                    disabled={salvandoMeta === u.id}
                    className="text-xs text-brand-navy hover:underline"
                  >
                    {salvandoMeta === u.id ? 'Salvando...' : 'Salvar meta'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* IA Comercial */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-1">
            <Sparkles size={16} className="text-brand-teal" /> IA Comercial
          </h2>
          <p className="text-xs text-slate-400 mb-3">Sugestões automáticas com base nos leads, tarefas e contatos registrados.</p>
          <div className="space-y-2">
            {insights.map((ins, i) => (
              <div
                key={i}
                className={`text-sm px-3 py-2 rounded-lg ${
                  ins.tipo === 'alerta' ? 'bg-red-50 text-red-700' : ins.tipo === 'oportunidade' ? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-slate-600'
                }`}
              >
                {ins.texto}
              </div>
            ))}
          </div>
        </div>

        {/* Funil de vendas por status */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Funil de vendas</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {STATUS_FUNIL.map(s => {
              const itens = cards.filter(c => c.status === s.valor)
              const valor = itens.reduce((sum, c) => sum + (c.valor_estimado || 0), 0)
              return (
                <div key={s.valor} className="border border-slate-100 rounded-xl p-3 text-center">
                  <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mb-2 ${s.cor}`}>{s.label}</span>
                  <p className="text-xl font-bold text-slate-800">{itens.length}</p>
                  <p className="text-xs text-slate-400">R$ {valor.toFixed(0)}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Funil por temperatura */}
        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Funil por temperatura</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {colunasTemperatura.map(col => {
              const cardsColuna = cardsComTemperatura.filter(c => c.temperatura === col.chave)
              return (
                <div key={col.chave} className={`rounded-2xl border ${col.corBorda} bg-white overflow-hidden`}>
                  <div className={`${col.corHeader} px-4 py-3 flex items-center justify-between`}>
                    <span className={`font-semibold text-sm ${col.corTexto}`}>
                      {col.emoji} {col.label}
                    </span>
                    <span className={`text-xs font-medium ${col.corTexto}`}>{cardsColuna.length}</span>
                  </div>
                  <div className="p-3 space-y-2 min-h-[100px] max-h-80 overflow-y-auto">
                    {cardsColuna.length === 0 && (
                      <p className="text-xs text-slate-300 text-center py-6">Nenhum orçamento aqui</p>
                    )}
                    {cardsColuna.map(card => (
                      <Link
                        key={card.id}
                        href={`/kanban?orcamento=${card.id}`}
                        className="block rounded-xl border border-slate-200 p-3 hover:border-slate-300 hover:shadow-sm transition"
                      >
                        <p className="font-medium text-sm text-slate-800 truncate">{card.cliente_nome}</p>
                        {card.cidade && (
                          <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                            <MapPin size={11} /> {card.cidade}
                          </p>
                        )}
                        {card.criado_por_nome && (
                          <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                            <User size={11} /> {card.criado_por_nome}
                          </p>
                        )}
                        {card.valor_estimado != null && (
                          <p className="text-xs font-semibold text-emerald-600 mt-1">
                            R$ {card.valor_estimado.toFixed(2)}
                          </p>
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Tarefas e retornos */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
            <CheckSquare size={16} /> Tarefas e retornos pendentes
          </h2>
          {tarefas.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma tarefa pendente. Crie tarefas na página de cada cliente.</p>
          ) : (
            <div className="space-y-1.5">
              {tarefas.slice(0, 20).map(t => {
                const atrasada = t.data_vencimento && t.data_vencimento < hojeStr
                return (
                  <div key={t.id} className="flex items-center gap-2 py-1.5 border-b border-slate-100 last:border-0">
                    <button onClick={() => alternarTarefa(t)} className="text-slate-400 hover:text-brand-navy flex-shrink-0">
                      <CheckSquare size={16} className="opacity-30 hover:opacity-100" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700 truncate">
                        {t.titulo}
                        {t.cliente_nome && <span className="text-slate-400"> · {t.cliente_nome}</span>}
                      </p>
                    </div>
                    {t.data_vencimento && (
                      <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${atrasada ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                        {new Date(t.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </span>
                    )}
                    {t.cliente_id && (
                      <Link href={`/clientes/${t.cliente_id}`} className="text-xs text-brand-navy hover:underline flex-shrink-0">
                        Ver cliente
                      </Link>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Propostas enviadas */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
            <Send size={16} /> Propostas enviadas — aguardando resposta
          </h2>
          {propostasEnviadas.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma proposta aguardando resposta no momento.</p>
          ) : (
            <div className="space-y-1.5">
              {propostasEnviadas.map(c => (
                <Link
                  key={c.id}
                  href={c.cliente_id ? `/clientes/${c.cliente_id}` : `/kanban?orcamento=${c.id}`}
                  className="flex items-center justify-between gap-2 py-2 border-b border-slate-100 last:border-0 hover:bg-slate-50 -mx-2 px-2 rounded-lg transition"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {c.temperatura === 'quente' && <Flame size={13} className="text-red-500 flex-shrink-0" />}
                    <p className="text-sm text-slate-700 truncate">{c.cliente_nome}</p>
                  </div>
                  <p className="text-sm font-semibold text-emerald-600 flex-shrink-0">
                    {c.valor_estimado != null ? `R$ ${c.valor_estimado.toFixed(2)}` : ''}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
