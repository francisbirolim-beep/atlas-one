'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { Printer } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { MaterialPacote, PacoteTecnico } from '@/lib/materialPlanejamento'

type Grupo = 'perfis' | 'acessorios' | 'vidros'
type DadosCabecalho = {
  cliente: string
  obra: string
  orcamento: string
  pacote: string
  origem: string
  versao: number
}
const grupos: Record<Grupo,{titulo:string;categorias:MaterialPacote['categoria'][]}> = {
  perfis:{titulo:'Lista de Perfis',categorias:['perfil','contramarco']},
  acessorios:{titulo:'Lista de Acessórios',categorias:['acessorio']},
  vidros:{titulo:'Lista de Vidros',categorias:['vidro']},
}
const n=(v:unknown)=>Number.isFinite(Number(v))?Number(v):0
const qtd=(v:unknown)=>n(v).toLocaleString('pt-BR',{maximumFractionDigits:3})
function itemRef(item:any,i:number){return String(item?.id||`item-${i+1}`)}
function itemLabel(item:any,i:number){
  const ambiente=String(item?.ambiente||'').trim()
  const tipo=String(item?.tipo_outro_texto||item?.tipo_esquadria||item?.tipo||item?.descricao||`Tipologia ${i+1}`).trim()
  const medida=n(item?.largura_mm)>0&&n(item?.altura_mm)>0?`${Math.round(n(item.largura_mm))} × ${Math.round(n(item.altura_mm))} mm`:''
  return [ambiente,tipo,medida].filter(Boolean).join(' · ')
}
function origem(m:MaterialPacote){
  if(m.incluido_manual)return 'Ajuste manual Atlas'
  const o=String(m.origem_calculo||'').toLowerCase()
  if(o.includes('wvetro')||o.includes('w.vetro'))return 'W.Vetro'
  return 'Cálculo técnico'
}

export default function MateriaisPdfPage(){
  const params=useParams<{id:string}>()
  const obraId=String(params?.id||'')
  const [grupo,setGrupo]=useState<Grupo>('perfis')
  const [materiais,setMateriais]=useState<MaterialPacote[]>([])
  const [cab,setCab]=useState<DadosCabecalho|null>(null)
  const [labels,setLabels]=useState<Record<string,string>>({})
  const [erro,setErro]=useState('')
  const [loading,setLoading]=useState(true)

  useEffect(()=>{void carregar()},[obraId])

  async function carregar(){
    setLoading(true);setErro('')
    const qs=new URLSearchParams(window.location.search)
    const g=(qs.get('grupo')||'perfis') as Grupo
    const grupoSeguro:Grupo=grupos[g]?g:'perfis'
    setGrupo(grupoSeguro)
    const pacoteParam=qs.get('pacote')
    const orcamentoParam=qs.get('orcamento')

    let pacote:PacoteTecnico|null=null
    if(pacoteParam){
      const pr=await supabase.from('pacotes_tecnicos').select('*').eq('id',pacoteParam).eq('obra_id',obraId).maybeSingle()
      if(pr.error){setErro(pr.error.message);setLoading(false);return}
      pacote=(pr.data||null) as PacoteTecnico|null
    }else if(orcamentoParam){
      const pr=await supabase.from('pacotes_tecnicos').select('*').eq('orcamento_id',orcamentoParam).eq('obra_id',obraId).neq('status','substituido').order('created_at',{ascending:false}).limit(1).maybeSingle()
      if(pr.error){setErro(pr.error.message);setLoading(false);return}
      pacote=(pr.data||null) as PacoteTecnico|null
    }else{
      const pr=await supabase.from('pacotes_tecnicos').select('*').eq('obra_id',obraId).neq('status','substituido').order('created_at',{ascending:false}).limit(1).maybeSingle()
      if(pr.error){setErro(pr.error.message);setLoading(false);return}
      pacote=(pr.data||null) as PacoteTecnico|null
    }
    if(!pacote){setErro('Nenhum pacote técnico encontrado para esta obra.');setLoading(false);return}

    const snapshot=Array.isArray(pacote.snapshot_itens)?pacote.snapshot_itens:[]
    const mapa:Record<string,string>={'sem-tipologia':'Material geral da obra'}
    snapshot.forEach((item:any,i:number)=>{mapa[itemRef(item,i)]=itemLabel(item,i)})
    setLabels(mapa)

    const [mr,or,ob]=await Promise.all([
      supabase.from('pacote_tecnico_materiais').select('*').eq('pacote_id',pacote.id).eq('excluido',false).in('categoria',grupos[grupoSeguro].categorias).order('categoria').order('ordem'),
      supabase.from('orcamentos').select('id,numero,cliente_nome,clientes(id,nome)').eq('id',pacote.orcamento_id).maybeSingle(),
      supabase.from('obras').select('id,numero,nome').eq('id',obraId).maybeSingle(),
    ])
    if(mr.error||or.error||ob.error){setErro(mr.error?.message||or.error?.message||ob.error?.message||'Falha ao carregar materiais.');setLoading(false);return}
    setMateriais((mr.data||[]) as MaterialPacote[])
    const cliente:any=Array.isArray((or.data as any)?.clientes)?(or.data as any).clientes[0]:(or.data as any)?.clientes
    setCab({
      cliente:cliente?.nome||(or.data as any)?.cliente_nome||'—',
      obra:(ob.data as any)?.nome||`Obra #${(ob.data as any)?.numero||'—'}`,
      orcamento:String((or.data as any)?.numero||pacote.orcamento_id||'—'),
      pacote:pacote.id,
      origem:String(pacote.origem||'—'),
      versao:Number(pacote.versao||1),
    })
    setLoading(false)
  }

  const total=useMemo(()=>materiais.reduce((s,m)=>s+n(m.quantidade_ajustada),0),[materiais])
  if(loading)return <main className="estado">Carregando lista de materiais…</main>
  if(erro||!cab)return <main className="estado">{erro||'Não foi possível gerar a lista.'}</main>

  return <><main className="folha">
    <header>
      <div><h1>{grupos[grupo].titulo}</h1><p>Obra · material técnico conferível · Atlas One</p></div>
      <button className="no-print" onClick={()=>window.print()}><Printer size={15}/> Imprimir / Salvar PDF</button>
    </header>
    <section className="grade">
      <div><b>Cliente</b><span>{cab.cliente}</span></div>
      <div><b>Obra</b><span>{cab.obra}</span></div>
      <div><b>Orçamento</b><span>#{cab.orcamento}</span></div>
      <div><b>Pacote técnico</b><span>v{cab.versao} · {cab.origem}</span></div>
    </section>
    <div className="resumo"><b>{materiais.length}</b> linha(s) · quantidade ajustada total <b>{qtd(total)}</b></div>
    <table>
      <thead><tr><th>Código</th><th>Descrição</th><th>Tipologia / ambiente</th><th>Qtd. técnica</th><th>Qtd. final</th><th>Corte / barra</th><th>Origem</th></tr></thead>
      <tbody>{materiais.map(m=><tr key={m.id}>
        <td><b>{m.codigo||'—'}</b></td>
        <td>{m.descricao}{m.cor_ref?<div className="sub">Cor: {m.cor_ref}</div>:null}{m.justificativa_ajuste?<div className="ajuste">Ajuste: {m.justificativa_ajuste}</div>:null}</td>
        <td>{labels[String(m.item_ref||'sem-tipologia')]||'Material geral da obra'}</td>
        <td>{qtd(m.quantidade_tecnica)} {m.unidade}</td>
        <td><b>{qtd(m.quantidade_ajustada)} {m.unidade}</b></td>
        <td>{m.comprimento_corte_mm?`${Math.round(n(m.comprimento_corte_mm))} mm corte`:'—'}{m.comprimento_barra_mm?<div className="sub">Barra {Math.round(n(m.comprimento_barra_mm))} mm</div>:null}</td>
        <td>{origem(m)}</td>
      </tr>)}
      {!materiais.length&&<tr><td colSpan={7} className="vazio">Nenhum material desta categoria no pacote técnico selecionado.</td></tr>}</tbody>
    </table>
    <footer><p>Pacote: {cab.pacote}</p><p>Este documento reflete a quantidade ajustada vigente no Atlas. Inclusões, trocas e retiradas permanecem registradas na conferência técnica da obra.</p></footer>
  </main>
  <style jsx global>{`
    *{box-sizing:border-box}body{margin:0;background:#eef1f4;color:#111;font-family:Arial,sans-serif}.folha{width:210mm;min-height:297mm;margin:16px auto;background:#fff;padding:12mm;font-size:9.5pt}header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;border-bottom:2px solid #111;padding-bottom:8px}h1{margin:0;font-size:18pt}header p{margin:4px 0 0;color:#666}.no-print{display:inline-flex;align-items:center;gap:6px;border:1px solid #aaa;background:#fff;padding:8px 11px;border-radius:8px}.grade{display:grid;grid-template-columns:repeat(4,1fr);margin:10px 0;border:1px solid #aaa}.grade div{padding:7px;border:1px solid #ddd}.grade b,.grade span{display:block}.grade span{margin-top:3px}.resumo{margin:10px 0;padding:8px;background:#f5f5f5;border:1px solid #ddd}table{width:100%;border-collapse:collapse;font-size:8.8pt}th,td{border:1px solid #888;padding:5px;text-align:left;vertical-align:top}th{background:#eee}.sub{margin-top:3px;color:#555}.ajuste{margin-top:4px;font-size:8pt;color:#8a5a00}.vazio{text-align:center;padding:18px;color:#777}footer{margin-top:12px;padding-top:8px;border-top:1px solid #aaa;font-size:8pt;color:#666}footer p{margin:3px 0}@page{size:A4;margin:9mm}@media print{body{background:#fff}.folha{width:auto;min-height:auto;margin:0;padding:0}.no-print{display:none}header,.grade,.resumo{break-inside:avoid}tr{break-inside:avoid}}@media(max-width:800px){.folha{width:100%;margin:0;padding:14px}.grade{grid-template-columns:1fr 1fr}header{flex-direction:column}}
  `}</style></>
}
