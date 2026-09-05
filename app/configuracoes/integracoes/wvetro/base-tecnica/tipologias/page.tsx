'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, ImageOff, Loader2, Search, ShieldCheck } from 'lucide-react'
import { tokenAtual, usuarioAtual } from '@/lib/auth'

type LinhaTipologia = {
  id: string
  linha: string
  modelo: string
  tipologiaAtlasId: string | null
  imagemUrl: string | null
  ocorrencias: number
  statusMapeamento: string | null
  componentes: { total: number; vinculados: number; perfil: number; acessorio: number; vidro: number }
  variaveis: number
  temReceitaOficial: boolean
}

type Resumo = {
  totalTipologias: number
  vinculadasAtlas: number
  comImagem: number
  comComposicao: number
  semComposicao: number
  comReceitaOficial: number
  componentesBomTotal: number
  componentesBomVinculados: number
  componentesBomSemVinculo: number
}

type Catalogo = {
  perfis: { total: number; vinculados: number }
  acessorios: { total: number; vinculados: number }
  vidros: { total: number; vinculados: number }
}

export default function ExploradorTipologiasWVetroPage() {
  const [master, setMaster] = useState<boolean | null>(null)
  const [tipologias, setTipologias] = useState<LinhaTipologia[]>([])
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<'todas' | 'sem_composicao' | 'sem_vinculo' | 'sem_imagem' | 'com_receita'>('todas')

  useEffect(() => {
    usuarioAtual().then(async usuario => {
      const ehMaster = usuario?.role === 'master'
      setMaster(ehMaster)
      if (!ehMaster) { setCarregando(false); return }
      try {
        const token = await tokenAtual()
        if (!token) throw new Error('Sessão expirada. Entre novamente no Atlas.')
        const resp = await fetch('/api/integracoes/wvetro/base-tecnica/tipologias', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        })
        const json = await resp.json()
        if (!resp.ok) throw new Error(json?.error || 'Falha ao carregar.')
        setTipologias(json.tipologias || [])
        setResumo(json.resumo || null)
        setCatalogo(json.catalogo || null)
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Falha ao carregar tipologias.')
      } finally {
        setCarregando(false)
      }
    })
  }, [])

  const listaFiltrada = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return tipologias.filter(t => {
      if (termo && !`${t.linha} ${t.modelo}`.toLowerCase().includes(termo)) return false
      if (filtro === 'sem_composicao' && t.componentes.total > 0) return false
      if (filtro === 'sem_vinculo' && t.tipologiaAtlasId) return false
      if (filtro === 'sem_imagem' && t.imagemUrl) return false
      if (filtro === 'com_receita' && !t.temReceitaOficial) return false
      return true
    })
  }, [tipologias, busca, filtro])

  if (master === false) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-3xl rounded-2xl border bg-white p-6">
          <h1 className="text-xl font-bold">Explorador de tipologias W.Vetro</h1>
          <p className="mt-2 text-sm text-slate-600">Área restrita ao Master.</p>
        </div>
      </main>
    )
  }

  const cards = resumo ? [
    ['Tipologias-referência', resumo.totalTipologias],
    ['Vinculadas ao Atlas', resumo.vinculadasAtlas],
    ['Com composição (BOM)', resumo.comComposicao],
    ['Sem nenhum componente', resumo.semComposicao],
    ['Com imagem', resumo.comImagem],
    ['Com receita oficial validada', resumo.comReceitaOficial],
  ] as const : []

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <div>
          <Link href="/configuracoes/integracoes/wvetro/base-tecnica" className="inline-flex items-center gap-2 text-sm text-slate-600"><ArrowLeft size={16} /> Base técnica W.Vetro</Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Explorador de tipologias W.Vetro</h1>
          <p className="mt-1 text-sm text-slate-600">Auditoria por tipologia: composição observada, vínculos com o cadastro Atlas e status da receita técnica oficial. Somente leitura — não altera a carga histórica.</p>
        </div>

        {erro && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{erro}</div>}

        {carregando && <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Carregando...</div>}

        {!carregando && resumo && (
          <section className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {cards.map(([label, total]) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs text-slate-500">{label}</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{total}</p>
              </div>
            ))}
          </section>
        )}

        {!carregando && resumo && catalogo && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Catálogo de referência (identidade + histórico de preço) vs. composição por tipologia (BOM)</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs text-slate-500">Perfis no catálogo</p>
                <p className="text-lg font-bold text-slate-900">{catalogo.perfis.total}</p>
                <p className="text-[11px] text-slate-400">{catalogo.perfis.vinculados} vinculados a produto Atlas</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Acessórios no catálogo</p>
                <p className="text-lg font-bold text-slate-900">{catalogo.acessorios.total}</p>
                <p className="text-[11px] text-slate-400">{catalogo.acessorios.vinculados} vinculados a produto Atlas</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Linhas de composição (BOM)</p>
                <p className="text-lg font-bold text-slate-900">{resumo.componentesBomTotal}</p>
                <p className="text-[11px] text-slate-400">{resumo.componentesBomVinculados} vinculadas a produto Atlas</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Componentes de BOM sem vínculo</p>
                <p className="text-lg font-bold text-amber-700">{resumo.componentesBomSemVinculo}</p>
                <p className="text-[11px] text-slate-400">precisam de vínculo manual com produto Atlas</p>
              </div>
            </div>
          </section>
        )}

        {!carregando && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por linha ou modelo..." className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm" />
              </div>
              <select value={filtro} onChange={e => setFiltro(e.target.value as typeof filtro)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="todas">Todas</option>
                <option value="sem_composicao">Sem composição (BOM vazio)</option>
                <option value="sem_vinculo">Sem vínculo com tipologia Atlas</option>
                <option value="sem_imagem">Sem imagem</option>
                <option value="com_receita">Com receita oficial validada</option>
              </select>
              <span className="text-xs text-slate-500">{listaFiltrada.length} de {tipologias.length}</span>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-3">Linha / Modelo</th>
                    <th className="py-2 pr-3">Vínculo Atlas</th>
                    <th className="py-2 pr-3">Imagem</th>
                    <th className="py-2 pr-3">Componentes (BOM)</th>
                    <th className="py-2 pr-3">Variáveis</th>
                    <th className="py-2 pr-3">Ocorrências</th>
                    <th className="py-2 pr-3">Receita oficial</th>
                  </tr>
                </thead>
                <tbody>
                  {listaFiltrada.map(t => (
                    <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-2 pr-3">
                        <Link href={`/configuracoes/integracoes/wvetro/base-tecnica/tipologias/${t.id}`} className="font-medium text-blue-700 hover:underline">{t.linha}</Link>
                        <p className="text-xs text-slate-500">{t.modelo}</p>
                      </td>
                      <td className="py-2 pr-3">{t.tipologiaAtlasId ? <span className="inline-flex items-center gap-1 text-xs text-emerald-700"><CheckCircle2 size={13} /> Vinculada</span> : <span className="text-xs text-amber-700">Sem vínculo</span>}</td>
                      <td className="py-2 pr-3">{t.imagemUrl ? <span className="text-xs text-emerald-700">Sim</span> : <span className="inline-flex items-center gap-1 text-xs text-slate-400"><ImageOff size={13} /> Não</span>}</td>
                      <td className="py-2 pr-3">
                        <span className={t.componentes.total === 0 ? 'text-xs font-semibold text-red-700' : 'text-xs text-slate-700'}>{t.componentes.total} total</span>
                        <p className="text-[11px] text-slate-400">{t.componentes.perfil} perfil · {t.componentes.acessorio} acessório · {t.componentes.vidro} vidro · {t.componentes.vinculados} vinculados a produto</p>
                      </td>
                      <td className="py-2 pr-3 text-xs">{t.variaveis}</td>
                      <td className="py-2 pr-3 text-xs">{t.ocorrencias}</td>
                      <td className="py-2 pr-3">{t.temReceitaOficial ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><ShieldCheck size={13} /> Validada</span> : <span className="text-xs text-slate-400">Ainda não</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {listaFiltrada.length === 0 && <p className="py-6 text-center text-sm text-slate-400">Nenhuma tipologia encontrada com esse filtro.</p>}
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
          <b>Regra de segurança:</b> tudo aqui é dado observado no histórico W.Vetro (referência auditável). Só vira receita técnica oficial do Atlas depois de validação humana em <code>engenharia_tipologia_formulas_corte</code> — esta tela nunca promove nada automaticamente.
        </section>
      </div>
    </main>
  )
}
