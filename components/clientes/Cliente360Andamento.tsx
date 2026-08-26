'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle, ArrowRight, Boxes, CheckCircle2, ClipboardCheck, Factory,
  FileCheck2, GlassWater, PackageCheck, Ruler, ShoppingCart, Truck, Wrench,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

type ClienteResumo = { id: string; nome: string }
type ObraResumo = { id: string; nome: string; status: string }
type OrcamentoResumo = { id: string; numero?: number | null; obra_id?: string | null; status?: string | null; valor_estimado?: number | null }
type VendaResumo = { id: string; orcamento_id: string; obra_id?: string | null; valor_venda: number; custo_previsto?: number | null; status: string; confirmado_em: string }
type MedicaoResumo = { id: string; orcamento_id?: string | null; obra_id?: string | null; status_operacional?: string | null; created_at: string }
type ColunaFluxo = { id: string; setor_id: string; nome: string; ordem: number | null }
type ItemFluxo = { id: string; orcamento_id?: string | null; obra_id?: string | null; coluna_id?: string | null; created_at: string; atualizado_em?: string | null }
type ProducaoColuna = { id: string; nome: string; ordem?: number | null }
type ProducaoItem = { id: string; orcamento_id?: string | null; coluna_id?: string | null; created_at: string; atualizado_em?: string | null }

type StatusSetor = { nome: string; ordem: number; existe: boolean }

type ObraPainel = {
  id: string
  nome: string
  orcamentos: OrcamentoResumo[]
  vendas: VendaResumo[]
  medicoes: MedicaoResumo[]
  projeto: StatusSetor
  mee: StatusSetor
  perfis: StatusSetor
  acessorios: StatusSetor
  vidros: StatusSetor
  outros: StatusSetor
  financeiro: StatusSetor
  instalacao: StatusSetor
  producao: StatusSetor
  bloqueio: string
}

const SETORES = [
  'engenharia-projeto',
  'mee',
  'compras-perfis',
  'compras-acessorios',
  'compras-vidros',
  'compras-outros',
  'financeiro',
  'instalacao',
]

const STATUS_VAZIO: StatusSetor = { nome: 'Aguardando', ordem: -1, existe: false }

function statusClass(status: string, existe = true) {
  const s = status.toLowerCase()
  if (!existe) return 'border-slate-200 bg-slate-50 text-slate-500'
  if (s.includes('conferido') || s.includes('liberad') || s.includes('conclu') || s.includes('recebido') || s.includes('separado')) return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (s.includes('aguard') || s.includes('pendente') || s.includes('compra')) return 'border-amber-200 bg-amber-50 text-amber-800'
  if (s.includes('ajuste') || s.includes('bloque')) return 'border-red-200 bg-red-50 text-red-700'
  return 'border-blue-200 bg-blue-50 text-blue-700'
}

function StatusPill({ status }: { status: StatusSetor }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(status.nome, status.existe)}`}>{status.nome}</span>
}

function Etapa({ label, ok, ativa }: { label: string; ok: boolean; ativa?: boolean }) {
  return <div className={`flex min-w-[110px] items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : ativa ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-500'}`}>
    {ok ? <CheckCircle2 size={15}/> : <span className="h-2 w-2 rounded-full bg-current opacity-50"/>}{label}
  </div>
}

function MaterialCard({ titulo, status, href, icone }: { titulo: string; status: StatusSetor; href: string; icone: React.ReactNode }) {
  return <Link href={href} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">{icone}{titulo}</div>
      <ArrowRight size={15} className="text-slate-300"/>
    </div>
    <div className="mt-4"><StatusPill status={status}/></div>
  </Link>
}

export default function Cliente360Andamento({ clienteId }: { clienteId: string }) {
  const [cliente, setCliente] = useState<ClienteResumo | null>(null)
  const [obras, setObras] = useState<ObraResumo[]>([])
  const [orcamentos, setOrcamentos] = useState<OrcamentoResumo[]>([])
  const [vendas, setVendas] = useState<VendaResumo[]>([])
  const [medicoes, setMedicoes] = useState<MedicaoResumo[]>([])
  const [colunas, setColunas] = useState<ColunaFluxo[]>([])
  const [itens, setItens] = useState<ItemFluxo[]>([])
  const [producaoColunas, setProducaoColunas] = useState<ProducaoColuna[]>([])
  const [producaoItens, setProducaoItens] = useState<ProducaoItem[]>([])
  const [obraFiltro, setObraFiltro] = useState('todas')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => { void carregar() }, [clienteId])

  async function carregar() {
    setCarregando(true)
    setErro('')
    const [clienteResp, obrasResp, orcResp, vendasResp, medResp, colsResp, itensResp, prodColsResp] = await Promise.all([
      supabase.from('clientes').select('id,nome').eq('id', clienteId).maybeSingle(),
      supabase.from('obras').select('id,nome,status').eq('cliente_id', clienteId).order('created_at', { ascending: true }),
      // Orçamentos Balcão já vivem em balcao_orcamentos. Ler a tabela normal
      // inteira inclui também registros legados em que modo_entrada ficou nulo.
      supabase.from('orcamentos').select('id,numero,obra_id,status,valor_estimado').eq('cliente_id', clienteId).order('created_at', { ascending: true }),
      supabase.from('vendas_obras').select('id,orcamento_id,obra_id,valor_venda,custo_previsto,status,confirmado_em').eq('cliente_id', clienteId).order('confirmado_em', { ascending: true }),
      supabase.from('medicoes_finais').select('id,orcamento_id,obra_id,status_operacional,created_at').eq('cliente_id', clienteId).order('created_at', { ascending: true }),
      supabase.from('setor_kanban_colunas').select('id,setor_id,nome,ordem').in('setor_id', SETORES).order('ordem', { ascending: true }),
      supabase.from('setor_kanban_itens').select('id,orcamento_id,obra_id,coluna_id,created_at,atualizado_em').eq('cliente_id', clienteId).order('created_at', { ascending: true }),
      supabase.from('producao_colunas').select('id,nome,ordem').order('ordem', { ascending: true }),
    ])

    if (clienteResp.error || !clienteResp.data) {
      setErro('Cliente não encontrado.')
      setCarregando(false)
      return
    }

    const orcs = (orcResp.data || []) as OrcamentoResumo[]
    let prodItens: ProducaoItem[] = []
    if (orcs.length) {
      const { data } = await supabase.from('producao_itens').select('id,orcamento_id,coluna_id,created_at,atualizado_em').in('orcamento_id', orcs.map(o => o.id)).order('created_at', { ascending: true })
      prodItens = (data || []) as ProducaoItem[]
    }

    setCliente(clienteResp.data as ClienteResumo)
    setObras((obrasResp.data || []) as ObraResumo[])
    setOrcamentos(orcs)
    setVendas((vendasResp.data || []) as VendaResumo[])
    setMedicoes((medResp.data || []) as MedicaoResumo[])
    setColunas((colsResp.data || []) as ColunaFluxo[])
    setItens((itensResp.data || []) as ItemFluxo[])
    setProducaoColunas((prodColsResp.data || []) as ProducaoColuna[])
    setProducaoItens(prodItens)
    setCarregando(false)
  }

  const colunaPorId = useMemo(() => Object.fromEntries(colunas.map(c => [c.id, c])), [colunas])
  const producaoColunaPorId = useMemo(() => Object.fromEntries(producaoColunas.map(c => [c.id, c])), [producaoColunas])

  function statusSetor(orcIds: string[], setorId: string): StatusSetor {
    const encontrados = itens
      .filter(i => i.orcamento_id && orcIds.includes(i.orcamento_id))
      .map(i => colunaPorId[i.coluna_id || ''])
      .filter((c): c is ColunaFluxo => !!c && c.setor_id === setorId)
    if (!encontrados.length) return STATUS_VAZIO
    const gargalo = [...encontrados].sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0))[0]
    return { nome: gargalo.nome, ordem: Number(gargalo.ordem || 0), existe: true }
  }

  function statusProducao(orcIds: string[]): StatusSetor {
    const encontrados = producaoItens
      .filter(i => i.orcamento_id && orcIds.includes(i.orcamento_id))
      .map(i => producaoColunaPorId[i.coluna_id || ''])
      .filter((c): c is ProducaoColuna => !!c)
    if (!encontrados.length) return STATUS_VAZIO
    const gargalo = [...encontrados].sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0))[0]
    return { nome: gargalo.nome, ordem: Number(gargalo.ordem || 0), existe: true }
  }

  const paineis = useMemo<ObraPainel[]>(() => {
    const grupos: { id: string; nome: string }[] = obras.map(o => ({ id: o.id, nome: o.nome }))
    if (orcamentos.some(o => !o.obra_id)) grupos.push({ id: 'sem-obra', nome: 'Sem obra definida' })

    return grupos.map(grupo => {
      const orcs = orcamentos.filter(o => grupo.id === 'sem-obra' ? !o.obra_id : o.obra_id === grupo.id)
      const ids = orcs.map(o => o.id)
      const vendasObra = vendas.filter(v => ids.includes(v.orcamento_id))
      const medicoesObra = medicoes.filter(m => !!m.orcamento_id && ids.includes(m.orcamento_id))
      const projeto = statusSetor(ids, 'engenharia-projeto')
      const mee = statusSetor(ids, 'mee')
      const perfis = statusSetor(ids, 'compras-perfis')
      const acessorios = statusSetor(ids, 'compras-acessorios')
      const vidros = statusSetor(ids, 'compras-vidros')
      const outros = statusSetor(ids, 'compras-outros')
      const financeiro = statusSetor(ids, 'financeiro')
      const instalacao = statusSetor(ids, 'instalacao')
      const producao = statusProducao(ids)
      const projetoConferido = projeto.existe && projeto.nome.toLowerCase().includes('projeto conferido')
      const medicaoAprovada = medicoesObra.length > 0 && medicoesObra.every(m => m.status_operacional === 'aprovado')

      let bloqueio = 'Sem pendência crítica identificada.'
      if (!vendasObra.length) bloqueio = 'Aguardando venda confirmada.'
      else if (!projeto.existe) bloqueio = 'Venda confirmada, mas ainda sem card de Conferir Projeto.'
      else if (!projetoConferido) bloqueio = `Conferência do projeto: ${projeto.nome}.`
      else if (!medicaoAprovada) bloqueio = 'Projeto conferido. Aguardando Medição Final aprovada.'
      else if (vidros.existe && !['liberado','separado','recebido'].some(s => vidros.nome.toLowerCase().includes(s))) bloqueio = `Vidros: ${vidros.nome}.`
      else if (perfis.existe && !['liberado','separado','recebido'].some(s => perfis.nome.toLowerCase().includes(s))) bloqueio = `Perfis: ${perfis.nome}.`
      else if (acessorios.existe && !['liberado','separado','recebido'].some(s => acessorios.nome.toLowerCase().includes(s))) bloqueio = `Acessórios: ${acessorios.nome}.`

      return { id: grupo.id, nome: grupo.nome, orcamentos: orcs, vendas: vendasObra, medicoes: medicoesObra, projeto, mee, perfis, acessorios, vidros, outros, financeiro, instalacao, producao, bloqueio }
    }).filter(p => p.orcamentos.length > 0 || p.vendas.length > 0)
  }, [obras, orcamentos, vendas, medicoes, itens, colunaPorId, producaoItens, producaoColunaPorId])

  const visiveis = obraFiltro === 'todas' ? paineis : paineis.filter(p => p.id === obraFiltro)

  if (carregando) return <div className="min-h-[60vh] flex items-center justify-center text-slate-400">Carregando andamento...</div>
  if (erro) return <div className="min-h-[60vh] flex items-center justify-center text-red-600">{erro}</div>

  return <main className="min-h-screen bg-slate-50 px-4 py-6">
    <div className="mx-auto max-w-7xl space-y-5">
      <section className="rounded-3xl bg-brand-navy p-6 text-white shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Cliente 360 · Andamento</p>
            <h1 className="mt-1 text-2xl font-bold">{cliente?.nome}</h1>
            <p className="mt-2 max-w-3xl text-sm text-white/70">Visão consolidada dos mesmos cards usados pelos setores. Venda libera Financeiro + Conferir Projeto; Perfis/Acessórios/Outros nascem após Projeto conferido; Vidros somente após Medição Final aprovada.</p>
          </div>
          <label className="min-w-64 text-xs font-semibold text-white/70">Obra
            <select value={obraFiltro} onChange={e => setObraFiltro(e.target.value)} className="mt-1 w-full rounded-xl border border-white/20 bg-white px-3 py-2 text-sm font-medium text-slate-800">
              <option value="todas">Todas as obras</option>
              {paineis.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </label>
        </div>
      </section>

      {visiveis.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">Ainda não há obra/venda com fluxo operacional para este cliente.</div> : visiveis.map(painel => {
        const vendaOk = painel.vendas.length > 0
        const projetoOk = painel.projeto.existe && painel.projeto.nome.toLowerCase().includes('projeto conferido')
        const medicaoOk = painel.medicoes.length > 0 && painel.medicoes.every(m => m.status_operacional === 'aprovado')
        const engenhariaOk = painel.mee.existe && painel.mee.nome.toLowerCase().includes('liberad')
        const materiaisOk = [painel.perfis,painel.acessorios,painel.vidros].every(s => s.existe && ['liberado','separado','recebido'].some(x => s.nome.toLowerCase().includes(x)))
        const prodOk = painel.producao.existe && painel.producao.nome.toLowerCase().includes('conclu')
        const instOk = painel.instalacao.existe && painel.instalacao.nome.toLowerCase().includes('conclu')
        const medicao = painel.medicoes[painel.medicoes.length - 1]

        return <section key={painel.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">{painel.nome}</h2>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{painel.vendas.length} venda(s)</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{painel.orcamentos.map(o => o.numero ? `#${o.numero}` : o.id.slice(0,8)).join(' · ')}</p>
            </div>
            <div className={`rounded-xl border px-3 py-2 text-sm font-medium ${painel.bloqueio.startsWith('Sem pendência') ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
              <div className="flex items-start gap-2">{painel.bloqueio.startsWith('Sem pendência') ? <CheckCircle2 size={17} className="mt-0.5"/> : <AlertTriangle size={17} className="mt-0.5"/>}<span><strong>Bloqueio atual:</strong> {painel.bloqueio}</span></div>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto pb-1">
            <div className="flex min-w-max items-center gap-2">
              <Etapa label="Venda" ok={vendaOk} ativa={!vendaOk}/><ArrowRight size={15} className="text-slate-300"/>
              <Etapa label="Conferir projeto" ok={projetoOk} ativa={vendaOk && !projetoOk}/><ArrowRight size={15} className="text-slate-300"/>
              <Etapa label="Medição Final" ok={medicaoOk} ativa={projetoOk && !medicaoOk}/><ArrowRight size={15} className="text-slate-300"/>
              <Etapa label="Engenharia final" ok={engenhariaOk} ativa={medicaoOk && !engenhariaOk}/><ArrowRight size={15} className="text-slate-300"/>
              <Etapa label="Materiais" ok={materiaisOk} ativa={projetoOk && !materiaisOk}/><ArrowRight size={15} className="text-slate-300"/>
              <Etapa label="Produção" ok={prodOk} ativa={materiaisOk && !prodOk}/><ArrowRight size={15} className="text-slate-300"/>
              <Etapa label="Instalação" ok={instOk} ativa={prodOk && !instOk}/>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MaterialCard titulo="Perfis" status={painel.perfis} href="/setor/compras-perfis" icone={<Boxes size={17} className="text-brand-navy"/>}/>
            <MaterialCard titulo="Vidros" status={painel.vidros} href="/setor/compras-vidros" icone={<GlassWater size={17} className="text-brand-navy"/>}/>
            <MaterialCard titulo="Acessórios" status={painel.acessorios} href="/setor/compras-acessorios" icone={<PackageCheck size={17} className="text-brand-navy"/>}/>
            <MaterialCard titulo="Outros" status={painel.outros} href="/setor/compras-outros" icone={<ShoppingCart size={17} className="text-brand-navy"/>}/>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Link href="/setor/engenharia-projeto" className="rounded-xl border border-slate-200 p-3 text-sm hover:bg-slate-50"><span className="flex items-center gap-2 font-semibold text-slate-700"><ClipboardCheck size={16}/> Projeto</span><div className="mt-2"><StatusPill status={painel.projeto}/></div></Link>
            <Link href={medicao?.id ? `/producao/medicao-final/${medicao.id}` : '/producao/medicao-final'} className="rounded-xl border border-slate-200 p-3 text-sm hover:bg-slate-50"><span className="flex items-center gap-2 font-semibold text-slate-700"><Ruler size={16}/> Medição</span><div className="mt-2"><StatusPill status={painel.medicoes.length ? { nome: medicaoOk ? 'Aprovada' : 'Em andamento', ordem: medicaoOk ? 1 : 0, existe: true } : STATUS_VAZIO}/></div></Link>
            <Link href="/engenharia" className="rounded-xl border border-slate-200 p-3 text-sm hover:bg-slate-50"><span className="flex items-center gap-2 font-semibold text-slate-700"><FileCheck2 size={16}/> Engenharia final</span><div className="mt-2"><StatusPill status={painel.mee}/></div></Link>
            <Link href="/producao" className="rounded-xl border border-slate-200 p-3 text-sm hover:bg-slate-50"><span className="flex items-center gap-2 font-semibold text-slate-700"><Factory size={16}/> Produção</span><div className="mt-2"><StatusPill status={painel.producao}/></div></Link>
            <Link href="/setor/instalacao" className="rounded-xl border border-slate-200 p-3 text-sm hover:bg-slate-50"><span className="flex items-center gap-2 font-semibold text-slate-700"><Truck size={16}/> Instalação</span><div className="mt-2"><StatusPill status={painel.instalacao}/></div></Link>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
            <span className="rounded-lg bg-slate-100 px-2.5 py-1.5"><Wrench size={13} className="mr-1 inline"/>Conferência de projeto: {painel.projeto.nome}</span>
            <span className="rounded-lg bg-slate-100 px-2.5 py-1.5"><ShoppingCart size={13} className="mr-1 inline"/>Financeiro: {painel.financeiro.nome}</span>
            <span className="rounded-lg bg-slate-100 px-2.5 py-1.5"><Factory size={13} className="mr-1 inline"/>Produção: {painel.producao.nome}</span>
          </div>
        </section>
      })}
    </div>
  </main>
}
