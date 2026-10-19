'use client'

import {useState} from 'react'
import {compararDesenhos} from '@/lib/ai/equivalenciaDesenhoBrowser'
import {classificarFuncaoDeclarada} from '@/lib/ai/equivalenciaPerfilTecnico'

type Perfil={id:string;codigo:string;nome:string;categoria:string;peso_kg_m:number|null;
  medidas_mm:Record<string,number>;foto_url:string;mesmoCodigo:boolean;
  geometria:{medidasComuns:number;medidasCompativeis:boolean;divergentes:Array<{campo:string;origem:number;destino:number}>};
  fornecedores:Array<{nome:string;codigo:string;preco:number|null;peso_kg_m:number|null;desenho_url:string|null}>;funcao?:string|null}
type Resultado={sugestoes:Perfil[];desenho_origem:string;aviso?:string|null;motivo?:string|null}

export default function CompararPerfilCatalogo({candidato,api,somenteLeitura,onVinculado}:{
  candidato:{id:string;dados:Record<string,any>;status:string;pode_validar:boolean}
  api:(url:string,init?:RequestInit)=>Promise<any>
  somenteLeitura:boolean
  onVinculado:(msg:string)=>Promise<void>
}){
  const [dados,setDados]=useState<Resultado|null>(null)
  const [analises,setAnalises]=useState<Record<string,number|null>>({})
  const [consultando,setConsultando]=useState(false)
  const [analisando,setAnalisando]=useState(false)
  const [erro,setErro]=useState('')
  const [selecionado,setSelecionado]=useState<string|null>(null)
  const [concorda,setConcorda]=useState(false)
  const [gravando,setGravando]=useState(false)
  const [mensagem,setMensagem]=useState('')
  const codigo=String(candidato.dados?.codigo||'')
  const peso=Number(String(candidato.dados?.peso_kg_m||'').replace(',','.'))
  const medidas=Object.entries(candidato.dados?.medidas_mm||{}).map(([k,v])=>k+': '+v+' mm').join(' · ')
  const fonte=String(candidato.dados?.imagem_item_url||'')

  async function consultar(){
    if(consultando)return
    setErro('');setDados(null);setAnalises({});setMensagem('');setSelecionado(null);setConcorda(false)
    setConsultando(true)
    try{
      const resultado:Resultado=await api('/api/ia/central-aprendizado?compararPerfil='+encodeURIComponent(candidato.id))
      setDados(resultado)
      if(resultado.sugestoes?.length && resultado.desenho_origem){
        setAnalisando(true)
        const scores:Record<string,number|null>={}
        // Limita concorrência para manter o navegador responsivo.
        for(let i=0;i<resultado.sugestoes.length;i+=4){
          await Promise.all(resultado.sugestoes.slice(i,i+4).map(async p=>{
            scores[p.id]=await compararDesenhos(resultado.desenho_origem,p.foto_url)
          }))
          setAnalises({...scores})
        }
      }
    }catch(e:any){setErro(e?.message||'Não foi possível consultar os desenhos.')}
    finally{setConsultando(false);setAnalisando(false)}
  }

  async function vincular(p:Perfil){
    if(gravando||!concorda)return
    if(somenteLeitura){
      setMensagem('SIMULAÇÃO: código '+codigo+' do novo fornecedor seria vinculado ao produto '+p.codigo+' do Atlas, preservando os dois desenhos e pesos. Nenhum dado real foi alterado.')
      return
    }
    setGravando(true);setErro('')
    try{
      const resposta=await api('/api/ia/central-aprendizado',{
        method:'PATCH',body:JSON.stringify({acao:'vincular_equivalente_perfil',id:candidato.id,
          produto_id:p.id,confirmar_equivalencia:true}),
      })
      setMensagem(resposta.mensagem||'Referência vinculada.')
      await onVinculado(resposta.mensagem||'Perfil vinculado ao produto existente.')
    }catch(e:any){setErro(e?.message||'Falha ao confirmar a equivalência.')}
    finally{setGravando(false)}
  }

  const lista=(dados?.sugestoes||[]).slice().sort((a,b)=>{
    const va=analises[a.id],vb=analises[b.id]
    const ia=(a.geometria.medidasCompativeis?100:0)+(va??0)
    const ib=(b.geometria.medidasCompativeis?100:0)+(vb??0)
    return ib-ia
  })
  return <div className="mt-3 rounded-xl border border-indigo-200 bg-white p-3 text-xs">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><b className="text-sm text-indigo-900">Comparar desenho e códigos de outros fornecedores</b>
        <p className="mt-1 text-slate-500">A IA sugere correspondências. Só uma conferência humana pode autorizar o vínculo.</p></div>
      <button type="button" disabled={consultando} onClick={()=>void consultar()} className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 font-semibold text-indigo-800 disabled:opacity-50">
        {consultando?'Comparando desenhos...':'Buscar perfis equivalentes'}</button>
    </div>
    {!!fonte&&<div className="mt-3 flex flex-wrap gap-3 rounded-lg bg-slate-50 p-3">
      <img loading="lazy" src={fonte} alt={'Desenho técnico original '+codigo} className="h-32 w-32 rounded border bg-white object-contain"/>
      <div className="min-w-0 flex-1"><b>Código do catálogo: {codigo}</b>
        <p>Peso deste fornecedor: {Number.isFinite(peso)&&peso>0?peso+' kg/m':'a conferir'}</p>
        <p>Medidas: {medidas||'a conferir'}</p>
        <p>Função declarada: {classificarFuncaoDeclarada(candidato.dados?.descricao,candidato.dados?.aplicacao)}</p>
      </div></div>}
    {analisando&&<p role="status" className="mt-2 text-indigo-700">Calculando similaridade visual aproximada, sem modificar cadastros...</p>}
    {dados?.motivo&&<p className="mt-2 text-amber-700">{dados.motivo}</p>}
    {dados?.aviso&&<p className="mt-2 text-amber-700">{dados.aviso}</p>}
    {dados&&lista.length===0&&!dados.motivo&&<p className="mt-2 text-slate-500">Nenhum desenho cadastrado para comparação. Não criei outro produto.</p>}
    <div className="mt-3 max-h-[530px] space-y-2 overflow-y-auto">
      {lista.map(p=>{
        const fotoNota=analises[p.id]
        const geom=p.geometria
        const diferente=geom.divergentes.length>0
        const escolhida=selecionado===p.id
        const podeVincular=geom.medidasCompativeis && candidato.pode_validar
          && candidato.status!=='aplicado' && !!candidato.dados?.imagem_confirmada
        return <div key={p.id} className={'rounded-lg border p-3 '+(escolhida?'border-indigo-400 bg-indigo-50':'bg-white')}>
          <div className="flex flex-wrap gap-3">
            <img loading="lazy" src={p.foto_url} alt={'Desenho cadastrado '+p.codigo} className="h-28 w-28 rounded-lg border bg-white object-contain"/>
            <div className="min-w-0 flex-1 space-y-1">
              <div><b>{p.codigo} — {p.nome}</b> {p.mesmoCodigo?'(mesmo código)':'(código diferente)'}</div>
              <p>Desenho: {fotoNota==null?'comparação visual indisponível':fotoNota+'% de semelhança aproximada'}</p>
              <p>Geometria: {geom.medidasCompativeis?'medidas compatíveis':diferente?'medidas diferentes':'medidas insuficientes para validar equivalência'}</p>
              <p>Medidas cadastradas: {Object.entries(p.medidas_mm||{}).map(([k,v])=>k+': '+v+' mm').join(' · ')||'não informadas'}</p>
              <p>Peso cadastrado: {p.peso_kg_m??'não informado'} kg/m
                {peso>0&&p.peso_kg_m!=null?' · diferença de '+Math.abs(peso-Number(p.peso_kg_m)).toFixed(3)+' kg/m':''}</p>
              <p>Função declarada: {classificarFuncaoDeclarada(p.nome,p.funcao)}</p>
              <div className="rounded bg-slate-50 px-2 py-1.5">
                <b>Fornecedores registrados:</b>
                {p.fornecedores?.length?p.fornecedores.map((f,i)=><div key={i} className="mt-1 flex items-center gap-2 border-t py-1">
                  {f.desenho_url?<img loading="lazy" src={f.desenho_url} alt={'Desenho de '+f.nome+' para '+f.codigo} className="h-10 w-10 shrink-0 rounded border bg-white object-contain"/>
                  :<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded border text-[9px] text-amber-700">Sem foto própria</span>}
                  <span>{f.nome} — {f.codigo} · peso: {f.peso_kg_m!=null?f.peso_kg_m+' kg/m':'não registrado'}
                    {f.preco!=null?' · R$ '+f.preco:''}</span>
                </div>):<p>nenhum vínculo de fornecedor registrado</p>}
              </div>
              <button type="button" onClick={()=>{setSelecionado(escolhida?null:p.id);setConcorda(false)}}
                className="rounded-md border border-indigo-300 px-2 py-1.5 font-semibold text-indigo-700">
                {escolhida?'Fechar comparação':'Comparar lado a lado'}
              </button>
            </div>
          </div>
          {escolhida&&<div className="mt-3 border-t pt-3">
            <p className="font-semibold text-amber-800">Códigos diferentes não provam equivalência. Confira encaixes, canais, travas, espessuras e todas as cotas.</p>
            {diferente&&<p className="mt-1 text-red-700">Dimensões divergentes: {geom.divergentes.map(d=>d.campo+' '+d.origem+' × '+d.destino+' mm').join('; ')}. Não vincule como mesmo produto.</p>}
            <label className="mt-3 flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={concorda} onChange={e=>setConcorda(e.target.checked)}/>
              Confirmei pessoalmente que os desenhos, encaixes e medidas pertencem ao mesmo perfil.
            </label>
            <button disabled={!concorda||!podeVincular||gravando} type="button" onClick={()=>void vincular(p)}
              className="mt-2 rounded-lg bg-indigo-700 px-3 py-2 font-semibold text-white disabled:opacity-40">
              {gravando?'Vinculando...':somenteLeitura?'Simular vínculo entre fornecedores':'Vincular ao produto existente'}
            </button>
            {!podeVincular&&<p className="mt-2 text-amber-700">Para vincular, confirme e salve o desenho do novo catálogo e confira pelo menos duas cotas compatíveis. Produtos já aplicados não são alterados por esta operação.</p>}
          </div>}
        </div>
      })}
    </div>
    {erro&&<p role="alert" className="mt-2 rounded bg-red-50 p-2 text-red-700">{erro}</p>}
    {mensagem&&<p role="status" className="mt-2 rounded bg-indigo-50 p-2 text-indigo-800">{mensagem}</p>}
    <p className="mt-3 text-slate-500">A porcentagem visual é apenas uma sugestão de recortes rasterizados. Desenhos iguais não comprovam que liga, espessura, resistência e usinagem são equivalentes. Não há vinculação automática.</p>
  </div>
}
