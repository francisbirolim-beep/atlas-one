'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Search, UserCheck, UserPlus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { correspondeBuscaAtlas } from '@/lib/buscaAtlas'
import { obterOuCriarCliente } from '@/lib/clientes'
import type { Cliente } from '@/lib/tipos'

type ClienteBusca = Pick<Cliente, 'id' | 'nome' | 'whatsapp' | 'telefone' | 'cidade' | 'bairro' | 'cpf_cnpj'> & { apelido?: string | null }

function temNomeCompleto(nome: string) {
  return nome.trim().split(/\s+/).filter(Boolean).length >= 2
}

export default function NovoOrcamento() {
  const router = useRouter()
  const [busca, setBusca] = useState('')
  const [clientes, setClientes] = useState<ClienteBusca[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erroBusca, setErroBusca] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    supabase.from('clientes').select('*').order('nome').limit(1000).then(({ data, error }) => {
      if (error) {
        setErroBusca('Não foi possível consultar os clientes agora. Atualize a página e tente novamente.')
        setClientes([])
      } else {
        setErroBusca('')
        setClientes((data || []) as ClienteBusca[])
      }
      setCarregando(false)
    })
  }, [])

  const encontrados = useMemo(() => {
    if (busca.trim().length < 2) return []
    return clientes.filter(cliente => correspondeBuscaAtlas(busca, cliente.nome, cliente.apelido, cliente.whatsapp, cliente.telefone, cliente.cidade, cliente.bairro, cliente.cpf_cnpj)).slice(0, 8)
  }, [busca, clientes])

  async function cadastrarEAbrir() {
    setErro('')
    if (!temNomeCompleto(busca)) return setErro('Informe nome e sobrenome para criar o cliente.')
    setSalvando(true)
    const id = await obterOuCriarCliente({ nome: busca.trim(), origem: 'outros' })
    setSalvando(false)
    if (!id) return setErro('Não foi possível criar o Cliente 360. Tente novamente.')
    router.push(`/clientes/${id}`)
  }

  return <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-4"><Link href="/orcamento" className="rounded-lg p-2 transition hover:bg-slate-100"><ArrowLeft size={20} /></Link>{/* eslint-disable-next-line @next/next/no-img-element */}<img src="/icons/icon-mark.png" alt="" className="h-8 w-8" /><div><h1 className="text-lg font-bold text-slate-800">Identificar cliente</h1><p className="text-sm text-slate-500">Todo orçamento começa pelo Cliente 360</p></div></div></header>
    <main className="mx-auto max-w-2xl px-4 py-8"><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-navy">Novo atendimento</p><h2 className="mt-2 text-xl font-bold text-slate-900">Qual é o nome do cliente?</h2><p className="mt-2 text-sm leading-6 text-slate-500">Comece a digitar o nome: os clientes já cadastrados aparecem abaixo. Clique em um deles para abrir o Cliente 360; se não existir, cadastre apenas nome e sobrenome.</p><div className="relative mt-5"><Search size={18} className="absolute left-3 top-3.5 text-slate-400"/><input autoFocus value={busca} onInput={e => { setBusca(e.currentTarget.value); setErro('') }} onCompositionUpdate={e => setBusca(e.currentTarget.value)} placeholder="Digite nome e sobrenome..." className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-3 text-base outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10"/></div>{carregando ? <div className="mt-4 flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin"/> Carregando clientes...</div> : null}{erroBusca ? <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erroBusca}</p> : null}{encontrados.length > 0 ? <div className="mt-3 overflow-hidden rounded-xl border border-emerald-200 bg-white shadow-sm"><p className="border-b border-emerald-100 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800">{encontrados.length === 1 ? 'Cliente encontrado' : `${encontrados.length} clientes encontrados`}</p>{encontrados.map(cliente => <button key={cliente.id} type="button" onClick={() => router.push(`/clientes/${cliente.id}`)} className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-slate-50"><span className="rounded-lg bg-emerald-50 p-2 text-emerald-700"><UserCheck size={16}/></span><span className="min-w-0 flex-1"><strong className="block text-sm text-slate-800">{cliente.nome}</strong><span className="mt-0.5 block truncate text-xs text-slate-500">{[cliente.cidade, cliente.bairro, cliente.whatsapp || cliente.telefone, cliente.cpf_cnpj].filter(Boolean).join(' • ') || 'Abrir Cliente 360'}</span></span><span className="text-xs font-semibold text-brand-navy">Abrir</span></button>)}</div> : null}{busca.trim().length >= 2 && encontrados.length === 0 && !carregando && !erroBusca ? <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-semibold text-amber-900">Nenhum cliente cadastrado com esse nome</p><p className="mt-1 text-xs leading-5 text-amber-800">Se for um cliente novo, informe nome e sobrenome completos para abrir o cadastro dele.</p><button type="button" disabled={salvando} onClick={cadastrarEAbrir} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{salvando ? <Loader2 size={16} className="animate-spin"/> : <UserPlus size={16}/>}Cadastrar e abrir Cliente 360</button></div> : null}{erro ? <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p> : null}</section></main>
  </div>
}
