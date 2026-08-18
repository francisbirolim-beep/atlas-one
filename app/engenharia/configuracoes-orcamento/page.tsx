'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Layers3, Loader2, Save, Search, ShieldCheck, XCircle } from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import { listarProdutos } from '@/lib/produtos'
import { listarTipologias } from '@/lib/tipologias'
import { listarLinhasTecnicas, type LinhaTecnica } from '@/lib/linhasTecnicas'
import {
  listarTodasOpcoes,
  listarVariaveisDaTipologia,
  type EngenhariaVariavelOpcao,
  type TipologiaVariavelComVariavel,
} from '@/lib/engenhariaVariaveis'
import {
  alternarConfiguracaoOrcamento,
  criarConfiguracaoValidadaOrcamento,
  listarConfiguracoesOrcamentoAdministracao,
  type ConfiguracaoOrcamento,
} from '@/lib/orcamentoConfiguracoes'
import type { Produto, Tipologia, Usuario } from '@/lib/tipos'

function normalizar(valor: string) {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

export default function ConfiguracoesOrcamentoPage() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [linhas, setLinhas] = useState<LinhaTecnica[]>([])
  const [tipologias, setTipologias] = useState<Tipologia[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [configuracoes, setConfiguracoes] = useState<ConfiguracaoOrcamento[]>([])
  const [linhaId, setLinhaId] = useState('')
  const [tipologiaId, setTipologiaId] = useState('')
  const [produtoId, setProdutoId] = useState('')
  const [nome, setNome] = useState('')
  const [evidencia, setEvidencia] = useState('')
  const [variaveis, setVariaveis] = useState<TipologiaVariavelComVariavel[]>([])
  const [opcoes, setOpcoes] = useState<EngenhariaVariavelOpcao[]>([])
  const [valores, setValores] = useState<Record<string, string>>({})
  const [busca, setBusca] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  async function carregar() {
    setCarregando(true)
    const [me, ls, ts, ps, os, cs] = await Promise.all([
      usuarioAtual(),
      listarLinhasTecnicas(),
      listarTipologias(),
      listarProdutos(true),
      listarTodasOpcoes(),
      listarConfiguracoesOrcamentoAdministracao(),
    ])
    setUsuario(me)
    setLinhas(ls.filter(l => l.ativo))
    setTipologias(ts)
    setProdutos(ps.filter(p => p.categoria === 'porta_janela_padrao' || p.categoria === 'produto'))
    setOpcoes(os)
    setConfiguracoes(cs)
    setCarregando(false)
  }

  useEffect(() => { void carregar() }, [])

  useEffect(() => {
    async function carregarVariaveis() {
      if (!tipologiaId) { setVariaveis([]); setValores({}); return }
      setVariaveis(await listarVariaveisDaTipologia(tipologiaId))
      setValores({})
    }
    void carregarVariaveis()
  }, [tipologiaId])

  const linha = linhas.find(l => l.id === linhaId) || null
  const tipologiasFiltradas = useMemo(() => {
    if (!linha) return tipologias
    return tipologias.filter(t => Boolean(linha.tipologia_ids?.includes(t.id)))
  }, [linha, tipologias])
  const produtosFiltrados = useMemo(() => {
    if (!linha) return produtos
    return produtos.filter(p => Boolean(linha.produto_ids?.includes(p.id)))
  }, [linha, produtos])

  const configuracoesFiltradas = useMemo(() => {
    const q = normalizar(busca)
    return configuracoes.filter(c => {
      if (!c.usar_no_orcamento) return false
      const tipologia = tipologias.find(t => t.id === c.tipologia_id)
      const produto = produtos.find(p => p.id === c.produto_id)
      if (linha) {
        const compativel = c.produto_id
          ? Boolean(linha.produto_ids?.includes(c.produto_id))
          : Boolean(linha.tipologia_ids?.includes(c.tipologia_id))
        if (!compativel) return false
      }
      if (!q) return true
      return normalizar(`${c.nome} ${tipologia?.label || ''} ${produto?.nome || ''}`).includes(q)
    })
  }, [busca, configuracoes, linha, produtos, tipologias])

  function opcoesDaVariavel(variavelId: string) {
    return opcoes.filter(o => o.variavel_id === variavelId)
  }

  async function salvar() {
    setErro(''); setSucesso('')
    if (!tipologiaId) { setErro('Selecione a tipologia.'); return }
    if (!nome.trim()) { setErro('Dê um nome para a configuração, por exemplo “3F — Aba + reforço interno”.'); return }
    if (!evidencia.trim()) { setErro('Registre a evidência técnica usada para validar essa combinação.'); return }
    for (const vinculo of variaveis) {
      if (vinculo.obrigatorio && !valores[vinculo.variavel.chave]) {
        setErro(`Preencha a variável obrigatória “${vinculo.variavel.label}”.`)
        return
      }
    }

    setSalvando(true)
    const resultado = await criarConfiguracaoValidadaOrcamento({
      tipologiaId,
      produtoId: produtoId || null,
      nome: nome.trim(),
      valores,
      evidencia: evidencia.trim(),
    })
    setSalvando(false)
    if (!resultado.ok) { setErro(resultado.error || 'Não foi possível salvar.'); return }

    setNome(''); setEvidencia(''); setValores({})
    setConfiguracoes(await listarConfiguracoesOrcamentoAdministracao())
    setSucesso('Configuração validada e publicada para o orçamento.')
  }

  async function alternar(item: ConfiguracaoOrcamento) {
    setErro(''); setSucesso('')
    const resultado = await alternarConfiguracaoOrcamento(item.id, item.ativo === false)
    if (!resultado.ok) { setErro(resultado.error || 'Não foi possível alterar a configuração.'); return }
    setConfiguracoes(await listarConfiguracoesOrcamentoAdministracao())
  }

  if (carregando) return <div className="min-h-screen grid place-items-center text-slate-400"><Loader2 className="animate-spin" /></div>
  if (usuario?.role !== 'master') {
    return <div className="min-h-screen grid place-items-center px-4"><div className="max-w-md text-center"><ShieldCheck className="mx-auto text-slate-300 mb-3" size={42}/><p className="text-slate-600">Somente o Master pode publicar configurações validadas para o orçamento.</p><Link href="/engenharia" className="text-brand-navy text-sm hover:underline">Voltar à Engenharia</Link></div></div>
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/engenharia" className="p-2 rounded-lg hover:bg-slate-100"><ArrowLeft size={20}/></Link>
          <Layers3 className="text-brand-navy" size={22}/>
          <div><h1 className="font-bold text-slate-800">Configurações validadas de orçamento</h1><p className="text-sm text-slate-500">Modelos rápidos: Linha → Tipologia → combinação técnica conferida</p></div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-7 grid lg:grid-cols-[420px_1fr] gap-6">
        <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 h-fit">
          <div><h2 className="font-semibold text-slate-800">Nova configuração validada</h2><p className="text-xs text-slate-500 mt-1">Só publique combinações já conferidas. O vendedor poderá escolhê-las com um clique.</p></div>
          {erro && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">{erro}</div>}
          {sucesso && <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex gap-2"><CheckCircle2 size={16}/>{sucesso}</div>}

          <div><label className="text-xs text-slate-500">Linha (opcional, usada para filtrar)</label><select value={linhaId} onChange={e => { setLinhaId(e.target.value); setTipologiaId(''); setProdutoId('') }} className="w-full mt-1 border border-slate-300 rounded-xl p-2.5 text-sm"><option value="">Todas / a definir</option>{linhas.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}</select></div>
          <div><label className="text-xs text-slate-500">Tipologia *</label><select value={tipologiaId} onChange={e => setTipologiaId(e.target.value)} className="w-full mt-1 border border-slate-300 rounded-xl p-2.5 text-sm"><option value="">Selecione...</option>{tipologiasFiltradas.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></div>
          <div><label className="text-xs text-slate-500">Produto base (opcional)</label><select value={produtoId} onChange={e => setProdutoId(e.target.value)} className="w-full mt-1 border border-slate-300 rounded-xl p-2.5 text-sm"><option value="">Sem produto específico</option>{produtosFiltrados.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></div>
          <div><label className="text-xs text-slate-500">Nome que o vendedor verá *</label><input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: 3F — Reforço de aba + interno" className="w-full mt-1 border border-slate-300 rounded-xl p-2.5 text-sm"/></div>

          {tipologiaId && (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-600">Variáveis da configuração</p>
              {variaveis.length === 0 && <p className="text-xs text-slate-400">Essa tipologia ainda não possui variáveis vinculadas.</p>}
              {variaveis.map(v => (
                <div key={v.id}><label className="text-xs text-slate-500">{v.variavel.label}{v.obrigatorio ? ' *' : ''}</label><select value={valores[v.variavel.chave] || ''} onChange={e => setValores(prev => ({ ...prev, [v.variavel.chave]: e.target.value }))} className="w-full mt-1 border border-slate-300 rounded-lg p-2 text-sm"><option value="">A definir</option>{opcoesDaVariavel(v.variavel_id).map(o => <option key={o.id} value={o.chave}>{o.label}</option>)}</select></div>
              ))}
            </div>
          )}

          <div><label className="text-xs text-slate-500">Evidência técnica da validação *</label><textarea value={evidencia} onChange={e => setEvidencia(e.target.value)} placeholder="Ex: conferido no relatório W.Vetro OC..., catálogo..., teste de produção..." className="w-full mt-1 border border-slate-300 rounded-xl p-2.5 text-sm h-24 resize-none"/></div>
          <button onClick={salvar} disabled={salvando} className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-navy text-white py-3 text-sm font-semibold disabled:opacity-50"><Save size={16}/>{salvando ? 'Salvando...' : 'Salvar e validar'}</button>
        </section>

        <section className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="relative"><Search className="absolute left-3 top-3 text-slate-400" size={16}/><input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar configuração, tipologia ou produto..." className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm"/></div>
          </div>
          <div className="space-y-3">
            {configuracoesFiltradas.length === 0 && <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-sm text-slate-500">Nenhuma configuração publicada ainda.</div>}
            {configuracoesFiltradas.map(c => {
              const t = tipologias.find(x => x.id === c.tipologia_id)
              const p = produtos.find(x => x.id === c.produto_id)
              return <article key={c.id} className={`bg-white border rounded-2xl p-4 ${c.ativo === false ? 'border-slate-200 opacity-60' : c.validado ? 'border-emerald-200' : 'border-amber-200'}`}>
                <div className="flex items-start justify-between gap-3"><div><div className="flex gap-2 flex-wrap"><span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">{t?.label || 'Tipologia'}</span>{c.validado && <span className="text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 flex items-center gap-1"><ShieldCheck size={12}/> Validada</span>}</div><h3 className="font-semibold text-slate-800 mt-2">{c.nome}</h3>{p && <p className="text-xs text-slate-500 mt-1">Produto base: {p.nome}</p>}<p className="text-xs text-slate-400 mt-1">{Object.keys(c.valores || {}).length} variável(is) registrada(s)</p>{c.evidencia_validacao && <p className="text-xs text-slate-500 mt-2">Evidência: {c.evidencia_validacao}</p>}</div><button onClick={() => alternar(c)} className={`text-xs px-2.5 py-1.5 rounded-lg border ${c.ativo === false ? 'border-emerald-200 text-emerald-700' : 'border-red-200 text-red-600'}`}>{c.ativo === false ? <span className="flex gap-1 items-center"><CheckCircle2 size={12}/> Ativar</span> : <span className="flex gap-1 items-center"><XCircle size={12}/> Desativar</span>}</button></div>
              </article>
            })}
          </div>
        </section>
      </main>
    </div>
  )
}
