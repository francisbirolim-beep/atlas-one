'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import {
  ArrowLeft, Phone, MapPin, FileText, Camera, Plus, CheckSquare, Square,
  Trash2, Paperclip, MessageCircle, PhoneCall, Handshake, StickyNote, Send,
} from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Cliente, Anexo, TipoInteracao, Tarefa, Interacao, Usuario } from '@/lib/tipos'
import { usuarioAtual } from '@/lib/auth'
import { uploadArquivo } from '@/lib/upload'
import {
  listarTarefasCliente, criarTarefa, concluirTarefa, excluirTarefa,
  listarInteracoesCliente, registrarInteracao, STATUS_FUNIL,
} from '@/lib/crm'

interface OrcamentoResumo {
  id: string
  created_at: string
  tipo_esquadria: string
  valor_estimado: number | null
  status: string
  modo_entrada: string
  motivo_perda?: string | null
  anexos?: Anexo[] | null
}

const origemLabels: Record<string, string> = {
  indicacao: 'Indicação',
  arquiteto: 'Arquiteto',
  engenheiro: 'Engenheiro',
  construtora: 'Construtora',
  instagram: 'Instagram',
  facebook: 'Facebook',
  google: 'Google',
  whatsapp: 'WhatsApp',
  cliente_antigo: 'Cliente antigo',
  passou_na_frente: 'Passou em frente',
  outros: 'Outros',
}

const statusColors: Record<string, string> = {
  rascunho: 'bg-slate-100 text-slate-600',
  enviado: 'bg-brand-navyLight text-brand-navy',
  aprovado: 'bg-brand-tealLight text-brand-teal',
  recusado: 'bg-red-100 text-red-600',
  convertido: 'bg-purple-100 text-purple-600',
}

const tipoInteracaoInfo: Record<TipoInteracao, { label: string; icon: any }> = {
  ligacao: { label: 'Ligação', icon: PhoneCall },
  whatsapp: { label: 'WhatsApp', icon: MessageCircle },
  visita: { label: 'Visita', icon: MapPin },
  proposta: { label: 'Proposta', icon: Send },
  negociacao: { label: 'Negociação', icon: Handshake },
  nota: { label: 'Nota', icon: StickyNote },
  outro: { label: 'Outro', icon: FileText },
}

export default function DetalheCliente() {
  const params = useParams()
  const id = params?.id as string

  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [orcamentos, setOrcamentos] = useState<OrcamentoResumo[]>([])
  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  const [interacoes, setInteracoes] = useState<Interacao[]>([])
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [carregando, setCarregando] = useState(true)

  const [novaTarefaTitulo, setNovaTarefaTitulo] = useState('')
  const [novaTarefaData, setNovaTarefaData] = useState('')
  const [salvandoTarefa, setSalvandoTarefa] = useState(false)

  const [novaInteracaoTipo, setNovaInteracaoTipo] = useState<TipoInteracao>('ligacao')
  const [novaInteracaoDescricao, setNovaInteracaoDescricao] = useState('')
  const [novaInteracaoArquivo, setNovaInteracaoArquivo] = useState<File | null>(null)
  const [salvandoInteracao, setSalvandoInteracao] = useState(false)

  const [motivoPerdaEdicao, setMotivoPerdaEdicao] = useState<Record<string, string>>({})

  useEffect(() => {
    if (id) carregar()
    usuarioAtual().then(setUsuario)
  }, [id])

  async function carregar() {
    setCarregando(true)
    const [{ data: c }, { data: o }, tarefasData, interacoesData] = await Promise.all([
      supabase.from('clientes').select('*').eq('id', id).single(),
      supabase
        .from('orcamentos')
        .select('id, created_at, tipo_esquadria, valor_estimado, status, modo_entrada, motivo_perda, anexos')
        .eq('cliente_id', id)
        .order('created_at', { ascending: false }),
      listarTarefasCliente(id),
      listarInteracoesCliente(id),
    ])
    if (c) setCliente(c as Cliente)
    if (o) setOrcamentos(o as OrcamentoResumo[])
    setTarefas(tarefasData)
    setInteracoes(interacoesData)
    setCarregando(false)
  }

  async function mudarStatus(orcamentoId: string, novoStatus: string) {
    if (novoStatus === 'recusado') {
      setOrcamentos(prev => prev.map(o => (o.id === orcamentoId ? { ...o, status: novoStatus } : o)))
      return
    }
    await supabase.from('orcamentos').update({ status: novoStatus, motivo_perda: null }).eq('id', orcamentoId)
    setOrcamentos(prev => prev.map(o => (o.id === orcamentoId ? { ...o, status: novoStatus, motivo_perda: null } : o)))
  }

  async function salvarMotivoPerda(orcamentoId: string) {
    const motivo = motivoPerdaEdicao[orcamentoId] || null
    await supabase.from('orcamentos').update({ status: 'recusado', motivo_perda: motivo }).eq('id', orcamentoId)
    setOrcamentos(prev => prev.map(o => (o.id === orcamentoId ? { ...o, status: 'recusado', motivo_perda: motivo } : o)))
  }

  async function adicionarTarefa() {
    if (!novaTarefaTitulo.trim() || !cliente) return
    setSalvandoTarefa(true)
    await criarTarefa(cliente.id, cliente.nome, novaTarefaTitulo.trim(), novaTarefaData || null, usuario)
    setNovaTarefaTitulo('')
    setNovaTarefaData('')
    setTarefas(await listarTarefasCliente(id))
    setSalvandoTarefa(false)
  }

  async function alternarTarefa(t: Tarefa) {
    await concluirTarefa(t.id, !t.concluida)
    setTarefas(prev => prev.map(x => (x.id === t.id ? { ...x, concluida: !t.concluida } : x)))
  }

  async function removerTarefa(t: Tarefa) {
    await excluirTarefa(t.id)
    setTarefas(prev => prev.filter(x => x.id !== t.id))
  }

  async function enviarInteracao() {
    if (!novaInteracaoDescricao.trim() || !cliente) return
    setSalvandoInteracao(true)
    let anexos: Anexo[] = []
    if (novaInteracaoArquivo) {
      const url = await uploadArquivo(novaInteracaoArquivo)
      if (url) anexos = [{ titulo: novaInteracaoArquivo.name, nome: novaInteracaoArquivo.name, url }]
    }
    await registrarInteracao(cliente.id, novaInteracaoTipo, novaInteracaoDescricao.trim(), usuario, anexos)
    setNovaInteracaoDescricao('')
    setNovaInteracaoArquivo(null)
    setInteracoes(await listarInteracoesCliente(id))
    setSalvandoInteracao(false)
  }

  if (carregando) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Carregando...</div>
  }

  if (!cliente) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        Cliente não encontrado.
      </div>
    )
  }

  const valorTotal = orcamentos.reduce((s, o) => s + (o.valor_estimado || 0), 0)
  const tarefasAbertas = tarefas.filter(t => !t.concluida)
  const tarefasConcluidas = tarefas.filter(t => t.concluida)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/clientes" className="p-2 hover:bg-slate-100 rounded-lg transition">
            <ArrowLeft size={20} />
          </Link>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-mark.png" alt="" className="w-8 h-8" />
          <div>
            <h1 className="text-lg font-bold text-slate-800">{cliente.nome}</h1>
            <p className="text-sm text-slate-500">Cliente desde {new Date(cliente.created_at).toLocaleDateString('pt-BR')}</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex flex-wrap gap-4 text-sm text-slate-600 mb-3">
            {cliente.whatsapp && (
              <span className="flex items-center gap-1.5"><Phone size={14} /> {cliente.whatsapp}</span>
            )}
            {cliente.cidade && (
              <span className="flex items-center gap-1.5"><MapPin size={14} /> {cliente.cidade}</span>
            )}
            <span className="px-2 py-0.5 bg-slate-100 rounded-full text-xs">
              Origem: {origemLabels[cliente.origem] || cliente.origem}
            </span>
          </div>
          {cliente.cpf_cnpj && <p className="text-sm text-slate-500">CPF/CNPJ: {cliente.cpf_cnpj}</p>}
          {cliente.endereco && <p className="text-sm text-slate-500">Endereço: {cliente.endereco}</p>}
          {cliente.observacoes && <p className="text-sm text-slate-500 mt-2">{cliente.observacoes}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <p className="text-xs text-slate-500 mb-1">Orçamentos</p>
            <p className="text-2xl font-bold text-slate-800">{orcamentos.length}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <p className="text-xs text-slate-500 mb-1">Valor total orçado</p>
            <p className="text-2xl font-bold text-brand-teal">R$ {valorTotal.toFixed(2)}</p>
          </div>
        </div>

        {/* Tarefas e retornos */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-sm font-medium text-slate-700 mb-3">Tarefas e retornos</h2>
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <input
              type="text"
              value={novaTarefaTitulo}
              onChange={e => setNovaTarefaTitulo(e.target.value)}
              placeholder="Ex: Ligar pra confirmar medida"
              className="flex-1 border border-slate-300 rounded-xl px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={novaTarefaData}
              onChange={e => setNovaTarefaData(e.target.value)}
              className="border border-slate-300 rounded-xl px-3 py-2 text-sm"
            />
            <button
              onClick={adicionarTarefa}
              disabled={salvandoTarefa || !novaTarefaTitulo.trim()}
              className="px-4 py-2 bg-brand-navy text-white rounded-xl text-sm font-medium hover:bg-brand-navyDark transition disabled:opacity-40"
            >
              <Plus size={15} className="inline -mt-0.5" /> Adicionar
            </button>
          </div>

          {tarefas.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma tarefa cadastrada.</p>
          ) : (
            <div className="space-y-1.5">
              {tarefasAbertas.map(t => (
                <div key={t.id} className="flex items-center gap-2 py-1.5 border-b border-slate-100 last:border-0">
                  <button onClick={() => alternarTarefa(t)} className="text-slate-400 hover:text-brand-navy">
                    <Square size={16} />
                  </button>
                  <div className="flex-1">
                    <p className="text-sm text-slate-700">{t.titulo}</p>
                    {t.data_vencimento && (
                      <p className="text-xs text-slate-400">
                        Vence {new Date(t.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </p>
                    )}
                  </div>
                  <button onClick={() => removerTarefa(t)} className="text-slate-300 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {tarefasConcluidas.map(t => (
                <div key={t.id} className="flex items-center gap-2 py-1.5 border-b border-slate-100 last:border-0 opacity-50">
                  <button onClick={() => alternarTarefa(t)} className="text-brand-teal">
                    <CheckSquare size={16} />
                  </button>
                  <p className="flex-1 text-sm text-slate-500 line-through">{t.titulo}</p>
                  <button onClick={() => removerTarefa(t)} className="text-slate-300 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Histórico de atendimento / negociações */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-sm font-medium text-slate-700 mb-3">Histórico de atendimento e negociação</h2>
          <div className="space-y-2 mb-4">
            <div className="flex flex-wrap gap-2">
              {(Object.keys(tipoInteracaoInfo) as TipoInteracao[]).map(tp => {
                const Icon = tipoInteracaoInfo[tp].icon
                return (
                  <button
                    key={tp}
                    onClick={() => setNovaInteracaoTipo(tp)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border transition ${
                      novaInteracaoTipo === tp
                        ? 'border-brand-navy bg-brand-navyLight text-brand-navyDark font-medium'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <Icon size={12} /> {tipoInteracaoInfo[tp].label}
                  </button>
                )
              })}
            </div>
            <textarea
              value={novaInteracaoDescricao}
              onChange={e => setNovaInteracaoDescricao(e.target.value)}
              placeholder="O que aconteceu nesse contato? (ex: cliente pediu desconto, vamos ligar semana que vem...)"
              rows={2}
              className="w-full border border-slate-300 rounded-xl p-3 text-sm"
            />
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 cursor-pointer hover:border-slate-300">
                <Paperclip size={13} />
                {novaInteracaoArquivo ? novaInteracaoArquivo.name : 'Anexar foto, áudio ou documento'}
                <input
                  type="file"
                  accept="image/*,audio/*,.pdf,.doc,.docx"
                  className="hidden"
                  onChange={e => setNovaInteracaoArquivo(e.target.files?.[0] || null)}
                />
              </label>
              <button
                onClick={enviarInteracao}
                disabled={salvandoInteracao || !novaInteracaoDescricao.trim()}
                className="ml-auto px-4 py-1.5 bg-brand-navy text-white rounded-lg text-xs font-medium hover:bg-brand-navyDark transition disabled:opacity-40"
              >
                Registrar
              </button>
            </div>
          </div>

          {interacoes.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum atendimento registrado ainda.</p>
          ) : (
            <div className="space-y-3">
              {interacoes.map(it => {
                const Icon = tipoInteracaoInfo[it.tipo]?.icon || FileText
                return (
                  <div key={it.id} className="border-l-2 border-slate-200 pl-3">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-0.5">
                      <Icon size={12} />
                      <span className="font-medium text-slate-600">{tipoInteracaoInfo[it.tipo]?.label || it.tipo}</span>
                      <span>· {it.usuario_nome || 'Sistema'}</span>
                      <span>· {new Date(it.created_at).toLocaleString('pt-BR')}</span>
                    </div>
                    {it.descricao && <p className="text-sm text-slate-700">{it.descricao}</p>}
                    {it.anexos && it.anexos.length > 0 && (
                      <a href={it.anexos[0].url} target="_blank" rel="noreferrer" className="text-xs text-brand-navy hover:underline flex items-center gap-1 mt-1">
                        <Paperclip size={11} /> {it.anexos[0].nome}
                      </a>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Propostas / orçamentos */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-slate-700">Propostas e orçamentos</h2>
            <Link href="/orcamento-rapido" className="flex items-center gap-1 text-sm text-brand-navy hover:text-brand-navyDark">
              <Plus size={14} /> Novo orçamento
            </Link>
          </div>

          {orcamentos.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm bg-white rounded-2xl border border-slate-200">
              Nenhum orçamento feito para este cliente ainda.
            </div>
          ) : (
            <div className="space-y-2">
              {orcamentos.map(o => {
                const pdfAnexo = (o.anexos || []).find(a => a.titulo?.toLowerCase().includes('pdf'))
                return (
                  <div key={o.id} className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${o.modo_entrada === 'detalhado' ? 'bg-brand-tealLight' : 'bg-brand-navyLight'}`}>
                          {o.modo_entrada === 'detalhado'
                            ? <Camera size={16} className="text-brand-teal" />
                            : <FileText size={16} className="text-brand-navy" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800">{o.tipo_esquadria}</p>
                          <p className="text-xs text-slate-500">{new Date(o.created_at).toLocaleDateString('pt-BR')}</p>
                          {pdfAnexo && (
                            <a href={pdfAnexo.url} target="_blank" rel="noreferrer" className="text-xs text-brand-navy hover:underline flex items-center gap-1 mt-0.5">
                              <Paperclip size={11} /> Ver proposta (PDF)
                            </a>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-slate-800 text-sm mb-1">
                          {o.valor_estimado != null ? `R$ ${o.valor_estimado.toFixed(2)}` : 'Aguardando'}
                        </p>
                        <select
                          value={o.status}
                          onChange={e => mudarStatus(o.id, e.target.value)}
                          className={`text-xs px-2 py-1 rounded-full font-medium border-0 ${statusColors[o.status] || 'bg-slate-100 text-slate-600'}`}
                        >
                          {STATUS_FUNIL.map(s => (
                            <option key={s.valor} value={s.valor}>{s.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {o.status === 'recusado' && (
                      <div className="mt-2 pt-2 border-t border-slate-100">
                        <label className="block text-xs text-slate-500 mb-1">Motivo da perda</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={motivoPerdaEdicao[o.id] ?? o.motivo_perda ?? ''}
                            onChange={e => setMotivoPerdaEdicao(prev => ({ ...prev, [o.id]: e.target.value }))}
                            placeholder="Ex: preço, escolheu concorrente, desistiu da obra..."
                            className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-xs"
                          />
                          <button
                            onClick={() => salvarMotivoPerda(o.id)}
                            className="px-3 py-1.5 bg-slate-700 text-white rounded-lg text-xs font-medium hover:bg-slate-800 transition"
                          >
                            Salvar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
