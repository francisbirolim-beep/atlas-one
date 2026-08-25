'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Calculator, ShieldAlert, Tag } from 'lucide-react'
import Link from 'next/link'
import { usuarioAtual } from '@/lib/auth'
import { listarProdutos, atualizarProduto, CATEGORIAS_PRODUTO, labelCategoriaProduto } from '@/lib/produtos'
import { Produto, CategoriaProduto } from '@/lib/tipos'
import { arredondarMoeda, margemRealPorPreco, precoPorMargemReal } from '@/lib/precificacaoBalcao'
import BuscaAtlasInput from '@/components/system/BuscaAtlasInput'
import { correspondeBuscaAtlas } from '@/lib/buscaAtlas'

type ProdutoPreco = Produto & { preco_minimo?: number | null; preco_promocional?: number | null; ultimo_preco_vendido?: number | null; ultimo_preco_vendido_em?: string | null }
type LinhaPreco = { custo: string; margem: string; preco: string; minimo: string; promocional: string }

function textoNumero(v: number | null | undefined) { return v == null ? '' : String(v) }
function numero(v: string): number | null { if (!v.trim()) return null; const n = Number(v.replace(',', '.')); return Number.isFinite(n) ? n : null }
function moeda(v: number | null | undefined) { if (v == null) return '—'; return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }

export default function PrecificacaoLote() {
  const [carregando, setCarregando] = useState(true)
  const [euSouMaster, setEuSouMaster] = useState<boolean | null>(null)
  const [produtos, setProdutos] = useState<ProdutoPreco[]>([])
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState<CategoriaProduto | 'todas'>('acessorio')
  const [somenteSemPreco, setSomenteSemPreco] = useState(false)
  const [linhas, setLinhas] = useState<Record<string, LinhaPreco>>({})
  const [salvandoId, setSalvandoId] = useState<string | null>(null)
  const [salvosIds, setSalvosIds] = useState<Set<string>>(new Set())
  const [erro, setErro] = useState('')

  useEffect(() => { carregar() }, [])
  async function carregar() {
    setCarregando(true)
    const me = await usuarioAtual(); setEuSouMaster(me?.role === 'master')
    if (me?.role === 'master') {
      const lista = await listarProdutos() as ProdutoPreco[]; setProdutos(lista)
      const mapa: Record<string, LinhaPreco> = {}
      lista.forEach(p => { mapa[p.id] = { custo: textoNumero(p.custo), margem: textoNumero(p.margem_percentual), preco: textoNumero(p.preco), minimo: textoNumero(p.preco_minimo), promocional: textoNumero(p.preco_promocional) } })
      setLinhas(mapa)
    }
    setCarregando(false)
  }

  const filtrados = useMemo(() => produtos.filter(p => {
    if (categoria !== 'todas' && p.categoria !== categoria) return false
    if (somenteSemPreco && Number(p.preco) > 0) return false
    if (!busca.trim()) return true
    return correspondeBuscaAtlas(busca, p.codigo, p.nome, p.descricao, labelCategoriaProduto(p.categoria), p.grupo, p.marca, p.ncm, p.unidade, p.codigo_origem, p.origem)
  }), [produtos, categoria, somenteSemPreco, busca])

  function patchLinha(id: string, patch: Partial<LinhaPreco>) { setLinhas(prev => ({ ...prev, [id]: { ...prev[id], ...patch } })) }
  function mudarCusto(id: string, valor: string) { const atual=linhas[id],custo=numero(valor),margem=numero(atual?.margem||''),sugerido=arredondarMoeda(precoPorMargemReal(custo,margem)); patchLinha(id,{custo:valor,...(sugerido!=null?{preco:String(sugerido)}:{})}) }
  function mudarMargem(id: string, valor: string) { const atual=linhas[id],custo=numero(atual?.custo||''),margem=numero(valor),sugerido=arredondarMoeda(precoPorMargemReal(custo,margem)); patchLinha(id,{margem:valor,...(sugerido!=null?{preco:String(sugerido)}:{})}) }
  function mudarPreco(id: string, valor: string) { const atual=linhas[id],custo=numero(atual?.custo||''),preco=numero(valor),margem=margemRealPorPreco(custo,preco); patchLinha(id,{preco:valor,...(margem!=null?{margem:margem.toFixed(2)}:{})}) }

  async function salvar(id: string) {
    const l=linhas[id]; if(!l)return
    const custo=numero(l.custo),margem=numero(l.margem),preco=numero(l.preco),minimo=numero(l.minimo),promocional=numero(l.promocional)
    if(margem!=null&&(margem<0||margem>=100))return setErro('A margem deve ficar entre 0% e menos de 100%.')
    if(preco==null||preco<0)return setErro('Informe um preço de venda válido.')
    if(minimo!=null&&minimo<0)return setErro('Preço mínimo inválido.')
    if(promocional!=null&&promocional<0)return setErro('Preço promocional inválido.')
    if(minimo!=null&&promocional!=null&&promocional>0&&promocional<minimo)return setErro('O preço promocional está abaixo do preço mínimo. Ajuste ou limpe um dos campos.')
    setErro('');setSalvandoId(id)
    const {error}=await atualizarProduto(id,{custo,margem_percentual:margem,preco,preco_minimo:minimo,preco_promocional:promocional} as any)
    setSalvandoId(null);if(error)return setErro('Não foi possível salvar a precificação.')
    setProdutos(prev=>prev.map(p=>p.id===id?{...p,custo,margem_percentual:margem,preco,preco_minimo:minimo,preco_promocional:promocional}:p))
    setSalvosIds(prev=>new Set(prev).add(id));setTimeout(()=>setSalvosIds(prev=>{const n=new Set(prev);n.delete(id);return n}),1800)
  }

  if(carregando)return <div className="min-h-screen flex items-center justify-center text-slate-400">Carregando...</div>
  if(!euSouMaster)return <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 gap-3"><ShieldAlert size={40} className="text-slate-300"/><p className="text-slate-500">Só o usuário master pode acessar esta tela.</p><Link href="/cadastro/produtos" className="text-brand-navy text-sm hover:underline">Voltar aos Produtos</Link></div>
  const semPreco=produtos.filter(p=>Number(p.preco)<=0).length

  return <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight">
    <header className="bg-white border-b border-slate-200"><div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4"><Link href="/cadastro/produtos" className="p-2 hover:bg-slate-100 rounded-lg transition"><ArrowLeft size={20}/></Link><Tag size={22} className="text-brand-navy"/><div className="flex-1"><h1 className="text-lg font-bold text-slate-800">Precificação de venda balcão</h1><p className="text-sm text-slate-500">Tipologias usam custo. Venda avulsa usa preço e margem próprios. {semPreco} produto(s) sem preço.</p></div></div></header>
    <main className="max-w-7xl mx-auto px-4 py-8"><section className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950"><div className="flex gap-2"><Calculator size={18} className="mt-0.5 shrink-0"/><div><strong>Margem real:</strong> preço = custo ÷ (1 − margem). O preço balcão não é usado dentro das tipologias.</div></div></section>{erro?<div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>:null}
      <section className="bg-white rounded-2xl border border-slate-200 p-5"><div className="flex flex-wrap gap-2 mb-4"><BuscaAtlasInput value={busca} onValueChange={setBusca} placeholder="Buscar código, nome, descrição, grupo, marca, NCM ou unidade..." containerClassName="flex-1 min-w-[220px]" inputClassName="w-full border border-slate-300 rounded-xl pr-3 py-2.5 text-sm"/><select value={categoria} onChange={e=>setCategoria(e.target.value as CategoriaProduto|'todas')} className="border border-slate-300 rounded-xl px-3 py-2.5 text-sm"><option value="todas">Todas as categorias</option>{CATEGORIAS_PRODUTO.map(c=><option key={c.valor} value={c.valor}>{c.label}</option>)}</select><label className="flex items-center gap-2 text-sm text-slate-600 px-3 py-2.5 border border-slate-300 rounded-xl cursor-pointer"><input type="checkbox" checked={somenteSemPreco} onChange={e=>setSomenteSemPreco(e.target.checked)}/>Só sem preço</label></div><p className="text-xs text-slate-400 mb-3">{filtrados.length} produto(s)</p>
        <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="min-w-[1250px] w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-3">Produto</th><th className="p-3">Custo técnico</th><th className="p-3">Margem balcão</th><th className="p-3">Preço normal</th><th className="p-3">Preço mínimo</th><th className="p-3">Promocional</th><th className="p-3">Último vendido</th><th className="p-3">Ação</th></tr></thead><tbody>{filtrados.map(p=>{const l=linhas[p.id]||{custo:'',margem:'',preco:'',minimo:'',promocional:''};const precoVenda=numero(l.promocional)&&Number(numero(l.promocional))>0?numero(l.promocional):numero(l.preco);const margemAtual=margemRealPorPreco(numero(l.custo),precoVenda);return <tr key={p.id} className="border-t border-slate-100 align-top"><td className="p-3 min-w-[260px]"><div className="font-semibold text-slate-900">{p.codigo||'—'} — {p.nome}</div><div className="mt-1 text-xs text-slate-500">{labelCategoriaProduto(p.categoria)} • {p.unidade||'unidade pendente'}</div></td><td className="p-3"><InputNumero value={l.custo} onChange={v=>mudarCusto(p.id,v)}/></td><td className="p-3"><InputNumero value={l.margem} onChange={v=>mudarMargem(p.id,v)} sufixo="%"/><div className="mt-1 text-[11px] text-slate-400">Efetiva: {margemAtual==null?'—':`${margemAtual.toFixed(2)}%`}</div></td><td className="p-3"><InputNumero value={l.preco} onChange={v=>mudarPreco(p.id,v)}/></td><td className="p-3"><InputNumero value={l.minimo} onChange={v=>patchLinha(p.id,{minimo:v})}/></td><td className="p-3"><InputNumero value={l.promocional} onChange={v=>patchLinha(p.id,{promocional:v})}/></td><td className="p-3 whitespace-nowrap"><div className="font-medium text-slate-700">{moeda(p.ultimo_preco_vendido)}</div><div className="text-[11px] text-slate-400">{p.ultimo_preco_vendido_em?new Date(p.ultimo_preco_vendido_em).toLocaleDateString('pt-BR'):'sem histórico'}</div></td><td className="p-3"><button onClick={()=>salvar(p.id)} disabled={salvandoId===p.id} className="rounded-lg bg-brand-navy px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{salvandoId===p.id?'Salvando...':salvosIds.has(p.id)?'✓ Salvo':'Salvar'}</button></td></tr>})}{!filtrados.length?<tr><td colSpan={8} className="p-8 text-center text-slate-400">Nenhum produto encontrado.</td></tr>:null}</tbody></table></div>
      </section>
    </main>
  </div>
}
function InputNumero({value,onChange,sufixo}:{value:string;onChange:(v:string)=>void;sufixo?:string}){return <div className="flex items-center gap-1"><input type="number" step="any" min="0" value={value} onChange={e=>onChange(e.target.value)} className="w-28 rounded-lg border border-slate-300 px-2.5 py-2 text-right text-sm"/>{sufixo?<span className="text-xs text-slate-500">{sufixo}</span>:null}</div>}
