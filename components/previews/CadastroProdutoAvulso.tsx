'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { ImagePlus, Plus, X } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'
import { uploadFotoProduto } from '@/lib/upload'
import { acrescimoSobreCustoPorPreco, arredondarMoeda, margemRealPorPreco, precoPorAcrescimoSobreCusto } from '@/lib/precificacaoBalcao'

export type ProdutoAvulsoCriado = {
  id: string; codigo: string; nome: string; descricao: string; categoria: string
  unidade: string; linha: string | null; fotoUrl: string | null; fotoCandidataUrl: string | null
  preco: number | null; precoPromocional: number | null
}
type Formulario = {
  codigo: string; nome: string; categoria: string; unidade: string
  custo: string; modoPreco: 'percentual' | 'direto'; acrescimo: string; preco: string
  descricao: string; pesoKgM: string; tamanhoBarraMm: string
}
const vazio: Formulario = {
  codigo: '', nome: '', categoria: 'produto', unidade: 'unidade',
  custo: '', modoPreco: 'direto', acrescimo: '', preco: '',
  descricao: '', pesoKgM: '', tamanhoBarraMm: '6000',
}
function numeroTexto(valor: string): number | null {
  if (!valor.trim()) return null
  const numero = Number(valor.trim().replace(',', '.'))
  return Number.isFinite(numero) ? numero : null
}
const moeda = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const categorias = [
  { valor: 'produto', nome: 'Produto' }, { valor: 'acessorio', nome: 'Acessório' },
  { valor: 'perfil', nome: 'Perfil' }, { valor: 'vidro', nome: 'Vidro' },
  { valor: 'porta_janela_padrao', nome: 'Produto pronto' }, { valor: 'kit', nome: 'Kit' },
  { valor: 'outro', nome: 'Outro' },
]
const campo = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none'

export default function CadastroProdutoAvulso({ onCriado }: { onCriado: (produto: ProdutoAvulsoCriado) => void }) {
  const [permitido, setPermitido] = useState(false)
  const [aberto, setAberto] = useState(false)
  const [form, setForm] = useState<Formulario>(vazio)
  const [foto, setFoto] = useState<File | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  useEffect(() => {
    let ativo = true
    void (async () => {
      try {
        const token = await tokenAtual()
        if (!token) return
        const res = await fetch('/api/previews/produtos', {
          headers: { Authorization: 'Bearer ' + token }, cache: 'no-store',
        })
        const json = await res.json()
        if (ativo) setPermitido(res.ok && json.podeCriar === true)
      } catch { if (ativo) setPermitido(false) }
    })()
    return () => { ativo = false }
  }, [])

  const custo = numeroTexto(form.custo)
  const acrescimo = numeroTexto(form.acrescimo)
  const precoFinal = form.modoPreco === 'percentual'
    ? arredondarMoeda(precoPorAcrescimoSobreCusto(custo, acrescimo))
    : numeroTexto(form.preco)
  const margemReal = custo !== null && precoFinal !== null ? margemRealPorPreco(custo, precoFinal) : null
  const acrescimoEquivalente = custo !== null && precoFinal !== null
    ? acrescimoSobreCustoPorPreco(custo, precoFinal) : null

  if (!permitido) return null

  const alterar = (key: keyof Formulario, valor: string) => {
    setForm(anterior => ({
      ...anterior, [key]: valor,
      ...(key === 'categoria' ? {
        unidade: valor === 'perfil' ? 'barra' : anterior.unidade === 'barra' ? 'unidade' : anterior.unidade,
      } : {}),
    }))
    setErro('')
  }

  async function cadastrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (salvando) return
    setErro('')
    setSucesso('')
    if (!form.nome.trim() || !form.unidade.trim() || custo === null || custo <= 0 || custo > 100000000) {
      setErro('Informe nome, unidade e custo do produto maior que zero.'); return
    }
    if (form.modoPreco === 'percentual' && (acrescimo === null || acrescimo < 0)) {
      setErro('Informe um acréscimo sobre o custo igual ou maior que zero.'); return
    }
    if (precoFinal === null || precoFinal <= 0 || precoFinal > 100000000) {
      setErro('Informe um preço de venda válido e maior que zero.'); return
    }
    if (['perfil', 'acessorio'].includes(form.categoria) && !foto) {
      setErro('Cadastre a foto do perfil ou acessório.'); return
    }
    if (form.categoria === 'perfil' && (!(Number(form.pesoKgM.replace(',', '.')) > 0)
      || !(Number(form.tamanhoBarraMm) > 0))) {
      setErro('Informe peso em kg/m e comprimento da barra para o perfil.'); return
    }
    if (foto && (!foto.type.startsWith('image/') || foto.size > 25 * 1024 * 1024)) {
      setErro('Escolha uma imagem válida de até 25 MB.'); return
    }
    setSalvando(true)
    try {
      const token = await tokenAtual()
      if (!token) throw Error('Sessão expirada. Entre novamente no Atlas One.')
      const fotoUrl = foto ? await uploadFotoProduto(foto) : null
      if (foto && !fotoUrl) throw Error('Falha no envio da foto. O produto não foi cadastrado.')
      const response = await fetch('/api/previews/produtos', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form, custo, preco: precoFinal, fotoUrl,
          acrescimo: form.modoPreco === 'percentual' ? acrescimo : null,
          pesoKgM: form.pesoKgM ? Number(form.pesoKgM.replace(',', '.')) : null,
          tamanhoBarraMm: form.tamanhoBarraMm ? Number(form.tamanhoBarraMm) : null,
        }),
      })
      const dados = await response.json()
      if (!response.ok || !dados.produto) throw Error(dados.error || 'Falha ao cadastrar.')
      onCriado(dados.produto as ProdutoAvulsoCriado)
      setSucesso('Produto cadastrado no banco de dados e adicionado aos itens.')
      setForm(vazio)
      setFoto(null)
      setAberto(false)
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível cadastrar o produto.')
    } finally {
      setSalvando(false)
    }
  }

  return <div className="mt-3">
    <button type="button" onClick={() => { setAberto(valor => !valor); setErro(''); setSucesso('') }}
      className="inline-flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800">
      {aberto ? <X size={15}/> : <Plus size={15}/>}
      {aberto ? 'Fechar cadastro' : 'Cadastrar produto novo'}
    </button>
    {sucesso && <p role="status" className="mt-2 text-xs font-semibold text-emerald-700">{sucesso}</p>}
    {aberto && <form onSubmit={cadastrar} className="mt-3 space-y-3 rounded-xl border border-blue-200 bg-blue-50/50 p-3">
      <p className="text-sm font-bold text-slate-800">Novo produto no catálogo</p>
      <p className="text-xs text-slate-600">Cadastro restrito ao Master ou à permissão Cadastros → Produtos → Criar.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-slate-700">Código (opcional)
          <input className={campo+' mt-1'} maxLength={60} value={form.codigo} onChange={e => alterar('codigo', e.target.value)} placeholder="Gerado se vazio"/>
        </label>
        <label className="text-xs font-semibold text-slate-700">Nome do produto *
          <input className={campo+' mt-1'} maxLength={200} required value={form.nome} onChange={e => alterar('nome', e.target.value)}/>
        </label>
        <label className="text-xs font-semibold text-slate-700">Categoria *
          <select className={campo+' mt-1'} value={form.categoria} onChange={e => alterar('categoria', e.target.value)}>
            {categorias.map(c => <option key={c.valor} value={c.valor}>{c.nome}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-700">Unidade *
          <input className={campo+' mt-1'} maxLength={40} required value={form.unidade} onChange={e => alterar('unidade', e.target.value)}/>
        </label>
        <label className="text-xs font-semibold text-slate-700">{form.categoria === 'perfil' ? 'Custo de referência para venda (R$) *' : 'Custo do produto (R$) *'}
          <input className={campo+' mt-1'} inputMode="decimal" required value={form.custo} onChange={e => alterar('custo', e.target.value)} placeholder="Ex.: 100,00"/>
        </label>
        {form.categoria === 'perfil' && <p className="text-[11px] text-amber-800 sm:col-span-2">
          Para perfis, este custo serve apenas de referência para calcular o preço de venda.
          O custo técnico de fabricação continua calculado pelo peso e pelo alumínio, sem alteração.
        </p>
        <label className="text-xs font-semibold text-slate-700">Definir preço por *
          <select className={campo+' mt-1'} value={form.modoPreco} onChange={e => alterar('modoPreco', e.target.value)}>
            <option value="direto">Informar preço de venda</option>
            <option value="percentual">Acréscimo sobre o custo (%)</option>
          </select>
        </label>
        {form.modoPreco === 'percentual' ? (
          <label className="text-xs font-semibold text-slate-700">Acréscimo sobre o custo (%) *
            <input className={campo+' mt-1'} inputMode="decimal" required value={form.acrescimo} onChange={e => alterar('acrescimo', e.target.value)} placeholder="Ex.: 30"/>
          </label>
        ) : (
          <label className="text-xs font-semibold text-slate-700">Preço de venda (R$) *
            <input className={campo+' mt-1'} inputMode="decimal" required value={form.preco} onChange={e => alterar('preco', e.target.value)} placeholder="Ex.: 130,00"/>
          </label>
        )}
        <div className="sm:col-span-2 rounded-lg border border-blue-200 bg-white p-3 text-xs text-slate-700">
          <p className="text-sm font-bold text-slate-800">
            Preço de venda calculado: {precoFinal !== null && precoFinal > 0 ? moeda(precoFinal) : '—'}
          </p>
          <p className="mt-1 text-slate-500">
            {form.modoPreco === 'percentual'
              ? 'Percentual aplicado sobre o custo. Ex.: R$ 100 + 30% = R$ 130.'
              : 'O preço digitado será salvo no catálogo e utilizado nesta venda ou orçamento.'}
          </p>
          {acrescimoEquivalente !== null && (
            <p className="mt-1">Acréscimo equivalente sobre custo: {acrescimoEquivalente.toFixed(2)}%</p>
          )}
          {margemReal !== null && (
            <p className={margemReal < 0 ? 'mt-1 font-semibold text-amber-700' : 'mt-1'}>
              {margemReal < 0 ? 'Atenção: preço de venda abaixo do custo.' : 'Margem real estimada: ' + margemReal.toFixed(2) + '%'}
            </p>
          )}
        </div>
        <label className="text-xs font-semibold text-slate-700">Foto {['perfil','acessorio'].includes(form.categoria) ? '*' : '(opcional)'}
          <span className={campo+' mt-1 flex items-center gap-2 text-slate-600'}>
            <ImagePlus size={17}/>{foto ? foto.name : 'Escolher imagem'}
          </span>
          <input type="file" accept="image/*" className="mt-1 block w-full text-xs" onChange={e => setFoto(e.target.files?.[0] || null)}/>
        </label>
        {form.categoria === 'perfil' && <>
          <label className="text-xs font-semibold text-slate-700">Peso do perfil (kg/m) *
            <input className={campo+' mt-1'} inputMode="decimal" value={form.pesoKgM} onChange={e => alterar('pesoKgM', e.target.value)} placeholder="Ex.: 0,850"/>
          </label>
          <label className="text-xs font-semibold text-slate-700">Comprimento da barra (mm) *
            <input className={campo+' mt-1'} inputMode="numeric" value={form.tamanhoBarraMm} onChange={e => alterar('tamanhoBarraMm', e.target.value)}/>
          </label>
        </>}
        <label className="text-xs font-semibold text-slate-700 sm:col-span-2">Descrição (opcional)
          <textarea className={campo+' mt-1'} rows={2} maxLength={2000} value={form.descricao} onChange={e => alterar('descricao', e.target.value)}/>
        </label>
      </div>
      {erro && <p role="alert" className="text-xs font-semibold text-red-700">{erro}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={salvando} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
          {salvando ? 'Cadastrando...' : 'Salvar produto e adicionar'}
        </button>
        <button type="button" disabled={salvando} onClick={() => setAberto(false)} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button>
      </div>
    </form>}
  </div>
}
