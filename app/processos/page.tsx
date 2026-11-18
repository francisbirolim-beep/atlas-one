'use client'
import { useEffect, useRef, useState } from 'react'
import { usuarioAtual } from '@/lib/auth'

type Kind='inicio'|'tarefa'|'decisao'|'fim'|'cargo'|'nota'
type Mode='fluxo'|'org'
type Box={id:string;kind:Kind;title:string;owner:string;description:string;criteria:string;images:string[];x:number;y:number}
type Arrow={id:string;from:string;to:string;label:string}
type Drawing={boxes:Box[];arrows:Arrow[]}
type Process={id:string;name:string;description:string;fluxo:Drawing;org:Drawing}
type Sector={id:string;name:string;processes:Process[]}
type Workspace={version:2;sectors:Sector[];sectorId:string;processId:string;mode:Mode}
const key='atlas-processos-empresa-rascunhos-v2'
const id=()=>Math.random().toString(36).slice(2,11)
const empty=():Drawing=>({boxes:[],arrows:[]})
const process=(name:string):Process=>({id:id(),name,description:'',fluxo:empty(),org:empty()})
const clone=<T,>(v:T):T=>JSON.parse(JSON.stringify(v))
function seed():Workspace{
  const purchase=process('Compra e recebimento de materiais')
  purchase.description='Fluxo documental ilustrativo; não libera ordens de produção.'
  const box=(kind:Kind,title:string,x:number,y:number,owner:string,description=''):Box=>({id:id(),kind,title,x,y,owner,description,criteria:'',images:[]})
  const a=box('inicio','Compra realizada',90,160,'Compras')
  const b=box('tarefa','Conferir vidro e perfil',390,160,'Recebimento','Registrar os dois recebimentos separadamente.')
  const c=box('decisao','Vidro conferido?',680,160,'Recebimento')
  const d=box('decisao','Perfil conferido?',970,160,'Recebimento')
  const e=box('tarefa','Aguardar pendência',800,435,'Compras')
  const f=box('fim','Conferir regras técnicas',1260,160,'Produção','Medição, materiais e ordens devem obedecer às liberações oficiais do Atlas.')
  purchase.fluxo={boxes:[a,b,c,d,e,f],arrows:[{id:id(),from:a.id,to:b.id,label:''},{id:id(),from:b.id,to:c.id,label:''},{id:id(),from:c.id,to:d.id,label:'Sim'},{id:id(),from:c.id,to:e.id,label:'Não'},{id:id(),from:d.id,to:f.id,label:'Sim'},{id:id(),from:d.id,to:e.id,label:'Não'},{id:id(),from:e.id,to:b.id,label:'Rever'}]}
  const director=box('cargo','Direção',670,70,'Diretoria'),compras=box('cargo','Compras',350,300,'Responsável por compras'),estoque=box('cargo','Estoque',670,300,'Responsável por recebimentos'),producao=box('cargo','Produção',990,300,'Gestor da fábrica')
  purchase.org={boxes:[director,compras,estoque,producao],arrows:[compras,estoque,producao].map(n=>({id:id(),from:director.id,to:n.id,label:''}))}
  const names=['Compras','Produção','Comercial','Orçamentos','Financeiro','RH','Estoque','Medição Técnica','Instalação','Qualidade','Pós-venda','Gestão']
  const sectors=names.map(name=>({id:id(),name,processes:name==='Compras'?[purchase]:[process('Processo principal')]}))
  return {version:2,sectors,sectorId:sectors[0].id,processId:purchase.id,mode:'fluxo'}
}
function validate(raw:any):raw is Workspace{
  if(!raw||raw.version!==2||!Array.isArray(raw.sectors)||raw.sectors.length<1||raw.sectors.length>80||!['fluxo','org'].includes(raw.mode))return false
  let boxes=0
  for(const s of raw.sectors){
    if(typeof s.id!=='string'||typeof s.name!=='string'||!Array.isArray(s.processes)||s.processes.length>100)return false
    for(const p of s.processes){
      if(typeof p.id!=='string'||typeof p.name!=='string'||typeof p.description!=='string')return false
      for(const mode of ['fluxo','org'] as const){
        const d=p[mode];if(!d||!Array.isArray(d.boxes)||!Array.isArray(d.arrows)||d.boxes.length>350||d.arrows.length>900)return false
        boxes+=d.boxes.length;if(boxes>2500)return false
        const ids=new Set<string>()
        for(const b of d.boxes){
          if(typeof b.id!=='string'||ids.has(b.id)||!['inicio','tarefa','decisao','fim','cargo','nota'].includes(b.kind)||typeof b.title!=='string'||typeof b.owner!=='string'||typeof b.description!=='string'||typeof b.criteria!=='string'||typeof b.x!=='number'||typeof b.y!=='number'||!Number.isFinite(b.x)||!Number.isFinite(b.y)||b.x<0||b.y<0||b.x>2200||b.y>1350||!Array.isArray(b.images)||b.images.length>5)return false
          if(b.title.length>160||b.description.length>20000||b.criteria.length>5000||b.images.some((img:unknown)=>typeof img!=='string'||img.length>900000||!/^data:image\/(jpeg|png|webp);base64,[a-zA-Z0-9+/=]+$/.test(img)))return false
          ids.add(b.id)
        }
        for(const a of d.arrows)if(typeof a.id!=='string'||typeof a.from!=='string'||typeof a.to!=='string'||typeof a.label!=='string'||!ids.has(a.from)||!ids.has(a.to)||a.from===a.to)return false
      }
    }
  }
  return raw.sectors.some((s:Sector)=>s.id===raw.sectorId&&s.processes.some(p=>p.id===raw.processId))
}
async function imageToData(file:File):Promise<string>{
  if(file.size>8_000_000||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Imagem inválida ou acima de 8 MB.')
  const url=URL.createObjectURL(file)
  try{
    const im=new Image()
    await new Promise<void>((ok,bad)=>{im.onload=()=>ok();im.onerror=()=>bad(new Error('Falha ao abrir imagem.'));im.src=url})
    const cv=document.createElement('canvas'),scale=Math.min(1,800/im.width,800/im.height)
    cv.width=Math.max(1,Math.round(im.width*scale));cv.height=Math.max(1,Math.round(im.height*scale))
    const ctx=cv.getContext('2d');if(!ctx)throw Error('Canvas indisponível.')
    ctx.fillStyle='#fff';ctx.fillRect(0,0,cv.width,cv.height);ctx.drawImage(im,0,0,cv.width,cv.height)
    const data=cv.toDataURL('image/jpeg',.65);if(data.length>900000)throw Error('Imagem grande demais.')
    return data
  }finally{URL.revokeObjectURL(url)}
}
const style='rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100'
export default function ProcessosEmpresa(){
  const [ws,setWs]=useState<Workspace>(seed)
  const [ready,setReady]=useState(false)
  const [userId,setUserId]=useState('')
  const [blocked,setBlocked]=useState(false)
  const [selected,setSelected]=useState<{type:'box'|'arrow';id:string}|null>(null)
  const [connect,setConnect]=useState(false),[source,setSource]=useState('')
  const [zoom,setZoom]=useState(1),[status,setStatus]=useState('')
  const [history,setHistory]=useState<Workspace[]>([])
  const [storageError,setStorageError]=useState(false)
  const [search,setSearch]=useState('')
  const scroll=useRef<HTMLDivElement>(null),importRef=useRef<HTMLInputElement>(null)
  const drag=useRef<{id:string;x:number;y:number;px:number;py:number;moved:boolean}|null>(null)
  const skipClick=useRef(false)
  useEffect(()=>{let alive=true;usuarioAtual().then(u=>{if(!alive)return;if(!u||u.role!=='master'){setBlocked(true);return}setUserId(u.id);try{const saved=localStorage.getItem(key+':'+u.id);if(saved){const parsed=JSON.parse(saved);if(validate(parsed))setWs(parsed)}}catch{}setReady(true)}).catch(()=>{if(alive)setBlocked(true)});return()=>{alive=false}},[])
  useEffect(()=>{if(!ready||!userId)return;try{localStorage.setItem(key+':'+userId,JSON.stringify(ws));setStorageError(false)}catch{setStorageError(true)}},[ws,userId,ready])
  const sector=ws.sectors.find(s=>s.id===ws.sectorId),proc=sector?.processes.find(p=>p.id===ws.processId),drawing=proc?.[ws.mode]
  const boxes=drawing?.boxes||[],arrows=drawing?.arrows||[]
  const selBox=selected?.type==='box'?boxes.find(n=>n.id===selected.id):undefined
  const selArrow=selected?.type==='arrow'?arrows.find(n=>n.id===selected.id):undefined
  function update(fn:(d:Workspace)=>void,remember=true){const next=clone(ws);fn(next);if(remember)setHistory(h=>[...h.slice(-25),ws]);setWs(next)}
  function editBox(field:'title'|'owner'|'description'|'criteria',value:string){if(!selBox)return;update(d=>{const b=d.sectors.find(s=>s.id===d.sectorId)?.processes.find(p=>p.id===d.processId)?.[d.mode].boxes.find(b=>b.id===selBox.id);if(b)b[field]=value},false)}
  function editArrow(value:string){if(!selArrow)return;update(d=>{const a=d.sectors.find(s=>s.id===d.sectorId)?.processes.find(p=>p.id===d.processId)?.[d.mode].arrows.find(a=>a.id===selArrow.id);if(a)a.label=value},false)}
  function newSector(){const name=prompt('Nome do setor:')?.trim().slice(0,80);if(!name)return;if(ws.sectors.some(s=>s.name.toLowerCase()===name.toLowerCase()))return setStatus('Setor já existe.');const p=process('Processo principal'),sid=id();update(d=>{d.sectors.push({id:sid,name,processes:[p]});d.sectorId=sid;d.processId=p.id});setSelected(null)}
  function newProcess(){const name=prompt('Nome do processo:')?.trim().slice(0,120);if(!name)return;const p=process(name);update(d=>{const s=d.sectors.find(s=>s.id===d.sectorId);if(s){s.processes.push(p);d.processId=p.id}});setSelected(null)}
  function renameSector(){if(!sector)return;const name=prompt('Novo nome do setor:',sector.name)?.trim().slice(0,80);if(!name)return;if(ws.sectors.some(s=>s.id!==sector.id&&s.name.toLowerCase()===name.toLowerCase()))return setStatus('Já existe setor com este nome.');update(d=>{const s=d.sectors.find(s=>s.id===d.sectorId);if(s)s.name=name})}
  function renameProcess(){if(!proc)return;const name=prompt('Novo nome do processo:',proc.name)?.trim().slice(0,120);if(!name)return;update(d=>{const p=d.sectors.find(s=>s.id===d.sectorId)?.processes.find(p=>p.id===d.processId);if(p)p.name=name})}
  function removeProcess(){if(!proc||!sector||sector.processes.length<=1)return setStatus('Cada setor precisa manter pelo menos um processo.');if(!confirm('Excluir o processo e todos os seus quadrinhos? Exporte uma cópia antes, se necessário.'))return;update(d=>{const s=d.sectors.find(s=>s.id===d.sectorId);if(!s)return;s.processes=s.processes.filter(p=>p.id!==d.processId);d.processId=s.processes[0].id});setSelected(null)}
  function removeSector(){if(!sector||ws.sectors.length<=1)return setStatus('É necessário manter pelo menos um setor.');if(!confirm('Excluir o setor, seus processos e todos os quadrinhos? Exporte uma cópia antes, se necessário.'))return;update(d=>{d.sectors=d.sectors.filter(s=>s.id!==d.sectorId);d.sectorId=d.sectors[0].id;d.processId=d.sectors[0].processes[0].id});setSelected(null)}
  function addBox(kind:Kind){if(!drawing)return;const finalKind=ws.mode==='org'?'cargo':kind;const x=Math.max(20,Math.min(2180,Math.round(((scroll.current?.scrollLeft||0)+(scroll.current?.clientWidth||650)/2)/zoom-105)));const y=Math.max(20,Math.min(1330,Math.round(((scroll.current?.scrollTop||0)+(scroll.current?.clientHeight||430)/2)/zoom-55)));const b:Box={id:id(),kind:finalKind,title:finalKind==='decisao'?'Nova decisão':finalKind==='cargo'?'Novo cargo':'Nova etapa',owner:'',description:'',criteria:'',images:[],x,y};update(d=>{d.sectors.find(s=>s.id===d.sectorId)?.processes.find(p=>p.id===d.processId)?.[d.mode].boxes.push(b)});setSelected({type:'box',id:b.id})}
  function selectBox(idBox:string){if(skipClick.current){skipClick.current=false;return}if(!connect){setSelected({type:'box',id:idBox});return}if(!source){setSource(idBox);setSelected({type:'box',id:idBox});return}if(source===idBox||arrows.some(a=>a.from===source&&a.to===idBox))return setStatus('Selecione outro destino válido.');const a:Arrow={id:id(),from:source,to:idBox,label:''};update(d=>{d.sectors.find(s=>s.id===d.sectorId)?.processes.find(p=>p.id===d.processId)?.[d.mode].arrows.push(a)});setConnect(false);setSource('');setSelected({type:'arrow',id:a.id})}
  function pointerStart(e:React.PointerEvent<HTMLButtonElement>,b:Box){if(connect)return;drag.current={id:b.id,x:b.x,y:b.y,px:e.clientX,py:e.clientY,moved:false};e.currentTarget.setPointerCapture(e.pointerId)}
  function pointerMove(e:React.PointerEvent<HTMLButtonElement>){const dr=drag.current;if(!dr)return;const dx=(e.clientX-dr.px)/zoom,dy=(e.clientY-dr.py)/zoom;if(!dr.moved&&Math.abs(dx)+Math.abs(dy)<4)return;if(!dr.moved){setHistory(h=>[...h.slice(-25),ws]);dr.moved=true}const x=Math.min(2180,Math.max(0,Math.round(dr.x+dx))),y=Math.min(1330,Math.max(0,Math.round(dr.y+dy)));setWs(old=>{const d=clone(old),b=d.sectors.find(s=>s.id===d.sectorId)?.processes.find(p=>p.id===d.processId)?.[d.mode].boxes.find(b=>b.id===dr.id);if(b){b.x=x;b.y=y}return d})}
  function pointerEnd(){if(drag.current?.moved)skipClick.current=true;drag.current=null}
  function remove(){if(!selected||!confirm('Excluir elemento do rascunho?'))return;update(d=>{const graph=d.sectors.find(s=>s.id===d.sectorId)?.processes.find(p=>p.id===d.processId)?.[d.mode];if(!graph)return;if(selected.type==='box'){graph.boxes=graph.boxes.filter(b=>b.id!==selected.id);graph.arrows=graph.arrows.filter(a=>a.from!==selected.id&&a.to!==selected.id)}else graph.arrows=graph.arrows.filter(a=>a.id!==selected.id)});setSelected(null)}
  async function addImages(ev:React.ChangeEvent<HTMLInputElement>){if(!selBox)return;const files=Array.from(ev.target.files||[]).slice(0,5-selBox.images.length);ev.target.value='';const images:string[]=[];for(const file of files)try{images.push(await imageToData(file))}catch(error){setStatus(error instanceof Error?error.message:'Imagem inválida.')}if(images.length)update(d=>{const b=d.sectors.find(s=>s.id===d.sectorId)?.processes.find(p=>p.id===d.processId)?.[d.mode].boxes.find(b=>b.id===selBox.id);if(b)b.images.push(...images)})}
  function exportJson(){const url=URL.createObjectURL(new Blob([JSON.stringify(ws,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='atlas-processos-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
  async function importJson(e:React.ChangeEvent<HTMLInputElement>){const file=e.target.files?.[0];e.target.value='';if(!file)return;try{if(file.size>15_000_000)throw Error('Arquivo acima de 15 MB');const content=JSON.parse(await file.text());if(!validate(content))throw Error('Arquivo incompatível ou inválido');if(!confirm('Substituir o rascunho deste navegador?'))return;setHistory(h=>[...h.slice(-25),ws]);setWs(content);setSelected(null);setStatus('Importação concluída.')}catch(error){setStatus(error instanceof Error?error.message:'Falha na importação.')}}
  function path(a:Arrow){const n=boxes.find(n=>n.id===a.from),m=boxes.find(n=>n.id===a.to);if(!n||!m)return '';if(m.x>n.x+50)return 'M'+(n.x+210)+' '+(n.y+55)+' C'+(n.x+275)+' '+(n.y+55)+' '+(m.x-65)+' '+(m.y+55)+' '+m.x+' '+(m.y+55);return 'M'+(n.x+105)+' '+(n.y+110)+' C'+(n.x+105)+' '+(n.y+205)+' '+(m.x+105)+' '+(m.y-90)+' '+(m.x+105)+' '+m.y}
  if(blocked)return <div className="rounded-xl bg-white p-8 text-center"><b>Acesso restrito</b><p>Durante a homologação, o editor é exclusivo do usuário Master.</p></div>
  if(!ready)return <p className="p-8 text-center text-slate-500">Carregando editor...</p>
  return <main className="min-h-screen space-y-3 bg-slate-50 p-3 md:p-5">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-bold text-slate-900">Processos da Empresa</h1><p className="text-xs text-slate-500">Organogramas, fluxogramas e procedimentos • Esquadrifácio</p></div><div className="flex flex-wrap gap-2"><span className="rounded-md bg-amber-100 px-2 py-2 text-xs font-semibold text-amber-800">RASCUNHO ISOLADO</span><button className={style} disabled={!history.length} onClick={()=>{if(history.length){setWs(history[history.length-1]);setHistory(h=>h.slice(0,-1));setSelected(null)}}}>Desfazer</button><button className={style} onClick={exportJson}>Exportar JSON</button><button className={style} onClick={()=>importRef.current?.click()}>Importar JSON</button><input hidden type="file" ref={importRef} accept=".json,application/json" onChange={importJson}/></div></header>
    <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">Editor documental de teste: não altera pedidos, estoque, compras, RH nem as regras oficiais de produção. Os dados ficam no navegador deste Master. {storageError?'⚠ Falha no salvamento; exporte JSON.':'Faça exportações JSON como cópia de segurança.'}</div>
    {status&&<div className="flex justify-between rounded-lg border bg-white px-3 py-2 text-xs"><span>{status}</span><button onClick={()=>setStatus('')}>×</button></div>}
    <div className="grid min-h-[630px] grid-cols-1 gap-3 xl:grid-cols-[180px_minmax(0,1fr)_280px]">
      <aside className="rounded-xl border bg-white p-3"><h2 className="mb-2 text-sm font-semibold">Setores</h2><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar setor" className="mb-2 w-full rounded-lg border px-2 py-2 text-xs"/><div className="max-h-80 space-y-1 overflow-auto xl:max-h-[470px]">{ws.sectors.filter(s=>s.name.toLowerCase().includes(search.toLowerCase())).map(s=><button key={s.id} onClick={()=>{setWs(d=>({...d,sectorId:s.id,processId:s.processes[0]?.id||''}));setSelected(null)}} className={'w-full rounded-lg px-3 py-2 text-left text-sm '+(s.id===ws.sectorId?'bg-blue-700 text-white':'hover:bg-slate-100')}>{s.name}</button>)}</div><button className={style+' mt-3 w-full'} onClick={newSector}>+ Setor</button><div className="mt-2 flex gap-2"><button className={style+' flex-1'} onClick={renameSector}>Renomear setor</button><button className={style+' text-rose-700'} onClick={removeSector}>Excluir</button></div><hr className="my-4"/><h3 className="mb-2 text-xs font-semibold">Processos do setor</h3><select value={ws.processId} onChange={e=>{setWs({...ws,processId:e.target.value});setSelected(null)}} className="mb-2 w-full rounded-lg border px-2 py-2 text-xs">{sector?.processes.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><button className={style+' w-full'} onClick={newProcess}>+ Processo</button><div className="mt-2 flex gap-2"><button className={style+' flex-1'} onClick={renameProcess}>Renomear</button><button className={style+' text-rose-700'} onClick={removeProcess}>Excluir</button></div></aside>
      <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border bg-white"><div className="flex flex-wrap items-center justify-between gap-2 border-b p-3"><div><h2 className="font-semibold">{proc?.name}</h2><p className="text-xs text-slate-500">Arraste os quadrinhos e ligue com setas.</p></div><div className="flex gap-1"><button className={style+(ws.mode==='fluxo'?' border-blue-500 bg-blue-50':'')} onClick={()=>{setWs({...ws,mode:'fluxo'});setSelected(null)}}>Fluxograma</button><button className={style+(ws.mode==='org'?' border-blue-500 bg-blue-50':'')} onClick={()=>{setWs({...ws,mode:'org'});setSelected(null)}}>Organograma</button></div></div>
      <div className="flex flex-wrap gap-2 border-b p-2">{ws.mode==='org'?<button className={style} onClick={()=>addBox('cargo')}>+ Cargo</button>:<><button className={style} onClick={()=>addBox('inicio')}>+ Início</button><button className={style} onClick={()=>addBox('tarefa')}>+ Quadrinho</button><button className={style} onClick={()=>addBox('decisao')}>+ Decisão</button><button className={style} onClick={()=>addBox('nota')}>+ Nota</button><button className={style} onClick={()=>addBox('fim')}>+ Fim</button></>}<button className={style+(connect?' border-blue-500 bg-blue-100':'')} onClick={()=>{setConnect(!connect);setSource('')}}>{connect?'Cancelar ligação':'↗ Ligar seta'}</button><span className="flex-1"/><button className={style} onClick={()=>setZoom(z=>Math.max(.5,z-.1))}>−</button><span className="self-center text-xs">{Math.round(zoom*100)}%</span><button className={style} onClick={()=>setZoom(z=>Math.min(1.5,z+.1))}>+</button></div>
      {connect&&<p className="border-b bg-blue-50 p-2 text-xs text-blue-700">{source?'Selecione o quadrinho de destino':'Selecione o quadrinho de origem'}</p>}
      <div ref={scroll} className="min-h-[430px] flex-1 overflow-auto bg-slate-100" style={{backgroundImage:'radial-gradient(#cbd5e1 1px,transparent 1px)',backgroundSize:'20px 20px'}}><div className="relative" style={{width:2400*zoom,height:1500*zoom}}><div className="absolute left-0 top-0" style={{width:2400,height:1500,transform:'scale('+zoom+')',transformOrigin:'0 0'}}><svg width="2400" height="1500" className="pointer-events-none absolute inset-0"><defs><marker id="atlas-process-arrow" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0 0 L0 6 L7 3" fill="#64748b"/></marker></defs>{arrows.map(a=>{const from=boxes.find(b=>b.id===a.from),to=boxes.find(b=>b.id===a.to);if(!from||!to)return null;return <g key={a.id}><path d={path(a)} stroke={selected?.id===a.id?'#2563eb':'#64748b'} strokeWidth="2.5" fill="none" markerEnd="url(#atlas-process-arrow)"/><path d={path(a)} stroke="transparent" strokeWidth="20" fill="none" className="pointer-events-auto cursor-pointer" onClick={()=>{if(!connect)setSelected({type:'arrow',id:a.id})}}/><text x={(from.x+to.x+210)/2} y={(from.y+to.y+110)/2-12} fontSize="13" textAnchor="middle" fill="#1d4ed8">{a.label}</text></g>})}</svg>{boxes.map(b=><button type="button" key={b.id} onPointerDown={e=>pointerStart(e,b)} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd} onClick={()=>selectBox(b.id)} style={{left:b.x,top:b.y,width:210,minHeight:110,touchAction:'none'}} className={'absolute z-10 flex cursor-grab select-none flex-col justify-center rounded-xl border-2 p-3 text-left shadow-sm '+(b.kind==='decisao'?'border-amber-400 bg-amber-50':b.kind==='cargo'?'border-indigo-400 bg-indigo-50':b.kind==='inicio'||b.kind==='fim'?'rounded-full border-emerald-400 bg-emerald-50':'border-slate-300 bg-white')+(selected?.id===b.id?' ring-4 ring-blue-200':'')}><small className="font-bold uppercase text-slate-500">{b.kind}</small><b className="break-words text-sm">{b.title}</b><small className="truncate text-slate-500">{b.owner}</small>{b.images.length>0&&<small>📷 {b.images.length} imagem(ns)</small>}</button>)}</div></div></div><div className="border-t px-3 py-2 text-xs text-slate-500">{boxes.length} quadrinhos • {arrows.length} setas</div></section>
      <aside className="min-w-0 rounded-xl border bg-white p-3"><h2 className="font-bold">Detalhes e procedimentos</h2>{selBox?<div key={selBox.id} className="mt-3 space-y-3"><label className="block text-xs font-semibold">Título<input className="mt-1 w-full rounded-lg border p-2" maxLength={160} value={selBox.title} onChange={e=>editBox('title',e.target.value)}/></label><label className="block text-xs font-semibold">Responsável / cargo<input className="mt-1 w-full rounded-lg border p-2" value={selBox.owner} maxLength={160} onChange={e=>editBox('owner',e.target.value)}/></label><label className="block text-xs font-semibold">Passo a passo<textarea className="mt-1 min-h-32 w-full rounded-lg border p-2" maxLength={20000} value={selBox.description} onChange={e=>editBox('description',e.target.value)}/></label><label className="block text-xs font-semibold">Critérios / condições<textarea className="mt-1 min-h-20 w-full rounded-lg border p-2" maxLength={5000} value={selBox.criteria} onChange={e=>editBox('criteria',e.target.value)}/></label><label className="block text-xs font-semibold">Fotos ilustrativas ({selBox.images.length}/5)<input type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={addImages} className="mt-1 w-full text-xs"/></label><div className="grid grid-cols-2 gap-2">{selBox.images.map((src,i)=><div className="relative" key={i}><img src={src} alt={'Procedimento '+(i+1)} className="h-24 w-full rounded object-cover"/><button className="absolute right-0 top-0 rounded bg-red-700 px-2 text-white" onClick={()=>update(d=>{d.sectors.find(s=>s.id===d.sectorId)?.processes.find(p=>p.id===d.processId)?.[d.mode].boxes.find(b=>b.id===selBox.id)?.images.splice(i,1)})}>×</button></div>)}</div><button className={style+' text-rose-700'} onClick={remove}>Excluir quadrinho</button></div>:selArrow?<div className="mt-3"><label className="text-xs font-semibold">Texto da seta (Sim/Não)<input className="mt-2 w-full rounded-lg border p-2" value={selArrow.label} maxLength={80} onChange={e=>editArrow(e.target.value)}/></label><button className={style+' mt-3 text-rose-700'} onClick={remove}>Excluir seta</button></div>:<div className="mt-4 space-y-3"><p className="text-sm text-slate-500">Clique num quadrinho para editar o procedimento escrito, o responsável e as imagens.</p><label className="block text-xs font-semibold">Descrição geral do processo<textarea className="mt-2 min-h-36 w-full rounded-lg border p-2 text-sm" value={proc?.description||''} maxLength={20000} onChange={e=>update(d=>{const p=d.sectors.find(s=>s.id===d.sectorId)?.processes.find(p=>p.id===d.processId);if(p)p.description=e.target.value},false)}/></label></div>}<p className="mt-6 border-t pt-3 text-[11px] text-slate-500">Rascunho local e individual. Não cria tarefas, compras ou ordens no Atlas em produção.</p></aside>
    </div>
  </main>
}