'use client'
import {useEffect,useMemo,useState} from 'react'
import {ImageIcon,Loader2,AlertTriangle} from 'lucide-react'
import {tokenAtual} from '@/lib/auth'
import type {ResumoCompraWVetro,CategoriaCompraWVetro} from '@/lib/wvetroListaMateriaisCompra'
type Mudanca={chave:string;codigo:string;descricao:string;categoria:CategoriaCompraWVetro;antes:number;depois:number;status:string}
type Resultado={ok:true;numeroWvetro:string;lista:ResumoCompraWVetro;comparacao:{mudancas:Mudanca[];total:number}|null;origem:'wvetro_ao_vivo'|'snapshot_importado';sincronizado:boolean;somenteLeitura:true;aviso:string|null;consultas:string[];dataImportacao:string|null}
const qtd=(n:number)=>n.toLocaleString('pt-BR',{maximumFractionDigits:3})
const grupos:{id:CategoriaCompraWVetro;nome:string}[]=[
 {id:'perfil',nome:'Perfis · barras inteiras'},{id:'acessorio',nome:'Acessórios consolidados'},{id:'vidro',nome:'Vidros por medida'},
]
export default function VendaListaCompraWVetro({vendaId,solicitarSync}:{vendaId:string;solicitarSync:number}){
 const [dados,setDados]=useState<Resultado|null>(null)
 const [carregando,setCarregando]=useState(false)
 const [erro,setErro]=useState('')
 const [categoria,setCategoria]=useState<CategoriaCompraWVetro>('perfil')
 useEffect(()=>{
  let ativo=true
  async function carregar(){
   setCarregando(true);setErro('')
   try{
    const token=await tokenAtual()
    if(!token)throw Error('Sessão expirada.')
    const endpoint='/api/integracoes/wvetro/vendas/lista-compra?vendaId='+encodeURIComponent(vendaId)+(solicitarSync>0?'&aoVivo=1':'')
    const resp=await fetch(endpoint,{headers:{Authorization:'Bearer '+token},cache:'no-store'})
    const json=await resp.json().catch(()=>({}))
    if(!resp.ok)throw Error(json.error||'Não foi possível carregar a lista comercial W.Vetro.')
    if(ativo)setDados(json as Resultado)
   }catch(e){if(ativo)setErro(e instanceof Error?e.message:'Falha na consulta de materiais.')}
   finally{if(ativo)setCarregando(false)}
  }
  void carregar()
  return ()=>{ativo=false}
 },[vendaId,solicitarSync])
 const linhas=useMemo(()=>dados?.lista.itens.filter(i=>i.categoria===categoria)||[],[dados,categoria])
 return <section className="mt-4 overflow-hidden rounded-xl border border-emerald-300 bg-white" aria-label="Lista de materiais W.Vetro para compra">
  <div className="border-b border-emerald-100 bg-emerald-50/50 p-4">
   <h3 className="text-sm font-bold text-slate-900">Lista de materiais W.Vetro para compra</h3>
   <p className="mt-1 text-xs text-slate-600">Perfis = Barras Utilizadas; acessórios = quantidades por código e cor; vidros = especificação e medidas. <b>Não são peças do plano de corte.</b></p>
   {dados&&<p className="mt-2 text-[11px] font-semibold text-slate-600">W.Vetro #{dados.numeroWvetro} · {dados.origem==='wvetro_ao_vivo'?'Consulta atual':'Importação existente'}
    {dados.origem==='snapshot_importado'&&dados.dataImportacao?' · '+new Date(dados.dataImportacao).toLocaleString('pt-BR'):''}
   </p>}
  </div>
  <div className="p-4">
   {carregando&&<p role="status" className="mb-3 flex items-center gap-2 text-xs text-blue-700"><Loader2 size={15} className="animate-spin"/>Consultando lista comercial W.Vetro...</p>}
   {erro&&<p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{erro} {dados?'A lista anterior permanece disponível.':''}</p>}
   {dados?.aviso&&<p role="alert" className="mb-3 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><AlertTriangle size={15} className="shrink-0"/>{dados.aviso}</p>}
   {dados?.sincronizado&&<p className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">Lista comercial consultada agora. Alterações ainda não aplicadas à obra.</p>}
   {dados&&<>
    <div className="grid gap-2 sm:grid-cols-3">
     {grupos.map(g=><button type="button" key={g.id} onClick={()=>setCategoria(g.id)}
      className={'rounded-lg border p-3 text-left text-xs '+(categoria===g.id?'border-emerald-600 bg-emerald-50 text-emerald-900':'border-slate-200 text-slate-700')}>
       <b>{g.nome}</b>
       <p className="mt-1">{g.id==='perfil'?dados.lista.totais.perfis+' referências · '+qtd(dados.lista.totais.barras)+' barras':
        g.id==='acessorio'?dados.lista.totais.acessorios+' referências · '+qtd(dados.lista.totais.unidadesAcessorios)+' unidades':
        dados.lista.totais.vidros+' medidas · '+qtd(dados.lista.totais.pecasVidro)+' peças'}</p>
      </button>)}
    </div>
    {dados.comparacao&&<div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
     <b>{dados.sincronizado?'Mudanças encontradas: '+dados.comparacao.total:'Nenhuma nova lista comercial confirmada'}</b>
     {dados.sincronizado&&dados.comparacao.total===0&&<p className="mt-1">A lista atual retornou as mesmas quantidades da importação. Nenhuma alteração foi aplicada.</p>}
     {!!dados.comparacao.mudancas.length&&<div className="mt-2 max-h-40 space-y-1 overflow-auto">
      {dados.comparacao.mudancas.map(m=><p key={m.chave}><b>{m.codigo}</b> · {m.categoria} · {qtd(m.antes)} → {qtd(m.depois)} ({m.status})</p>)}
     </div>}
    </div>}
    {dados.lista.alertas.length>0&&<div className="mt-3 rounded-lg border border-amber-200 p-3 text-xs text-amber-800">
     {dados.lista.alertas.map(a=><p key={a}>{a}</p>)}
    </div>}
    <div className="mt-3 overflow-x-auto rounded-lg border">
     <table className="w-full min-w-[800px] text-left text-xs">
      <thead className="bg-slate-50 text-slate-500"><tr><th className="p-2">Imagem</th><th className="p-2">Código</th><th className="p-2">Descrição</th><th className="p-2">Cor / medida</th><th className="p-2 text-right">Quantidade</th><th className="p-2">Un.</th></tr></thead>
      <tbody>{linhas.map(m=><tr key={m.chave} className="border-t">
       <td className="p-2"><div className="grid h-14 w-14 place-items-center overflow-hidden rounded-lg border bg-slate-50">
        {m.imagemUrl?<img src={m.imagemUrl} alt={m.descricao+' '+m.codigo} className="h-full w-full object-contain"/>:
        <span className="flex flex-col items-center text-center text-[9px] font-bold text-amber-700"><ImageIcon size={17}/>Imagem pendente</span>}
       </div></td>
       <td className="p-2 font-mono font-bold">{m.codigo}</td>
       <td className="p-2 font-semibold">{m.descricao}</td>
       <td className="p-2">{m.cor||'—'}{m.medida&&<small className="block text-slate-500">{m.medida}</small>}</td>
       <td className="p-2 text-right font-bold">{qtd(m.quantidade)}</td>
       <td className="p-2">{m.unidade}</td>
      </tr>)}
      {!linhas.length&&<tr><td colSpan={6} className="p-4 text-center text-slate-500">Nenhum item recebido nesta categoria.</td></tr>}
      </tbody>
     </table>
    </div>
    <p className="mt-3 text-[11px] text-slate-500">Conferência comercial somente leitura. Itens e ajustes da composição técnica anterior estão preservados. Para substituir itens de compra, é necessária uma validação específica que preserve materiais editados e compras existentes.</p>
   </>}
  </div>
 </section>
}
