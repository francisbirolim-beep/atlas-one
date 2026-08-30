'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { BadgeDollarSign, Building2, CalendarDays, FileText, MapPin, Plus, ShoppingCart, Timer, Wrench } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface ClienteOperacoesProps { clienteId: string; clienteNome: string }
interface ObraResumo { id: string; numero?: number | null; nome: string; status?: string | null; endereco?: string | null; numero_endereco?: string | null; bairro?: string | null; cidade?: string | null; responsavel?: string | null }
interface AssistenciaResumo { id: string; created_at: string; descricao_problema?: string | null; status?: string | null; tecnico_nome?: string | null; duracao_atendimento_segundos?: number | null; obra_id?: string | null }
interface MedicaoVendaResumo { id: string; created_at: string; orcamento_id?: string | null; obra_id?: string | null }
interface OrcamentoVendaResumo { id: string; numero?: number | null; created_at: string; tipo_esquadria?: string | null; valor_estimado?: number | null; obra_id?: string | null }

const estilosObra: Record<string, string> = { planejamento: 'border-blue-200 bg-blue-50 text-blue-800', engenharia: 'border-violet-200 bg-violet-50 text-violet-800', medicao: 'border-amber-200 bg-amber-50 text-amber-800', producao: 'border-orange-200 bg-orange-50 text-orange-800', instalacao: 'border-emerald-200 bg-emerald-50 text-emerald-800', concluida: 'border-slate-200 bg-slate-50 text-slate-700' }
const moeda = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const nomeStatusObra = (status?: string | null) => (status || 'planejamento').replace(/_/g, ' ').replace(/^./, letra => letra.toUpperCase())
const enderecoObra = (obra: ObraResumo) => [obra.endereco, obra.numero_endereco, obra.bairro, obra.cidade].filter(Boolean).join(', ')
function duracao(segundos?: number | null) { if (typeof segundos !== 'number') return null; const total = Math.max(0, Math.floor(segundos)); const h = Math.floor(total / 3600); const m = Math.floor((total % 3600) / 60); return h > 0 ? `${h}h ${m}min` : `${m} min` }
function statusAssistencia(status?: string | null) { const mapa: Record<string, string> = { aberto: 'Aberta', em_atendimento: 'Em atendimento', resolvido: 'Resolvida', concluido: 'Concluída' }; return !status ? 'Aberta' : mapa[status] || status.replace(/_/g, ' ') }

export function ClienteAcoes({ clienteId }: { clienteId: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-6">
    <Cabecalho titulo="O que deseja fazer?" texto="Escolha a operação. Ela ficará vinculada a este Cliente 360." icone={<Plus size={20} className="text-brand-navy"/>}/>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <AcaoCliente href={`/orcamento-rapido?cliente=${encodeURIComponent(clienteId)}&origem=cliente-360&modo=pedido`} titulo="Pedido de orçamento" texto="Registrar a visita para entrar no Kanban." icone={<FileText size={18}/>}/>
      <AcaoCliente href={`/orcamento-rapido?cliente=${encodeURIComponent(clienteId)}&origem=cliente-360&modo=sob-medida`} titulo="Orçamento sob medida" texto="Montar proposta técnica com tipologia." icone={<Plus size={18}/>}/>
      <AcaoCliente href={`/balcao?cliente=${encodeURIComponent(clienteId)}&origem=cliente-360`} titulo="Orçamento balcão" texto="Venda de produtos e acessórios." icone={<ShoppingCart size={18}/>}/>
      <AcaoCliente href={`/assistencia?cliente=${encodeURIComponent(clienteId)}&origem=cliente-360`} titulo="Assistência" texto="Abrir manutenção ou pós-venda." icone={<Wrench size={18}/>}/>
    </div>
  </div>
}

export default function ClienteOperacoes({ clienteId, clienteNome }: ClienteOperacoesProps) {
  const [obras, setObras] = useState<ObraResumo[]>([])
  const [assistencias, setAssistencias] = useState<AssistenciaResumo[]>([])
  const [medicoes, setMedicoes] = useState<MedicaoVendaResumo[]>([])
  const [orcamentosVenda, setOrcamentosVenda] = useState<Record<string, OrcamentoVendaResumo>>({})
  const [carregando, setCarregando] = useState(true)
  const [novaObraAberta, setNovaObraAberta] = useState(false)
  const [novaObra, setNovaObra] = useState({ nome: '', endereco: '', cidade: '', responsavel: '' })
  const [salvandoObra, setSalvandoObra] = useState(false)
  const [erroObra, setErroObra] = useState('')

  async function carregar() {
    setCarregando(true)
    const [{ data: obrasData }, { data: assistenciasData }, { data: medicoesData }] = await Promise.all([
      supabase.from('obras').select('id,numero,nome,status,endereco,numero_endereco,bairro,cidade,responsavel').eq('cliente_id', clienteId).order('created_at', { ascending: false }),
      supabase.from('assistencias').select('id,created_at,descricao_problema,status,tecnico_nome,duracao_atendimento_segundos,obra_id').eq('cliente_id', clienteId).order('created_at', { ascending: false }),
      supabase.from('medicoes_finais').select('id,created_at,orcamento_id,obra_id').eq('cliente_id', clienteId).order('created_at', { ascending: false }),
    ])
    const listaMedicoes = (medicoesData || []) as MedicaoVendaResumo[]
    setObras((obrasData || []) as ObraResumo[])
    setAssistencias((assistenciasData || []) as AssistenciaResumo[])
    setMedicoes(listaMedicoes)
    const ids = Array.from(new Set(listaMedicoes.map(m => m.orcamento_id).filter(Boolean))) as string[]
    if (ids.length) {
      const { data } = await supabase.from('orcamentos').select('id,numero,created_at,tipo_esquadria,valor_estimado,obra_id').in('id', ids)
      const mapa: Record<string, OrcamentoVendaResumo> = {}
      ;((data || []) as OrcamentoVendaResumo[]).forEach(v => { mapa[v.id] = v })
      setOrcamentosVenda(mapa)
    } else setOrcamentosVenda({})
    setCarregando(false)
  }

  useEffect(() => { void carregar() }, [clienteId])

  async function criarObra() {
    if (!novaObra.nome.trim()) { setErroObra('Informe o nome da obra ou do local.'); return }
    setErroObra(''); setSalvandoObra(true)
    const { error } = await supabase.from('obras').insert({ cliente_id: clienteId, nome: novaObra.nome.trim(), endereco: novaObra.endereco.trim() || null, cidade: novaObra.cidade.trim() || null, responsavel: novaObra.responsavel.trim() || null, status: 'planejamento' })
    setSalvandoObra(false)
    if (error) { setErroObra(error.message); return }
    setNovaObra({ nome: '', endereco: '', cidade: '', responsavel: '' }); setNovaObraAberta(false); await carregar()
  }

  const obrasPorId = useMemo(() => Object.fromEntries(obras.map(obra => [obra.id, obra])), [obras])
  const vendas = useMemo(() => medicoes.map(m => ({ medicao: m, orcamento: m.orcamento_id ? orcamentosVenda[m.orcamento_id] : undefined })), [medicoes, orcamentosVenda])
  const totalVendido = useMemo(() => vendas.reduce((soma, venda) => soma + (venda.orcamento?.valor_estimado || 0), 0), [vendas])

  return <section className="space-y-4">
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-base font-semibold text-slate-800">Cliente 360</h2><p className="text-sm text-slate-500">Escolha o que será feito. Todo atendimento permanece no histórico deste cliente.</p></div><button type="button" onClick={() => { setNovaObraAberta(v => !v); setErroObra('') }} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-100"><Plus size={14} /> Nova obra / local</button></div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><Resumo titulo="Obras / locais" valor={obras.length}/><Resumo titulo="Vendas" valor={medicoes.length}/><Resumo titulo="Total vendido" valor={moeda(totalVendido)} pequeno/><Resumo titulo="Assistências" valor={assistencias.length}/></div>
      {novaObraAberta && <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/70 p-4"><div className="mb-3 flex items-center gap-2 text-sm font-semibold text-blue-950"><Building2 size={16}/> Cadastrar obra ou local para {clienteNome}</div><div className="grid gap-3 sm:grid-cols-2"><Campo value={novaObra.nome} onChange={nome => setNovaObra(v => ({ ...v, nome }))} placeholder="Nome da obra / local *"/><Campo value={novaObra.responsavel} onChange={responsavel => setNovaObra(v => ({ ...v, responsavel }))} placeholder="Responsável na obra (opcional)"/><Campo value={novaObra.endereco} onChange={endereco => setNovaObra(v => ({ ...v, endereco }))} placeholder="Endereço (opcional)"/><Campo value={novaObra.cidade} onChange={cidade => setNovaObra(v => ({ ...v, cidade }))} placeholder="Cidade (opcional)"/></div>{erroObra && <p className="mt-2 text-xs text-red-600">{erroObra}</p>}<div className="mt-3 flex justify-end gap-2"><button type="button" onClick={() => setNovaObraAberta(false)} className="rounded-lg px-3 py-2 text-xs font-medium text-slate-600 hover:bg-white">Cancelar</button><button type="button" onClick={() => void criarObra()} disabled={salvandoObra} className="rounded-lg bg-brand-navy px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{salvandoObra ? 'Salvando...' : 'Salvar obra'}</button></div></div>}
    </div>

    <div className="rounded-2xl border border-slate-200 bg-white p-6"><Cabecalho titulo="Obras e locais deste cliente" texto="Use os botões dentro de cada obra para não misturar históricos." icone={<Building2 size={20} className="text-brand-navy"/>}/>{carregando ? <p className="text-sm text-slate-400">Carregando obras...</p> : obras.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">Ainda não há obra cadastrada. Para atendimentos sem obra específica, use as ações gerais abaixo.</div> : <div className="grid gap-3 lg:grid-cols-2">{obras.map(obra => <CartaoObra key={obra.id} obra={obra} clienteId={clienteId}/>)}</div>}</div>

    {carregando ? <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-400">Carregando histórico operacional...</div> : <><div className="rounded-2xl border border-slate-200 bg-white p-6"><Cabecalho titulo="Vendas confirmadas" texto="Uma venda entra aqui quando o processo gera a Medição Final." icone={<BadgeDollarSign size={20} className="text-brand-teal"/>}/>{vendas.length === 0 ? <p className="text-sm text-slate-400">Nenhuma venda confirmada para este cliente ainda.</p> : <div className="space-y-2">{vendas.map(({ medicao, orcamento }) => { const obra = obrasPorId[medicao.obra_id || orcamento?.obra_id || '']; return <div key={medicao.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium text-slate-800">{orcamento?.numero ? `Venda do orçamento #${orcamento.numero}` : 'Venda confirmada'}</p><p className="text-xs text-slate-500">{orcamento?.tipo_esquadria ? `${orcamento.tipo_esquadria} · ` : ''}{new Date(medicao.created_at).toLocaleDateString('pt-BR')}{obra ? ` · ${obra.nome}` : ''}</p></div><div className="flex items-center gap-3"><span className="text-sm font-bold text-brand-teal">{orcamento?.valor_estimado != null ? moeda(orcamento.valor_estimado) : 'Valor não informado'}</span><Link href={`/producao/medicao-final/${medicao.id}`} className="text-xs font-medium text-brand-navy hover:underline">Abrir processo</Link></div></div> })}</div>}</div>
    <div className="rounded-2xl border border-slate-200 bg-white p-6"><Cabecalho titulo="Assistências e manutenções" texto="Todo chamado vinculado ao cliente fica registrado aqui." icone={<Wrench size={20} className="text-brand-navy"/>}/>{assistencias.length === 0 ? <p className="text-sm text-slate-400">Nenhuma assistência ou manutenção registrada.</p> : <div className="space-y-2">{assistencias.map(a => { const tempo = duracao(a.duracao_atendimento_segundos); const obra = obrasPorId[a.obra_id || '']; return <div key={a.id} className="rounded-xl border border-slate-200 p-3"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium text-slate-800">{a.descricao_problema || 'Assistência / manutenção'}</p><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{statusAssistencia(a.status)}</span>{obra && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">{obra.nome}</span>}</div><p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500"><span className="inline-flex items-center gap-1"><CalendarDays size={12}/>{new Date(a.created_at).toLocaleDateString('pt-BR')}</span>{a.tecnico_nome && <span>· Técnico: {a.tecnico_nome}</span>}{tempo && <span className="inline-flex items-center gap-1"><Timer size={12}/>{tempo}</span>}</p></div><div className="flex flex-wrap gap-2"><Link href={`/assistencias/${a.id}/os`} className="inline-flex items-center gap-1 text-xs font-medium text-brand-navy hover:underline"><FileText size={12}/> OS / PDF</Link><Link href={`/assistencias?cliente=${encodeURIComponent(clienteNome)}`} className="text-xs font-medium text-slate-600 hover:underline">Ver no Kanban</Link></div></div></div> })}</div>}</div></>}
  </section>
}

function Campo({ value, onChange, placeholder }: { value: string; onChange: (valor: string) => void; placeholder: string }) { return <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="rounded-lg border border-blue-200 bg-white px-3 py-2.5 text-sm"/> }
function Resumo({ titulo, valor, pequeno }: { titulo: string; valor: string | number; pequeno?: boolean }) { return <div className="rounded-xl border border-slate-200 p-3"><p className="text-xs text-slate-500">{titulo}</p><p className={`mt-1 font-bold ${pequeno ? 'text-sm text-brand-teal' : 'text-xl text-slate-800'}`}>{valor}</p></div> }
function Cabecalho({ titulo, texto, icone }: { titulo: string; texto: string; icone: ReactNode }) { return <div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="text-sm font-medium text-slate-700">{titulo}</h3><p className="text-xs text-slate-400">{texto}</p></div>{icone}</div> }
function AcaoCliente({ href, titulo, texto, icone }: { href: string; titulo: string; texto: string; icone: ReactNode }) { return <Link href={href} className="group rounded-xl border border-slate-200 p-4 transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-sm"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700">{icone}</span><p className="mt-3 text-sm font-semibold text-slate-800">{titulo}</p><p className="mt-1 text-xs leading-5 text-slate-500">{texto}</p></Link> }
function CartaoObra({ obra, clienteId }: { obra: ObraResumo; clienteId: string }) { const estilo = estilosObra[obra.status || 'planejamento'] || estilosObra.planejamento; const endereco = enderecoObra(obra); return <div className={`rounded-xl border p-4 ${estilo}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-bold">{obra.numero ? `Obra #${obra.numero} — ` : ''}{obra.nome}</p><p className="mt-1 flex items-center gap-1 text-xs opacity-80"><Building2 size={12}/>{nomeStatusObra(obra.status)}</p></div><span className="rounded-full bg-white/70 px-2 py-1 text-[10px] font-semibold">Local vinculado</span></div>{endereco && <p className="mt-3 flex items-start gap-1.5 text-xs leading-5 opacity-90"><MapPin size={13} className="mt-0.5 shrink-0"/>{endereco}</p>}{obra.responsavel && <p className="mt-1 text-xs opacity-90">Responsável: {obra.responsavel}</p>}<div className="mt-4 flex flex-wrap gap-2"><Link href={`/orcamento-rapido?cliente=${encodeURIComponent(clienteId)}&obra=${encodeURIComponent(obra.id)}&origem=cliente-360&modo=sob-medida`} className="rounded-lg bg-white px-2.5 py-2 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-50"><Plus size={12} className="mr-1 inline"/>Orçamento</Link><Link href={`/assistencia?cliente=${encodeURIComponent(clienteId)}&obra=${encodeURIComponent(obra.id)}&origem=cliente-360`} className="rounded-lg border border-current/20 bg-white/50 px-2.5 py-2 text-xs font-semibold hover:bg-white"><Wrench size={12} className="mr-1 inline"/>Assistência</Link></div></div> }
