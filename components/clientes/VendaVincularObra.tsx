'use client'
import {useCallback,useEffect,useState} from 'react'
import {Building2,CheckCircle2,Loader2,RefreshCw} from 'lucide-react'
import {tokenAtual,usuarioAtual} from '@/lib/auth'

type Opcao={id:string;numero?:number|null;nome:string;cidade?:string|null;status?:string|null}
export default function VendaVincularObra({vendaId,clienteNome,cidadeCliente,onVinculada}:{
  vendaId:string;clienteNome:string;cidadeCliente?:string|null;onVinculada:()=>Promise<void>|void
}){
 const [opcoes,setOpcoes]=useState<Opcao[]>([])
 const [selecionada,setSelecionada]=useState('')
 const [nova,setNova]=useState(false)
 const [nome,setNome]=useState('')
 const [cidade,setCidade]=useState(cidadeCliente||'')
 const [carregando,setCarregando]=useState(true)
 const [salvando,setSalvando]=useState(false)
 const [autorizado,setAutorizado]=useState(false)
 const [erro,setErro]=useState('')

 const carregar=useCallback(async()=>{
   setCarregando(true);setErro('')
   try{
     const token=await tokenAtual()
     if(!token)throw Error('Sessão expirada.')
     const resp=await fetch('/api/vendas/obra-vinculo?vendaId='+encodeURIComponent(vendaId),{
       cache:'no-store',headers:{Authorization:'Bearer '+token},
     })
     const j=await resp.json().catch(()=>({}))
     if(!resp.ok)throw Error(j.error||'Falha ao consultar as obras.')
     setOpcoes(j.obras||[])
     setSelecionada(v=>v&&j.obras?.some((o:Opcao)=>o.id===v)?v:'')
   }catch(e){setErro(e instanceof Error?e.message:'Não foi possível consultar as obras.')}
   finally{setCarregando(false)}
 },[vendaId])
 useEffect(()=>{void carregar();void usuarioAtual().then(u=>setAutorizado(u?.role==='master'))},[carregar])

 async function confirmar(){
   if(salvando)return
   const candidata=opcoes.find(o=>o.id===selecionada)
   const criarNova=nova||!opcoes.length
   if(!criarNova&&!candidata){setErro('Selecione uma obra do cliente.');return}
   if(criarNova&&nome.trim().length<3){setErro('Informe o nome da nova obra.');return}
   const descricao=criarNova?'criar e vincular a nova obra "'+nome.trim()+'"':'vincular a obra #'+(candidata?.numero||'—')+' "'+candidata?.nome+'"'
   if(!window.confirm('Confirma '+descricao+' à venda de '+clienteNome+'? O Atlas também associará o orçamento e registros pendentes do mesmo orçamento, sem mudar valores.'))return
   setSalvando(true);setErro('')
   try{
     const token=await tokenAtual()
     if(!token)throw Error('Sessão expirada.')
     const r=await fetch('/api/vendas/obra-vinculo',{method:'POST',headers:{
       Authorization:'Bearer '+token,'Content-Type':'application/json'},
       body:JSON.stringify({vendaId,obraId:criarNova?null:candidata?.id,
         nomeNovaObra:criarNova?nome.trim():null,cidade:criarNova?cidade.trim():null,confirmar:true}),
     })
     const j=await r.json().catch(()=>({}))
     if(!r.ok)throw Error(j.error||'Vínculo recusado pelo Atlas.')
     await onVinculada()
   }catch(e){setErro(e instanceof Error?e.message:'Não foi possível vincular a obra.')}
   finally{setSalvando(false)}
 }

 return <section className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
   <div className="flex items-start gap-2"><Building2 size={18} className="mt-0.5 text-amber-800"/>
     <div><h2 className="text-sm font-bold text-amber-950">Esta venda ainda não tem obra vinculada</h2>
       <p className="mt-1 text-xs text-amber-900">Vincule uma obra do próprio cliente ou crie uma nova. O Atlas não faz associação automática por nome.</p></div>
   </div>
   {erro&&<p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{erro}</p>}
   {!autorizado?<p className="mt-3 text-xs text-amber-900">Peça ao Master para conferir e vincular esta obra.</p>:<>
     {carregando?<p className="mt-3 text-xs text-amber-800"><Loader2 size={14} className="inline animate-spin"/> Consultando obras...</p>:
       <div className="mt-3 space-y-2">
         <label className="block text-xs font-bold text-amber-950">O que deseja fazer?</label>
         {opcoes.length>0&&<label className="block text-xs text-amber-900">
           <input type="radio" checked={!nova} onChange={()=>setNova(false)} className="mr-1.5"/>Vincular obra existente do cliente
         </label>}
         <label className="block text-xs text-amber-900"><input type="radio" checked={nova||!opcoes.length} onChange={()=>setNova(true)} className="mr-1.5"/>Cadastrar nova obra</label>
         {!nova&&opcoes.length>0?<select value={selecionada} onChange={e=>setSelecionada(e.target.value)}
           className="w-full max-w-lg rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm">
           <option value="">Selecione a obra correta...</option>
           {opcoes.map(o=><option key={o.id} value={o.id}>Obra #{o.numero||'—'} · {o.nome}{o.cidade?' · '+o.cidade:''}</option>)}
         </select>:<>
           <input value={nome} onChange={e=>setNome(e.target.value)} maxLength={150}
             placeholder="Nome da obra (ex.: Residência, Casa, Reforma)" className="block w-full max-w-lg rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"/>
           <input value={cidade} onChange={e=>setCidade(e.target.value)} maxLength={150}
             placeholder="Cidade da obra (opcional)" className="block w-full max-w-lg rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"/>
         </>}
         <div className="flex flex-wrap gap-2">
           <button type="button" disabled={salvando||(!nova&&!!opcoes.length&&!selecionada)||(nova&&nome.trim().length<3)}
             onClick={()=>void confirmar()} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">
             {salvando?<Loader2 size={14} className="animate-spin"/>:<CheckCircle2 size={14}/>}
             {nova||!opcoes.length?'Criar e vincular obra':'Confirmar vínculo da obra'}
           </button>
           <button type="button" disabled={salvando||carregando} onClick={()=>void carregar()}
             className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-xs font-bold text-slate-700">
             <RefreshCw size={13}/>Atualizar obras
           </button>
         </div>
       </div>
     }
   </>}
 </section>
}
