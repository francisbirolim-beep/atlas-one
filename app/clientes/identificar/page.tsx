'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, ClipboardList, Headphones, LayoutDashboard, Loader2, PackagePlus, Pencil, Search, ShoppingCart,
  UserCheck, UserPlus, X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { correspondeBuscaAtlas } from '@/lib/buscaAtlas'
import { obterOuCriarCliente } from '@/lib/clientes'
import type { Cliente } from '@/lib/tipos'

type ClienteBusca = Pick<
  Cliente,
  'id' | 'nome' | 'whatsapp' | 'telefone' | 'cidade' | 'bairro' | 'cpf_cnpj'
> & { apelido?: string | null }

function temNomeCompleto(nome: string) {
  return nome.trim().split(/\s+/).filter(Boolean).length >= 2
}

export default function IdentificarCliente() {
  const router = useRouter()
  const [busca, setBusca] = useState('')
  const [clientes, setClientes] = useState<ClienteBusca[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erroBusca, setErroBusca] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [clienteSelecionado, setClienteSelecionado] = useState<{ id: string; nome: string } | null>(null)

  useEffect(() => {
    supabase
      .from('clientes')
      .select('*')
      .order('nome')
      .limit(1000)
      .then(({ data, error }) => {
        if (error) {
          setErroBusca(
            'Não foi possível consultar os clientes agora. Atualize a página e tente novamente.',
          )
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
    return clientes
      .filter((cliente) =>
        correspondeBuscaAtlas(
          busca,
          cliente.nome,
          cliente.apelido,
          cliente.whatsapp,
          cliente.telefone,
          cliente.cidade,
          cliente.bairro,
          cliente.cpf_cnpj,
        ),
      )
      .slice(0, 8)
  }, [busca, clientes])

  function atualizarBusca(valor: string) {
    setBusca(valor)
    setErro('')
  }

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
  }

  const acoes = clienteSelecionado
    ? [
        {
          titulo: 'Pedido de orçamento',
          subtitulo: 'Registrar visita e enviar ao Kanban',
          icone: ClipboardList,
          href: `/orcamento-rapido?cliente=${encodeURIComponent(clienteSelecionado.id)}`,
        },
        {
          titulo: 'Orçamento sob medida',
          subtitulo: 'Montar com tipologia e variáveis',
          icone: Pencil,
          href: `/orcamento-rapido?cliente=${encodeURIComponent(clienteSelecionado.id)}`,
        },
        {
          titulo: 'Balcão',
          subtitulo: 'Venda de produtos',
          icone: ShoppingCart,
          href: `/orcamento/balcao/novo?cliente=${encodeURIComponent(clienteSelecionado.id)}`,
        },
        {
          titulo: 'Assistência',
          subtitulo: 'Pós-venda e manutenção',
          icone: Headphones,
          href: `/assistencia?cliente=${encodeURIComponent(clienteSelecionado.id)}`,
        },
        {
          titulo: 'Pedido de compra',
          subtitulo: 'Enviar necessidade direto ao comprador',
          icone: PackagePlus,
          href: `/compras?cliente=${encodeURIComponent(clienteSelecionado.id)}&clienteNome=${encodeURIComponent(clienteSelecionado.nome)}`,
        },
        {
          titulo: 'Painel do cliente',
          subtitulo: 'Financeiro, orçamentos e histórico completo',
          icone: LayoutDashboard,
          href: `/clientes/${clienteSelecionado.id}`,
        },
      ]
    : []

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-4">
          <Link
            href="/"
            className="rounded-lg p-2 transition hover:bg-slate-100"
          >
            <ArrowLeft size={20} />
          </Link>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-mark.png" alt="" className="h-8 w-8" />
          <div>
            <h1 className="text-lg font-bold text-slate-800">
              Identificar cliente
            </h1>
            <p className="text-sm text-slate-500">
              Tudo começa pelo Cliente 360
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-navy">
            Cliente 360
          </p>
          <h2 className="mt-2 text-xl font-bold text-slate-900">
            Qual é o nome do cliente?
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Comece a digitar o nome: os clientes já cadastrados aparecem
            abaixo. Clique em um deles para escolher o que fazer — orçamento,
            venda balcão ou assistência. Se o cliente ainda não existir,
            cadastre pelo menos nome e sobrenome para manter o histórico.
          </p>
          <div className="relative mt-5">
            <Search
              size={18}
              className="absolute left-3 top-3.5 text-slate-400"
            />
            <input
              autoFocus
              value={busca}
              onChange={(e) => atualizarBusca(e.currentTarget.value)}
              onInput={(e) => atualizarBusca(e.currentTarget.value)}
              onCompositionEnd={(e) => atualizarBusca(e.currentTarget.value)}
              placeholder="Digite nome e sobrenome..."
              className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-3 text-base outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10"
            />
          </div>
          {carregando ? (
            <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin" /> Carregando
              clientes...
            </div>
          ) : null}
          {erroBusca ? (
            <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {erroBusca}
            </p>
          ) : null}
          {encontrados.length > 0 ? (
            <div className="mt-3 overflow-hidden rounded-xl border border-emerald-200 bg-white shadow-sm">
              <p className="border-b border-emerald-100 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800">
                {encontrados.length === 1
                  ? 'Cliente encontrado'
                  : `${encontrados.length} clientes encontrados`}
              </p>
              {encontrados.map((cliente) => (
                <button
                  key={cliente.id}
                  type="button"
                  onClick={() => setClienteSelecionado({ id: cliente.id, nome: cliente.nome })}
                  className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-slate-50"
                >
                  <span className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
                    <UserCheck size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block text-sm text-slate-800">
                      {cliente.nome}
                    </strong>
                    <span className="mt-0.5 block truncate text-xs text-slate-500">
                      {[
                        cliente.cidade,
                        cliente.bairro,
                        cliente.whatsapp || cliente.telefone,
                        cliente.cpf_cnpj,
                      ]
                        .filter(Boolean)
                        .join(' • ') || 'Escolher ação'}
                    </span>
                  </span>
                  <span className="text-xs font-semibold text-brand-navy">
                    Abrir
                  </span>
                </button>
              ))}
            </div>
          ) : null}
          {busca.trim().length >= 2 &&
          encontrados.length === 0 &&
          !carregando &&
          !erroBusca ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">
                Nenhum cliente cadastrado com esse nome
              </p>
              <p className="mt-1 text-xs leading-5 text-amber-800">
                Se for um cliente novo, informe nome e sobrenome completos
                para abrir o cadastro dele.
              </p>
              <button
                type="button"
                disabled={salvando}
                onClick={() => void cadastrarEAbrir()}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {salvando ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <UserPlus size={16} />
                )}
                Cadastrar e abrir Cliente 360
              </button>
            </div>
          ) : null}
          {erro ? (
            <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {erro}
            </p>
          ) : null}
        </section>
      </main>

      {clienteSelecionado ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={() => setClienteSelecionado(null)}
                className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100"
              >
                <ArrowLeft size={18} />
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-navy">
                  Cliente 360
                </p>
                <h3 className="truncate text-base font-bold text-slate-900">
                  {clienteSelecionado.nome}
                </h3>
              </div>
              <Link
                href={`/clientes/${clienteSelecionado.id}`}
                className="hidden sm:inline text-xs font-medium text-brand-navy hover:underline whitespace-nowrap"
              >
                Painel do cliente
              </Link>
              <button
                type="button"
                onClick={() => router.push('/')}
                className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
              {acoes.map((acao) => {
                const Icone = acao.icone
                return (
                  <Link
                    key={acao.titulo}
                    href={acao.href}
                    className="flex flex-col gap-2 rounded-xl border border-slate-200 p-4 text-left transition hover:-translate-y-0.5 hover:border-brand-navy hover:shadow-md"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-navyLight text-brand-navy">
                      <Icone size={18} />
                    </span>
                    <span className="text-sm font-semibold text-slate-800">{acao.titulo}</span>
                    <span className="text-xs text-slate-500">{acao.subtitulo}</span>
                  </Link>
                )
              })}
            </div>

            <div className="border-t border-slate-100 px-5 py-3 sm:hidden">
              <Link
                href={`/clientes/${clienteSelecionado.id}`}
                className="text-xs font-medium text-brand-navy hover:underline"
              >
                Painel do cliente
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
