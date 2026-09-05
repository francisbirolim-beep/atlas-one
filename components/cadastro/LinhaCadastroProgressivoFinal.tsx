'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, CircleAlert, ExternalLink, Layers3, Plus, RefreshCw, Save, Search, ShieldCheck } from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import { listarProdutos } from '@/lib/produtos'
import {
  listarLinhasTecnicas,
  salvarEtapaLinhaTecnica,
  salvarLinhaTecnica,
  validarLinhaTecnica,
  type EtapaCadastroLinhaTecnica,
  type LinhaTecnica,
} from '@/lib/linhasTecnicas'
import { criarTipologia, listarTipologias, type TipologiaTecnica } from '@/lib/tipologias'
import { listarTodasFormulasCorte, type RegistroFormulaCorte } from '@/lib/engenhariaFormulasCorte'
import type { Produto } from '@/lib/tipos'

const ETAPAS: Array<{ chave: EtapaCadastroLinhaTecnica; label: string }> = [
  { chave: 'dados_linha', label: 'Dados da Linha' },
  { chave: 'perfis', label: 'Perfis' },
  { chave: 'acessorios', label: 'Acessórios' },
  { chave: 'tipologias', label: 'Tipologias' },
  { chave: 'formulacoes', label: 'Formulações' },
  { chave: 'revisao', label: 'Revisão' },
]

function indiceEtapa(etapa: EtapaCadastroLinhaTecnica) {
  return Math.max(0, ETAPAS.findIndex(e => e.chave === etapa))
}

export default function LinhaCadastroProgressivoFinal() {
  const [carregando, setCarregando] = useState(true)
  const [autorizado, setAutorizado] = useState<boolean | null>(null)
  const [usuario, setUsuario] = useState<any>(null)
  const [linhas, setLinhas] = useState<LinhaTecnica[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [tipologias, setTipologias] = useState<TipologiaTecnica[]>([])
  const [formulas, setFormulas] = useState<RegistroFormulaCorte[]>([])
  const [linhaId, setLinhaId] = useState<string | null>(null)
  const [etapa, setEtapa] = useState<EtapaCadastroLinhaTecnica>('dados_linha')
  const [nome, setNome] = useState('')
  const [fabricante, setFabricante] = useState('')
  const [descricao, setDescricao] = useState('')
  const [produtoIds, setProdutoIds] = useState<string[]>([])
  const [tipologiaIds, setTipologiaIds] = useState<string[]>([])
  const [busca, setBusca] = useState('')
  const [novaTipologia, setNovaTipologia] = useState('')
  const [novaCategoria, setNovaCategoria] = useState('janela')
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setCarregando(true)
    const me = await usuarioAtual()
    setUsuario(me)
    const master = me?.role === 'master'
    setAutorizado(master)
    if (master) {
      const [ls, ps, ts, fs] = await Promise.all([
        listarLinhasTecnicas(), listarProdutos(), listarTipologias(true), listarTodasFormulasCorte(),
      ])
      setLinhas(ls); setProdutos(ps); setTipologias(ts); setFormulas(fs)
      const id = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('linha') : null
      if (id) {
        const atual = ls.find(l => l.id === id)
        if (atual) preencherLinha(atual)
      }
    }
    setCarregando(false)
  }

  async function atualizarTecnico() {
    const [ls, ts, fs] = await Promise.all([listarLinhasTecnicas(), listarTipologias(true), listarTodasFormulasCorte()])
    setLinhas(ls); setTipologias(ts); setFormulas(fs)
    if (linhaId) {
      const atual = ls.find(l => l.id === linhaId)
      if (atual) {
        setTipologiaIds(atual.tipologia_ids || [])
      }
    }
    setMensagem('Status técnico atualizado.')
  }

  function preencherLinha(linha: LinhaTecnica) {
    setLinhaId(linha.id)
    setNome(linha.nome || '')
    setFabricante(linha.fabricante || '')
    setDescricao(linha.descricao || '')
    setProdutoIds(linha.produto_ids || [])
    setTipologiaIds(linha.tipologia_ids || [])
    setEtapa(linha.etapa_cadastro || 'dados_linha')
  }

  const perfis = useMemo(() => produtos.filter(p => p.categoria === 'perfil'), [produtos])
  const acessorios = useMemo(() => produtos.filter(p => p.categoria === 'acessorio'), [produtos])
  const itensEtapa = etapa === 'perfis' ? perfis : etapa === 'acessorios' ? acessorios : []
  const itensFiltrados = useMemo(() => {
    const q = busca.trim().toLocaleLowerCase('pt-BR')
    if (!q) return itensEtapa
    return itensEtapa.filter((p: any) => `${p.codigo || ''} ${p.codigo_origem || ''} ${p.nome || ''} ${p.descricao || ''}`.toLocaleLowerCase('pt-BR').includes(q))
  }, [itensEtapa, busca])

  const tipologiasFiltradas = useMemo(() => {
    const q = busca.trim().toLocaleLowerCase('pt-BR')
    const lista = tipologias.filter(t => t.ativo !== false)
    if (!q) return lista
    return lista.filter(t => `${t.label} ${t.chave} ${t.categoria}`.toLocaleLowerCase('pt-BR').includes(q))
  }, [tipologias, busca])

  const qtdPerfis = produtoIds.filter(id => perfis.some(p => p.id === id)).length
  const qtdAcessorios = produtoIds.filter(id => acessorios.some(p => p.id === id)).length
  const formulasSelecionadas = formulas.filter(f => tipologiaIds.includes(f.tipologia_id))
  const statusPorTipologia = useMemo(() => {
    const mapa = new Map<string, { total: number; validas: number; ativas: number }>()
    for (const id of tipologiaIds) mapa.set(id, { total: 0, validas: 0, ativas: 0 })
    for (const f of formulasSelecionadas) {
      const atual = mapa.get(f.tipologia_id) || { total: 0, validas: 0, ativas: 0 }
      atual.total += 1
      if (f.status === 'validada') atual.validas += 1
      if (f.status === 'validada' && f.ativo) atual.ativas += 1
      mapa.set(f.tipologia_id, atual)
    }
    return mapa
  }, [formulasSelecionadas, tipologiaIds])

  const tipologiasSemFormulaValidada = tipologiaIds.filter(id => (statusPorTipologia.get(id)?.validas || 0) === 0)
  const podeLiberar = Boolean(linhaId && nome.trim() && qtdPerfis > 0 && tipologiaIds.length > 0 && tipologiasSemFormulaValidada.length === 0)
  const linhaAtual = linhaId ? linhas.find(l => l.id === linhaId) : null
  const jaValidada = linhaAtual?.status_validacao === 'validada' && linhaAtual?.ativo === true

  async function salvarDados(etapaDestino?: EtapaCadastroLinhaTecnica) {
    if (!nome.trim()) { setErro('Informe o nome da linha.'); return null }
    setSalvando(true); setErro(''); setMensagem('')
    try {
      const id = await salvarLinhaTecnica({
        id: linhaId || undefined,
        nome,
        fabricante,
        descricao,
        ativo: false,
        status_validacao: 'em_validacao',
        etapa_cadastro: etapaDestino || etapa,
        produto_ids: produtoIds,
        tipologia_ids: tipologiaIds,
      })
      setLinhaId(id)
      if (etapaDestino) {
        await salvarEtapaLinhaTecnica(id, etapaDestino)
        setEtapa(etapaDestino)
      }
      const novas = await listarLinhasTecnicas(); setLinhas(novas)
      setMensagem('Cadastro salvo. Você pode sair e continuar depois sem perder o progresso.')
      if (typeof window !== 'undefined') window.history.replaceState(null, '', `/cadastro/linhas/novo?linha=${id}`)
      return id
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível salvar a linha.')
      return null
    } finally { setSalvando(false) }
  }

  async function irPara(chave: EtapaCadastroLinhaTecnica) {
    const id = await salvarDados(chave)
    if (id) setBusca('')
  }

  function alternarProduto(id: string) {
    setProdutoIds(atual => atual.includes(id) ? atual.filter(x => x !== id) : [...atual, id])
  }

  function alternarTipologia(id: string) {
    setTipologiaIds(atual => atual.includes(id) ? atual.filter(x => x !== id) : [...atual, id])
  }

  async function cadastrarTipologia() {
    if (!novaTipologia.trim()) return
    setSalvando(true); setErro(''); setMensagem('')
    try {
      const criada = await criarTipologia(novaTipologia.trim(), novaCategoria)
      if (!criada) throw new Error('Não foi possível criar a tipologia.')
      setTipologias(atual => [...atual, criada])
      setTipologiaIds(atual => [...new Set([...atual, criada.id])])
      setNovaTipologia('')
      setMensagem('Tipologia criada e adicionada à linha. Agora configure a receita técnica na etapa Formulações.')
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível criar a tipologia.')
    } finally { setSalvando(false) }
  }

  async function liberarLinha() {
    if (!linhaId || !podeLiberar) return
    setSalvando(true); setErro(''); setMensagem('')
    try {
      await salvarLinhaTecnica({
        id: linhaId, nome, fabricante, descricao, ativo: false,
        status_validacao: 'em_validacao', etapa_cadastro: 'revisao', produto_ids: produtoIds, tipologia_ids: tipologiaIds,
      })
      const resposta = await validarLinhaTecnica(linhaId, { id: usuario?.id, nome: usuario?.nome })
      if (resposta.error) throw resposta.error
      const novas = await listarLinhasTecnicas(); setLinhas(novas)
      setMensagem('Linha validada e liberada para uso. A liberação ficou registrada no aprendizado técnico do Atlas.')
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível liberar a linha.')
    } finally { setSalvando(false) }
  }

  async function proxima() {
    const idx = indiceEtapa(etapa)
    if (idx < ETAPAS.length - 1) await irPara(ETAPAS[idx + 1].chave)
  }
  async function anterior() {
    const idx = indiceEtapa(etapa)
    if (idx > 0) await irPara(ETAPAS[idx - 1].chave)
  }

  if (carregando) return <div className="min-h-screen flex items-center justify-center text-slate-400">Carregando...</div>
  if (!autorizado) return <div className="min-h-screen flex items-center justify-center text-slate-500">Apenas o usuário master pode acessar este cadastro.</div>

  const status = jaValidada ? 'VALIDADA' : linhaId ? 'EM VALIDAÇÃO' : 'NOVA'

  return <main className="min-h-screen bg-slate-50">
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4">
        <Link href="/cadastro/linhas" className="rounded-lg p-2 hover:bg-slate-100"><ArrowLeft size={19}/></Link>
        <Layers3 size={22}/>
        <div className="min-w-0 flex-1"><h1 className="truncate text-lg font-bold text-slate-900">{nome || 'Nova linha técnica'}</h1><p className="text-xs text-slate-500">Cadastro progressivo com validação técnica antes da venda</p></div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${jaValidada ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{status}</span>
        <button disabled={salvando} onClick={() => salvarDados()} className="inline-flex items-center gap-2 rounded-xl bg-brand-navy px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Save size={15}/>{salvando ? 'Salvando...' : 'Salvar'}</button>
      </div>
    </header>

    <div className="border-b bg-white">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-2 px-4 py-3 sm:grid-cols-3 lg:grid-cols-6">
        {ETAPAS.map((e, i) => {
          const atual = e.chave === etapa; const concluida = i < indiceEtapa(etapa)
          return <button key={e.chave} onClick={() => irPara(e.chave)} className={`rounded-xl border px-3 py-2 text-left ${atual ? 'border-blue-500 bg-blue-50' : concluida ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
            <div className="flex items-center gap-2"><span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${atual ? 'bg-blue-600 text-white' : concluida ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{concluida ? '✓' : i + 1}</span><span className="text-xs font-semibold text-slate-700">{e.label}</span></div>
          </button>
        })}
      </div>
    </div>

    <div className="mx-auto grid max-w-7xl gap-4 px-4 py-6 lg:grid-cols-[240px_1fr_280px]">
      <aside className="space-y-3 rounded-2xl border bg-white p-4">
        <h2 className="font-bold text-slate-900">Resumo da linha</h2>
        <div className="space-y-2 text-sm text-slate-600">
          <div className="flex justify-between"><span>Perfis</span><strong>{qtdPerfis}</strong></div>
          <div className="flex justify-between"><span>Acessórios</span><strong>{qtdAcessorios}</strong></div>
          <div className="flex justify-between"><span>Tipologias</span><strong>{tipologiaIds.length}</strong></div>
          <div className="flex justify-between"><span>Receitas validadas</span><strong>{tipologiaIds.length - tipologiasSemFormulaValidada.length}/{tipologiaIds.length}</strong></div>
        </div>
        {!jaValidada && <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800"><strong>Proteção:</strong> a linha permanece inativa no orçamento até a revisão final.</div>}
        {jaValidada && <div className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800"><strong>Liberada:</strong> esta linha está validada para uso.</div>}
      </aside>

      <section className="rounded-2xl border bg-white p-5">
        {erro && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
        {mensagem && <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{mensagem}</div>}

        {etapa === 'dados_linha' && <div className="space-y-4">
          <div><h2 className="text-lg font-bold">Dados da Linha</h2><p className="text-sm text-slate-500">Cadastre a identidade técnica da linha.</p></div>
          <label className="block text-sm font-medium">Nome da linha *<input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Suprema" className="mt-1 w-full rounded-xl border px-3 py-2.5"/></label>
          <label className="block text-sm font-medium">Fabricante<input value={fabricante} onChange={e => setFabricante(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5"/></label>
          <label className="block text-sm font-medium">Descrição<textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={4} className="mt-1 w-full rounded-xl border px-3 py-2.5"/></label>
        </div>}

        {(etapa === 'perfis' || etapa === 'acessorios') && <div>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-lg font-bold">{etapa === 'perfis' ? 'Perfis da Linha' : 'Acessórios da Linha'}</h2><p className="text-sm text-slate-500">Marque os itens que pertencem à linha. Um produto pode participar de mais de uma linha.</p></div><Link href={`/cadastro/produtos?categoria=${etapa === 'perfis' ? 'perfil' : 'acessorio'}`} className="inline-flex items-center gap-2 rounded-xl border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700"><Plus size={14}/>Cadastrar novo {etapa === 'perfis' ? 'perfil' : 'acessório'}</Link></div>
          <div className="relative mb-4"><Search className="absolute left-3 top-3 text-slate-400" size={16}/><input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Pesquisar por código ou nome..." className="w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm"/></div>
          <div className="max-h-[520px] space-y-2 overflow-y-auto">{itensFiltrados.map((p: any) => <label key={p.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${produtoIds.includes(p.id) ? 'border-blue-300 bg-blue-50' : 'border-slate-200'}`}><input type="checkbox" checked={produtoIds.includes(p.id)} onChange={() => alternarProduto(p.id)}/><div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border bg-slate-50">{p.foto_url ? <img src={p.foto_url} alt={p.nome} className="h-full w-full object-contain p-1"/> : <div className="flex h-full items-center justify-center text-[9px] text-slate-400">Sem desenho</div>}</div><div className="min-w-0 flex-1"><div className="text-xs font-bold text-slate-900">{p.codigo || p.codigo_origem || 'Sem código'}</div><div className="truncate text-sm text-slate-700">{p.nome}</div>{p.peso_kg_m != null && <div className="text-[11px] text-slate-500">Peso: {p.peso_kg_m} kg/m</div>}</div>{produtoIds.includes(p.id) && <CheckCircle2 size={18} className="text-blue-600"/>}</label>)}</div>
        </div>}

        {etapa === 'tipologias' && <div className="space-y-5">
          <div><h2 className="text-lg font-bold">Tipologias da Linha</h2><p className="text-sm text-slate-500">Selecione modelos já cadastrados ou crie um novo. Depois cada tipologia recebe sua receita técnica.</p></div>
          <div className="grid gap-2 sm:grid-cols-[1fr_180px_auto]"><input value={novaTipologia} onChange={e => setNovaTipologia(e.target.value)} placeholder="Ex.: Janela de correr 2 folhas" className="rounded-xl border px-3 py-2.5 text-sm"/><select value={novaCategoria} onChange={e => setNovaCategoria(e.target.value)} className="rounded-xl border px-3 py-2.5 text-sm"><option value="janela">Janela</option><option value="porta">Porta</option><option value="fachada">Fachada</option><option value="box">Box</option><option value="guarda_corpo">Guarda-corpo</option><option value="outro">Outro</option></select><button onClick={cadastrarTipologia} disabled={!novaTipologia.trim() || salvando} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"><Plus size={16}/>Criar</button></div>
          <div className="relative"><Search className="absolute left-3 top-3 text-slate-400" size={16}/><input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Pesquisar tipologia..." className="w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm"/></div>
          <div className="max-h-[480px] space-y-2 overflow-y-auto">{tipologiasFiltradas.map(t => <label key={t.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${tipologiaIds.includes(t.id) ? 'border-blue-300 bg-blue-50' : 'border-slate-200'}`}><input type="checkbox" checked={tipologiaIds.includes(t.id)} onChange={() => alternarTipologia(t.id)}/><div className="min-w-0 flex-1"><div className="font-semibold text-slate-900">{t.label}</div><div className="text-xs text-slate-500">{t.categoria} · {t.chave}</div></div>{tipologiaIds.includes(t.id) && <CheckCircle2 size={18} className="text-blue-600"/>}</label>)}</div>
        </div>}

        {etapa === 'formulacoes' && <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold">Formulações e componentes</h2><p className="text-sm text-slate-500">O Atlas já possui editor técnico completo. Configure perfis, fórmulas, quantidades, acessórios e vidro e valide cada receita.</p></div><button onClick={atualizarTecnico} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold"><RefreshCw size={15}/>Atualizar status</button></div>
          {tipologiaIds.length === 0 ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Selecione pelo menos uma tipologia na etapa anterior.</div> : <div className="space-y-3">{tipologiaIds.map(id => {
            const t = tipologias.find(x => x.id === id); const st = statusPorTipologia.get(id) || { total: 0, validas: 0, ativas: 0 }
            const ok = st.validas > 0
            return <div key={id} className="rounded-2xl border p-4"><div className="flex flex-wrap items-center gap-3"><div className="min-w-0 flex-1"><div className="font-bold text-slate-900">{t?.label || id}</div><div className="mt-1 text-xs text-slate-500">{st.total} configuração(ões) · {st.validas} validada(s) · {st.ativas} ativa(s)</div></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${ok ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{ok ? 'RECEITA VALIDADA' : 'FALTA VALIDAR'}</span><Link href="/engenharia/editor-tecnico" className="inline-flex items-center gap-2 rounded-xl bg-brand-navy px-3 py-2 text-xs font-bold text-white">Abrir editor técnico<ExternalLink size={14}/></Link></div></div>
          })}</div>}
        </div>}

        {etapa === 'revisao' && <div className="space-y-5">
          <div><h2 className="text-lg font-bold">Revisão e liberação</h2><p className="text-sm text-slate-500">A linha só entra no orçamento quando os requisitos técnicos mínimos estiverem validados.</p></div>
          <div className="space-y-2">
            <Checklist ok={Boolean(nome.trim())} texto="Dados da linha preenchidos"/>
            <Checklist ok={qtdPerfis > 0} texto={`Perfis associados (${qtdPerfis})`}/>
            <Checklist ok={tipologiaIds.length > 0} texto={`Tipologias associadas (${tipologiaIds.length})`}/>
            <Checklist ok={tipologiasSemFormulaValidada.length === 0 && tipologiaIds.length > 0} texto="Todas as tipologias têm pelo menos uma receita validada"/>
          </div>
          {tipologiasSemFormulaValidada.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><div className="flex gap-2"><CircleAlert size={18}/><div><strong>Falta validar formulação:</strong><div className="mt-1">{tipologiasSemFormulaValidada.map(id => tipologias.find(t => t.id === id)?.label || id).join(', ')}</div></div></div></div>}
          {jaValidada ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><strong>Linha já validada e ativa.</strong> Alterações técnicas posteriores devem ser revisadas antes de nova liberação.</div> : <button disabled={!podeLiberar || salvando} onClick={liberarLinha} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"><ShieldCheck size={18}/>{salvando ? 'Validando...' : 'Validar e liberar linha'}</button>}
        </div>}

        <div className="mt-6 flex items-center justify-between border-t pt-4"><button disabled={indiceEtapa(etapa) === 0 || salvando} onClick={anterior} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold disabled:opacity-40"><ChevronLeft size={16}/>Anterior</button><button disabled={indiceEtapa(etapa) === ETAPAS.length - 1 || salvando} onClick={proxima} className="inline-flex items-center gap-2 rounded-xl bg-brand-navy px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">Salvar e continuar<ChevronRight size={16}/></button></div>
      </section>

      <aside className="space-y-3 rounded-2xl border bg-white p-4">
        <h2 className="font-bold text-slate-900">Regra de segurança</h2>
        <p className="text-sm text-slate-600">Referência importada ou receita em desenvolvimento não vira regra oficial automaticamente.</p>
        <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600"><strong>Fluxo:</strong><br/>1. cadastrar<br/>2. associar componentes<br/>3. criar tipologia<br/>4. montar fórmula<br/>5. testar/validar<br/>6. liberar para venda</div>
        <Link href="/engenharia/editor-tecnico" className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">Editor técnico<ExternalLink size={14}/></Link>
      </aside>
    </div>
  </main>
}

function Checklist({ ok, texto }: { ok: boolean; texto: string }) {
  return <div className={`flex items-center gap-3 rounded-xl border p-3 text-sm ${ok ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>{ok ? <CheckCircle2 size={18} className="text-emerald-600"/> : <CircleAlert size={18} className="text-slate-400"/>}<span>{texto}</span></div>
}
