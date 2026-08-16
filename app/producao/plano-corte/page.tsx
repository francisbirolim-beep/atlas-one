'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, FileSpreadsheet, Loader2, LockKeyhole, Save, Search, Settings2, SlidersHorizontal } from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import type { NivelPermissao, Produto, Usuario } from '@/lib/tipos'
import {
  buscarReceitaAtivaProduto,
  listarComponentesReceita,
  listarProdutosTecnicos,
  listarTipologiasComReceita,
  type ComponenteReceita,
  type ReceitaTecnica,
  type TipologiaComReceita,
} from '@/lib/engenhariaReceitas'
import { listarPermissoesUsuario, listarSetores, nivelEfetivo } from '@/lib/setores'
import {
  atualizarComponentePlano,
  atualizarPlanoCorte,
  carregarComponentesPlano,
  criarPlanoCorte,
  listarPlanosCorte,
  listarProdutosEsquadria,
  type ComponentePlanoCorte,
  type PlanoCorte,
  type VariaveisPlanoCorte,
} from '@/lib/planoCorte'

const VARIAVEIS = [
  ['linha', 'Linha'],
  ['folhas', 'Folhas'],
  ['montagem', 'Montagem'],
  ['trilho', 'Trilho'],
  ['contramarco', 'Contramarco'],
  ['arremate', 'Arremate'],
  ['fechadura', 'Fechadura'],
  ['puxador', 'Puxador'],
  ['mao_amiga', 'Mão amiga'],
  ['travessas', 'Travessas'],
  ['roldana', 'Roldana'],
] as const

type OrigemReceita = 'produto' | 'tipologia' | null

function numero(valor: string, fallback = 0) {
  const n = Number((valor || '').replace(',', '.'))
  return Number.isFinite(n) ? n : fallback
}

function nomeNormalizado(valor: string) {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

export default function PlanoCortePage() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [nivel, setNivel] = useState<NivelPermissao>('oculto')
  const [carregando, setCarregando] = useState(true)
  const [carregandoReceita, setCarregandoReceita] = useState(false)
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [produtosTecnicos, setProdutosTecnicos] = useState<Produto[]>([])
  const [tipologias, setTipologias] = useState<TipologiaComReceita[]>([])
  const [planos, setPlanos] = useState<PlanoCorte[]>([])
  const [busca, setBusca] = useState('')
  const [produtoId, setProdutoId] = useState('')
  const [tipologiaId, setTipologiaId] = useState('')
  const [receitaSelecionada, setReceitaSelecionada] = useState<ReceitaTecnica | null>(null)
  const [origemReceita, setOrigemReceita] = useState<OrigemReceita>(null)
  const [componentesReceita, setComponentesReceita] = useState<ComponenteReceita[]>([])
  const [largura, setLargura] = useState('')
  const [altura, setAltura] = useState('')
  const [quantidade, setQuantidade] = useState('1')
  const [folgaLargura, setFolgaLargura] = useState('4')
  const [folgaAltura, setFolgaAltura] = useState('4')
  const [variaveis, setVariaveis] = useState<VariaveisPlanoCorte>({})
  const [observacoes, setObservacoes] = useState('')
  const [planoAtual, setPlanoAtual] = useState<PlanoCorte | null>(null)
  const [componentesPlano, setComponentesPlano] = useState<ComponentePlanoCorte[]>([])
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState('')

  useEffect(() => {
    async function carregar() {
      const u = await usuarioAtual()
      setUsuario(u)

      let permissao: NivelPermissao = u?.role === 'master' ? 'edicao' : 'oculto'
      if (u && u.role !== 'master') {
        const [setores, permissoes] = await Promise.all([listarSetores(), listarPermissoesUsuario(u.id)])
        const setorProducao = setores.find(s => s.rota === '/producao' || nomeNormalizado(s.nome) === 'producao')
        if (setorProducao) permissao = nivelEfetivo(u, setorProducao.id, permissoes)
      }
      setNivel(permissao)

      if (permissao !== 'oculto') {
        const [p, pt, t, pl] = await Promise.all([
          listarProdutosEsquadria(),
          listarProdutosTecnicos(),
          listarTipologiasComReceita(),
          listarPlanosCorte(),
        ])
        setProdutos(p)
        setProdutosTecnicos(pt)
        setTipologias(t)
        setPlanos(pl)
      }
      setCarregando(false)
    }
    void carregar()
  }, [])

  const podeEditar = nivel === 'edicao'
  const produtosFiltrados = useMemo(() => {
    const termo = nomeNormalizado(busca)
    if (!termo) return produtos
    return produtos.filter(p => nomeNormalizado(`${p.nome} ${p.descricao || ''}`).includes(termo))
  }, [produtos, busca])
  const produto = produtos.find(p => p.id === produtoId) || null
  const tipologia = tipologias.find(t => t.id === tipologiaId) || null
  const tipologiasComFallback = tipologias.filter(t => Boolean(t.receita))

  async function carregarComponentesDaReceita(receita: ReceitaTecnica | null) {
    setReceitaSelecionada(receita)
    setComponentesReceita(receita ? await listarComponentesReceita(receita.id) : [])
  }

  async function selecionarProduto(p: Produto) {
    setProdutoId(p.id)
    setPlanoAtual(null)
    setComponentesPlano([])
    setLargura(p.largura_mm ? String(p.largura_mm) : '')
    setAltura(p.altura_mm ? String(p.altura_mm) : '')
    setTipologiaId('')
    setOrigemReceita(null)
    setComponentesReceita([])
    setReceitaSelecionada(null)
    setMensagem('')
    setCarregandoReceita(true)

    const receitaProduto = await buscarReceitaAtivaProduto(p.id)
    if (receitaProduto) {
      setTipologiaId(receitaProduto.tipologia_id)
      setOrigemReceita('produto')
      await carregarComponentesDaReceita(receitaProduto)
      setMensagem('Receita específica deste produto carregada automaticamente.')
    } else {
      setMensagem('Este produto ainda não tem receita específica. Selecione abaixo uma receita genérica da tipologia ou cadastre a receita do produto.')
    }
    setCarregandoReceita(false)
  }

  async function selecionarTipologiaGenerica(id: string) {
    setTipologiaId(id)
    const t = tipologias.find(item => item.id === id) || null
    setOrigemReceita(t?.receita ? 'tipologia' : null)
    await carregarComponentesDaReceita(t?.receita || null)
  }

  function alterarVariavel(chave: string, valor: string) {
    setVariaveis(prev => ({ ...prev, [chave]: valor }))
  }

  async function gerarPlano() {
    if (!podeEditar || !produto || !tipologia || !receitaSelecionada) return
    setSalvando(true)
    setMensagem('')
    const plano = await criarPlanoCorte({
      produto,
      tipologia,
      receita: receitaSelecionada,
      componentesReceita,
      largura_mm: largura ? numero(largura) : null,
      altura_mm: altura ? numero(altura) : null,
      quantidade: Math.max(1, numero(quantidade, 1)),
      folga_largura_mm: numero(folgaLargura, 4),
      folga_altura_mm: numero(folgaAltura, 4),
      variaveis,
      observacoes: observacoes || null,
      usuario,
    })
    setSalvando(false)
    if (!plano) {
      setMensagem('Não foi possível gerar o plano de corte. Confirme se as migrations do Plano de Corte já foram aplicadas no banco.')
      return
    }
    setPlanoAtual(plano)
    setComponentesPlano(await carregarComponentesPlano(plano.id))
    setPlanos(prev => [plano, ...prev])
    setMensagem('Plano criado. Fórmulas validadas foram calculadas; demais cortes continuam editáveis para conferência.')
  }

  async function abrirPlano(plano: PlanoCorte) {
    setPlanoAtual(plano)
    setComponentesPlano(await carregarComponentesPlano(plano.id))
    setProdutoId(plano.produto_id || '')
    setTipologiaId(plano.tipologia_id || '')
    setLargura(plano.largura_mm ? String(plano.largura_mm) : '')
    setAltura(plano.altura_mm ? String(plano.altura_mm) : '')
    setQuantidade(String(plano.quantidade))
    setFolgaLargura(String(plano.folga_largura_mm))
    setFolgaAltura(String(plano.folga_altura_mm))
    setVariaveis(plano.variaveis || {})
    setObservacoes(plano.observacoes || '')
  }

  async function salvarCabecalhoPlano() {
    if (!podeEditar || !planoAtual) return
    setSalvando(true)
    const ok = await atualizarPlanoCorte(planoAtual.id, {
      largura_mm: largura ? numero(largura) : null,
      altura_mm: altura ? numero(altura) : null,
      quantidade: Math.max(1, numero(quantidade, 1)),
      folga_largura_mm: numero(folgaLargura, 4),
      folga_altura_mm: numero(folgaAltura, 4),
      variaveis,
      observacoes: observacoes || null,
    })
    setSalvando(false)
    setMensagem(ok ? 'Variáveis do plano salvas.' : 'Não foi possível salvar as variáveis.')
  }

  function alterarComponente(id: string, campo: keyof ComponentePlanoCorte, valor: string | number | null) {
    setComponentesPlano(prev => prev.map(c => c.id === id ? { ...c, [campo]: valor } : c))
  }

  async function salvarComponente(componente: ComponentePlanoCorte) {
    if (!podeEditar) return
    setSalvando(true)
    const ok = await atualizarComponentePlano(componente.id, {
      produto_id: componente.produto_id || null,
      nome: componente.nome,
      unidade: componente.unidade,
      quantidade: Number(componente.quantidade) || 0,
      corte_mm: componente.corte_mm == null ? null : Number(componente.corte_mm),
      formula_quantidade: componente.formula_quantidade || null,
      formula_corte: componente.formula_corte || null,
      observacao: componente.observacao || null,
    })
    setSalvando(false)
    setMensagem(ok ? `Componente “${componente.nome}” salvo.` : 'Não foi possível salvar o componente.')
  }

  function trocarProdutoComponente(componente: ComponentePlanoCorte, novoId: string) {
    const p = produtosTecnicos.find(x => x.id === novoId)
    alterarComponente(componente.id, 'produto_id', novoId || null)
    if (p) {
      alterarComponente(componente.id, 'nome', p.nome)
      alterarComponente(componente.id, 'unidade', p.unidade || componente.unidade)
    }
  }

  if (carregando) return <div className="grid min-h-[60vh] place-items-center text-slate-400"><Loader2 className="animate-spin" /></div>

  if (nivel === 'oculto') {
    return <div className="mx-auto max-w-xl px-4 py-12"><div className="rounded-2xl border border-slate-200 bg-white p-8 text-center"><LockKeyhole className="mx-auto mb-3 text-slate-400"/><h1 className="font-bold text-slate-900">Sem acesso ao Plano de Corte</h1><p className="mt-2 text-sm text-slate-500">O Master precisa liberar a permissão do setor Produção para este usuário.</p></div></div>
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Link href="/producao" className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500"><ArrowLeft size={18}/></Link>
          <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-emerald-600">Produção</p><h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-slate-950"><FileSpreadsheet size={22}/> Plano de Corte</h1><p className="mt-1 text-sm text-slate-500">Produto cadastrado → receita técnica → variáveis → snapshot editável de produção.</p></div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {podeEditar && <Link href="/engenharia/receitas-produtos" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"><Settings2 size={14}/>Receitas por produto</Link>}
          <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${podeEditar ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{podeEditar ? 'Edição liberada' : 'Somente consulta'}</span>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[340px_1fr]">
        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[.12em] text-slate-400">1. Produto cadastrado</p>
            <div className="relative mt-3"><Search size={16} className="absolute left-3 top-3 text-slate-400"/><input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Ex.: porta de correr 3 folhas" className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm"/></div>
            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">{produtosFiltrados.map(p => <button key={p.id} onClick={() => void selecionarProduto(p)} className={`w-full rounded-xl border p-3 text-left ${produtoId === p.id ? 'border-emerald-300 bg-emerald-50' : 'border-slate-100 hover:bg-slate-50'}`}><p className="text-sm font-semibold text-slate-800">{p.nome}</p><p className="mt-1 text-xs text-slate-400">{p.largura_mm && p.altura_mm ? `${p.largura_mm} × ${p.altura_mm} mm` : 'Medida variável'}</p></button>)}</div>
            {produtos.length === 0 && <p className="mt-3 rounded-xl border border-dashed border-slate-200 p-4 text-xs text-slate-400">Cadastre primeiro a esquadria em Cadastro de Produtos usando a categoria de porta/janela padrão.</p>}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold uppercase tracking-[.12em] text-slate-400">2. Receita técnica</p>{carregandoReceita && <Loader2 size={14} className="animate-spin text-slate-400"/>}</div>
            {receitaSelecionada && <div className={`mt-3 rounded-xl border px-3 py-2.5 ${origemReceita === 'produto' ? 'border-emerald-200 bg-emerald-50' : 'border-blue-200 bg-blue-50'}`}><p className="text-xs font-semibold text-slate-800">{receitaSelecionada.nome}</p><p className="mt-1 text-[11px] text-slate-500">Versão {receitaSelecionada.versao} · {origemReceita === 'produto' ? 'receita específica do produto' : 'fallback genérico da tipologia'}</p></div>}
            <select value={origemReceita === 'tipologia' ? tipologiaId : ''} onChange={e => void selecionarTipologiaGenerica(e.target.value)} disabled={!produto || carregandoReceita} className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm disabled:bg-slate-50"><option value="">{origemReceita === 'produto' ? 'Trocar pela receita genérica…' : 'Selecione a receita genérica'}</option>{tipologiasComFallback.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
            <p className="mt-2 text-xs leading-5 text-slate-500">O Atlas procura primeiro a receita específica do produto. A receita genérica da tipologia é usada somente como fallback.</p>
          </section>

          {planos.length > 0 && <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[.12em] text-slate-400">Planos recentes</p><div className="mt-3 space-y-2">{planos.slice(0, 8).map(pl => <button key={pl.id} onClick={() => void abrirPlano(pl)} className="w-full rounded-xl border border-slate-100 p-3 text-left hover:bg-slate-50"><div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-semibold text-slate-800">{pl.nome}</p><span className="text-[10px] font-semibold uppercase text-slate-400">{pl.status}</span></div><p className="mt-1 text-xs text-slate-400">{pl.largura_mm || '-'} × {pl.altura_mm || '-'} mm · {pl.quantidade} un.</p></button>)}</div></section>}
        </aside>

        <main className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.12em] text-slate-400">3. Variáveis do plano</p><h2 className="mt-1 text-lg font-bold text-slate-900">{produto?.nome || planoAtual?.nome || 'Selecione o produto'}</h2></div><SlidersHorizontal size={20} className="text-slate-300"/></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-xs font-medium text-slate-600">Largura (mm)<input value={largura} onChange={e => setLargura(e.target.value)} disabled={!podeEditar} inputMode="numeric" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm disabled:bg-slate-50"/></label>
              <label className="text-xs font-medium text-slate-600">Altura (mm)<input value={altura} onChange={e => setAltura(e.target.value)} disabled={!podeEditar} inputMode="numeric" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm disabled:bg-slate-50"/></label>
              <label className="text-xs font-medium text-slate-600">Quantidade<input value={quantidade} onChange={e => setQuantidade(e.target.value)} disabled={!podeEditar} inputMode="numeric" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm disabled:bg-slate-50"/></label>
              <label className="text-xs font-medium text-slate-600">Folga largura (mm)<input value={folgaLargura} onChange={e => setFolgaLargura(e.target.value)} disabled={!podeEditar} inputMode="decimal" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm disabled:bg-slate-50"/></label>
              <label className="text-xs font-medium text-slate-600">Folga altura (mm)<input value={folgaAltura} onChange={e => setFolgaAltura(e.target.value)} disabled={!podeEditar} inputMode="decimal" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm disabled:bg-slate-50"/></label>
              {VARIAVEIS.map(([chave, label]) => <label key={chave} className="text-xs font-medium text-slate-600">{label}<input value={String(variaveis[chave] || '')} onChange={e => alterarVariavel(chave, e.target.value)} disabled={!podeEditar} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm disabled:bg-slate-50"/></label>)}
            </div>
            <label className="mt-3 block text-xs font-medium text-slate-600">Observações<textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} disabled={!podeEditar} rows={3} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm disabled:bg-slate-50"/></label>
            <div className="mt-4 flex flex-wrap justify-end gap-2">{planoAtual && <button onClick={() => void salvarCabecalhoPlano()} disabled={!podeEditar || salvando} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-40"><Save size={16}/>Salvar variáveis</button>}<button onClick={() => void gerarPlano()} disabled={!podeEditar || salvando || !produto || !tipologia || !receitaSelecionada} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{salvando ? <Loader2 size={16} className="animate-spin"/> : <FileSpreadsheet size={16}/>}Gerar plano</button></div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.12em] text-slate-400">4. Perfis, acessórios e cortes</p><h2 className="mt-1 font-bold text-slate-900">{planoAtual ? `Plano · ${planoAtual.nome}` : 'Aguardando geração'}</h2></div>{planoAtual && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"><Check size={13}/>Snapshot editável</span>}</div>
            {!planoAtual ? <div className="mt-4 rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">Selecione produto + receita e clique em Gerar plano.</div> : componentesPlano.length === 0 ? <div className="mt-4 rounded-xl border border-dashed border-amber-200 bg-amber-50 p-5 text-sm text-amber-700">A receita selecionada não possui componentes. Cadastre os perfis e acessórios em Engenharia → Receitas por produto.</div> : <div className="mt-4 space-y-3">{componentesPlano.map(componente => {
              const produtosCompativeis = produtosTecnicos.filter(p => componente.tipo === 'perfil' ? p.categoria === 'perfil' : componente.tipo === 'acessorio' ? p.categoria === 'acessorio' : true)
              return <article key={componente.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase text-slate-600">{componente.tipo}</span><p className="mt-2 text-sm font-semibold text-slate-800">{componente.nome}</p>{componente.formula_corte_validada && componente.corte_mm != null && <p className="mt-1 text-[11px] font-medium text-emerald-700">✓ Corte calculado por fórmula validada</p>}</div><button onClick={() => void salvarComponente(componente)} disabled={!podeEditar || salvando} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"><Save size={13}/>Salvar</button></div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="text-[11px] font-medium text-slate-500">Trocar perfil/acessório<select value={componente.produto_id || ''} onChange={e => trocarProdutoComponente(componente, e.target.value)} disabled={!podeEditar} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs disabled:bg-slate-50"><option value="">Manual / manter descrição</option>{produtosCompativeis.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label><label className="text-[11px] font-medium text-slate-500">Quantidade<input value={componente.quantidade} onChange={e => alterarComponente(componente.id, 'quantidade', numero(e.target.value))} disabled={!podeEditar} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs disabled:bg-slate-50"/></label><label className="text-[11px] font-medium text-slate-500">Corte final (mm)<input value={componente.corte_mm ?? ''} onChange={e => alterarComponente(componente.id, 'corte_mm', e.target.value === '' ? null : numero(e.target.value))} disabled={!podeEditar} placeholder="Preencher/ajustar" className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs disabled:bg-slate-50"/></label><label className="text-[11px] font-medium text-slate-500">Unidade<input value={componente.unidade} onChange={e => alterarComponente(componente.id, 'unidade', e.target.value)} disabled={!podeEditar} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs disabled:bg-slate-50"/></label></div>
                {(componente.formula_quantidade || componente.formula_corte) && <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">{componente.formula_quantidade && <p>Fórmula quantidade: <code>{componente.formula_quantidade}</code></p>}{componente.formula_corte && <p className="mt-1">Fórmula corte: <code>{componente.formula_corte}</code></p>}{componente.formula_corte && !componente.formula_corte_validada && <p className="mt-2 text-[11px] text-amber-700">Fórmula ainda não validada: o Atlas não calcula o corte automaticamente.</p>}</div>}
              </article>
            })}</div>}
          </section>

          {mensagem && <div className={`rounded-xl border px-4 py-3 text-sm ${mensagem.includes('Não') || mensagem.includes('ainda não') ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{mensagem}</div>}
        </main>
      </div>
    </div>
  )
}
