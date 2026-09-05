'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, Layers3, Plus, Save, Search } from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import { listarProdutos } from '@/lib/produtos'
import { listarLinhasTecnicas, salvarEtapaLinhaTecnica, salvarLinhaTecnica, type EtapaCadastroLinhaTecnica, type LinhaTecnica } from '@/lib/linhasTecnicas'
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

export default function NovaLinhaProgressivaPage() {
  const [carregando, setCarregando] = useState(true)
  const [autorizado, setAutorizado] = useState<boolean | null>(null)
  const [linhas, setLinhas] = useState<LinhaTecnica[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [linhaId, setLinhaId] = useState<string | null>(null)
  const [etapa, setEtapa] = useState<EtapaCadastroLinhaTecnica>('dados_linha')
  const [nome, setNome] = useState('')
  const [fabricante, setFabricante] = useState('')
  const [descricao, setDescricao] = useState('')
  const [produtoIds, setProdutoIds] = useState<string[]>([])
  const [busca, setBusca] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setCarregando(true)
    const me = await usuarioAtual()
    const master = me?.role === 'master'
    setAutorizado(master)
    if (master) {
      const [ls, ps] = await Promise.all([listarLinhasTecnicas(), listarProdutos()])
      setLinhas(ls)
      setProdutos(ps)
      const id = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('linha') : null
      if (id) {
        const atual = ls.find(l => l.id === id)
        if (atual) preencherLinha(atual)
      }
    }
    setCarregando(false)
  }

  function preencherLinha(linha: LinhaTecnica) {
    setLinhaId(linha.id)
    setNome(linha.nome || '')
    setFabricante(linha.fabricante || '')
    setDescricao(linha.descricao || '')
    setProdutoIds(linha.produto_ids || [])
    setEtapa(linha.etapa_cadastro || 'dados_linha')
  }

  const perfis = useMemo(() => produtos.filter(p => p.categoria === 'perfil'), [produtos])
  const acessorios = useMemo(() => produtos.filter(p => p.categoria === 'acessorio'), [produtos])
  const itensEtapa = etapa === 'perfis' ? perfis : etapa === 'acessorios' ? acessorios : []
  const itensFiltrados = useMemo(() => {
    const q = busca.trim().toLocaleLowerCase('pt-BR')
    if (!q) return itensEtapa
    return itensEtapa.filter(p => `${p.codigo || ''} ${p.codigo_origem || ''} ${p.nome} ${p.descricao || ''}`.toLocaleLowerCase('pt-BR').includes(q))
  }, [itensEtapa, busca])

  const qtdPerfis = produtoIds.filter(id => perfis.some(p => p.id === id)).length
  const qtdAcessorios = produtoIds.filter(id => acessorios.some(p => p.id === id)).length

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
        tipologia_ids: linhaId ? (linhas.find(l => l.id === linhaId)?.tipologia_ids || []) : [],
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
    await salvarDados(chave)
    setBusca('')
  }

  function alternarProduto(id: string) {
    setProdutoIds(atual => atual.includes(id) ? atual.filter(x => x !== id) : [...atual, id])
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

  const status = linhaId ? 'PENDENTE' : 'NOVO'
  return <main className="min-h-screen bg-slate-50">
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4">
        <Link href="/cadastro/linhas" className="rounded-lg p-2 hover:bg-slate-100"><ArrowLeft size={19}/></Link>
        <Layers3 size={22}/>
        <div className="min-w-0 flex-1"><h1 className="truncate text-lg font-bold text-slate-900">{nome || 'Nova linha técnica'}</h1><p className="text-xs text-slate-500">Cadastro progressivo · salva automaticamente por etapa</p></div>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">{status}</span>
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

    <div className="mx-auto grid max-w-7xl gap-4 px-4 py-6 lg:grid-cols-[240px_1fr_260px]">
      <aside className="space-y-3 rounded-2xl border bg-white p-4">
        <h2 className="font-bold text-slate-900">Resumo da linha</h2>
        <div className="space-y-2 text-sm text-slate-600"><div className="flex justify-between"><span>Perfis</span><strong>{qtdPerfis}</strong></div><div className="flex justify-between"><span>Acessórios</span><strong>{qtdAcessorios}</strong></div><div className="flex justify-between"><span>Tipologias</span><strong>{linhaId ? (linhas.find(l => l.id === linhaId)?.tipologia_ids?.length || 0) : 0}</strong></div></div>
        <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800"><strong>Pendente:</strong> enquanto não passar pela revisão final, esta linha fica fora da venda.</div>
      </aside>

      <section className="rounded-2xl border bg-white p-5">
        {erro && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
        {mensagem && <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{mensagem}</div>}

        {etapa === 'dados_linha' && <div className="space-y-4"><div><h2 className="text-lg font-bold">Dados da Linha</h2><p className="text-sm text-slate-500">Comece com o básico. O restante pode ser completado depois.</p></div><label className="block text-sm font-medium">Nome da linha *<input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Linha Econômica" className="mt-1 w-full rounded-xl border px-3 py-2.5"/></label><label className="block text-sm font-medium">Fabricante<input value={fabricante} onChange={e => setFabricante(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5"/></label><label className="block text-sm font-medium">Descrição<textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={4} className="mt-1 w-full rounded-xl border px-3 py-2.5"/></label></div>}

        {(etapa === 'perfis' || etapa === 'acessorios') && <div><div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-lg font-bold">{etapa === 'perfis' ? 'Perfis da Linha' : 'Acessórios da Linha'}</h2><p className="text-sm text-slate-500">Pesquise no banco Atlas e marque o que faz parte desta linha.</p></div><Link href={`/cadastro/produtos?categoria=${etapa === 'perfis' ? 'perfil' : 'acessorio'}`} className="inline-flex items-center gap-2 rounded-xl border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700"><Plus size={14}/>Cadastrar novo {etapa === 'perfis' ? 'perfil' : 'acessório'}</Link></div><div className="relative mb-4"><Search className="absolute left-3 top-3 text-slate-400" size={16}/><input value={busca} onChange={e => setBusca(e.target.value)} placeholder={`Pesquisar ${etapa === 'perfis' ? 'perfil' : 'acessório'} por código ou nome...`} className="w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm"/></div><div className="max-h-[520px] space-y-2 overflow-y-auto">{itensFiltrados.map(p => <label key={p.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${produtoIds.includes(p.id) ? 'border-blue-300 bg-blue-50' : 'border-slate-200'}`}><input type="checkbox" checked={produtoIds.includes(p.id)} onChange={() => alternarProduto(p.id)}/><div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border bg-slate-50">{p.foto_url ? <img src={p.foto_url} alt={p.nome} className="h-full w-full object-contain p-1"/> : <div className="flex h-full items-center justify-center text-[9px] text-slate-400">Sem desenho</div>}</div><div className="min-w-0 flex-1"><div className="text-xs font-bold text-slate-900">{p.codigo || p.codigo_origem || 'Sem código'}</div><div className="truncate text-sm text-slate-700">{p.nome}</div>{p.peso_kg_m != null && <div className="text-[11px] text-slate-500">Peso: {p.peso_kg_m} kg/m</div>}</div>{produtoIds.includes(p.id) && <CheckCircle2 size={18} className="text-blue-600"/>}</label>)}</div></div>}

        {etapa === 'tipologias' && <div className="space-y-4"><h2 className="text-lg font-bold">Tipologias</h2><p className="text-sm text-slate-500">Nesta etapa vamos criar cada modelo (ex.: Janela de correr 2 folhas) e selecionar todos os perfis e acessórios usados nela.</p><div className="rounded-2xl border border-dashed p-8 text-center text-sm text-slate-500">Próxima implementação do fluxo: construtor de tipologia por componentes.</div></div>}
        {etapa === 'formulacoes' && <div className="space-y-4"><h2 className="text-lg font-bold">Formulações</h2><p className="text-sm text-slate-500">Depois da tipologia, entram as regras de quantidade, cortes, folgas, acessórios e cálculo por medida.</p><div className="rounded-2xl border border-dashed p-8 text-center text-sm text-slate-500">A formulação será criada por tipologia e testada antes da liberação para venda.</div></div>}
        {etapa === 'revisao' && <div className="space-y-4"><h2 className="text-lg font-bold">Revisão e testes</h2><p className="text-sm text-slate-500">A linha só será liberada para venda depois que perfis, acessórios, tipologias e formulações estiverem conferidos.</p><div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Enquanto houver etapas técnicas incompletas, o status permanece <strong>PENDENTE</strong> e a linha continua inativa no orçamento.</div></div>}

        <div className="mt-6 flex items-center justify-between border-t pt-4"><button disabled={indiceEtapa(etapa) === 0 || salvando} onClick={anterior} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm disabled:opacity-40"><ChevronLeft size={16}/>Anterior</button><button disabled={indiceEtapa(etapa) === ETAPAS.length - 1 || salvando} onClick={proxima} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Salvar e continuar<ChevronRight size={16}/></button></div>
      </section>

      <aside className="space-y-3 rounded-2xl border bg-white p-4"><h2 className="font-bold text-slate-900">Como funciona</h2><div className="space-y-3 text-xs text-slate-600"><p>1. Você pode parar em qualquer etapa.</p><p>2. Tudo que foi selecionado fica salvo.</p><p>3. Ao voltar, abre na última etapa salva.</p><p>4. A linha fica fora das vendas enquanto estiver pendente.</p><p>5. No final, fazemos os testes e só então liberamos para venda.</p></div></aside>
    </div>
  </main>
}
