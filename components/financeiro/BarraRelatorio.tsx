'use client'
import {useMemo,useState} from 'react'
import {FileDown,Printer} from 'lucide-react'
export type LinhaFinanceira={id:string;pessoa:string;documento:string;parcela:string;vencimento:string;pagamento:string;valor:number;saldo:number;status:string;forma:string;obra?:string;origem?:string}
type Campo='vencimento'|'pagamento'
type Estado='todos'|'aberto'|'vencido'|'pago'|'parcial'
const moeda=(n:number)=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const dateBR=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)?v.slice(8)+'/'+v.slice(5,7)+'/'+v.slice(0,4):'—'
const hojeISO=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
const safe=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c))
const colunas=['Pessoa','Obra','Documento','Parcela','Vencimento','Pagamento','Valor','Saldo','Situação','Forma','Origem']
const valores=(x:LinhaFinanceira)=>[x.pessoa,x.obra||'',x.documento,x.parcela,dateBR(x.vencimento),dateBR(x.pagamento),moeda(x.valor),moeda(x.saldo),x.status,x.forma,x.origem||'']
function exportar(nome:string,linhas:LinhaFinanceira[]){
 const campo=(v:string)=>'"'+(/^[=+@\-\t\r]/.test(v)?"'"+v:v).replaceAll('"','""')+'"'
 const csv=[colunas,...linhas.map(valores)].map(a=>a.map(campo).join(';')).join('\r\n')
 const url=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}))
 const a=document.createElement('a');a.href=url;a.download=nome+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000)
}
function imprimir(titulo:string,linhas:LinhaFinanceira[],periodo:string){
 const j=window.open('','_blank','width=1200,height=800')
 if(!j){alert('Autorize pop-ups para imprimir.');return}
 const corpo=linhas.map(x=>'<tr>'+valores(x).map(v=>'<td>'+safe(v)+'</td>').join('')+'</tr>').join('')
 const saldo=linhas.reduce((s,x)=>s+(x.status==='cancelado'?0:x.saldo),0)
 j.document.write('<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><title>'+safe(titulo)+'</title><style>body{font:12px Arial,sans-serif;padding:18px;color:#1e293b}h1{font-size:19px}table{width:100%;border-collapse:collapse;font-size:10px}th,td{border-bottom:1px solid #ddd;padding:6px;text-align:left}th{background:#eee}@page{size:A4 landscape;margin:10mm}</style></head><body><h1>'+safe(titulo)+'</h1><p>'+safe(periodo)+'</p><h3>Saldo dos títulos: '+safe(moeda(saldo))+' | '+linhas.length+' registro(s)</h3><table><thead><tr>'+colunas.map(c=>'<th>'+safe(c)+'</th>').join('')+'</tr></thead><tbody>'+corpo+'</tbody></table></body></html>')
 j.document.close();j.focus();setTimeout(()=>j.print(),350)
}
export function useRelatorioTitulos<T extends {id:string}>(contas:T[],mapear:(x:T)=>LinhaFinanceira){
 const [inicio,setInicio]=useState(''),[fim,setFim]=useState(''),[pessoa,setPessoa]=useState(''),[situacao,setSituacao]=useState<Estado>('todos'),[campo,setCampo]=useState<Campo>('vencimento'),[busca,setBusca]=useState('')
 const hoje=hojeISO()
 const linhasTodas=useMemo(()=>contas.map(mapear),[contas,mapear])
 const pessoas=Array.from(new Set(linhasTodas.map(x=>x.pessoa).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'pt-BR'))
 const indices=linhasTodas.map((x,i)=>({x,i})).filter(({x})=>{
  const d=campo==='vencimento'?x.vencimento:x.pagamento
  if(inicio&&(!d||d<inicio)||fim&&(!d||d>fim)||pessoa&&x.pessoa!==pessoa)return false
  const aberto=x.saldo>0.009&&x.status!=='cancelado',vencido=aberto&&!!x.vencimento&&x.vencimento<hoje,parcial=aberto&&x.saldo+0.009<x.valor
  if(situacao==='aberto'&&!aberto||situacao==='vencido'&&!vencido||situacao==='parcial'&&!parcial||situacao==='pago'&&!(x.status==='pago'||x.saldo<=0.009&&x.status!=='cancelado'))return false
  return !busca||Object.values(x).some(v=>String(v??'').toLocaleLowerCase('pt-BR').includes(busca.toLocaleLowerCase('pt-BR')))
 })
 const filtradas=indices.map(x=>contas[x.i]),linhas=indices.map(x=>x.x)
 const saldo=linhas.reduce((s,x)=>s+(x.status==='cancelado'?0:x.saldo),0)
 function periodo(t:'hoje'|'semana'|'mes'|'proximo'|'todos'){
  if(t==='todos'){setInicio('');setFim('');return}
  const d=new Date(),y=d.getFullYear(),m=d.getMonth()
  const iso=(a:Date)=>[a.getFullYear(),String(a.getMonth()+1).padStart(2,'0'),String(a.getDate()).padStart(2,'0')].join('-')
  if(t==='hoje'){setInicio(hoje);setFim(hoje)}
  if(t==='semana'){const seg=new Date(y,m,d.getDate()-((d.getDay()+6)%7));setInicio(iso(seg));setFim(iso(new Date(y,m,seg.getDate()+6)))}
  if(t==='mes'){setInicio(iso(new Date(y,m,1)));setFim(iso(new Date(y,m+1,0)))}
  if(t==='proximo'){setInicio(iso(new Date(y,m+1,1)));setFim(iso(new Date(y,m+2,0)))}
 }
 return {inicio,setInicio,fim,setFim,pessoa,setPessoa,situacao,setSituacao,campo,setCampo,busca,setBusca,pessoas,filtradas,linhas,saldo,periodo}
}
type Filtros=ReturnType<typeof useRelatorioTitulos<{id:string}>>
export function BarraRelatorio({titulo,f}:{titulo:string;f:Filtros}){
 const descricao=(f.inicio||f.fim?dateBR(f.inicio)+' até '+dateBR(f.fim):'Todos os períodos')+' | '+(f.campo==='vencimento'?'Vencimento':'Data realizada')+' | '+(f.pessoa||'Todos')
 return <section className="rounded-2xl border bg-white p-4 space-y-3">
  <div className="flex flex-wrap justify-between gap-2"><b>Filtros e relatórios — {titulo}</b><span className="text-sm">{f.linhas.length} título(s) · Saldo: <b>{moeda(f.saldo)}</b></span></div>
  <div className="flex flex-wrap gap-2">{([['hoje','Hoje'],['semana','Esta semana'],['mes','Este mês'],['proximo','Próximo mês'],['todos','Todos']] as const).map(([t,n])=><button key={t} className="rounded-lg border px-3 py-1.5 text-xs" onClick={()=>f.periodo(t)}>{n}</button>)}</div>
  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
   <label className="text-xs">Data de<select className="mt-1 w-full rounded-lg border p-2 text-sm" value={f.campo} onChange={e=>f.setCampo(e.target.value as Campo)}><option value="vencimento">Vencimento</option><option value="pagamento">Pagamento / recebimento</option></select></label>
   <label className="text-xs">De<input className="mt-1 w-full rounded-lg border p-2 text-sm" type="date" value={f.inicio} max={f.fim||undefined} onChange={e=>f.setInicio(e.target.value)}/></label>
   <label className="text-xs">Até<input className="mt-1 w-full rounded-lg border p-2 text-sm" type="date" value={f.fim} min={f.inicio||undefined} onChange={e=>f.setFim(e.target.value)}/></label>
   <label className="text-xs">Situação<select className="mt-1 w-full rounded-lg border p-2 text-sm" value={f.situacao} onChange={e=>f.setSituacao(e.target.value as Estado)}><option value="todos">Todas</option><option value="aberto">Em aberto</option><option value="vencido">Vencidas</option><option value="parcial">Parciais</option><option value="pago">Pagas</option></select></label>
   <label className="text-xs">Fornecedor / cliente<select className="mt-1 w-full rounded-lg border p-2 text-sm" value={f.pessoa} onChange={e=>f.setPessoa(e.target.value)}><option value="">Todos</option>{f.pessoas.map(p=><option key={p}>{p}</option>)}</select></label>
   <label className="text-xs">Buscar<input className="mt-1 w-full rounded-lg border p-2 text-sm" placeholder="Documento, obra..." value={f.busca} onChange={e=>f.setBusca(e.target.value)}/></label>
  </div>
  <div className="flex flex-wrap gap-2"><button className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white" onClick={()=>imprimir(titulo,f.linhas,descricao)}><Printer size={15}/>Imprimir / PDF</button><button className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold" onClick={()=>exportar('atlas-'+titulo.toLowerCase().replace(/\s+/g,'-'),f.linhas)}><FileDown size={15}/>Exportar Excel (CSV)</button></div>
 </section>
}
