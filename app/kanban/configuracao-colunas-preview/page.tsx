'use client'
import {useCallback,useEffect,useMemo,useState} from 'react'
import Link from 'next/link'
import {ArrowLeft,ArrowRight,ArrowUp,ArrowDown,Columns3,GripVertical,Pencil,Plus,RotateCcw,Trash2,ShieldAlert,Copy} from 'lucide-react'
import {tokenAtual} from '@/lib/auth'
import {QUADROS,indiceConclusaoOperacional} from '@/lib/centralKanban'

type Col={id:string;setor:string;nome:string;ordem:number;visualNovo?:boolean}
type Dados={colunas:Col[];permissoes:Record<string,'oculto'|'visualizar'|'movimentar'|'administrar'>;
 quadros:Array<{id:string;nome:string}>}
const manter=(lista:Col[])=>lista.map(c=>({...c}))
export default function KanbanColunasPreview(){
 const [dados,setDados]=useState<Dados|null>(null),[base,setBase]=useState<Record<string,Col[]>>({}),[rascunhos,setRascunhos]=useState<Record<string,Col[]>>({})
 const [setor,setSetor]=useState(''),[nomeNovo,setNomeNovo]=useState(''),[erro,setErro]=useState(''),[loading,setLoading]=useState(true),[arrastado,setArrastado]=useState<string|null>(null),[copiado,setCopiado]=useState(false)
 const carregar=useCallback(async()=>{
  try{setLoading(true);setErro('');const token=await tokenAtual();if(!token)throw Error('Entre no Atlas com um usuário autorizado.')
   const res=await fetch('/api/kanban/configuracao-colunas-preview',{headers:{Authorization:'Bearer '+token},cache:'no-store'})
   const json=await res.json().catch(()=>({}));if(!res.ok)throw Error(json.erro||'Kanbans indisponíveis')
   const rows=(json.colunas||[]) as Col[];const nomes=[...new Set(rows.map(r=>r.setor))]
   const grupos:Record<string,Col[]>={};for(const n of nomes)grupos[n]=manter(rows.filter(r=>r.setor===n).sort((a,b)=>a.ordem-b.ordem))
   setBase(grupos);setRascunhos(grupos);setDados(json);setSetor(old=>old&&nomes.includes(old)?old:nomes.find(n=>json.permissoes?.[n]==='administrar')||nomes[0]||'')
  }catch(e){setErro(e instanceof Error?e.message:'Erro ao carregar')}
  finally{setLoading(false)}
 },[])
 useEffect(()=>{void carregar()},[carregar])
 const quadros=dados?.quadros.filter(q=>dados.permissoes[q.id]==='administrar')||[]
 const cols=rascunhos[setor]||[]
 const alterações=useMemo(()=>JSON.stringify(rascunhos[setor]||[])!==JSON.stringify(base[setor]||[]),[rascunhos,base,setor])
 const modificar=(next:Col[])=>{setRascunhos(r=>({...r,[setor]:manter(next)}));setCopiado(false)}
 const mover=(a:number,b:number)=>{if(a<0||b<0||a>=cols.length||b>=cols.length||a===b)return
  const nova=[...cols],c=nova.splice(a,1)[0];nova.splice(b,0,c);modificar(nova)}
 const incluir=()=>{const nome=nomeNovo.trim();if(nome.length<2)return;modificar([...cols,{id:'previa-'+Date.now(),setor,nome,ordem:cols.length,visualNovo:true}]);setNomeNovo('')}
 const renomear=(c:Col)=>{const x=prompt('Novo nome da coluna (somente na prévia):',c.nome);if(x?.trim()&&x.trim().length>=2)modificar(cols.map(t=>t.id===c.id?{...t,nome:x.trim()}:t))}
 const excluir=(c:Col)=>{if(!confirm('Remover a coluna '+c.nome+' somente desta prévia? Nenhum card real será alterado.'))return;modificar(cols.filter(x=>x.id!==c.id))}
 const copiar=async()=>{const payload=JSON.stringify({setor,colunas:cols.map((c,ordemVisual)=>({id:c.id,nome:c.nome,ordemVisual,nova:!!c.visualNovo}))},null,2)
  try{await navigator.clipboard.writeText(payload);setCopiado(true)}catch{setErro('Não foi possível copiar. A simulação continua visível nesta página.')}}
 const secNome=(q:string)=>dados?.quadros.find(x=>x.id===q)?.nome||QUADROS.find(x=>x.id===q)?.nome||q
 return <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 md:px-7"><div className="mx-auto max-w-6xl space-y-5">
  <header className="flex flex-wrap items-start justify-between gap-3"><div><Link href="/kanban" className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-blue-700"><ArrowLeft size={17}/> Voltar à Central de Kanbans</Link><h1 className="text-2xl font-black">Configurar colunas dos Kanbans</h1><p className="mt-2 max-w-3xl text-sm text-slate-600">Experimente criar, renomear e mudar a ordem das colunas. Os quadros operacionais e a produção permanecem intocados.</p></div><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">Prévia sem gravação</span></header>
  <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-900"><ShieldAlert size={17} className="mb-1 inline"/> <b>Proteção do fluxo:</b> algumas etapas aprovam medidas, compras, produção e instalação. Esta prévia muda só a ordem visual dos cartões de colunas, não altera esses gatilhos. As permissões atuais continuam válidas.</div>
  {erro&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erro}</p>}
  <section className="rounded-2xl border bg-white p-5"><div className="flex flex-wrap items-end gap-3"><label className="min-w-[220px] flex-1 text-sm font-bold">Selecionar Kanban<select value={setor} onChange={e=>setSetor(e.target.value)} className="mt-2 w-full rounded-lg border p-3 text-sm"><option value="">Escolher quadro</option>{quadros.map(q=><option key={q.id} value={q.id}>{q.nome}</option>)}</select></label><button onClick={()=>{setRascunhos(s=>({...s,[setor]:base[setor]||[]}));setCopiado(false)}} disabled={!alterações} className="inline-flex items-center gap-2 rounded-lg border px-4 py-3 text-xs font-semibold disabled:opacity-40"><RotateCcw size={16}/> Restaurar prévia</button></div>
  {loading&&<p className="mt-3 text-sm text-slate-500">Carregando colunas atuais do Atlas...</p>}
  {!loading&&!quadros.length&&!erro&&<p className="mt-3 text-sm text-amber-700">Seu usuário não possui permissão para administrar colunas de Kanbans.</p>}
  {setor&&quadros.some(q=>q.id===setor)&&<><div className="my-4 flex flex-wrap gap-2"><input value={nomeNovo} onChange={e=>setNomeNovo(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')incluir()}} placeholder="Nome da nova coluna" className="min-w-[200px] flex-1 rounded-lg border p-3 text-sm"/><button onClick={incluir} disabled={nomeNovo.trim().length<2} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"><Plus size={17}/> Adicionar coluna</button></div>
   <p className="mb-3 text-xs text-slate-600">Arraste os cartões ou use as setas para mudar a sequência visual. Clique em Renomear para simular um novo nome.</p>
   <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{cols.map((c,i)=><div key={c.id} draggable onDragStart={()=>setArrastado(c.id)} onDragOver={e=>e.preventDefault()} onDrop={()=>{const a=cols.findIndex(x=>x.id===arrastado);mover(a,i);setArrastado(null)}} onDragEnd={()=>setArrastado(null)} className={'rounded-xl border-2 bg-white p-3 shadow-sm '+(arrastado===c.id?'border-blue-600 opacity-60':'border-slate-200')}>
    <div className="flex items-start justify-between gap-2"><div className="flex items-center gap-2"><GripVertical size={17} className="text-slate-400"/><div><p className="text-[11px] font-bold uppercase text-slate-400">Coluna {i+1}</p><b className="text-sm">{c.nome}</b></div></div><div className="flex gap-1"><button onClick={()=>mover(i,i-1)} disabled={i===0} className="rounded border p-1.5 disabled:opacity-30" title="Mover para esquerda"><ArrowUp size={15}/></button><button onClick={()=>mover(i,i+1)} disabled={i===cols.length-1} className="rounded border p-1.5 disabled:opacity-30" title="Mover para direita"><ArrowDown size={15}/></button></div></div>
    <p className="my-3 text-[11px] text-slate-500">{c.visualNovo?'Coluna nova, ainda não salva no Atlas':setor.startsWith('central:')&&c.ordem===indiceConclusaoOperacional(setor.slice('central:'.length))?'Etapa com possível regra de conclusão — preservar automação':'Ordem visual simulada; status reais não mudam'}</p>
    <div className="flex gap-2 border-t pt-2"><button onClick={()=>renomear(c)} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold text-blue-800"><Pencil size={13}/> Renomear</button><button onClick={()=>excluir(c)} disabled={cols.length<=1} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-40"><Trash2 size={13}/> Remover da prévia</button></div>
   </div>)}</div>
   <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-100 p-4"><div><p className="text-sm font-bold">{secNome(setor)} · {cols.length} colunas</p><p className="text-xs text-slate-600">{alterações?'Você modificou a sequência simulada. Nenhum dado real foi alterado.':'As colunas estão na ordem original do sistema.'}</p></div><button onClick={()=>void copiar()} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"><Copy size={15}/>{copiado?'Configuração copiada':'Copiar configuração para validação'}</button></div>
   <p className="mt-3 text-xs text-amber-800">A opção de salvar de verdade ficará disponível somente depois de validar como a reordenação deverá funcionar sem alterar as etapas operacionais.</p>
  </>}
  </section>
 </div></main>
}
