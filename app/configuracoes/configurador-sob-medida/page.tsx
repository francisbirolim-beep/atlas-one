'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CADASTRO_INICIAL, CadastroConfigurador, Condicao, NIVEIS, Regra, validarCadastro } from '@/lib/configuradorSobMedida'
import { requisicaoConfigurador } from '@/lib/configuradorSobMedidaClient'

const input = 'mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm'
const ACOES: { valor: Regra['acao']; label: string }[] = [
  { valor: 'recomendar_linha', label: 'Recomendar linha' }, { valor: 'permitir_linha', label: 'Filtrar linhas permitidas' },
  { valor: 'bloquear_linha', label: 'Bloquear linha' }, { valor: 'exigir_valor', label: 'Recomendar / exigir opção' }, { valor: 'avisar', label: 'Exibir aviso / encaminhar para análise' },
]
export default function CadastroPiloto() {
  const [cadastro, setCadastro] = useState<CadastroConfigurador | null>(null)
  const [linhas, setLinhas] = useState<{ id: string; nome: string }[]>([])
  const [master, setMaster] = useState(false)
  const [erro, setErro] = useState('')
  const [status, setStatus] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [categoria, setCategoria] = useState('')
  useEffect(() => {
    let ativo = true
    requisicaoConfigurador().then(d => { if (ativo) { setCadastro(d.cadastro); setMaster(d.master); setLinhas(d.linhas) } }).catch(e => { if (ativo) setErro(e.message) })
    return () => { ativo = false }
  }, [])
  function editarRegra(id: string, patch: Partial<Regra>) {
    setStatus('')
    setCadastro(c => c && ({ ...c, regras: c.regras.map(r => r.id === id ? { ...r, ...patch } : r) }))
  }
  async function salvar() {
    if (!cadastro || salvando) return
    setSalvando(true); setErro(''); setStatus('')
    try { validarCadastro(cadastro); await requisicaoConfigurador(cadastro); setStatus('Cadastro salvo. Reabra o piloto para usar as alterações.') }
    catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao salvar.') }
    finally { setSalvando(false) }
  }
  const campos = [
    { valor: 'largura', label: 'Largura (mm)' }, { valor: 'altura', label: 'Altura (mm)' }, { valor: 'quantidade', label: 'Quantidade' },
    { valor: 'produto', label: 'Produto' }, ...CADASTRO_INICIAL.perguntas.map(p => ({ valor: p.chave, label: p.label })),
  ]
  return <main className="mx-auto max-w-4xl space-y-5 p-4 pb-24">
    <Link href="/orcamento/novo" className="text-sm text-blue-700">← Novo Orçamento</Link>
    <h1 className="text-xl font-bold">Cadastro do configurador Sob Medida</h1>
    {erro && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{erro}</p>}
    {!cadastro ? <p>Carregando cadastro…</p> : !master ? <p>Área de cadastro exclusiva do Master.</p> : <>
      <p className="text-sm text-slate-600">Piloto Porta de Correr 2 Folhas. Cadastre somente regras validadas. Nenhum limite dimensional vem preenchido. Mão-de-amigo, trilho, roldanas, contramarco, arremate, vidro, cor e receitas serão detalhados após o teste.</p>
      <fieldset disabled={salvando} className="space-y-5">
        <section className="rounded-xl border bg-white p-4"><h2 className="font-semibold">O que é? — Categorias</h2><div className="mt-3 flex flex-wrap gap-2">{cadastro.categorias.map(c => <span key={c.valor} className="rounded-lg bg-slate-100 px-3 py-2 text-sm">{c.label}</span>)}</div>
          <label className="mt-3 block text-sm">Nova categoria<input value={categoria} onChange={e => setCategoria(e.target.value)} className={input} /></label>
          <button type="button" className="mt-2 rounded-lg border px-3 py-2 text-sm" onClick={() => {
            const valor = categoria.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
            if (!/^[a-z][a-z0-9_]{0,59}$/.test(valor) || cadastro.categorias.some(c => c.valor === valor)) { setErro('Informe um nome de categoria novo e válido.'); return }
            setCadastro({ ...cadastro, categorias: [...cadastro.categorias, { valor, label: categoria.trim() }] }); setCategoria(''); setStatus(''); setErro('')
          }}>Adicionar categoria</button><p className="mt-2 text-xs text-slate-500">Novas categorias ficam aguardando cadastro de suas variáveis. Não ampliam o escopo do piloto.</p>
        </section>
        <section className="space-y-4"><h2 className="font-semibold">Regras técnicas</h2>
          <p className="text-xs text-slate-600">Todas as condições da regra devem ser atendidas. Apenas o nível Obrigatória bloqueia uma linha ou exige um valor; Recomendação e Alerta forte orientam. Análise técnica impede concluir a configuração. Regras de linhas permitidas formam uma lista de alternativas; bloqueios prevalecem.</p>
          {cadastro.regras.length === 0 && <p className="rounded-lg border border-dashed p-4 text-sm">Nenhuma regra dimensional cadastrada.</p>}
          {cadastro.regras.map((r, indice) => <fieldset key={r.id} className="space-y-3 rounded-xl border bg-white p-4"><legend className="px-1 text-sm font-semibold">Regra {indice + 1}</legend>
            <label className="block text-sm">Mensagem da regra<input value={r.nome} onChange={e => editarRegra(r.id, { nome: e.target.value })} className={input} /></label>
            <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Nível<select value={r.nivel} onChange={e => editarRegra(r.id, { nivel: e.target.value as Regra['nivel'] })} className={input}>{NIVEIS.map(n => <option key={n}>{n}</option>)}</select></label><label className="text-sm">Ação<select value={r.acao} onChange={e => editarRegra(r.id, { acao: e.target.value as Regra['acao'], alvo: '', valor: '' })} className={input}>{ACOES.map(a => <option key={a.valor} value={a.valor}>{a.label}</option>)}</select></label></div>
            {r.acao.endsWith('_linha') && <label className="block text-sm">Linha<select value={r.alvo} onChange={e => editarRegra(r.id, { alvo: e.target.value })} className={input}><option value="">Selecione</option>{linhas.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}</select></label>}
            {r.acao === 'exigir_valor' && <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Variável<select value={r.alvo} onChange={e => editarRegra(r.id, { alvo: e.target.value, valor: '' })} className={input}><option value="">Selecione</option>{cadastro.perguntas.map(p => <option key={p.chave} value={p.chave}>{p.label}</option>)}</select></label><label className="text-sm">Valor<select value={r.valor} onChange={e => editarRegra(r.id, { valor: e.target.value })} className={input}><option value="">Selecione</option>{cadastro.perguntas.find(p => p.chave === r.alvo)?.opcoes.map(o => <option key={o.valor} value={o.valor}>{o.label}</option>)}</select></label></div>}
            <p className="text-sm font-medium">Quando todas estas condições forem atendidas:</p>
            {r.quando.map((cond, i) => {
              const atualizar = (patch: Partial<Condicao>) => editarRegra(r.id, { quando: r.quando.map((c, j) => i === j ? { ...c, ...patch } : c) })
              const numerico = ['largura', 'altura', 'quantidade'].includes(cond.campo)
              const opcoes = cond.campo === 'produto' ? cadastro.categorias : cadastro.perguntas.find(p => p.chave === cond.campo)?.opcoes || []
              return <div key={i} className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                <label className="text-xs">Campo<select className={input} value={cond.campo} onChange={e => atualizar({ campo: e.target.value, operador: 'igual', valor: '' })}>{campos.map(c => <option key={c.valor} value={c.valor}>{c.label}</option>)}</select></label>
                <label className="text-xs">Condição<select className={input} value={cond.operador} onChange={e => atualizar({ operador: e.target.value as Condicao['operador'] })}><option value="igual">Igual a</option>{numerico && <><option value="maior_igual">Maior ou igual a</option><option value="menor_igual">Menor ou igual a</option></>}</select></label>
                <label className="text-xs">Valor{numerico ? <input className={input} inputMode="decimal" value={cond.valor} onChange={e => atualizar({ valor: e.target.value })} /> : <select className={input} value={cond.valor} onChange={e => atualizar({ valor: e.target.value })}><option value="">Selecione</option>{opcoes.map(o => <option key={o.valor} value={o.valor}>{o.label}</option>)}</select>}</label>
                <button type="button" aria-label={`Remover condição ${i + 1} da regra ${indice + 1}`} className="p-2 text-sm text-red-700" onClick={() => editarRegra(r.id, { quando: r.quando.filter((_, j) => j !== i) })}>Remover</button>
              </div>
            })}
            <button type="button" className="rounded-lg border px-3 py-2 text-xs" onClick={() => editarRegra(r.id, { quando: [...r.quando, { campo: 'largura', operador: 'maior_igual', valor: '' }] })}>Adicionar condição</button>
            <label className="block text-sm">Evidência / referência técnica validada<textarea value={r.evidencia} onChange={e => editarRegra(r.id, { evidencia: e.target.value })} className={input} /></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={r.ativa} onChange={e => editarRegra(r.id, { ativa: e.target.checked })} />Regra ativa</label>
            <button type="button" className="text-xs text-red-700 underline" onClick={() => { setCadastro({ ...cadastro, regras: cadastro.regras.filter(regra => regra.id !== r.id) }); setStatus('') }}>Excluir regra do cadastro</button>
          </fieldset>)}
          <button type="button" className="rounded-lg border px-4 py-2 text-sm" onClick={() => { setStatus(''); setCadastro({ ...cadastro, regras: [...cadastro.regras, { id: crypto.randomUUID(), nome: '', evidencia: '', ativa: false, nivel: 'Recomendação', acao: 'avisar', alvo: '', valor: '', quando: [{ campo: 'produto', operador: 'igual', valor: 'porta' }, { campo: 'abertura', operador: 'igual', valor: 'correr' }, { campo: 'folhas', operador: 'igual', valor: '2' }] }] }) }}>Adicionar regra</button>
        </section>
        <button type="button" onClick={() => void salvar()} className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white">{salvando ? 'Salvando…' : 'Salvar cadastro'}</button>
      </fieldset>
      {status && <p role="status" className="text-sm text-green-700">{status}</p>}
    </>}
  </main>
}
