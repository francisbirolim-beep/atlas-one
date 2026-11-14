'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, ChevronRight, ClipboardList, Headphones, LayoutDashboard, Loader2,
  PackagePlus, Pencil, Ruler, Search, ShoppingCart, UserCheck, UserPlus, Users, MapPin, Plus, RefreshCw,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { correspondeBuscaAtlas } from '@/lib/buscaAtlas'
import { obterOuCriarCliente } from '@/lib/clientes'
import type { Cliente } from '@/lib/tipos'

type ClienteBusca = Pick<Cliente, 'id' | 'nome' | 'whatsapp' | 'telefone' | 'cidade' | 'bairro' | 'cpf_cnpj'> & { apelido?: string | null }
// Cache anterior é desconsiderado: poderia conter clientes já inativados.
const CACHE_CLIENTES_IDENTIFICAR = 'atlas_clientes_identificar_cache_v2_ativos'

function temNomeCompleto(nome: string) {
  return nome.trim().split(/\s+/).filter(Boolean).length >= 2
}

function iniciais(nome: string) {
  return nome.trim().split(/\s+/).slice(0, 2).map((parte) => parte[0]?.toUpperCase()).join('') || 'CL'
}

export default function IdentificarCliente() {
  const [busca, setBusca] = useState('')
  const [clientes, setClientes] = useState<ClienteBusca[]>([])
  const [carregando, setCarregando] = useState(false)
  const [erroBusca, setErroBusca] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteBusca | null>(null)

  useEffect(() => {
    const termo = busca.trim()
    if (!termo) {
      setClientes([])
      setCarregando(false)
      setErroBusca('')
      return
    }

    let cancelado = false
    const timer = window.setTimeout(async () => {
      setCarregando(true)
      setErroBusca('')

      try {
        const termoBusca = termo.replace(/[%,]/g, ' ').replace(/\s+/g, ' ').trim()
        const primeiroTermo = termoBusca.split(' ')[0] || termoBusca
        const padraoContem = `%${primeiroTermo}%`
        const { data, error } = await supabase
          .from('clientes')
          .select('id,nome,apelido,whatsapp,telefone,cidade,bairro,cpf_cnpj')
          .eq('ativo', true)
          .or([
            `nome.ilike.${padraoContem}`,
            `apelido.ilike.${padraoContem}`,
            `whatsapp.ilike.${padraoContem}`,
            `telefone.ilike.${padraoContem}`,
            `cidade.ilike.${padraoContem}`,
            `bairro.ilike.${padraoContem}`,
            `cpf_cnpj.ilike.${padraoContem}`,
          ].join(','))
          .order('nome')
          .limit(20)

        if (cancelado) return

        if (error) {
          throw error
        }

        const encontradosBanco = ((data || []) as ClienteBusca[])
          .filter((cliente) => correspondeBuscaAtlas(
            termo, cliente.nome, cliente.apelido, cliente.whatsapp, cliente.telefone,
            cliente.cidade, cliente.bairro, cliente.cpf_cnpj,
          ))
          .slice(0, 8)

        setClientes(encontradosBanco)
        try { localStorage.setItem(CACHE_CLIENTES_IDENTIFICAR, JSON.stringify(encontradosBanco)) } catch {}
      } catch {
        if (cancelado) return
        setErroBusca('Não foi possível consultar os clientes agora. Atualize a página e tente novamente.')
        try {
          const cache = JSON.parse(localStorage.getItem(CACHE_CLIENTES_IDENTIFICAR) || '[]')
          setClientes(Array.isArray(cache) ? (cache as ClienteBusca[]).filter((cliente) => correspondeBuscaAtlas(
            termo, cliente.nome, cliente.apelido, cliente.whatsapp, cliente.telefone,
            cliente.cidade, cliente.bairro, cliente.cpf_cnpj,
          )).slice(0, 8) : [])
        } catch {
          setClientes([])
        }
      } finally {
        if (!cancelado) setCarregando(false)
      }
    }, 180)

    return () => {
      cancelado = true
      window.clearTimeout(timer)
    }
  }, [busca])

  const encontrados = useMemo(() => {
    return clientes.filter((cliente) => correspondeBuscaAtlas(
      busca, cliente.nome, cliente.apelido, cliente.whatsapp, cliente.telefone,
      cliente.cidade, cliente.bairro, cliente.cpf_cnpj,
    )).slice(0, 8)
  }, [busca, clientes])

  async function cadastrarEAbrir() {
    setErro('')
    if (!temNomeCompleto(busca)) {
      setErro('Informe nome e sobrenome para criar o cliente.')
      return
    }
    setSalvando(true)
    const id = await obterOuCriarCliente({ nome: busca.trim() })
    setSalvando(false)
    if (!id) {
      setErro('Não foi possível criar o Cliente 360. Tente novamente.')
      return
    }
    setClienteSelecionado({ id, nome: busca.trim() })
    setBusca('')
  }

  const acoes = clienteSelecionado ? [
    { titulo: 'Pedido de orçamento', subtitulo: 'Registrar visita e enviar ao Kanban', icone: ClipboardList, href: `/orcamento-rapido?cliente=${encodeURIComponent(clienteSelecionado.id)}`, cor: 'bg-blue-50 text-blue-600' },
    { titulo: 'Orçamento sob medida', subtitulo: 'Montar com tipologia e variáveis', icone: Pencil, href: `/orcamento-rapido?cliente=${encodeURIComponent(clienteSelecionado.id)}&modo=sob-medida&novo=1`, cor: 'bg-emerald-50 text-emerald-600' },
    { titulo: 'Venda', subtitulo: 'Venda direta de produtos prontos', icone: ShoppingCart, href: `/balcao?cliente=${encodeURIComponent(clienteSelecionado.id)}`, cor: 'bg-violet-50 text-violet-700' },
    { titulo: 'Medida final', subtitulo: 'Registrar medidas finais da obra', icone: Ruler, href: `/producao/medicao-final/cliente/${encodeURIComponent(clienteSelecionado.id)}`, cor: 'bg-rose-50 text-rose-500' },
    { titulo: 'Assistência', subtitulo: 'Pós-venda e manutenção', icone: Headphones, href: `/assistencia?cliente=${encodeURIComponent(clienteSelecionado.id)}`, cor: 'bg-violet-50 text-violet-700' },
    { titulo: 'Pedido de compra', subtitulo: 'Enviar necessidade direto ao comprador', icone: PackagePlus, href: `/compras?cliente=${encodeURIComponent(clienteSelecionado.id)}&clienteNome=${encodeURIComponent(clienteSelecionado.nome)}`, cor: 'bg-red-50 text-red-700' },
    { titulo: 'Abrir cliente', subtitulo: 'Ver histórico, orçamentos, pedidos e finanças', icone: LayoutDashboard, href: `/clientes/${clienteSelecionado.id}`, cor: 'bg-slate-100 text-brand-navy' },
  ] : []

  function prepararNovoCliente() {
    setClienteSelecionado(null)
    setBusca('')
    setErro('')
    window.setTimeout(() => document.getElementById('cliente360-busca')?.focus(), 0)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-blue-50/30 pb-12 text-slate-900">
      <div className="mx-auto w-full max-w-[1500px] px-3 py-5 sm:px-6 lg:px-8">
        <header className="mb-5 flex flex-wrap items-center gap-3 border-b border-slate-200 pb-5">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
            <Users size={28} strokeWidth={2}/>
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">Cliente 360</h1>
            <p className="text-sm text-slate-500">Localize um cliente e escolha o que deseja fazer.</p>
          </div>
          <Link href="/" title="Voltar ao Início" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
            <ArrowLeft size={15}/> Início
          </Link>
        </header>

        <section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]" aria-label="Buscar ou cadastrar cliente">
          <div className="relative min-w-0">
            <Search size={19} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"/>
            <input id="cliente360-busca" autoFocus={!clienteSelecionado} value={busca}
              onChange={e=>{setBusca(e.currentTarget.value);setClienteSelecionado(null);setErro('')}}
              placeholder="Pesquisar por nome, apelido, telefone ou CPF/CNPJ..."
              aria-label="Pesquisar cliente pelo nome, apelido, telefone ou CPF/CNPJ"
              className="h-12 w-full rounded-xl border border-slate-300 bg-white pl-12 pr-4 text-sm shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"/>
          </div>
          <button type="button" onClick={prepararNovoCliente}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-sm hover:bg-blue-700">
            <Plus size={18}/> Cadastrar cliente
          </button>
        </section>

        {clienteSelecionado ? (
          <>
            <section className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50/75 p-4 sm:p-5">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-blue-100 text-lg font-extrabold text-blue-700">
                {iniciais(clienteSelecionado.nome)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-600">Cliente selecionado</p>
                <Link href={`/clientes/${clienteSelecionado.id}`} className="block truncate text-lg font-extrabold text-slate-950 hover:underline sm:text-xl" title="Abrir cadastro do cliente">
                  {clienteSelecionado.nome}
                </Link>
                {(clienteSelecionado.cidade || clienteSelecionado.bairro) && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-slate-600">
                    <MapPin size={13}/> {[clienteSelecionado.cidade,clienteSelecionado.bairro].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <button type="button" onClick={prepararNovoCliente}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50">
                <RefreshCw size={15}/> Trocar cliente
              </button>
            </section>

            <h2 className="mb-4 flex items-center gap-2 text-xl font-extrabold text-slate-950">
              <span className="text-blue-600"><UserCheck size={24}/></span> O que você deseja fazer?
            </h2>
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Ações do Cliente 360">
              {acoes.map(acao => {
                const Icone = acao.icone
                return (
                  <Link key={acao.titulo} href={acao.href}
                    className="group flex min-h-[125px] items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500">
                    <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${acao.cor}`}>
                      <Icone size={24} strokeWidth={2}/>
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block text-sm font-extrabold text-slate-950">{acao.titulo}</strong>
                      <span className="mt-1 block text-xs leading-5 text-slate-600">{acao.subtitulo}</span>
                    </span>
                    <ChevronRight size={19} className="shrink-0 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-blue-600"/>
                  </Link>
                )
              })}
            </section>
          </>
        ) : (
          <section className="max-w-3xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-base font-bold text-slate-900">Qual cliente você deseja atender?</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Pesquise um cliente existente e selecione-o para abrir as opções. Para cadastrar um novo cliente, digite nome e sobrenome no campo de pesquisa.
            </p>
            {carregando && <div className="mt-4 flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin"/> Buscando clientes...</div>}
            {erroBusca && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erroBusca}</p>}
            {encontrados.length > 0 && (
              <div className="mt-4 overflow-hidden rounded-xl border border-blue-100 bg-white">
                {encontrados.map(cliente=>(
                  <button key={cliente.id} type="button"
                    onClick={()=>{setClienteSelecionado(cliente);setBusca('')}}
                    className="flex w-full items-center gap-3 border-b border-slate-100 px-3 py-3 text-left transition last:border-b-0 hover:bg-blue-50">
                    <span className="rounded-xl bg-blue-50 p-2 text-blue-600"><UserCheck size={18}/></span>
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-sm text-slate-900">{cliente.nome}</strong>
                      <span className="block truncate text-xs text-slate-500">
                        {[cliente.apelido,cliente.cidade,cliente.bairro,cliente.whatsapp||cliente.telefone].filter(Boolean).join(' · ')||'Escolher ação'}
                      </span>
                    </span>
                    <span className="text-xs font-semibold text-blue-700">Selecionar</span>
                  </button>
                ))}
              </div>
            )}
            {busca.trim().length>=1 && encontrados.length===0 && !carregando && !erroBusca && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900">Nenhum cliente cadastrado com esse nome</p>
                <p className="mt-1 text-xs text-amber-900/80">Para cadastrar, informe nome e sobrenome.</p>
                <button type="button" disabled={salvando} onClick={()=>void cadastrarEAbrir()}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-60">
                  {salvando ? <Loader2 size={16} className="animate-spin"/>:<UserPlus size={16}/>} Cadastrar e abrir Cliente 360
                </button>
              </div>
            )}
            {erro && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
          </section>
        )}
      </div>
    </div>
  )
}
