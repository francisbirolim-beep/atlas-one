'use client'
import {useCallback,useEffect,useMemo,useState} from 'react'
import Link from 'next/link'
import {ArrowLeft,BarChart3,CalendarDays,ChevronLeft,ChevronRight,Info,Plus,RefreshCw,Target} from 'lucide-react'
import {tokenAtual} from '@/lib/auth'
import {avaliarReserva,capacidadeMensal,type ProgramacaoInstalacao} from '@/lib/instalacaoCapacidade'
import {DEMO_INSTALACOES,DEMO_PROJETOS} from '@/lib/visaoGeralDemo'
const moeda=(n:number)=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const mesAtual=()=>new Date().toISOString().slice(0,7)
const mesTitulo=(m:string)=>new Date(m+'-01T12:00:00').toLocaleDateString('pt-BR',{month:'long',year:'numeric'})
const moverMes=(m:string,delta:number)=>{const [a,b]=m.split('-').map(Number);const d=new Date(a,b-1+delta,1);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')}
const formatarData=(d:string)=>new Date(d+'T12:00:00').toLocaleDateString('pt-BR')
type Programacao=ProgramacaoInstalacao&{dataPrevista?:string}
type Metas=Record<string,number>
export default function RelatorioInstalacoes(){
 const [demo,setDemo]=useState<boolean|null>(null),[mes,setMes]=useState(mesAtual)
 const [reservas,setReservas]=useState<Programacao[]>([]),[metas,setMetas]=useState<Metas>({})
 const [erro,setErro]=useState(''),[msg,setMsg]=useState(''),[carregando,setCarregando]=useState(true),[podeEditar,setPodeEditar]=useState(false)
 const [editandoMeta,setEditandoMeta]=useState(''),[novaVenda,setNovaVenda]=useState(''),[novaData,setNovaData]=useState(''),[novoValor,setNovoValor]=useState('')
 const [disponiveis,setDisponiveis]=useState<Array<{id:string;cliente:string;numero:string}>>([])
 const carregar=useCallback(async()=>{
  if(demo===null)return
  if(demo){setReservas(DEMO_INSTALACOES.map((r,i)=>({...r,dataPrevista:r.mes+'-'+String(6+i*3).padStart(2,'0')})));setMetas({'2026-10':100000,'2026-11':160000,'2026-12':130000});setPodeEditar(true);setCarregando(false);return}
  try{const token=await tokenAtual();if(!token)throw Error('Sessão expirada')
   const r=await fetch('/api/relatorios/instalacoes',{headers:{Authorization:'Bearer '+token},cache:'no-store'})
   const json=await r.json().catch(()=>({}));if(!r.ok)throw Error(json.erro||'Não foi possível abrir relatório')
   setReservas(json.reservas||[]);setMetas(json.metas||{});setPodeEditar(json.podeEditar===true);setErro(json.aviso||'')
   const pr=await fetch('/api/visao-geral-projetos',{headers:{Authorization:'Bearer '+token},cache:'no-store'})
   if(pr.ok){const cp=await pr.json();setDisponiveis((cp.cards||[]).map((p:any)=>({id:p.vendaId,cliente:p.cliente,numero:p.numeroOrcamento})))}
   else setDisponiveis([])
  }catch(e){setErro(e instanceof Error?e.message:'Falha na consulta')}
  finally{setCarregando(false)}
 },[demo])
 useEffect(()=>{setDemo(new URLSearchParams(window.location.search).get('demo')==='1')},[])
 useEffect(()=>{if(demo!==null)void carregar()},[carregar,demo])
 const meta=metas[mes]??null
 const resumo=useMemo(()=>capacidadeMensal(mes,meta,reservas),[mes,meta,reservas])
 const grafico=useMemo(()=>Array.from({length:6},(_,i)=>{const m=moverMes(mes,i);return capacidadeMensal(m,metas[m]??null,reservas)}),[mes,metas,reservas])
 const escala=Math.max(1,...grafico.flatMap(x=>[x.programado,x.meta??0]))
 const dias=new Date(Number(mes.slice(0,4)),Number(mes.slice(5)),0).getDate()
 const primeiro=new Date(mes+'-01T12:00:00').getDay()
 const planejadas=reservas.filter(r=>r.mes===mes&&r.estado!=='cancelado')
 const possibilidades=demo?DEMO_PROJETOS.map(p=>({id:p.vendaId,cliente:p.cliente,numero:p.numeroOrcamento})):disponiveis
 async function salvarMeta(){const valor=Number(editandoMeta.replace(',','.'));if(!Number.isFinite(valor)||valor<=0){setErro('Digite uma meta positiva em reais.');return}
  if(demo){setMetas(x=>({...x,[mes]:valor}));setMsg('Meta de demonstração atualizada apenas nesta sessão.');setErro('');return}
  try{const token=await tokenAtual();const r=await fetch('/api/relatorios/instalacoes',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({acao:'meta',mes,valor})});const j=await r.json();if(!r.ok)throw Error(j.erro||'Falha');setMsg('Meta salva');await carregar()}catch(e){setErro(String(e))}
 }
 async function programar(){const valor=Number(novoValor.replace(',','.'));const data=novaData,projeto=possibilidades.find(p=>p.id===novaVenda)
  if(!projeto||!data||!Number.isFinite(valor)||valor<=0){setErro('Escolha a obra, data e valor previsto.');return}
  const teste=avaliarReserva(data.slice(0,7),metas[data.slice(0,7)]??null,reservas,{vendaId:novaVenda,valor})
  let justificativaExcesso=''
  if(teste.ultrapassa){
   if(demo){if(!window.confirm('Esta simulação excederá a meta financeira. Continuar apenas na prévia?'))return}
   else {const justificativa=window.prompt('Limite mensal excedido. Registre justificativa Master com pelo menos 8 caracteres ou cancele:');if(!justificativa||justificativa.trim().length<8)return;justificativaExcesso=justificativa.trim()}
  }
  if(demo){setReservas(x=>[...x.filter(r=>r.vendaId!==novaVenda),{vendaId:novaVenda,cliente:projeto.cliente,numeroOrcamento:projeto.numero,mes:data.slice(0,7),dataPrevista:data,valor,estado:'previsto'}]);setMsg(teste.aviso);setErro('');return}
  try{
   const token=await tokenAtual();if(!token)throw Error('Sessão expirada')
   const r=await fetch('/api/relatorios/instalacoes',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
    body:JSON.stringify({acao:'programacao',vendaId:novaVenda,dataPrevista:data,valor,justificativaExcesso})})
   const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.erro||'Não foi possível programar.')
   setErro('');setMsg('Programação registrada e auditada. Não significa instalação confirmada.');await carregar()
  }catch(e){setErro(e instanceof Error?e.message:'Falha ao programar')}

 }
 const uso=resumo.utilizacao===null?'Não definido':resumo.utilizacao+'%'
 return <main className="min-h-screen bg-[#f3f6fb] px-4 py-6 text-slate-900 md:px-8">
 <div className="mx-auto max-w-7xl space-y-5">
 <div className="flex flex-wrap items-center justify-between gap-3"><div><Link href="/relatorios" className="inline-flex items-center gap-2 text-xs font-bold text-blue-700"><ArrowLeft size={15}/> Central de Relatórios</Link><h1 className="mt-2 text-2xl font-extrabold">Planejamento e capacidade de instalação</h1><p className="text-sm text-slate-500">Calendário, metas financeiras e programação mensal</p></div><div className="flex items-center gap-2">{demo&&<span className="rounded-lg bg-amber-100 px-3 py-2 text-xs font-bold text-amber-800">PRÉVIA FICTÍCIA</span>}<Link href={'/visao-geral-projetos'+(demo?'?demo=1':'')} className="rounded-lg border bg-white px-3 py-2 text-sm">Kanban Geral</Link><button onClick={()=>void carregar()} className="rounded-lg border bg-white p-2"><RefreshCw size={18}/></button></div></div>
 {erro&&<p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{erro}</p>}
 {msg&&<p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{msg}</p>}
 <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm"><div className="flex items-center gap-3"><button aria-label="Mês anterior" onClick={()=>setMes(moverMes(mes,-1))} className="rounded-lg border p-2"><ChevronLeft size={18}/></button><h2 className="min-w-[180px] text-center text-lg font-bold capitalize">{mesTitulo(mes)}</h2><button aria-label="Mês seguinte" onClick={()=>setMes(moverMes(mes,1))} className="rounded-lg border p-2"><ChevronRight size={18}/></button></div><div className="flex flex-wrap items-center gap-2">{podeEditar&&<><Target size={18} className="text-blue-700"/><label className="text-xs font-semibold" htmlFor="meta-mensal">Meta mensal em R$</label><input id="meta-mensal" inputMode="decimal" value={editandoMeta} onChange={e=>setEditandoMeta(e.target.value)} placeholder={meta?.toString()||'Sem meta'} className="w-32 rounded-lg border px-3 py-2 text-sm"/><button onClick={()=>void salvarMeta()} className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white">Salvar meta</button></>}</div></div>
 <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[
  ['Valor programado',moeda(resumo.programado)],['Meta do mês',meta===null?'Sem meta':moeda(meta)],['Ocupação da meta',uso],['Capacidade restante',resumo.saldo===null?'Não calculada':moeda(resumo.saldo)]
 ].map(([titulo,valor])=><div key={titulo} className="rounded-xl border bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">{titulo}</p><b className="mt-1 block text-xl">{valor}</b></div>)}</section>
 <p className={'rounded-lg border p-3 text-sm font-semibold '+(resumo.situacao==='excedido'?'border-rose-300 bg-rose-50 text-rose-800':resumo.situacao==='atencao'?'border-amber-300 bg-amber-50 text-amber-800':'border-blue-100 bg-blue-50 text-blue-800')}>{resumo.situacao==='excedido'?'A programação financeira ultrapassa a meta. Avalie mover instalações para outro mês.':resumo.situacao==='atencao'?'Atenção: ocupação financeira acima de 85% da meta.':resumo.situacao==='sem_meta'?'Defina a meta para acompanhar a utilização mensal.':'Programação financeira dentro da meta.'} Meta em R$ não substitui capacidade física de equipe/dias.</p>
 <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
  <section className="rounded-xl border bg-white p-4"><h3 className="mb-4 flex items-center gap-2 font-bold"><BarChart3 size={18}/> Programado × capacidade — próximos 6 meses</h3><div className="space-y-3">{grafico.map(x=><div key={x.mes} className="space-y-1"><div className="flex justify-between text-xs"><b className="capitalize">{mesTitulo(x.mes)}</b><span>{moeda(x.programado)} / {x.meta===null?'sem meta':moeda(x.meta)}</span></div><div className="relative h-4 rounded-full bg-slate-100"><div className="absolute inset-y-0 left-0 rounded-full bg-blue-600" style={{width:(x.programado/escala*100)+'%'}}/><div className="absolute inset-y-0 w-[2px] bg-amber-500" style={{left:(x.meta===null?100:x.meta/escala*100)+'%'}}/></div></div>)}</div><p className="mt-3 text-xs text-slate-500">Azul: valor programado. Traço laranja: meta mensal, quando cadastrada.</p></section>
  <section className="rounded-xl border bg-white p-4"><h3 className="mb-3 flex items-center gap-2 font-bold"><CalendarDays size={18}/> Situação das instalações do mês</h3><div className="space-y-2"><p className="text-sm">Previsto: <b>{moeda(planejadas.filter(r=>r.estado==='previsto').reduce((s,r)=>s+r.valor,0))}</b></p><p className="text-sm">Confirmado: <b>{moeda(resumo.confirmado)}</b></p><p className="text-sm">Concluído: <b>{moeda(resumo.concluido)}</b></p><p className="text-sm">Obras programadas: <b>{resumo.quantidade}</b></p></div><div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600"><Info size={15} className="mr-2 inline"/>O Atlas só deve considerar uma instalação confirmada ou concluída quando houver registro oficial do setor. Previsão comercial é separada.</div></section>
 </div>
 <section className="rounded-xl border bg-white p-4"><h3 className="mb-3 text-lg font-extrabold">Calendário de instalações</h3><div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-slate-500">{['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d=><div key={d} className="py-2">{d}</div>)}</div><div className="grid grid-cols-7 gap-1">{Array.from({length:primeiro},(_,i)=><div key={'v'+i}/>)}{Array.from({length:dias},(_,i)=>{const dia=String(i+1).padStart(2,'0'),agenda=planejadas.filter(p=>p.dataPrevista===mes+'-'+dia);return <div key={dia} className={'min-h-[68px] rounded-lg border p-1.5 text-xs '+(agenda.length?'border-blue-200 bg-blue-50':'border-slate-100 bg-white')}><span className="font-bold">{i+1}</span>{agenda.map(p=><div key={p.vendaId} className="mt-1 truncate rounded bg-blue-600 p-1 text-[10px] text-white" title={p.cliente+' '+moeda(p.valor)}>{p.cliente}</div>)}</div>})}</div></section>
 <section className="rounded-xl border bg-white p-4"><h3 className="mb-3 font-bold">Obras previstas para {mesTitulo(mes)}</h3><div className="overflow-x-auto"><table className="w-full min-w-[580px] text-left text-sm"><thead className="border-b bg-slate-50 text-xs text-slate-500"><tr><th className="p-3">Cliente / orçamento</th><th className="p-3">Data</th><th className="p-3">Situação</th><th className="p-3 text-right">Valor previsto</th></tr></thead><tbody>{planejadas.map(r=><tr key={r.vendaId} className="border-b"><td className="p-3 font-semibold">{r.cliente}<span className="block text-xs font-normal text-slate-500">Orçamento {r.numeroOrcamento}</span></td><td className="p-3">{r.dataPrevista?formatarData(r.dataPrevista):'Mês sem dia definido'}</td><td className="p-3 capitalize">{r.estado}</td><td className="p-3 text-right">{moeda(r.valor)}</td></tr>)}{!planejadas.length&&<tr><td colSpan={4} className="p-6 text-center text-slate-500">Nenhuma programação registrada para este mês.</td></tr>}</tbody></table></div></section>
 {podeEditar&&<section className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/50 p-4"><h3 className="flex items-center gap-2 font-bold"><Plus size={17}/> {demo?'Simular instalação (somente prévia)':'Programar instalação prevista'}</h3><div className="flex flex-wrap items-end gap-2"><label className="text-xs font-semibold">Projeto<select value={novaVenda} onChange={e=>setNovaVenda(e.target.value)} className="mt-1 block max-w-[240px] rounded-lg border p-2 text-sm"><option value="">Selecione</option>{possibilidades.map(p=><option key={p.id} value={p.id}>{p.cliente} · {p.numero}</option>)}</select></label><label className="text-xs font-semibold">Data<input type="date" value={novaData} onChange={e=>setNovaData(e.target.value)} className="mt-1 block rounded-lg border p-2 text-sm"/></label><label className="text-xs font-semibold">Valor previsto (R$)<input inputMode="decimal" value={novoValor} onChange={e=>setNovoValor(e.target.value)} className="mt-1 block w-40 rounded-lg border p-2 text-sm"/></label><button onClick={()=>void programar()} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white">{demo?'Simular reserva':'Programar data'}</button></div><p className="text-xs text-slate-600">{demo?'A simulação não reserva equipe, não agenda obra real e não grava nada no banco.':'Programação prevista não confirma execução, equipe ou conclusão física. Somente Master pode salvar; a migração da agenda deve ser homologada.'}</p></section>}
 {carregando&&<p className="text-xs text-slate-500">Consultando programação...</p>}
 </div></main>
}
