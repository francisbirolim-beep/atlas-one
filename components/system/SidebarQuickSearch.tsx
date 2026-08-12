'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Search, X, ArrowUpRight, LayoutGrid } from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import { GUIAS } from '@/lib/guias'
import { listarSetores, listarPermissoesUsuario, nivelEfetivo } from '@/lib/setores'
import type { NivelPermissao, Setor, Usuario } from '@/lib/tipos'

const ALIASES: Record<string, string> = {
  '/cadastro': 'cadastro usuario usuários perfil perfis acesso funcionario funcionários vendedor vendedores equipe',
  '/configuracoes': 'configuração configurações sistema parâmetros preferências',
  '/configuracoes/campos': 'campos formulários cadastro formulário personalizar',
  '/clientes': 'cliente clientes cadastro cliente comercial',
  '/orcamento': 'orçamento orcamentos orçamento pedido proposta',
  '/kanban': 'painel orçamento orçamentos kanban acompanhamento comercial',
  '/ia/comercial': 'ia assistente inteligência artificial comercial ajuda análise',
  '/setores': 'setor setores módulos áreas cadastro setor',
  '/producao': 'produção fabrica fábrica ordem produção',
  '/engenharia': 'engenharia técnico técnica projeto conferência receita tipologia',
}

function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function hrefDoSetor(setor: Setor) {
  return setor.ativo && setor.rota ? setor.rota : `/setor/${setor.id}`
}

type Resultado = {
  id: string
  titulo: string
  subtitulo: string
  href: string
  busca: string
  tipo: 'tela' | 'setor'
}

export default function SidebarQuickSearch() {
  const [aberto, setAberto] = useState(false)
  const [termo, setTermo] = useState('')
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [setores, setSetores] = useState<Setor[]>([])
  const [permissoes, setPermissoes] = useState<Record<string, NivelPermissao>>({})
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    usuarioAtual().then(setUsuario)
  }, [])

  useEffect(() => {
    if (!usuario) return
    const carregar = async () => {
      const lista = await listarSetores()
      const mapa = usuario.role === 'master' ? {} : await listarPermissoesUsuario(usuario.id)
      setSetores(lista)
      setPermissoes(mapa)
    }
    carregar()
  }, [usuario])

  useEffect(() => {
    if (aberto) setTimeout(() => inputRef.current?.focus(), 0)
  }, [aberto])

  useEffect(() => {
    function atalho(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        setAberto(true)
      }
      if (e.key === 'Escape') setAberto(false)
    }
    window.addEventListener('keydown', atalho)
    return () => window.removeEventListener('keydown', atalho)
  }, [])

  const resultadosBase = useMemo<Resultado[]>(() => {
    if (!usuario) return []

    const telas = GUIAS
      .filter((guia) => !guia.masterOnly || usuario.role === 'master')
      .map((guia) => ({
        id: `guia:${guia.href}`,
        titulo: guia.label,
        subtitulo: guia.grupo,
        href: guia.href,
        busca: normalizar(`${guia.label} ${guia.grupo} ${guia.href} ${ALIASES[guia.href] || ''}`),
        tipo: 'tela' as const,
      }))

    const setoresVisiveis = setores
      .filter((setor) => nivelEfetivo(usuario, setor.id, permissoes) !== 'oculto')
      .map((setor) => {
        const href = hrefDoSetor(setor)
        return {
          id: `setor:${setor.id}`,
          titulo: setor.nome,
          subtitulo: 'Setor do Atlas',
          href,
          busca: normalizar(`${setor.nome} ${href} setor modulo área`),
          tipo: 'setor' as const,
        }
      })

    const mapa = new Map<string, Resultado>()
    ;[...telas, ...setoresVisiveis].forEach((item) => {
      if (!mapa.has(item.href)) mapa.set(item.href, item)
    })
    return Array.from(mapa.values())
  }, [usuario, setores, permissoes])

  const resultados = useMemo(() => {
    const q = normalizar(termo)
    if (!q) return resultadosBase.slice(0, 8)
    const palavras = q.split(/\s+/).filter(Boolean)
    return resultadosBase
      .map((item) => ({
        item,
        pontos: palavras.reduce((total, palavra) => {
          if (normalizar(item.titulo).startsWith(palavra)) return total + 5
          if (normalizar(item.titulo).includes(palavra)) return total + 3
          if (item.busca.includes(palavra)) return total + 1
          return total - 20
        }, 0),
      }))
      .filter(({ pontos }) => pontos >= palavras.length)
      .sort((a, b) => b.pontos - a.pontos || a.item.titulo.localeCompare(b.item.titulo))
      .slice(0, 12)
      .map(({ item }) => item)
  }, [termo, resultadosBase])

  function fechar() {
    setAberto(false)
    setTermo('')
  }

  return (
    <div className="hidden md:block">
      <button
        type="button"
        onClick={() => setAberto(true)}
        title="Buscar no menu do Atlas (Ctrl+B)"
        className="fixed left-[198px] top-[16px] z-[55] flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-slate-300 shadow-sm transition hover:border-emerald-500 hover:text-white"
      >
        <Search size={16} />
      </button>

      {aberto && (
        <>
          <button
            type="button"
            aria-label="Fechar busca"
            onClick={fechar}
            className="fixed inset-0 z-[56] cursor-default bg-slate-950/25 backdrop-blur-[1px]"
          />
          <section className="fixed left-3 top-16 z-[57] w-[360px] max-w-[calc(100vw-24px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20">
            <div className="border-b border-slate-100 p-3">
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 focus-within:border-emerald-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-500/10">
                <Search size={16} className="text-slate-400" />
                <input
                  ref={inputRef}
                  value={termo}
                  onChange={(e) => setTermo(e.target.value)}
                  placeholder="Ex.: cadastro, perfil, produção..."
                  className="h-11 min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                />
                {termo && (
                  <button type="button" onClick={() => setTermo('')} className="text-slate-400 hover:text-slate-700" title="Limpar">
                    <X size={15} />
                  </button>
                )}
              </div>
              <p className="mt-2 px-1 text-[11px] text-slate-400">Pesquise telas, cadastros e setores. Atalho: Ctrl+B.</p>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-2">
              {resultados.length === 0 ? (
                <div className="px-3 py-8 text-center text-sm text-slate-400">Nenhuma tela encontrada para “{termo}”.</div>
              ) : (
                resultados.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={fechar}
                    className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-slate-50"
                  >
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 group-hover:bg-emerald-50 group-hover:text-emerald-700">
                      {item.tipo === 'setor' ? <LayoutGrid size={16} /> : <Search size={15} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-slate-800">{item.titulo}</div>
                      <div className="truncate text-xs text-slate-400">{item.subtitulo}</div>
                    </div>
                    <ArrowUpRight size={15} className="text-slate-300 transition group-hover:text-emerald-600" />
                  </Link>
                ))
              )}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
