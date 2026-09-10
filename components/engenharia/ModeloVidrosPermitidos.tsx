'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, GlassWater, Loader2, Save, X } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { listarProdutosTecnicos } from '@/lib/engenhariaReceitas'
import type { Produto } from '@/lib/tipos'

type MetaModelo = {
  descricao_orcamento?: string
  descricao_pesquisa?: string
  folga_largura?: number
  folga_altura?: number
  origem?: string
  vidros_permitidos?: string[]
}

function normalizar(v: string) {
  return v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export default function ModeloVidrosPermitidos() {
  const pathname = usePathname()
  const [aberto, setAberto] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [formulaId, setFormulaId] = useState<string | null>(null)
  const [meta, setMeta] = useState<MetaModelo>({})
  const [vidros, setVidros] = useState<Produto[]>([])
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [busca, setBusca] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')

  const ativo = pathname === '/engenharia/modelos'

  useEffect(() => {
    if (!ativo) return
    void carregar()
  }, [ativo])

  async function carregar() {
    setCarregando(true)
    setErro('')
    const [catalogo, formulaResp] = await Promise.all([
      listarProdutosTecnicos(),
      supabase
        .from('engenharia_tipologia_formulas_corte')
        .select('id, metadados_editor')
        .eq('configuracao_chave', 'pc2_suprema_editor_v1')
        .maybeSingle(),
    ])

    const lista = catalogo.filter(p => p.categoria === 'vidro' && p.ativo !== false)
    setVidros(lista)

    if (formulaResp.error || !formulaResp.data) {
      setErro('Não foi possível localizar o modelo PC2 Suprema para salvar os vidros permitidos.')
      setCarregando(false)
      return
    }

    const dadosMeta = (formulaResp.data.metadados_editor && typeof formulaResp.data.metadados_editor === 'object')
      ? formulaResp.data.metadados_editor as MetaModelo
      : {}
    setFormulaId(formulaResp.data.id)
    setMeta(dadosMeta)

    const salvos = Array.isArray(dadosMeta.vidros_permitidos) ? dadosMeta.vidros_permitidos : []
    if (salvos.length) {
      setSelecionados(new Set(salvos))
    } else {
      const sugestao = lista
        .filter(p => {
          const texto = normalizar(`${p.codigo || ''} ${p.nome || ''} ${p.descricao || ''}`)
          return texto.includes('incolor') && (texto.includes('06mm') || texto.includes('6mm') || texto.includes(' 06 '))
        })
        .map(p => p.id)
      setSelecionados(new Set(sugestao.slice(0, 1)))
    }
    setCarregando(false)
  }

  const filtrados = useMemo(() => {
    const q = normalizar(busca.trim())
    if (!q) return vidros
    return vidros.filter(p => normalizar(`${p.codigo || ''} ${p.nome || ''} ${p.descricao || ''}`).includes(q))
  }, [vidros, busca])

  function alternar(id: string) {
    setSelecionados(prev => {
      const proximo = new Set(prev)
      if (proximo.has(id)) proximo.delete(id)
      else proximo.add(id)
      return proximo
    })
  }

  async function salvar() {
    if (!formulaId) return
    setSalvando(true)
    setMensagem('')
    setErro('')
    const novoMeta: MetaModelo = { ...meta, vidros_permitidos: Array.from(selecionados) }
    const { error } = await supabase
      .from('engenharia_tipologia_formulas_corte')
      .update({ metadados_editor: novoMeta, updated_at: new Date().toISOString() })
      .eq('id', formulaId)
    if (error) setErro('Não foi possível salvar a lista de vidros permitidos.')
    else {
      setMeta(novoMeta)
      setMensagem('Vidros permitidos salvos para a Porta de Correr 02 Folhas Suprema.')
    }
    setSalvando(false)
  }

  if (!ativo) return null

  return <>
    <button onClick={()=>setAberto(true)} className="fixed bottom-5 left-5 z-[65] inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white px-4 py-3 text-sm font-bold text-cyan-800 shadow-lg hover:bg-cyan-50">
      <GlassWater size={17}/> Vidros permitidos <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[11px]">{selecionados.size}</span>
    </button>

    {aberto&&<div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/40 p-4" onMouseDown={e=>{if(e.currentTarget===e.target)setAberto(false)}}>
      <div className="max-h-[88vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b px-5 py-4">
          <div><div className="text-[11px] font-bold uppercase tracking-[.16em] text-cyan-600">Porta de Correr 02 Folhas · Suprema</div><h2 className="mt-1 text-xl font-bold">Vidros permitidos na tipologia</h2><p className="mt-1 text-xs text-slate-500">Somente os itens marcados devem aparecer para o vendedor ao configurar esta tipologia.</p></div>
          <button onClick={()=>setAberto(false)} className="rounded-lg p-2 hover:bg-slate-100"><X size={18}/></button>
        </div>

        <div className="p-5">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800"><b>Regra segura:</b> vidro novo no cadastro geral não entra automaticamente nesta Suprema. Ele só fica disponível depois de ser marcado aqui.</div>
          <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar vidro por nome, código ou espessura..." className="mt-4 w-full rounded-xl border px-3 py-2.5 text-sm"/>

          {carregando?<div className="grid h-48 place-items-center"><Loader2 className="animate-spin text-cyan-600"/></div>:<div className="mt-4 max-h-[48vh] overflow-auto rounded-xl border">
            {filtrados.length===0?<div className="p-6 text-center text-sm text-slate-400">Nenhum vidro encontrado no cadastro técnico.</div>:filtrados.map(p=>{
              const marcado = selecionados.has(p.id)
              return <label key={p.id} className="flex cursor-pointer items-center gap-3 border-b px-4 py-3 last:border-b-0 hover:bg-slate-50">
                <input type="checkbox" checked={marcado} onChange={()=>alternar(p.id)} className="h-4 w-4"/>
                <div className="min-w-0 flex-1"><div className="font-semibold text-slate-800">{p.nome}</div><div className="text-xs text-slate-500">{p.codigo||'sem código'} · {p.unidade||'m²'}{p.descricao?` · ${p.descricao}`:''}</div></div>
                {marcado&&<CheckCircle2 size={18} className="text-emerald-600"/>}
              </label>
            })}
          </div>}

          {(mensagem||erro)&&<div className={`mt-4 rounded-xl border px-3 py-2 text-xs ${erro?'border-red-200 bg-red-50 text-red-700':'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{erro||mensagem}</div>}
        </div>

        <div className="flex justify-end gap-2 border-t bg-white px-5 py-4"><button onClick={()=>setAberto(false)} className="rounded-xl border px-4 py-2 text-sm font-semibold">Fechar</button><button onClick={salvar} disabled={salvando||carregando} className="inline-flex items-center gap-2 rounded-xl bg-cyan-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{salvando?<Loader2 size={16} className="animate-spin"/>:<Save size={16}/>}Salvar vidros permitidos</button></div>
      </div>
    </div>}
  </>
}
