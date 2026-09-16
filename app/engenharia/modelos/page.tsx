'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Beaker, CheckCircle2, FileDown, Loader2, Plus, Printer,
  Save, Search, Trash2, Wrench,
} from 'lucide-react'
import {
  listarTodasFormulasCorte,
  salvarFormulaCorte,
  type AcessorioFormulaCorte,
  type RegistroFormulaCorte,
} from '@/lib/engenhariaFormulasCorte'
import { listarProdutosTecnicos } from '@/lib/engenhariaReceitas'
import type { PecaFormula } from '@/lib/formulasCorteEngine'
import type { Produto } from '@/lib/tipos'
import { simularReceitaPc2 } from '@/lib/pc2Receita'
import { atualizarProduto } from '@/lib/produtos'

type Reforco = 'sem_reforco' | 'interno' | 'externo' | 'interno_externo'
type MaoLargura = 'comum' | 'largo'
type Contramarco = 'sem' | 'cm200'
type Fechamento = 'fechadura' | 'concha'

type PerfilCalculado = { codigo: string; descricao: string; corte: number; quantidade: number; eixo: 'L' | 'H'; desenho?: string | null; custo?: number | null }
type AcessorioCalculado = { codigo: string; descricao: string; quantidade: number | null; unidade: string; observacao?: string; desenho?: string | null; custo?: number | null }

type Simulacao = {
  perfis: PerfilCalculado[]
  vidro: { descricao: string; largura: number; altura: number; quantidade: number; custo?: number | null; desenho?: string | null }
  acessorios: AcessorioCalculado[]
  nivel: 'validado' | 'em_validacao'
  aviso: string
}


function n(v: string, fallback: number) {
  const valor = Number(String(v).replace(',', '.'))
  return Number.isFinite(valor) && valor > 0 ? valor : fallback
}

function clonar<T>(v: T): T { return JSON.parse(JSON.stringify(v)) as T }


function imprimirTabela(titulo: string, cabecalhos: string[], linhas: Array<Array<string | number>>) {
  const popup = window.open('', '_blank', 'width=980,height=760')
  if (!popup) return
  const escapar = (valor: string | number) => String(valor).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] || c))
  const th = cabecalhos.map(c => `<th>${escapar(c)}</th>`).join('')
  const tr = linhas.map(l => `<tr>${l.map(v => `<td>${typeof v === 'string' && /^https:\/\//.test(v) ? `<img src="${escapar(v)}" width="100" alt="Desenho do produto">` : escapar(v)}</td>`).join('')}</tr>`).join('')
  popup.document.write(`<!doctype html><html><head><title>${escapar(titulo)}</title><style>body{font-family:Arial;padding:28px;color:#0f172a}h1{font-size:22px}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #cbd5e1;padding:8px;text-align:left}th{background:#f1f5f9}@media print{button{display:none}}</style></head><body><h1>${escapar(titulo)}</h1><p>Atlas One · Engenharia</p><table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`)
  popup.document.close()
}

export default function ModelosEngenhariaPage() {
  const [formula, setFormula] = useState<RegistroFormulaCorte | null>(null)
  const [rascunho, setRascunho] = useState<RegistroFormulaCorte | null>(null)
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')
  const [largura, setLargura] = useState('2000')
  const [altura, setAltura] = useState('2200')
  const [contramarco, setContramarco] = useState<Contramarco>('sem')
  const [mao, setMao] = useState<MaoLargura>('comum')
  const [reforco, setReforco] = useState<Reforco>('interno_externo')
  const [fechamento, setFechamento] = useState<Fechamento>('fechadura')
  const [quantidade, setQuantidade] = useState('1')
  const [arremate, setArremate] = useState('sem')
  const [trilho, setTrilho] = useState('macarrao')
  const [roldana, setRoldana] = useState('100')
  const [montanteLateral, setMontanteLateral] = useState('largo')
  const [vidroEscolhido, setVidroEscolhido] = useState('Incolor 06mm - Temperado')
  const [cor, setCor] = useState('Natural')
  const [puxador, setPuxador] = useState('sem')
  const [simulacao, setSimulacao] = useState<Simulacao | null>(null)
  const [buscaPerfil, setBuscaPerfil] = useState('')
  const [codigoCusto, setCodigoCusto] = useState('')
  const [valorCusto, setValorCusto] = useState('')
  const [origemCusto, setOrigemCusto] = useState('')
  const [resultadoTeste, setResultadoTeste] = useState('')

  useEffect(() => {
    void (async () => {
      const [formulas, catalogo] = await Promise.all([listarTodasFormulasCorte(), listarProdutosTecnicos()])
      const alvo = formulas.find(f => f.configuracao_chave === 'pc2_suprema_editor_v1') || null
      setFormula(alvo)
      setRascunho(alvo ? clonar(alvo) : null)
      setProdutos(catalogo)
      setCarregando(false)
    })()
  }, [])

  const perfisCatalogo = useMemo(() => produtos.filter(p => p.categoria === 'perfil' && p.codigo), [produtos])
  const descricaoPesquisa = rascunho?.metadados_editor.descricao_pesquisa || ''
  const descricaoOrcamento = rascunho?.metadados_editor.descricao_orcamento || ''
  const custoParcial = (simulacao?.perfis.reduce((s,p)=>s+(p.custo||0),0)||0)+(simulacao?.acessorios.reduce((s,a)=>s+(a.custo||0),0)||0)+(simulacao?.vidro.custo||0)
  const custosPendentes = (simulacao?.perfis.filter(p=>p.custo==null).length||0)+(simulacao?.acessorios.filter(a=>a.custo==null).length||0)+(simulacao?.vidro.custo==null&&simulacao?1:0)

  function simular() {
    setErro('')
    setMensagem('')
    try {
      if (!rascunho) throw new Error('Cadastro técnico indisponível')
      const resultado = simularReceitaPc2(rascunho, { largura: n(largura, 2000), altura: n(altura, 2200), quantidade: n(quantidade, 1), opcoes: { contramarco, mao_amigo_largura: mao, reforco_mao_amigo: reforco, fechamento, arremate, trilho, roldana, montante_lateral: montanteLateral, vidro: vidroEscolhido, cor, puxador } }, produtos)
      setSimulacao(resultado)
    } catch (e) {
      setSimulacao(null)
      setErro(e instanceof Error ? e.message : 'Não foi possível simular.')
    }
  }

  function atualizarPeca(index: number, patch: Partial<PecaFormula>) {
    setRascunho(prev => prev ? { ...prev, pecas: prev.pecas.map((p, i) => i === index ? { ...p, ...patch } : p) } : prev)
  }

  function adicionarPeca() {
    setRascunho(prev => prev ? { ...prev, pecas: [...prev.pecas, { codigo: '', descricao: 'Novo perfil', formula: '', quantidade: 1, eixo: 'L' }] } : prev)
  }

  function atualizarAcessorio(index: number, patch: Partial<AcessorioFormulaCorte>) {
    setRascunho(prev => prev ? { ...prev, acessorios: prev.acessorios.map((a, i) => i === index ? { ...a, ...patch } : a) } : prev)
  }
  function atualizarCondicaoAcessorio(index: number, texto: string) {
    try { atualizarAcessorio(index, { condicao_ativa: texto.trim() ? JSON.parse(texto) : undefined }); setErro('') }
    catch { setErro('Condição do acessório precisa ser um JSON válido.') }
  }

  function adicionarAcessorio() {
    setRascunho(prev => prev ? { ...prev, acessorios: [...prev.acessorios, { codigo: '', descricao: 'Novo acessório', status: 'referencia' }] } : prev)
  }

  async function salvar() {
    if (!rascunho) return
    setSalvando(true); setErro(''); setMensagem('')
    const salvo = await salvarFormulaCorte(rascunho.id, {
      configuracao_label: rascunho.configuracao_label,
      variaveis: rascunho.variaveis,
      pecas: rascunho.pecas,
      vidro: rascunho.vidro,
      acessorios: rascunho.acessorios,
      metadados_editor: rascunho.metadados_editor,
      status: rascunho.status,
      ativo: rascunho.ativo,
      observacoes: rascunho.observacoes,
    })
    if (!salvo) setErro('Não foi possível salvar o cadastro.')
    else { setFormula(salvo); setRascunho(clonar(salvo)); setMensagem('Cadastro salvo. A fórmula continua em validação e não interfere na produção.') }
    setSalvando(false)
  }

  async function salvarCustoMestre() {
    const mestre = produtos.find(p => p.codigo === codigoCusto)
    const valor = Number(valorCusto.replace(',', '.'))
    if (!mestre || !Number.isFinite(valor) || valor <= 0 || !origemCusto.trim()) {
      setErro('Escolha um produto mestre, informe custo maior que zero e a origem real.'); return
    }
    const dadosOrigem = { ...(mestre.dados_origem || {}), custo_tecnico_origem: origemCusto.trim(), custo_tecnico_em: new Date().toISOString() }
    const resposta = await atualizarProduto(mestre.id, { custo: valor, dados_origem: dadosOrigem })
    if (resposta.error) setErro('Não foi possível atualizar o custo mestre.')
    else { setProdutos(prev => prev.map(p => p.id === mestre.id ? { ...p, custo: valor, dados_origem: dadosOrigem } : p)); setMensagem('Custo mestre atualizado com origem e data.'); setErro('') }
  }
  function atualizarRegrasPeca(index: number, texto: string) {
    try {
      const regras = JSON.parse(texto) as Pick<PecaFormula, 'mapa_codigo' | 'condicoes' | 'condicao_ativa'>
      atualizarPeca(index, { mapa_codigo: regras.mapa_codigo, condicoes: regras.condicoes, condicao_ativa: regras.condicao_ativa })
      setErro('')
    } catch { setErro('Regras do perfil precisam ser um JSON válido.') }
  }

  function executarTestes() {
    if (!rascunho) return
    try {
      const resultado = simularReceitaPc2(rascunho, { largura: 2000, altura: 2200, quantidade: 1, opcoes: { contramarco: 'sem', arremate: 'sem', trilho: 'macarrao', fechamento: 'fechadura', mao_amigo_largura: 'comum', reforco_mao_amigo: 'interno_externo', roldana: '100', montante_lateral: 'largo', vidro: vidroEscolhido, cor, puxador } }, produtos)
      const corte = (codigo: string, eixo?: string) => resultado.perfis.find(p => p.codigo === codigo && (!eixo || p.eixo === eixo))?.corte
      const esperado: Array<[string, number, string?]> = [['SU001',1970],['TMC',1970],['SU007',2196],['SU008',2183],['SU053',917],['SU225',917],['SU280',2166],['SU047',2166],['SU049',2166],['SU102',917,'L'],['SU102',2015,'H']]
      const falhas = esperado.filter(([codigo, valor, eixo]) => corte(codigo, eixo) !== valor).map(([codigo]) => codigo)
      if (resultado.vidro.largura !== 911 || resultado.vidro.altura !== 2033 || resultado.vidro.quantidade !== 2) falhas.push('vidro')
      setResultadoTeste(falhas.length ? `Falhou: ${falhas.join(', ')}` : 'PC2 2000×2200: 11 perfis e 2 vidros 911×2033 conferidos.')
    } catch (e) { setResultadoTeste(e instanceof Error ? e.message : 'Teste indisponível') }
  }

  if (carregando) return <div className="grid min-h-[65vh] place-items-center"><Loader2 className="animate-spin text-blue-600" /></div>
  if (!formula || !rascunho) return <div className="p-8 text-sm text-red-700">Modelo PC2 Suprema de teste não encontrado na base.</div>

  return (
    <main className="min-h-screen bg-slate-50 p-3 md:p-6">
      <datalist id="catalogo-perfis-modelo">{perfisCatalogo.map(p => <option key={p.id} value={p.codigo || ''}>{p.nome}</option>)}</datalist>
      <datalist id="catalogo-produtos-mestres">{produtos.map(p => <option key={p.id} value={p.codigo || ''}>{p.nome}</option>)}</datalist>
      <div className="mx-auto max-w-[1550px] space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/engenharia" className="inline-flex items-center gap-1 text-xs text-slate-500"><ArrowLeft size={14}/> Engenharia</Link>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Cadastro de Modelo de Esquadria</h1>
            <p className="text-sm text-slate-500">Suprema · Porta de Correr · 2 Folhas Móveis · ambiente de teste técnico</p>
          </div>
          <div className="flex gap-2">
            <button onClick={simular} className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700"><Beaker size={16}/> Simular</button>
            <button onClick={salvar} disabled={salvando} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{salvando?<Loader2 size={16} className="animate-spin"/>:<Save size={16}/>} Salvar</button>
          </div>
        </header>

        {(mensagem || erro) && <div className={`rounded-xl border px-4 py-3 text-sm ${erro?'border-red-200 bg-red-50 text-red-700':'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{erro || mensagem}</div>}

        <section className="grid gap-4 xl:grid-cols-[1.5fr_.75fr_.75fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 font-bold">Identificação do modelo</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-xs font-semibold text-slate-600">Código<input value="PC2-SUPREMA" readOnly className="mt-1 w-full rounded-lg border bg-slate-50 px-3 py-2 text-sm"/></label>
              <label className="text-xs font-semibold text-slate-600">Descrição do orçamento<input value={descricaoOrcamento} onChange={e=>setRascunho(p=>p?{...p,metadados_editor:{...p.metadados_editor,descricao_orcamento:e.target.value}}:p)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"/></label>
              <label className="md:col-span-2 text-xs font-semibold text-slate-600">Descrição para pesquisa interna<input value={descricaoPesquisa} onChange={e=>setRascunho(p=>p?{...p,metadados_editor:{...p.metadados_editor,descricao_pesquisa:e.target.value}}:p)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"/></label>
              <label className="text-xs font-semibold text-slate-600">Linha<input value="Suprema" readOnly className="mt-1 w-full rounded-lg border bg-slate-50 px-3 py-2 text-sm"/></label>
              <label className="text-xs font-semibold text-slate-600">Status<input value="Em validação" readOnly className="mt-1 w-full rounded-lg border bg-amber-50 px-3 py-2 text-sm text-amber-800"/></label>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="font-bold">Busca do orçamento</h2><Search className="mx-auto my-4 text-blue-500" size={30}/>
            <p className="text-xs text-slate-500">O vendedor pesquisa termos técnicos; o cliente recebe somente a descrição comercial.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="font-bold">Origem técnica</h2><Wrench className="mx-auto my-4 text-slate-500" size={30}/>
            <p className="text-xs text-slate-500">{rascunho.metadados_editor.origem || 'W.Vetro'}</p>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[.8fr_1.25fr_.95fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 font-bold">Dimensões e folgas</h2>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs font-semibold">Largura<input value={largura} onChange={e=>setLargura(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2"/></label>
              <label className="text-xs font-semibold">Altura<input value={altura} onChange={e=>setAltura(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2"/></label>
              <label className="text-xs font-semibold">Quantidade<input value={quantidade} onChange={e=>setQuantidade(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2"/></label>
              <label className="text-xs font-semibold">Folga largura<input value={rascunho.metadados_editor.folga_largura ?? 4} onChange={e=>setRascunho(p=>p?{...p,metadados_editor:{...p.metadados_editor,folga_largura:n(e.target.value,4)}}:p)} className="mt-1 w-full rounded-lg border px-3 py-2"/></label>
              <label className="text-xs font-semibold">Folga altura<input value={rascunho.metadados_editor.folga_altura ?? 4} onChange={e=>setRascunho(p=>p?{...p,metadados_editor:{...p.metadados_editor,folga_altura:n(e.target.value,4)}}:p)} className="mt-1 w-full rounded-lg border px-3 py-2"/></label>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 font-bold">Variáveis do modelo</h2>
            <div className="grid gap-2 md:grid-cols-2">
              <label className="text-xs font-semibold">Contramarco<select value={contramarco} onChange={e=>setContramarco(e.target.value as Contramarco)} className="mt-1 w-full rounded-lg border px-3 py-2"><option value="sem">Sem contramarco</option><option value="cm200">CM200</option></select></label>
              <label className="text-xs font-semibold">Arremate<select value={arremate} onChange={e=>setArremate(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2"><option value="sem">Sem arremate</option><option value="interno">Arremate interno MP347</option></select></label>
              <label className="text-xs font-semibold">Trilho<select value={trilho} onChange={e=>setTrilho(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2"><option value="macarrao">Macarrão</option><option value="convencional">Convencional — em validação</option></select></label>
              <label className="text-xs font-semibold">Modo de fechamento<select value={fechamento} onChange={e=>{const valor=e.target.value as Fechamento;setFechamento(valor);if(valor==='fechadura')setMontanteLateral('largo')}} className="mt-1 w-full rounded-lg border px-3 py-2"><option value="fechadura">Fechadura</option><option value="concha">Concha — falta validar</option></select></label>
              <label className="text-xs font-semibold">Mão-de-amigo<select value={mao} onChange={e=>setMao(e.target.value as MaoLargura)} className="mt-1 w-full rounded-lg border px-3 py-2"><option value="comum">Perfil comum</option><option value="largo">Perfil largo</option></select></label>
              <label className="text-xs font-semibold">Reforço<select value={reforco} onChange={e=>setReforco(e.target.value as Reforco)} className="mt-1 w-full rounded-lg border px-3 py-2"><option value="sem_reforco">Sem reforço</option><option value="interno">Interno</option><option value="externo">Externo</option><option value="interno_externo">Interno + externo</option></select></label>
              <label className="text-xs font-semibold">Roldana<select value={roldana} onChange={e=>setRoldana(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2"><option value="100">100 kg</option><option value="200">200 kg — consumo pendente</option></select></label>
              <label className="text-xs font-semibold">Vidro<input value={vidroEscolhido} onChange={e=>setVidroEscolhido(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2"/></label>
              <label className="text-xs font-semibold">Cor<input value={cor} onChange={e=>setCor(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2"/></label>
              <label className="text-xs font-semibold">Montante lateral<select value={montanteLateral} disabled={fechamento==='fechadura'} onChange={e=>setMontanteLateral(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 disabled:bg-slate-100"><option value="largo">Largo</option><option value="estreito">Estreito — em validação</option></select></label>
              <label className="text-xs font-semibold">Puxador<select value={puxador} onChange={e=>setPuxador(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2"><option value="sem">Sem puxador</option><option value="sim">Com puxador — referência pendente</option></select></label>
            </div>
            <div className="mt-3 rounded-xl bg-blue-50 p-3 text-xs text-blue-800">Regra atual: <b>Fechadura → SU280 / montante lateral largo com reforço de aba.</b> A concha só será liberada no cálculo após conferência W.Vetro.</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-2 font-bold">Vista de referência</h2>
            <div className="relative mx-auto mt-4 h-56 max-w-64 rounded border-4 border-slate-600 bg-slate-100 p-2">
              <div className="grid h-full grid-cols-2 gap-2"><div className="grid place-items-center border-2 border-slate-500 bg-cyan-50 text-3xl">→</div><div className="grid place-items-center border-2 border-slate-500 bg-cyan-50 text-3xl">←</div></div>
              <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-xs font-bold">{largura} mm</span>
              <span className="absolute -right-14 top-1/2 -translate-y-1/2 rotate-90 text-xs font-bold">{altura} mm</span>
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.4fr_.85fr_.75fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">Perfis calculados / Plano de corte</h2><button onClick={()=>simulacao&&imprimirTabela('Plano de corte — Porta 2F Suprema',['Código','Descrição','Corte','Qtd.','Eixo','Desenho'],simulacao.perfis.map(p=>[p.codigo,p.descricao,p.corte,p.quantidade,p.eixo,p.desenho || 'Desenho pendente']))} className="text-blue-700"><Printer size={17}/></button></div>
            <div className="max-h-96 overflow-auto"><table className="w-full text-xs"><thead className="sticky top-0 bg-slate-100"><tr><th className="p-2 text-left">Código</th><th className="p-2 text-left">Descrição</th><th className="p-2 text-right">Corte</th><th className="p-2 text-right">Qtd.</th></tr></thead><tbody>{(simulacao?.perfis||[]).map((p,i)=><tr key={`${p.codigo}-${i}`} className="border-t"><td className="p-2 font-semibold">{p.codigo}</td><td className="p-2">{p.descricao}<div className="text-[10px] text-amber-700">{p.desenho ? "Desenho disponível" : "Desenho pendente"}</div></td><td className="p-2 text-right">{p.corte}</td><td className="p-2 text-right">{p.quantidade}</td></tr>)}</tbody></table></div>
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex justify-between"><h2 className="font-bold">Vidros</h2><button onClick={()=>simulacao&&imprimirTabela('Lista de vidros',['Descrição','Largura','Altura','Qtd.'],[[simulacao.vidro.descricao,simulacao.vidro.largura,simulacao.vidro.altura,simulacao.vidro.quantidade]])}><Printer size={17}/></button></div>{simulacao&&<div className="mt-3 grid grid-cols-4 gap-2 text-xs"><div className="col-span-4 font-semibold">{simulacao.vidro.descricao}</div><div>L: {simulacao.vidro.largura}</div><div>A: {simulacao.vidro.altura}</div><div>Qtd: {simulacao.vidro.quantidade}</div></div>}</div>
            <div className={`rounded-2xl border p-4 shadow-sm ${simulacao?.nivel==='validado'?'border-emerald-200 bg-emerald-50':'border-amber-200 bg-amber-50'}`}><div className="flex gap-2"><CheckCircle2 size={18}/><div><b className="text-sm">{simulacao?.nivel==='validado'?'Cálculo validado':'Cálculo em validação'}</b><p className="mt-1 text-xs">{simulacao?.aviso||'Clique em Simular.'}</p></div></div></div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex justify-between"><h2 className="font-bold">Impressão</h2><FileDown size={18}/></div>
            <div className="space-y-2 text-sm">
              <button onClick={()=>simulacao&&imprimirTabela('Lista de perfis',['Código','Descrição','Corte','Qtd.','Desenho'],simulacao.perfis.map(p=>[p.codigo,p.descricao,p.corte,p.quantidade,p.desenho || 'Desenho pendente']))} className="w-full rounded-lg border px-3 py-2 text-left">Imprimir lista de perfis</button>
              <button onClick={()=>simulacao&&imprimirTabela('Lista de acessórios',['Código','Descrição','Qtd.','UN','Desenho'],simulacao.acessorios.map(a=>[a.codigo,a.descricao,a.quantidade ?? 'Consumo pendente',a.unidade,a.desenho || 'Desenho pendente']))} className="w-full rounded-lg border px-3 py-2 text-left">Imprimir acessórios</button>
              <button onClick={()=>simulacao&&imprimirTabela('Lista de vidros',['Descrição','Largura','Altura','Qtd.'],[[simulacao.vidro.descricao,simulacao.vidro.largura,simulacao.vidro.altura,simulacao.vidro.quantidade]])} className="w-full rounded-lg border px-3 py-2 text-left">Imprimir vidros</button>
              <button onClick={()=>simulacao&&imprimirTabela('Plano de corte',['Código','Descrição','Corte','Qtd.','Eixo','Desenho'],simulacao.perfis.map(p=>[p.codigo,p.descricao,p.corte,p.quantidade,p.eixo,p.desenho || 'Desenho pendente']))} className="w-full rounded-lg border px-3 py-2 text-left">Imprimir plano de corte</button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-bold">Planilha técnica — perfis</h2><p className="text-xs text-slate-500">Edição tipo Excel: código, descrição, fórmula e quantidade. Use para montar novas linhas/modelos.</p></div><button onClick={adicionarPeca} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold"><Plus size={14}/>Adicionar perfil</button></div>
          <div className="overflow-x-auto"><table className="min-w-[1100px] w-full text-xs"><thead className="bg-slate-100"><tr><th className="p-2 text-left">Código / grupo</th><th className="p-2 text-left">Descrição</th><th className="p-2 text-left">Fórmula</th><th className="p-2 text-left">Regras / substituições</th><th className="p-2">Qtd.</th><th className="p-2">Ação</th></tr></thead><tbody>{rascunho.pecas.map((p,i)=><tr className="border-t" key={i}><td className="p-1"><input list="catalogo-perfis-modelo" value={p.codigo||p.grupo||''} readOnly={Boolean(p.grupo && p.mapa_codigo)} onChange={e=>atualizarPeca(i,{codigo:e.target.value,grupo:undefined})} className="w-full rounded border px-2 py-1.5"/></td><td className="p-1"><input value={p.descricao||''} onChange={e=>atualizarPeca(i,{descricao:e.target.value})} className="w-full rounded border px-2 py-1.5"/></td><td className="p-1"><input value={p.formula||''} onChange={e=>atualizarPeca(i,{formula:e.target.value})} className="w-full rounded border px-2 py-1.5 font-mono"/></td><td className="p-1"><textarea defaultValue={JSON.stringify({mapa_codigo:p.mapa_codigo,condicoes:p.condicoes,condicao_ativa:p.condicao_ativa})} onBlur={e=>atualizarRegrasPeca(i,e.target.value)} className="h-16 w-72 rounded border px-2 py-1 font-mono"/></td><td className="p-1"><input type="number" value={p.quantidade||1} onChange={e=>atualizarPeca(i,{quantidade:Number(e.target.value)||1})} className="w-20 rounded border px-2 py-1.5"/></td><td className="p-1 text-center"><button onClick={()=>setRascunho(prev=>prev?{...prev,pecas:prev.pecas.filter((_,x)=>x!==i)}:prev)}><Trash2 size={15} className="text-red-500"/></button></td></tr>)}</tbody></table></div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between"><div><h2 className="font-bold">Planilha técnica — acessórios</h2><p className="text-xs text-slate-500">Pode adicionar e substituir códigos sem sair desta tela.</p></div><button onClick={adicionarAcessorio} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold"><Plus size={14}/>Adicionar</button></div>
            <div className="max-h-80 overflow-auto"><table className="w-full text-xs"><thead className="sticky top-0 bg-slate-100"><tr><th className="p-2 text-left">Código</th><th className="p-2 text-left">Descrição</th><th className="p-2">Qtd. observada</th><th className="p-2">Fórmula</th><th className="p-2">Condição</th><th className="p-2">Status</th><th></th></tr></thead><tbody>{rascunho.acessorios.map((a,i)=><tr key={i} className="border-t"><td className="p-1"><input value={a.codigo} onChange={e=>atualizarAcessorio(i,{codigo:e.target.value})} className="w-28 rounded border px-2 py-1.5"/></td><td className="p-1"><input value={a.descricao||''} onChange={e=>atualizarAcessorio(i,{descricao:e.target.value})} className="w-full rounded border px-2 py-1.5"/></td><td className="p-1"><input type="number" step="0.001" value={a.quantidade_referencia ?? ''} onChange={e=>atualizarAcessorio(i,{quantidade_referencia:e.target.value ? Number(e.target.value) : undefined})} className="w-24 rounded border px-2 py-1.5"/></td><td className="p-1"><input value={a.formula_quantidade||""} onChange={e=>atualizarAcessorio(i,{formula_quantidade:e.target.value})} className="w-28 rounded border px-2 py-1.5"/></td><td className="p-1"><textarea defaultValue={JSON.stringify(a.condicao_ativa||{})} onBlur={e=>atualizarCondicaoAcessorio(i,e.target.value)} className="h-14 w-40 rounded border px-2 py-1 font-mono"/></td><td className="p-1"><select value={a.status||"referencia"} onChange={e=>atualizarAcessorio(i,{status:e.target.value as AcessorioFormulaCorte["status"]})} className="rounded border px-1 py-1"><option value="referencia">Referência</option><option value="em_validacao">Em validação</option><option value="validada">Validada</option></select></td><td><button onClick={()=>setRascunho(prev=>prev?{...prev,acessorios:prev.acessorios.filter((_,x)=>x!==i)}:prev)}><Trash2 size={14} className="text-red-500"/></button></td></tr>)}</tbody></table></div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 font-bold">Acessórios da simulação atual</h2>
            <div className="max-h-80 overflow-auto"><table className="w-full text-xs"><thead className="sticky top-0 bg-slate-100"><tr><th className="p-2 text-left">Código</th><th className="p-2 text-left">Descrição</th><th className="p-2 text-right">Qtd.</th></tr></thead><tbody>{(simulacao?.acessorios||[]).map((a,i)=><tr key={`${a.codigo}-${i}`} className="border-t"><td className="p-2 font-semibold">{a.codigo}</td><td className="p-2">{a.descricao}<div className="text-[10px] text-amber-700">{a.desenho ? "Desenho disponível" : "Desenho pendente"}</div>{a.observacao&&<div className="text-[10px] text-amber-600">{a.observacao}</div>}</td><td className="p-2 text-right">{a.quantidade ?? "Consumo pendente"} {a.unidade}</td></tr>)}</tbody></table></div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="font-bold">Custo técnico mestre · Sob Medida</h2>
          <p className="mt-1 text-xs text-slate-500">Somente custo real do produto mestre; preço e margem do Balcão não entram nesta simulação.</p>
          <div className="mt-3 flex flex-wrap gap-3 text-xs"><span>Custo técnico conhecido: {custoParcial.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</span><b>{custosPendentes} custos ou conversões pendentes</b><span>Perfis por barra exigem aproveitamento comprovado.</span></div>
          <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_2fr_auto]">
            <label className="text-xs">Produto mestre<input list="catalogo-produtos-mestres" value={codigoCusto} onChange={e=>setCodigoCusto(e.target.value)} className="mt-1 w-full rounded border px-2 py-2"/></label>
            <label className="text-xs">Custo real<input value={valorCusto} onChange={e=>setValorCusto(e.target.value)} className="mt-1 w-full rounded border px-2 py-2"/></label>
            <label className="text-xs">Origem do custo<input value={origemCusto} onChange={e=>setOrigemCusto(e.target.value)} className="mt-1 w-full rounded border px-2 py-2"/></label>
            <button onClick={salvarCustoMestre} className="self-end rounded bg-blue-600 px-3 py-2 text-xs font-semibold text-white">Atualizar mestre</button>
          </div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><h2 className="font-bold">Testes da receita</h2><button onClick={executarTestes} className="rounded bg-blue-600 px-3 py-2 text-xs font-semibold text-white">Testar 2000×2200</button></div><p className="mt-2 text-sm">{resultadoTeste || 'Teste obrigatório disponível para a receita em edição.'}</p></section>

        <div className="flex justify-end gap-2 pb-8"><button onClick={simular} className="rounded-xl border border-blue-200 bg-white px-5 py-2.5 text-sm font-semibold text-blue-700">Salvar e testar depois</button><button onClick={salvar} disabled={salvando} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white">Salvar cadastro</button></div>
      </div>
    </main>
  )
}
