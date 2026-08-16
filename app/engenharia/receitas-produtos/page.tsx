'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Loader2, PackageSearch, Plus, Save, ShieldCheck, Trash2 } from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import type { NivelPermissao, Produto, Tipologia, Usuario } from '@/lib/tipos'
import {
  adicionarComponente,
  atualizarComponenteReceita,
  buscarReceitaAtivaProduto,
  criarReceitaParaProduto,
  excluirComponente,
  listarComponentesReceita,
  listarProdutosTecnicos,
  listarTipologiasComReceita,
  validarFormulasComponente,
  type ComponenteReceita,
  type ReceitaTecnica,
  type TipoComponenteReceita,
  type TipologiaComReceita,
} from '@/lib/engenhariaReceitas'
import { listarProdutosEsquadria } from '@/lib/planoCorte'
import { localizarSetorEngenharia } from '@/lib/engenharia'
import { listarPermissoesUsuario, nivelEfetivo } from '@/lib/setores'

function normalizar(valor: string) {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

export default function ReceitasProdutosPage() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [nivel, setNivel] = useState<NivelPermissao>('oculto')
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [produtosTecnicos, setProdutosTecnicos] = useState<Produto[]>([])
  const [tipologias, setTipologias] = useState<TipologiaComReceita[]>([])
  const [busca, setBusca] = useState('')
  const [produtoId, setProdutoId] = useState('')
  const [tipologiaId, setTipologiaId] = useState('')
  const [receita, setReceita] = useState<ReceitaTecnica | null>(null)
  const [componentes, setComponentes] = useState<ComponenteReceita[]>([])
  const [mensagem, setMensagem] = useState('')

  const [tipoNovo, setTipoNovo] = useState<TipoComponenteReceita>('perfil')
  const [produtoTecnicoId, setProdutoTecnicoId] = useState('')
  const [nomeNovo, setNomeNovo] = useState('')
  const [unidadeNova, setUnidadeNova] = useState('un')
  const [quantidadeNova, setQuantidadeNova] = useState('1')
  const [formulaQuantidadeNova, setFormulaQuantidadeNova] = useState('')
  const [formulaCorteNova, setFormulaCorteNova] = useState('')

  useEffect(() => {
    async function carregar() {
      const [u, setor, p, pt, t] = await Promise.all([
        usuarioAtual(),
        localizarSetorEngenharia(),
        listarProdutosEsquadria(),
        listarProdutosTecnicos(),
        listarTipologiasComReceita(),
      ])
      setUsuario(u)
      let acesso: NivelPermissao = u?.role === 'master' ? 'edicao' : 'oculto'
      if (u && u.role !== 'master' && setor) {
        const permissoes = await listarPermissoesUsuario(u.id)
        acesso = nivelEfetivo(u, setor.id, permissoes)
      }
      setNivel(acesso)
      setProdutos(p)
      setProdutosTecnicos(pt)
      setTipologias(t)
      setCarregando(false)
    }
    void carregar()
  }, [])

  const podeEditar = nivel === 'edicao'
  const produto = produtos.find(p => p.id === produtoId) || null
  const tipologia = tipologias.find(t => t.id === tipologiaId) || null
  const produtosFiltrados = useMemo(() => {
    const termo = normalizar(busca)
    if (!termo) return produtos
    return produtos.filter(p => normalizar(`${p.nome} ${p.descricao || ''}`).includes(termo))
  }, [produtos, busca])
  const tecnicosCompativeis = useMemo(() => produtosTecnicos.filter(p => tipoNovo === 'perfil' ? p.categoria === 'perfil' : tipoNovo === 'acessorio' ? p.categoria === 'acessorio' : true), [produtosTecnicos, tipoNovo])

  async function selecionarProduto(p: Produto) {
    setProdutoId(p.id)
    setTipologiaId('')
    setReceita(null)
    setComponentes([])
    setMensagem('')
    const encontrada = await buscarReceitaAtivaProduto(p.id)
    if (encontrada) {
      setReceita(encontrada)
      setTipologiaId(encontrada.tipologia_id)
      setComponentes(await listarComponentesReceita(encontrada.id))
      setMensagem('Receita específica carregada.')
    }
  }

  async function criarReceita() {
    if (!podeEditar || !produto || !tipologia || receita) return
    setSalvando(true)
    const criada = await criarReceitaParaProduto(produto, tipologia as Tipologia, usuario)
    setSalvando(false)
    if (!criada) {
      setMensagem('Não foi possível criar a receita. Confirme se a migration de receitas por produto já foi aplicada.')
      return
    }
    setReceita(criada)
    setComponentes([])
    setMensagem('Receita específica criada. Agora cadastre os componentes e fórmulas.')
  }

  async function adicionar() {
    if (!podeEditar || !receita || !nomeNovo.trim()) return
    setSalvando(true)
    const criado = await adicionarComponente(receita.id, {
      tipo: tipoNovo,
      produto_id: produtoTecnicoId || null,
      nome: nomeNovo.trim(),
      unidade: unidadeNova.trim() || 'un',
      quantidade_base: Number(quantidadeNova.replace(',', '.')) || 1,
      formula_quantidade: formulaQuantidadeNova.trim() || null,
      formula_corte: formulaCorteNova.trim() || null,
    })
    setSalvando(false)
    if (!criado) {
      setMensagem('Não foi possível adicionar o componente.')
      return
    }
    setComponentes(prev => [...prev, criado])
    setProdutoTecnicoId('')
    setNomeNovo('')
    setUnidadeNova('un')
    setQuantidadeNova('1')
    setFormulaQuantidadeNova('')
    setFormulaCorteNova('')
    setMensagem('Componente adicionado. A fórmula nasce como não validada.')
  }

  function alterarLocal(id: string, dados: Partial<ComponenteReceita>) {
    setComponentes(prev => prev.map(c => c.id === id ? { ...c, ...dados } : c))
  }

  async function salvarFormula(componente: ComponenteReceita) {
    if (!podeEditar) return
    setSalvando(true)
    const salvo = await atualizarComponenteReceita(componente.id, {
      formula_quantidade: componente.formula_quantidade?.trim() || null,
      formula_corte: componente.formula_corte?.trim() || null,
      observacao: componente.observacao?.trim() || null,
      formula_quantidade_validada: false,
      formula_corte_validada: false,
      formula_validada_em: null,
      formula_validada_por_id: null,
      formula_validada_por_nome: null,
      evidencia_validacao: null,
    })
    setSalvando(false)
    if (salvo) {
      alterarLocal(componente.id, salvo)
      setMensagem('Fórmula salva. Como foi editada, precisa ser validada novamente antes de calcular cortes.')
    } else setMensagem('Não foi possível salvar a fórmula.')
  }

  async function validar(componente: ComponenteReceita) {
    if (!podeEditar || !componente.formula_corte?.trim()) return
    const evidencia = (componente.evidencia_validacao || '').trim()
    if (!evidencia) {
      setMensagem('Informe a evidência técnica antes de validar a fórmula de corte.')
      return
    }
    setSalvando(true)
    const salvo = await validarFormulasComponente(componente, {
      quantidadeValidada: Boolean(componente.formula_quantidade_validada && componente.formula_quantidade),
      corteValidado: true,
      evidencia,
    }, usuario)
    setSalvando(false)
    if (salvo) {
      alterarLocal(componente.id, salvo)
      setMensagem('Fórmula de corte validada. Novos planos podem calcular este corte automaticamente.')
    } else setMensagem('Não foi possível registrar a validação.')
  }

  async function remover(componente: ComponenteReceita) {
    if (!podeEditar || !confirm(`Remover “${componente.nome}” desta receita?`)) return
    if (await excluirComponente(componente.id)) setComponentes(prev => prev.filter(c => c.id !== componente.id))
  }

  if (carregando) return <div className="grid min-h-[60vh] place-items-center text-slate-400"><Loader2 className="animate-spin"/></div>
  if (nivel === 'oculto') return <div className="mx-auto max-w-xl p-8"><div className="rounded-2xl border border-slate-200 bg-white p-7 text-center"><ShieldCheck className="mx-auto text-slate-300"/><h1 className="mt-3 font-bold text-slate-900">Sem acesso às receitas técnicas</h1><p className="mt-2 text-sm text-slate-500">O Master precisa liberar o setor Engenharia para este usuário.</p></div></div>

  return <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3"><Link href="/engenharia/receitas" className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500"><ArrowLeft size={18}/></Link><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-emerald-600">Engenharia · Receita mestre</p><h1 className="mt-1 text-2xl font-bold text-slate-950">Receitas técnicas por produto</h1><p className="mt-1 text-sm text-slate-500">Cada produto pode ter sua própria composição e fórmulas, mantendo a tipologia genérica apenas como fallback.</p></div></div>
      <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${podeEditar ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{podeEditar ? 'Pode editar e validar' : 'Somente consulta'}</span>
    </div>

    <div className="grid gap-5 lg:grid-cols-[330px_1fr]">
      <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[.12em] text-slate-400">Produto cadastrado</p>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Pesquisar produto..." className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/>
        <div className="mt-3 max-h-[65vh] space-y-2 overflow-y-auto">{produtosFiltrados.map(p => <button key={p.id} onClick={() => void selecionarProduto(p)} className={`w-full rounded-xl border p-3 text-left ${produtoId === p.id ? 'border-emerald-300 bg-emerald-50' : 'border-slate-100 hover:bg-slate-50'}`}><div className="flex items-start justify-between gap-2"><div><p className="text-sm font-semibold text-slate-800">{p.nome}</p><p className="mt-1 text-xs text-slate-400">{p.descricao || 'Produto técnico de esquadria'}</p></div><PackageSearch size={15} className="mt-0.5 shrink-0 text-slate-300"/></div></button>)}</div>
      </aside>

      <main className="space-y-5">
        {!produto ? <div className="grid min-h-[420px] place-items-center rounded-2xl border border-dashed border-slate-200 bg-white text-center text-slate-400"><div><PackageSearch className="mx-auto mb-3" size={34}/><p>Selecione um produto para abrir ou criar sua receita técnica.</p></div></div> : <>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-wide text-slate-400">Produto</p><h2 className="mt-1 text-xl font-bold text-slate-900">{produto.nome}</h2>{receita && <p className="mt-1 text-xs text-emerald-700">Receita ativa · versão {receita.versao}</p>}</div>{!receita && <div className="flex flex-wrap items-center gap-2"><select value={tipologiaId} onChange={e => setTipologiaId(e.target.value)} disabled={!podeEditar} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"><option value="">Escolha a tipologia</option>{tipologias.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select><button onClick={() => void criarReceita()} disabled={!podeEditar || !tipologiaId || salvando} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Criar receita do produto</button></div>}</div>
          </section>

          {receita && <>
            {podeEditar && <section className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-4">
              <select value={tipoNovo} onChange={e => setTipoNovo(e.target.value as TipoComponenteReceita)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"><option value="perfil">Perfil</option><option value="acessorio">Acessório</option><option value="vidro">Vidro</option><option value="reforco">Reforço</option><option value="outro">Outro</option></select>
              <select value={produtoTecnicoId} onChange={e => { const id = e.target.value; setProdutoTecnicoId(id); const p = produtosTecnicos.find(x => x.id === id); if (p) { setNomeNovo(p.nome); setUnidadeNova(p.unidade || 'un') } }} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"><option value="">Componente manual</option>{tecnicosCompativeis.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select>
              <input value={nomeNovo} onChange={e => setNomeNovo(e.target.value)} placeholder="Nome do componente" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"/>
              <div className="grid grid-cols-2 gap-2"><input value={quantidadeNova} onChange={e => setQuantidadeNova(e.target.value)} placeholder="Qtd." className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"/><input value={unidadeNova} onChange={e => setUnidadeNova(e.target.value)} placeholder="Un." className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"/></div>
              <input value={formulaQuantidadeNova} onChange={e => setFormulaQuantidadeNova(e.target.value)} placeholder="Fórmula quantidade (opcional)" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm xl:col-span-2"/>
              <input value={formulaCorteNova} onChange={e => setFormulaCorteNova(e.target.value)} placeholder="Fórmula corte, ex.: largura - 30" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"/>
              <button onClick={() => void adicionar()} disabled={!nomeNovo.trim() || salvando} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"><Plus size={16}/>Adicionar</button>
            </section>}

            <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between"><h3 className="font-semibold text-slate-900">Componentes da receita</h3><span className="text-xs text-slate-400">{componentes.length} item(ns)</span></div>
              {componentes.length === 0 && <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">Nenhum componente cadastrado.</div>}
              {componentes.map(c => <article key={c.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase text-slate-600">{c.tipo}</span><strong className="text-sm text-slate-800">{c.nome}</strong><span className="text-xs text-slate-400">{c.quantidade_base} {c.unidade}</span></div>{c.formula_corte_validada && <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><CheckCircle2 size={14}/>Fórmula de corte validada</p>}</div>{podeEditar && <button onClick={() => void remover(c)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16}/></button>}</div>
                <div className="mt-3 grid gap-3 md:grid-cols-2"><label className="text-xs font-medium text-slate-600">Fórmula de quantidade<input value={c.formula_quantidade || ''} onChange={e => alterarLocal(c.id, { formula_quantidade: e.target.value })} disabled={!podeEditar} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"/></label><label className="text-xs font-medium text-slate-600">Fórmula de corte<input value={c.formula_corte || ''} onChange={e => alterarLocal(c.id, { formula_corte: e.target.value })} disabled={!podeEditar} placeholder="ex.: largura - 30" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"/></label></div>
                <label className="mt-3 block text-xs font-medium text-slate-600">Evidência técnica para validação<input value={c.evidencia_validacao || ''} onChange={e => alterarLocal(c.id, { evidencia_validacao: e.target.value })} disabled={!podeEditar} placeholder="Ex.: W.Vetro orçamento 866 + amostra 835" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"/></label>
                {c.formula_validada_em && <p className="mt-2 text-[11px] text-slate-400">Última validação: {new Date(c.formula_validada_em).toLocaleString('pt-BR')} · {c.formula_validada_por_nome || 'usuário'}</p>}
                {podeEditar && <div className="mt-3 flex flex-wrap justify-end gap-2"><button onClick={() => void salvarFormula(c)} disabled={salvando} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"><Save size={14}/>Salvar fórmula</button><button onClick={() => void validar(c)} disabled={salvando || !c.formula_corte?.trim()} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"><ShieldCheck size={14}/>Validar corte</button></div>}
              </article>)}
            </section>
          </>}
        </>}
        {mensagem && <div className={`rounded-xl border px-4 py-3 text-sm ${mensagem.includes('Não') || mensagem.includes('Informe') ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{mensagem}</div>}
      </main>
    </div>
  </div>
}
