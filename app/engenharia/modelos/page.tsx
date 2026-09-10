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

type Reforco = 'sem_reforco' | 'interno' | 'externo' | 'interno_externo'
type MaoLargura = 'comum' | 'largo'
type Contramarco = 'sem' | 'cm200'
type Fechamento = 'fechadura' | 'concha'

type PerfilCalculado = { codigo: string; descricao: string; corte: number; quantidade: number; eixo: 'L' | 'H' }
type AcessorioCalculado = { codigo: string; descricao: string; quantidade: number; unidade: string; observacao?: string }

type Simulacao = {
  perfis: PerfilCalculado[]
  vidro: { descricao: string; largura: number; altura: number; quantidade: number }
  acessorios: AcessorioCalculado[]
  nivel: 'validado' | 'em_validacao'
  aviso: string
}

const ROTULO_REFORCO: Record<Reforco, string> = {
  sem_reforco: 'Sem reforço',
  interno: 'Reforço interno',
  externo: 'Reforço externo',
  interno_externo: 'Reforço interno + externo',
}

const MAPA_MAO: Record<MaoLargura, Record<Reforco, [string, string]>> = {
  comum: {
    sem_reforco: ['SU040', 'SU041'],
    interno: ['SU047', 'SU041'],
    externo: ['SU040', 'SU049'],
    interno_externo: ['SU047', 'SU049'],
  },
  largo: {
    sem_reforco: ['SU243', 'SU242'],
    interno: ['SU289', 'SU242'],
    externo: ['SU243', 'SU290'],
    interno_externo: ['SU289', 'SU290'],
  },
}

function n(v: string, fallback: number) {
  const valor = Number(String(v).replace(',', '.'))
  return Number.isFinite(valor) && valor > 0 ? valor : fallback
}

function clonar<T>(v: T): T { return JSON.parse(JSON.stringify(v)) as T }

function calcularPc2(
  largura: number,
  altura: number,
  contramarco: Contramarco,
  mao: MaoLargura,
  reforco: Reforco,
  fechamento: Fechamento,
): Simulacao {
  if (fechamento === 'concha') {
    throw new Error('A configuração com concha ainda precisa de um relatório W.Vetro limpo antes de entrar no cálculo automático.')
  }

  const comCm = contramarco === 'cm200'
  const larga = mao === 'largo'
  const [maoInterno, maoExterno] = MAPA_MAO[mao][reforco]

  const perfis: PerfilCalculado[] = []
  if (comCm) {
    perfis.push(
      { codigo: 'CM200', descricao: 'Contramarco 26 mm', corte: largura - 48, quantidade: 1, eixo: 'L' },
      { codigo: 'CM200', descricao: 'Contramarco 26 mm', corte: altura - 24, quantidade: 2, eixo: 'H' },
      { codigo: 'MP347', descricao: 'Arremate 37 mm / face interna', corte: largura + 20, quantidade: 1, eixo: 'L' },
      { codigo: 'MP347', descricao: 'Arremate 37 mm / face interna', corte: altura + 10, quantidade: 2, eixo: 'H' },
    )
  }

  const su001 = comCm ? largura - 54 : largura - 30
  const su007 = comCm ? altura - 16 : altura - 4
  const su008 = comCm ? altura - 29 : altura - 17
  const montante = comCm ? altura - 46 : altura - 34
  const bagueteVertical = comCm ? altura - 197 : altura - 185
  let travessa = Math.floor(largura / 2 - (comCm ? 95 : 83))
  let vidroL = Math.floor(largura / 2 - (comCm ? 101 : 89))
  const vidroH = altura - (comCm ? 179 : 167)
  let nivel: Simulacao['nivel'] = 'validado'
  let aviso = 'Geometria comparada com casos W.Vetro enviados e teste cego de medidas.'

  if (larga) {
    if (!comCm) {
      throw new Error('Mão-de-amigo larga sem contramarco ainda não tem segundo caso dimensional para calcular com segurança.')
    }
    travessa -= 11
    vidroL -= 11
    nivel = 'em_validacao'
    aviso = 'Perfis largos e códigos foram confirmados; a influência dimensional de 11 mm ainda precisa de um segundo tamanho para virar regra validada.'
  }

  perfis.push(
    { codigo: 'SU001', descricao: 'Marco superior / correr 2', corte: su001, quantidade: 1, eixo: 'L' },
    { codigo: 'TMC', descricao: 'Trilho macarrão de embutir', corte: su001, quantidade: 2, eixo: 'L' },
    { codigo: 'SU007', descricao: 'Marco lateral / correr 2', corte: su007, quantidade: 2, eixo: 'H' },
    { codigo: 'SU008', descricao: 'Mata junta / complemento do marco', corte: su008, quantidade: 2, eixo: 'H' },
    { codigo: 'SU053', descricao: 'Travessa da folha', corte: travessa, quantidade: 2, eixo: 'L' },
    { codigo: 'SU225', descricao: 'Travessa inferior da folha', corte: travessa, quantidade: 2, eixo: 'L' },
    { codigo: 'SU280', descricao: 'Montante lateral móvel | reforço de aba', corte: montante, quantidade: 2, eixo: 'H' },
    { codigo: maoInterno, descricao: 'Montante mão-de-amigo interno', corte: montante, quantidade: 1, eixo: 'H' },
    { codigo: maoExterno, descricao: 'Montante mão-de-amigo externo', corte: montante, quantidade: 1, eixo: 'H' },
    { codigo: 'SU102', descricao: 'Baguete horizontal', corte: travessa, quantidade: 4, eixo: 'L' },
    { codigo: 'SU102', descricao: 'Baguete vertical', corte: bagueteVertical, quantidade: 4, eixo: 'H' },
  )

  const tampa = reforco === 'interno_externo' ? 4 : reforco === 'sem_reforco' ? 0 : 2
  const acessorios: AcessorioCalculado[] = [
    ...(comCm ? [
      { codigo: 'CHU838', descricao: 'Chumbador de alumínio multiuso', quantidade: 15, unidade: 'UN' },
      { codigo: 'NYL-10002', descricao: 'Conexão nylon para contramarco CM200', quantidade: 2, unidade: 'UN' },
      { codigo: 'NYL190', descricao: 'Botão nylon fixação do arremate', quantidade: 15, unidade: 'UN' },
      { codigo: 'PAR1025', descricao: 'Parafuso AA CP 4,2 x 16 inox', quantidade: 15, unidade: 'UN' },
    ] : [
      { codigo: 'BUC755', descricao: 'Bucha de nylon S-8', quantidade: 14, unidade: 'UN' },
      { codigo: 'PAR1037', descricao: 'Parafuso AA CP 4,8 x 50 inox', quantidade: 14, unidade: 'UN' },
    ]),
    { codigo: 'CON409', descricao: 'Contrafecho lateral da fechadura', quantidade: 2, unidade: 'UN' },
    { codigo: 'FRA820', descricao: 'Fechadura bico de papagaio', quantidade: 2, unidade: 'UN' },
    { codigo: 'NYL042', descricao: 'Botão tampa furo 3/8 nylon', quantidade: 8, unidade: 'UN' },
    { codigo: 'NYL332', descricao: 'Guia deslizante com placa', quantidade: 8, unidade: 'UN' },
    { codigo: 'NYL335', descricao: 'Vedação superior', quantidade: 1, unidade: 'UN' },
    ...(tampa ? [{ codigo: 'NYL357', descricao: 'Tampa da mão de amigo', quantidade: tampa, unidade: 'UN' }] : []),
    { codigo: 'PAR1023', descricao: 'Parafuso AA CP 3,9 x 9,5 inox', quantidade: 12, unidade: 'UN' },
    { codigo: 'PAR435', descricao: 'Parafuso AA CP PP 4,8 x 32 inox', quantidade: 16, unidade: 'UN' },
    { codigo: 'RPCS100', descricao: 'Roldana simples côncava Suprema 100 kg', quantidade: 4, unidade: 'UN' },
  ]

  if (largura === 2137 && altura === 2419 && comCm) {
    acessorios.push(
      { codigo: 'FIT206', descricao: 'Fita vedação 5 x 6 mm', quantidade: 2.373, unidade: 'MT', observacao: 'referência W.Vetro 2137x2419' },
      { codigo: 'FIT212', descricao: 'Fita vedação 5 x 8 mm', quantidade: 8.452, unidade: 'MT', observacao: 'referência W.Vetro 2137x2419' },
      { codigo: 'FIT246', descricao: 'Fita vedadora 7,6 x 6 mm', quantidade: 9.492, unidade: 'MT', observacao: 'referência W.Vetro 2137x2419' },
      { codigo: 'GUA171', descricao: 'Guarnição espuma 11 x 3,2', quantidade: 3.8492, unidade: 'MT', observacao: 'referência W.Vetro 2137x2419' },
      { codigo: 'GUA258', descricao: 'Guarnição espuma 11 x 4,8', quantidade: 9.492, unidade: 'MT', observacao: 'referência W.Vetro 2137x2419' },
      { codigo: 'GUA259', descricao: 'Guarnição cunha vidro 12 x 4,2', quantidade: 13.3412, unidade: 'MT', observacao: 'referência W.Vetro 2137x2419' },
      { codigo: 'SIL-PU', descricao: 'Silicone de poliuretano', quantidade: 1.50267, unidade: 'TB', observacao: 'referência W.Vetro 2137x2419' },
    )
  }

  return {
    perfis,
    vidro: { descricao: 'Incolor 06mm - Temperado', largura: vidroL, altura: vidroH, quantidade: 2 },
    acessorios,
    nivel,
    aviso,
  }
}

function imprimirTabela(titulo: string, cabecalhos: string[], linhas: Array<Array<string | number>>) {
  const popup = window.open('', '_blank', 'width=980,height=760')
  if (!popup) return
  const th = cabecalhos.map(c => `<th>${c}</th>`).join('')
  const tr = linhas.map(l => `<tr>${l.map(v => `<td>${v}</td>`).join('')}</tr>`).join('')
  popup.document.write(`<!doctype html><html><head><title>${titulo}</title><style>body{font-family:Arial;padding:28px;color:#0f172a}h1{font-size:22px}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #cbd5e1;padding:8px;text-align:left}th{background:#f1f5f9}@media print{button{display:none}}</style></head><body><h1>${titulo}</h1><p>Atlas One · Engenharia</p><table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`)
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
  const [largura, setLargura] = useState('2137')
  const [altura, setAltura] = useState('2419')
  const [contramarco, setContramarco] = useState<Contramarco>('cm200')
  const [mao, setMao] = useState<MaoLargura>('largo')
  const [reforco, setReforco] = useState<Reforco>('interno_externo')
  const [fechamento, setFechamento] = useState<Fechamento>('fechadura')
  const [simulacao, setSimulacao] = useState<Simulacao | null>(null)
  const [buscaPerfil, setBuscaPerfil] = useState('')

  useEffect(() => {
    void (async () => {
      const [formulas, catalogo] = await Promise.all([listarTodasFormulasCorte(), listarProdutosTecnicos()])
      const alvo = formulas.find(f => f.configuracao_chave === 'pc2_suprema_editor_v1') || null
      setFormula(alvo)
      setRascunho(alvo ? clonar(alvo) : null)
      setProdutos(catalogo)
      setCarregando(false)
      if (alvo) {
        try { setSimulacao(calcularPc2(2137, 2419, 'cm200', 'largo', 'interno_externo', 'fechadura')) } catch {}
      }
    })()
  }, [])

  const perfisCatalogo = useMemo(() => produtos.filter(p => p.categoria === 'perfil' && p.codigo), [produtos])
  const descricaoPesquisa = rascunho?.metadados_editor.descricao_pesquisa || ''
  const descricaoOrcamento = rascunho?.metadados_editor.descricao_orcamento || ''

  function simular() {
    setErro('')
    setMensagem('')
    try {
      const resultado = calcularPc2(n(largura, 2137), n(altura, 2419), contramarco, mao, reforco, fechamento)
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

  function adicionarAcessorio() {
    setRascunho(prev => prev ? { ...prev, acessorios: [...prev.acessorios, { codigo: '', descricao: 'Novo acessório', quantidade_referencia: 1, status: 'referencia' }] } : prev)
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

  if (carregando) return <div className="grid min-h-[65vh] place-items-center"><Loader2 className="animate-spin text-blue-600" /></div>
  if (!formula || !rascunho) return <div className="p-8 text-sm text-red-700">Modelo PC2 Suprema de teste não encontrado na base.</div>

  return (
    <main className="min-h-screen bg-slate-50 p-3 md:p-6">
      <datalist id="catalogo-perfis-modelo">{perfisCatalogo.map(p => <option key={p.id} value={p.codigo || ''}>{p.nome}</option>)}</datalist>
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
              <label className="text-xs font-semibold text-slate-600">Código<input value="SUCB-PC2-01-EF" readOnly className="mt-1 w-full rounded-lg border bg-slate-50 px-3 py-2 text-sm"/></label>
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
              <label className="text-xs font-semibold">Folga largura<input value={rascunho.metadados_editor.folga_largura ?? 4} onChange={e=>setRascunho(p=>p?{...p,metadados_editor:{...p.metadados_editor,folga_largura:n(e.target.value,4)}}:p)} className="mt-1 w-full rounded-lg border px-3 py-2"/></label>
              <label className="text-xs font-semibold">Folga altura<input value={rascunho.metadados_editor.folga_altura ?? 4} onChange={e=>setRascunho(p=>p?{...p,metadados_editor:{...p.metadados_editor,folga_altura:n(e.target.value,4)}}:p)} className="mt-1 w-full rounded-lg border px-3 py-2"/></label>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 font-bold">Variáveis do modelo</h2>
            <div className="grid gap-2 md:grid-cols-2">
              <label className="text-xs font-semibold">Contramarco<select value={contramarco} onChange={e=>setContramarco(e.target.value as Contramarco)} className="mt-1 w-full rounded-lg border px-3 py-2"><option value="sem">Sem contramarco</option><option value="cm200">CM200 + arremate interno</option></select></label>
              <label className="text-xs font-semibold">Modo de fechamento<select value={fechamento} onChange={e=>setFechamento(e.target.value as Fechamento)} className="mt-1 w-full rounded-lg border px-3 py-2"><option value="fechadura">Fechadura</option><option value="concha">Concha — falta validar</option></select></label>
              <label className="text-xs font-semibold">Mão-de-amigo<select value={mao} onChange={e=>setMao(e.target.value as MaoLargura)} className="mt-1 w-full rounded-lg border px-3 py-2"><option value="comum">Perfil comum</option><option value="largo">Perfil largo</option></select></label>
              <label className="text-xs font-semibold">Reforço<select value={reforco} onChange={e=>setReforco(e.target.value as Reforco)} className="mt-1 w-full rounded-lg border px-3 py-2"><option value="sem_reforco">Sem reforço</option><option value="interno">Interno</option><option value="externo">Externo</option><option value="interno_externo">Interno + externo</option></select></label>
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
            <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">Perfis calculados / Plano de corte</h2><button onClick={()=>simulacao&&imprimirTabela('Plano de corte — Porta 2F Suprema',['Código','Descrição','Corte','Qtd.','Eixo'],simulacao.perfis.map(p=>[p.codigo,p.descricao,p.corte,p.quantidade,p.eixo]))} className="text-blue-700"><Printer size={17}/></button></div>
            <div className="max-h-96 overflow-auto"><table className="w-full text-xs"><thead className="sticky top-0 bg-slate-100"><tr><th className="p-2 text-left">Código</th><th className="p-2 text-left">Descrição</th><th className="p-2 text-right">Corte</th><th className="p-2 text-right">Qtd.</th></tr></thead><tbody>{(simulacao?.perfis||[]).map((p,i)=><tr key={`${p.codigo}-${i}`} className="border-t"><td className="p-2 font-semibold">{p.codigo}</td><td className="p-2">{p.descricao}</td><td className="p-2 text-right">{p.corte}</td><td className="p-2 text-right">{p.quantidade}</td></tr>)}</tbody></table></div>
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex justify-between"><h2 className="font-bold">Vidros</h2><button onClick={()=>simulacao&&imprimirTabela('Lista de vidros',['Descrição','Largura','Altura','Qtd.'],[[simulacao.vidro.descricao,simulacao.vidro.largura,simulacao.vidro.altura,simulacao.vidro.quantidade]])}><Printer size={17}/></button></div>{simulacao&&<div className="mt-3 grid grid-cols-4 gap-2 text-xs"><div className="col-span-4 font-semibold">{simulacao.vidro.descricao}</div><div>L: {simulacao.vidro.largura}</div><div>A: {simulacao.vidro.altura}</div><div>Qtd: {simulacao.vidro.quantidade}</div></div>}</div>
            <div className={`rounded-2xl border p-4 shadow-sm ${simulacao?.nivel==='validado'?'border-emerald-200 bg-emerald-50':'border-amber-200 bg-amber-50'}`}><div className="flex gap-2"><CheckCircle2 size={18}/><div><b className="text-sm">{simulacao?.nivel==='validado'?'Cálculo validado':'Cálculo em validação'}</b><p className="mt-1 text-xs">{simulacao?.aviso||'Clique em Simular.'}</p></div></div></div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex justify-between"><h2 className="font-bold">Impressão</h2><FileDown size={18}/></div>
            <div className="space-y-2 text-sm">
              <button onClick={()=>simulacao&&imprimirTabela('Lista de perfis',['Código','Descrição','Corte','Qtd.'],simulacao.perfis.map(p=>[p.codigo,p.descricao,p.corte,p.quantidade]))} className="w-full rounded-lg border px-3 py-2 text-left">Imprimir lista de perfis</button>
              <button onClick={()=>simulacao&&imprimirTabela('Lista de acessórios',['Código','Descrição','Qtd.','UN'],simulacao.acessorios.map(a=>[a.codigo,a.descricao,a.quantidade,a.unidade]))} className="w-full rounded-lg border px-3 py-2 text-left">Imprimir acessórios</button>
              <button onClick={()=>simulacao&&imprimirTabela('Lista de vidros',['Descrição','Largura','Altura','Qtd.'],[[simulacao.vidro.descricao,simulacao.vidro.largura,simulacao.vidro.altura,simulacao.vidro.quantidade]])} className="w-full rounded-lg border px-3 py-2 text-left">Imprimir vidros</button>
              <button onClick={()=>simulacao&&imprimirTabela('Plano de corte',['Código','Descrição','Corte','Qtd.','Eixo'],simulacao.perfis.map(p=>[p.codigo,p.descricao,p.corte,p.quantidade,p.eixo]))} className="w-full rounded-lg border px-3 py-2 text-left">Imprimir plano de corte</button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-bold">Planilha técnica — perfis</h2><p className="text-xs text-slate-500">Edição tipo Excel: código, descrição, fórmula e quantidade. Use para montar novas linhas/modelos.</p></div><button onClick={adicionarPeca} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold"><Plus size={14}/>Adicionar perfil</button></div>
          <div className="overflow-x-auto"><table className="min-w-[900px] w-full text-xs"><thead className="bg-slate-100"><tr><th className="p-2 text-left">Código / grupo</th><th className="p-2 text-left">Descrição</th><th className="p-2 text-left">Fórmula</th><th className="p-2">Qtd.</th><th className="p-2">Ação</th></tr></thead><tbody>{rascunho.pecas.map((p,i)=><tr className="border-t" key={i}><td className="p-1"><input list="catalogo-perfis-modelo" value={p.codigo||p.grupo||''} onChange={e=>atualizarPeca(i,{codigo:e.target.value,grupo:undefined})} className="w-full rounded border px-2 py-1.5"/></td><td className="p-1"><input value={p.descricao||''} onChange={e=>atualizarPeca(i,{descricao:e.target.value})} className="w-full rounded border px-2 py-1.5"/></td><td className="p-1"><input value={p.formula||''} onChange={e=>atualizarPeca(i,{formula:e.target.value})} className="w-full rounded border px-2 py-1.5 font-mono"/></td><td className="p-1"><input type="number" value={p.quantidade||1} onChange={e=>atualizarPeca(i,{quantidade:Number(e.target.value)||1})} className="w-20 rounded border px-2 py-1.5"/></td><td className="p-1 text-center"><button onClick={()=>setRascunho(prev=>prev?{...prev,pecas:prev.pecas.filter((_,x)=>x!==i)}:prev)}><Trash2 size={15} className="text-red-500"/></button></td></tr>)}</tbody></table></div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between"><div><h2 className="font-bold">Planilha técnica — acessórios</h2><p className="text-xs text-slate-500">Pode adicionar e substituir códigos sem sair desta tela.</p></div><button onClick={adicionarAcessorio} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold"><Plus size={14}/>Adicionar</button></div>
            <div className="max-h-80 overflow-auto"><table className="w-full text-xs"><thead className="sticky top-0 bg-slate-100"><tr><th className="p-2 text-left">Código</th><th className="p-2 text-left">Descrição</th><th className="p-2">Qtd.</th><th></th></tr></thead><tbody>{rascunho.acessorios.map((a,i)=><tr key={i} className="border-t"><td className="p-1"><input value={a.codigo} onChange={e=>atualizarAcessorio(i,{codigo:e.target.value})} className="w-28 rounded border px-2 py-1.5"/></td><td className="p-1"><input value={a.descricao||''} onChange={e=>atualizarAcessorio(i,{descricao:e.target.value})} className="w-full rounded border px-2 py-1.5"/></td><td className="p-1"><input type="number" step="0.001" value={a.quantidade_referencia||1} onChange={e=>atualizarAcessorio(i,{quantidade_referencia:Number(e.target.value)||0})} className="w-24 rounded border px-2 py-1.5"/></td><td><button onClick={()=>setRascunho(prev=>prev?{...prev,acessorios:prev.acessorios.filter((_,x)=>x!==i)}:prev)}><Trash2 size={14} className="text-red-500"/></button></td></tr>)}</tbody></table></div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 font-bold">Acessórios da simulação atual</h2>
            <div className="max-h-80 overflow-auto"><table className="w-full text-xs"><thead className="sticky top-0 bg-slate-100"><tr><th className="p-2 text-left">Código</th><th className="p-2 text-left">Descrição</th><th className="p-2 text-right">Qtd.</th></tr></thead><tbody>{(simulacao?.acessorios||[]).map((a,i)=><tr key={`${a.codigo}-${i}`} className="border-t"><td className="p-2 font-semibold">{a.codigo}</td><td className="p-2">{a.descricao}{a.observacao&&<div className="text-[10px] text-amber-600">{a.observacao}</div>}</td><td className="p-2 text-right">{a.quantidade} {a.unidade}</td></tr>)}</tbody></table></div>
          </div>
        </section>

        <div className="flex justify-end gap-2 pb-8"><button onClick={simular} className="rounded-xl border border-blue-200 bg-white px-5 py-2.5 text-sm font-semibold text-blue-700">Salvar e testar depois</button><button onClick={salvar} disabled={salvando} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white">Salvar cadastro</button></div>
      </div>
    </main>
  )
}
