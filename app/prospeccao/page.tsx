'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, Clock3, Filter, Flame, MapPin, Plus, Search, Snowflake, SunMedium, UserRound } from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import { listarEquipeProspeccao, listarProspeccoes, moverProspeccao, STATUS_PROSPECCAO, type Prospeccao, type StatusProspeccao } from '@/lib/prospeccao'
import type { Usuario } from '@/lib/tipos'

function formatarData(valor?: string | null) {
  if (!valor) return 'Sem retorno agendado'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(valor))
}

function Temperatura({ valor }: { valor: Prospeccao['temperatura'] }) {
  if (valor === 'quente') return <span title="Quente" className="text-red-500"><Flame size={15}/></span>
  if (valor === 'morno') return <span title="Morno" className="text-amber-500"><SunMedium size={15}/></span>
  return <span title="Frio" className="text-blue-400"><Snowflake size={15}/></span>
}

export default function ProspeccaoPage() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [itens, setItens] = useState<Prospeccao[]>([])
  const [equipe, setEquipe] = useState<Pick<Usuario, 'id' | 'nome'>[]>([])
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [vendedor, setVendedor] = useState('')
  const [cidade, setCidade] = useState('')
  const [bairro, setBairro] = useState('')
  const [aba, setAba] = useState<'kanban' | 'agenda'>('kanban')
  const [arrastando, setArrastando] = useState<string | null>(null)

  async function carregar() {
    setCarregando(true)
    const me = await usuarioAtual()
    setUsuario(me)
    const [lista, usuarios] = await Promise.all([listarProspeccoes(), me?.role === 'master' ? listarEquipeProspeccao() : Promise.resolve([])])
    setItens(lista)
    setEquipe(usuarios)
    setCarregando(false)
  }

  useEffect(() => { void carregar() }, [])

  const cidades = useMemo(() => [...new Set(itens.map(i => i.cidade).filter(Boolean) as string[])].sort(), [itens])
  const bairros = useMemo(() => [...new Set(itens.filter(i => !cidade || i.cidade === cidade).map(i => i.bairro).filter(Boolean) as string[])].sort(), [cidade, itens])
  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR')
    return itens.filter(item => {
      if (vendedor && item.responsavel_id !== vendedor) return false
      if (cidade && item.cidade !== cidade) return false
      if (bairro && item.bairro !== bairro) return false
      if (!termo) return true
      return [item.nome_cliente, item.nome_obra, item.telefone, item.endereco, item.cidade, item.bairro, item.responsavel_nome]
        .some(v => (v || '').toLocaleLowerCase('pt-BR').includes(termo))
    })
  }, [bairro, busca, cidade, itens, vendedor])

  const agenda = useMemo(() => filtrados.filter(i => i.proxima_acao_em && !['convertido','sem_interesse'].includes(i.status)).sort((a,b) => new Date(a.proxima_acao_em!).getTime() - new Date(b.proxima_acao_em!).getTime()), [filtrados])
  const atrasados = agenda.filter(i => new Date(i.proxima_acao_em!).getTime() < Date.now()).length

  async function soltar(status: StatusProspeccao) {
    const item = itens.find(i => i.id === arrastando)
    setArrastando(null)
    if (!item || item.status === status) return
    setItens(prev => prev.map(p => p.id === item.id ? { ...p, status, status_atualizado_em: new Date().toISOString() } : p))
    const r = await moverProspeccao(item, status)
    if (!r.ok) { alert(r.error || 'Não foi possível mover a prospecção.'); await carregar() }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-6">
          <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-600">Comercial · Campo</p><h1 className="text-xl font-bold text-slate-900">Prospecção</h1><p className="text-sm text-slate-500">Obras encontradas, contatos e próximos passos.</p></div>
          <Link href="/prospeccao/nova" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-sm"><Plus size={17}/> Nova prospecção</Link>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-4 px-4 py-5 md:px-6">
        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border bg-white p-4"><p className="text-xs text-slate-500">Prospecções visíveis</p><p className="mt-1 text-2xl font-bold">{filtrados.length}</p></div>
          <div className="rounded-2xl border bg-white p-4"><p className="text-xs text-slate-500">Retornos agendados</p><p className="mt-1 text-2xl font-bold text-blue-700">{agenda.length}</p></div>
          <div className="rounded-2xl border bg-white p-4"><p className="text-xs text-slate-500">Retornos atrasados</p><p className="mt-1 text-2xl font-bold text-red-600">{atrasados}</p></div>
        </section>

        <section className="rounded-2xl border bg-white p-3 shadow-sm">
          <div className="grid gap-2 lg:grid-cols-[minmax(220px,1fr)_repeat(3,minmax(150px,220px))]">
            <label className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar cliente, obra, telefone..." className="w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm"/></label>
            {usuario?.role === 'master' && <select value={vendedor} onChange={e=>setVendedor(e.target.value)} className="rounded-xl border px-3 py-2.5 text-sm"><option value="">Todos os vendedores</option>{equipe.map(u=><option key={u.id} value={u.id}>{u.nome}</option>)}</select>}
            <select value={cidade} onChange={e=>{setCidade(e.target.value);setBairro('')}} className="rounded-xl border px-3 py-2.5 text-sm"><option value="">Todas as cidades</option>{cidades.map(c=><option key={c}>{c}</option>)}</select>
            <select value={bairro} onChange={e=>setBairro(e.target.value)} className="rounded-xl border px-3 py-2.5 text-sm"><option value="">Todos os bairros</option>{bairros.map(b=><option key={b}>{b}</option>)}</select>
          </div>
          <div className="mt-3 flex gap-2 border-t pt-3"><button onClick={()=>setAba('kanban')} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${aba==='kanban'?'bg-slate-900 text-white':'text-slate-500'}`}><Filter size={15}/> Kanban</button><button onClick={()=>setAba('agenda')} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${aba==='agenda'?'bg-slate-900 text-white':'text-slate-500'}`}><CalendarDays size={15}/> Agenda</button></div>
        </section>

        {carregando ? <div className="rounded-2xl border bg-white p-10 text-center text-slate-400">Carregando prospecções...</div> : aba === 'kanban' ? (
          <div className="flex gap-3 overflow-x-auto pb-4">
            {STATUS_PROSPECCAO.map(coluna => {
              const cards = filtrados.filter(i => i.status === coluna.id)
              return <section key={coluna.id} onDragOver={e=>e.preventDefault()} onDrop={()=>void soltar(coluna.id)} className="w-[290px] shrink-0 rounded-2xl border border-slate-200 bg-slate-100/80 p-3">
                <header className="mb-3 flex items-center justify-between"><span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-700"><i className={`h-2.5 w-2.5 rounded-full ${coluna.cor}`}/>{coluna.label}</span><span className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-slate-500">{cards.length}</span></header>
                <div className="space-y-2">{cards.map(item=><Link draggable onDragStart={()=>setArrastando(item.id)} href={`/prospeccao/${item.id}`} key={item.id} className="block cursor-grab rounded-xl border bg-white p-3 shadow-sm transition hover:border-blue-300 hover:shadow-md active:cursor-grabbing">
                  <div className="flex items-start justify-between gap-2"><strong className="text-sm text-slate-900">{item.nome_cliente}</strong><Temperatura valor={item.temperatura}/></div>
                  {item.nome_obra && <p className="mt-1 truncate text-xs text-slate-500">{item.nome_obra}</p>}
                  <div className="mt-3 space-y-1.5 text-[11px] text-slate-500">{(item.cidade||item.bairro)&&<p className="flex items-center gap-1"><MapPin size={12}/>{[item.bairro,item.cidade].filter(Boolean).join(' · ')}</p>}<p className="flex items-center gap-1"><UserRound size={12}/>{item.responsavel_nome}</p>{item.proxima_acao_em&&<p className={`flex items-center gap-1 ${new Date(item.proxima_acao_em).getTime()<Date.now()?'font-semibold text-red-600':''}`}><Clock3 size={12}/>{formatarData(item.proxima_acao_em)}</p>}</div>
                </Link>)}{cards.length===0&&<p className="rounded-xl border border-dashed bg-white/50 px-3 py-8 text-center text-xs text-slate-400">Arraste uma prospecção para cá</p>}</div>
              </section>
            })}
          </div>
        ) : (
          <section className="overflow-hidden rounded-2xl border bg-white">
            <div className="border-b px-5 py-4"><h2 className="font-bold text-slate-900">Próximas ações</h2><p className="text-xs text-slate-500">Os compromissos também aparecem na agenda pessoal do vendedor.</p></div>
            <div className="divide-y">{agenda.map(item=>{const vencido=new Date(item.proxima_acao_em!).getTime()<Date.now();return <Link key={item.id} href={`/prospeccao/${item.id}`} className="flex flex-wrap items-center gap-3 px-4 py-4 hover:bg-slate-50"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${vencido?'bg-red-50 text-red-600':'bg-blue-50 text-blue-600'}`}><CalendarDays size={18}/></span><span className="min-w-0 flex-1"><strong className="block text-sm">{item.nome_cliente}</strong><span className="block truncate text-xs text-slate-500">{item.proxima_acao}</span></span><span className={`text-xs font-semibold ${vencido?'text-red-600':'text-slate-600'}`}>{formatarData(item.proxima_acao_em)}</span></Link>})}{agenda.length===0&&<p className="p-10 text-center text-sm text-slate-400">Nenhuma próxima ação agendada.</p>}</div>
          </section>
        )}
      </main>
    </div>
  )
}
