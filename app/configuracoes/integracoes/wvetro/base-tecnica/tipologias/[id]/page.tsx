'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, CheckCircle2, ImageOff, Loader2, ShieldCheck, XCircle } from 'lucide-react'
import { tokenAtual, usuarioAtual } from '@/lib/auth'

type Componente = {
  id: string
  tipo: 'perfil' | 'acessorio' | 'vidro'
  chave: string
  codigo: string | null
  codigoWvetro: string | null
  nome: string
  cor: string | null
  unidadeOrigem: string | null
  ncm: string | null
  imagemUrl: string | null
  ocorrencias: number
  quantidadeMin: number | null
  quantidadeMax: number | null
  quantidadeMedia: number | null
  medidaMin: number | null
  medidaMax: number | null
  custoMin: number | null
  custoMax: number | null
  custoUltimo: number | null
  ultimoCustoEm: string | null
  vendaMin: number | null
  vendaMax: number | null
  vendaUltimo: number | null
  posicoes: unknown
  cortes: unknown
  statusMapeamento: string | null
  produtoAtlas: { id: string; nome: string; ativo: boolean } | null
}

type Variavel = {
  id: string
  chave: string
  label: string
  valor: string
  origemTipo: string
  confianca: number | null
  evidencia: string | null
}

type ReceitaOficial = {
  id: string
  configuracaoChave?: string
  configuracao_chave?: string
  configuracaoLabel?: string
  configuracao_label?: string
  status: string
  versao: number
  observacoes: string | null
}

type Detalhe = {
  referencia: {
    id: string
    linha: string
    modelo: string
    imagemUrl: string | null
    ocorrencias: number
    statusMapeamento: string | null
    primeiroVisto: string | null
    ultimoVisto: string | null
    larguraMinMm?: number | null
    larguraMaxMm?: number | null
    alturaMinMm?: number | null
    alturaMaxMm?: number | null
    ambientesObservados?: string[]
    nomesObservados?: string[]
  }
  tipologiaAtlas: { id: string; chave: string; label: string; categoria: string | null; foto_url: string | null } | null
  componentes: Componente[]
  variaveis: Variavel[]
  receitasOficiais: ReceitaOficial[]
}

function moeda(v: number | null) {
  if (v == null) return '—'
  return `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
}

function GrupoComponentes({ titulo, itens }: { titulo: string; itens: Componente[] }) {
  if (itens.length === 0) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <b>{titulo}:</b> nenhum componente observado ainda para esta tipologia.
      </div>
    )
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-2 text-sm font-semibold text-slate-800">{titulo} ({itens.length})</div>
      <div className="divide-y divide-slate-100">
        {itens.map(c => (
          <div key={c.id} className="flex flex-wrap items-start gap-4 px-4 py-3 text-xs">
            <div className="w-14 flex-shrink-0">
              {c.imagemUrl ? (
                <Image src={c.imagemUrl} alt={c.nome} width={56} height={56} className="rounded-lg border border-slate-200 object-cover" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-slate-300 text-slate-300"><ImageOff size={18} /></div>
              )}
            </div>
            <div className="min-w-[180px] flex-1">
              <p className="font-medium text-slate-800">{c.nome}{c.cor ? ` · ${c.cor}` : ''}</p>
              <p className="mt-0.5 text-slate-500">Código Atlas: {c.codigo || '—'} · Código W.Vetro: {c.codigoWvetro || '—'} · NCM: {c.ncm || '—'} · Unidade: {c.unidadeOrigem || '—'}</p>
              <p className="mt-0.5">
                {c.produtoAtlas
                  ? <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 size={12} /> Vinculado a: {c.produtoAtlas.nome}{!c.produtoAtlas.ativo ? ' (inativo)' : ''}</span>
                  : <span className="inline-flex items-center gap-1 text-amber-700"><XCircle size={12} /> Sem vínculo com produto Atlas</span>}
              </p>
            </div>
            <div className="w-36">
              <p className="text-slate-500">Quantidade</p>
              <p className="font-medium text-slate-800">{c.quantidadeMin ?? '—'} a {c.quantidadeMax ?? '—'} {c.quantidadeMedia != null ? `(méd. ${c.quantidadeMedia.toFixed(2)})` : ''}</p>
              <p className="mt-1 text-slate-500">Medida</p>
              <p className="font-medium text-slate-800">{c.medidaMin ?? '—'} a {c.medidaMax ?? '—'} mm</p>
            </div>
            <div className="w-40">
              <p className="text-slate-500">Custo (mín/máx/último)</p>
              <p className="font-medium text-slate-800">{moeda(c.custoMin)} / {moeda(c.custoMax)} / {moeda(c.custoUltimo)}</p>
              <p className="mt-1 text-slate-500">Venda (mín/máx/último)</p>
              <p className="font-medium text-slate-800">{moeda(c.vendaMin)} / {moeda(c.vendaMax)} / {moeda(c.vendaUltimo)}</p>
            </div>
            <div className="w-32">
              <p className="text-slate-500">Ocorrências</p>
              <p className="font-medium text-slate-800">{c.ocorrencias}</p>
              <p className="mt-1 text-slate-500">Posição/corte</p>
              <p className="font-medium text-slate-800">
                {Array.isArray(c.posicoes) && c.posicoes.length > 0 ? 'posição' : '—'}
                {' / '}
                {Array.isArray(c.cortes) && c.cortes.length > 0 ? 'corte' : '—'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function TipologiaWVetroDetalhePage() {
  const params = useParams<{ id: string }>()
  const [master, setMaster] = useState<boolean | null>(null)
  const [dados, setDados] = useState<Detalhe | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    usuarioAtual().then(async usuario => {
      const ehMaster = usuario?.role === 'master'
      setMaster(ehMaster)
      if (!ehMaster) { setCarregando(false); return }
      try {
        const token = await tokenAtual()
        if (!token) throw new Error('Sessão expirada. Entre novamente no Atlas.')
        const resp = await fetch(`/api/integracoes/wvetro/base-tecnica/tipologias/${params.id}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        })
        const json = await resp.json()
        if (!resp.ok) throw new Error(json?.error || 'Falha ao carregar.')
        setDados(json)
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Falha ao carregar a tipologia.')
      } finally {
        setCarregando(false)
      }
    })
  }, [params.id])

  if (master === false) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-3xl rounded-2xl border bg-white p-6">
          <h1 className="text-xl font-bold">Tipologia W.Vetro</h1>
          <p className="mt-2 text-sm text-slate-600">Área restrita ao Master.</p>
        </div>
      </main>
    )
  }

  const perfis = dados?.componentes.filter(c => c.tipo === 'perfil') || []
  const acessorios = dados?.componentes.filter(c => c.tipo === 'acessorio') || []
  const vidros = dados?.componentes.filter(c => c.tipo === 'vidro') || []

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <div>
          <Link href="/configuracoes/integracoes/wvetro/base-tecnica/tipologias" className="inline-flex items-center gap-2 text-sm text-slate-600"><ArrowLeft size={16} /> Explorador de tipologias</Link>
        </div>

        {erro && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{erro}</div>}
        {carregando && <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Carregando...</div>}

        {!carregando && dados && (
          <>
            <section className="flex flex-wrap items-start gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="h-28 w-28 flex-shrink-0">
                {dados.referencia.imagemUrl ? (
                  <Image src={dados.referencia.imagemUrl} alt={dados.referencia.modelo} width={112} height={112} className="h-28 w-28 rounded-xl border border-slate-200 object-cover" />
                ) : (
                  <div className="flex h-28 w-28 items-center justify-center rounded-xl border border-dashed border-slate-300 text-slate-300"><ImageOff size={28} /></div>
                )}
              </div>
              <div className="min-w-[220px] flex-1">
                <h1 className="text-xl font-bold text-slate-900">{dados.referencia.linha}</h1>
                <p className="text-sm text-slate-600">{dados.referencia.modelo}</p>
                <p className="mt-2 text-xs text-slate-500">Visto de {dados.referencia.primeiroVisto || '—'} até {dados.referencia.ultimoVisto || '—'} · {dados.referencia.ocorrencias} ocorrência(s) histórica(s)</p>
                {(dados.referencia.larguraMinMm != null || dados.referencia.alturaMinMm != null) && (
                  <p className="mt-1 text-xs text-slate-500">
                    REFERÊNCIA HISTÓRICA — Largura: {dados.referencia.larguraMinMm ?? '—'}–{dados.referencia.larguraMaxMm ?? '—'} mm · Altura: {dados.referencia.alturaMinMm ?? '—'}–{dados.referencia.alturaMaxMm ?? '—'} mm
                    {dados.referencia.ambientesObservados && dados.referencia.ambientesObservados.length > 0 && (
                      <> · Ambientes: {dados.referencia.ambientesObservados.join(', ')}</>
                    )}
                  </p>
                )}
                <p className="mt-1 text-xs">
                  {dados.tipologiaAtlas
                    ? <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 size={13} /> Vinculada à tipologia Atlas: {dados.tipologiaAtlas.label} ({dados.tipologiaAtlas.chave})</span>
                    : <span className="inline-flex items-center gap-1 text-amber-700"><XCircle size={13} /> Sem vínculo com tipologia Atlas</span>}
                </p>
              </div>
              <div className="w-full sm:w-56">
                <p className="text-xs font-semibold text-slate-600">Status da validação técnica</p>
                {dados.receitasOficiais.length === 0 ? (
                  <p className="mt-1 text-xs text-slate-500">Nenhuma receita oficial ainda. Este componente é referência auditável, não fórmula validada.</p>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {dados.receitasOficiais.map(r => (
                      <li key={r.id} className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-800">
                        <ShieldCheck size={12} /> {(r.configuracaoLabel || r.configuracao_label || r.configuracaoChave || r.configuracao_chave)} · v{r.versao} · {r.status}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 font-semibold text-slate-900">Variáveis observadas ({dados.variaveis.length})</h2>
              {dados.variaveis.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhuma variável extraída ainda para esta tipologia.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {dados.variaveis.map(v => (
                    <div key={v.id} className="rounded-lg border border-slate-200 p-3 text-xs">
                      <p className="font-medium text-slate-800">{v.label}</p>
                      <p className="text-slate-500">Valor observado: <b>{v.valor || '—'}</b></p>
                      <p className="mt-1 text-slate-400">Origem: {v.origemTipo}{v.confianca != null ? ` · confiança ${(Number(v.confianca) * 100).toFixed(0)}%` : ''}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-3">
              <h2 className="font-semibold text-slate-900">Composição observada (BOM)</h2>
              <GrupoComponentes titulo="Perfis" itens={perfis} />
              <GrupoComponentes titulo="Acessórios" itens={acessorios} />
              <GrupoComponentes titulo="Vidros" itens={vidros} />
            </section>

            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
              <b>Regra de segurança:</b> tudo nesta tela é dado observado no histórico W.Vetro. Nenhuma composição é promovida automaticamente a receita técnica — a validação continua manual, em Engenharia, tipologia por tipologia.
            </section>
          </>
        )}
      </div>
    </main>
  )
}
