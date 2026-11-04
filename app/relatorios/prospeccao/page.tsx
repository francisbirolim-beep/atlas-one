'use client'
import {useEffect,useMemo,useState} from 'react'
import Link from 'next/link'
import {ArrowLeft,Download,FileDown,MapPin,RefreshCw} from 'lucide-react'
import {useRelatoriosAcesso,autorizarExportacaoRelatorio} from '@/components/relatorios/RelatoriosAcesso'
import {usuarioAtual} from '@/lib/auth'
import {listarProspeccoes,STATUS_PROSPECCAO,type Prospeccao} from '@/lib/prospeccao'
import {baixarCsv} from '@/lib/relatorios'
import type {Usuario} from '@/lib/tipos'
import { LOGOTIPO_PDF_FUNDO_CLARO } from '@/lib/brandingRelatorios'

const nomeStatus=(s:string)=>STATUS_PROSPECCAO.find(v=>v.id===s)?.label||s
const dataBR=(s:string|null|undefined)=>s?new Date(s).toLocaleDateString('pt-BR'):'—'
const dia=(s:string|null|undefined)=>s?new Date(s).toLocaleDateString('sv-SE'):''
function inicial(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-01'}
function agrupar(rows:Prospeccao[],f:(r:Prospeccao)=>string):[string,number][]{
 const m=new Map<string,number>()
 for(const r of rows){const key=f(r).trim()||'Não informado';m.set(key,(m.get(key)||0)+1)}
 return [...m].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'pt-BR'))
}
function Grafico({titulo,dados,total}:{titulo:string;dados:[string,number][];total:number}){
 return <section className="rounded-2xl border bg-white p-4">
  <h2 className="mb-3 text-sm font-bold">{titulo}</h2>
  <div className="max-h-72 space-y-3 overflow-auto">{dados.map(([nome,qtd])=><div key={nome}>
   <div className="flex justify-between gap-3 text-xs"><span className="truncate">{nome}</span><strong>{qtd}</strong></div>
   <div className="mt-1 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-blue-600" style={{width:(total?100*qtd/total:0)+'%'}}/></div>
  </div>)}
  {!dados.length&&<p className="text-xs text-slate-500">Sem registros.</p>}</div>
 </section>
}
async function carregarLogo():Promise<string|null>{
 return new Promise(resolve=>{const img=new Image();img.onload=()=>{
  try{const cv=document.createElement('canvas');cv.width=img.naturalWidth;cv.height=img.naturalHeight;cv.getContext('2d')?.drawImage(img,0,0);resolve(cv.toDataURL('image/png'))}catch{resolve(null)}
 };img.onerror=()=>resolve(null);img.src=LOGOTIPO_PDF_FUNDO_CLARO})
}
export default function RelatorioProspeccao(){
 const acesso=useRelatoriosAcesso().comercial
 const [usuario,setUsuario]=useState<Usuario|null>(null)
 const [registros,setRegistros]=useState<Prospeccao[]>([])
 const [carregando,setCarregando]=useState(true)
 const [exportando,setExportando]=useState(false)
 const [erro,setErro]=useState('')
 const [inicio,setInicio]=useState(inicial)
 const [fim,setFim]=useState(()=>new Date().toLocaleDateString('sv-SE'))
 const [cidade,setCidade]=useState('')
 const [bairro,setBairro]=useState('')
 const [vendedor,setVendedor]=useState('')
 const [status,setStatus]=useState('')
 const [busca,setBusca]=useState('')
 async function carregar(){
  if(!acesso.consultar)return
  setCarregando(true);setErro('')
  try{const u=await usuarioAtual();if(!u)throw Error('Sessão expirada. Entre novamente.')
   setUsuario(u);setRegistros(await listarProspeccoes())
  }catch(e){setErro(e instanceof Error?e.message:'Falha ao consultar prospecções.')}
  finally{setCarregando(false)}
 }
 useEffect(()=>{void carregar()},[acesso.consultar])
 const autorizados=useMemo(()=>acesso.proprios&&usuario?registros.filter(r=>r.responsavel_id===usuario.id):registros,[acesso.proprios,usuario,registros])
 const cidades=useMemo(()=>[...new Set(autorizados.map(r=>r.cidade||'').filter(Boolean))].sort(),[autorizados])
 const bairros=useMemo(()=>[...new Set(autorizados.filter(r=>!cidade||r.cidade===cidade).map(r=>r.bairro||'').filter(Boolean))].sort(),[autorizados,cidade])
 const vendedores=useMemo(()=>[...new Set(autorizados.map(r=>r.responsavel_nome||'').filter(Boolean))].sort(),[autorizados])
 const filtrados=useMemo(()=>autorizados.filter(r=>{
  const data=dia(r.created_at)
  if(inicio>fim||data<inicio||data>fim)return false
  if(cidade&&r.cidade!==cidade)return false
  if(bairro&&r.bairro!==bairro)return false
  if(vendedor&&r.responsavel_nome!==vendedor)return false
  if(status&&r.status!==status)return false
  const termo=busca.trim().toLocaleLowerCase('pt-BR')
  return !termo||[r.nome_obra,r.nome_cliente,r.cidade,r.bairro,r.endereco,r.telefone].some(v=>(v||'').toLocaleLowerCase('pt-BR').includes(termo))
 }),[autorizados,inicio,fim,cidade,bairro,vendedor,status,busca])
 const porCidade=useMemo(()=>agrupar(filtrados,r=>r.cidade||''),[filtrados])
 const porBairro=useMemo(()=>agrupar(filtrados,r=>[r.cidade,r.bairro].filter(Boolean).join(' / ')),[filtrados])
 const porStatus=useMemo(()=>agrupar(filtrados,r=>nomeStatus(r.status)),[filtrados])
 const porVendedor=useMemo(()=>agrupar(filtrados,r=>r.responsavel_nome||''),[filtrados])
 const abertos=filtrados.filter(r=>!['convertido','sem_interesse'].includes(r.status)).length
 const convertidos=filtrados.filter(r=>r.status==='convertido').length
 const semInteresse=filtrados.filter(r=>r.status==='sem_interesse').length
 const retornos=filtrados.filter(r=>r.proxima_acao_em&&!['convertido','sem_interesse'].includes(r.status)).length
 const semGps=filtrados.filter(r=>r.latitude==null||r.longitude==null).length
 const colunas=['Data','Obra / Cliente','Cidade','Bairro','Rua','CEP','Vendedor','Situação','Próxima ação']
 const valores=filtrados.map(r=>[dataBR(r.created_at),r.nome_obra||r.nome_cliente,r.cidade||'',r.bairro||'',r.endereco||'',r.cep||'',r.responsavel_nome||'',nomeStatus(r.status),r.proxima_acao_em?dataBR(r.proxima_acao_em)+' '+(r.proxima_acao||''):(r.proxima_acao||'')])
 async function csv(){
  setErro('');setExportando(true)
  try{await autorizarExportacaoRelatorio('comercial');baixarCsv('atlas-prospeccao-obras.csv',[colunas,...valores])}
  catch(e){setErro(e instanceof Error?e.message:'Exportação não autorizada')}
  finally{setExportando(false)}
 }
 async function pdf(){
  setErro('');setExportando(true)
  try{
   await autorizarExportacaoRelatorio('comercial')
   const {jsPDF}=await import('jspdf')
   const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'})
   const logo=await carregarLogo()
   const larguras=[21,49,28,28,40,21,28,32,26]
   let pagina=1,y=50
   const cabecalho=()=>{
    doc.setFillColor(243,247,253);doc.rect(0,0,297,36,'F')
    doc.setTextColor(27,43,68);doc.setFont('helvetica','bold');doc.setFontSize(15)
    doc.text('Relatório de Prospecção de Obras',12,13)
    doc.setFontSize(9);doc.setFont('helvetica','normal')
    doc.text('Período: '+dataBR(inicio+'T12:00:00')+' a '+dataBR(fim+'T12:00:00')+' | Total: '+filtrados.length+' | Abertas: '+abertos+' | Convertidas em cliente: '+convertidos,12,21)
    doc.text('Cidade: '+(cidade||'Todas')+' | Bairro: '+(bairro||'Todos')+' | Situação: '+(status?nomeStatus(status):'Todas'),12,28)
    let logoInserido=false
    if(logo){try{
      const d=doc.getImageProperties(logo),h=Math.min(23,45/Math.max(1,d.width/d.height)),w=h*d.width/d.height
      doc.addImage(logo,'PNG',297-12-w,6,w,h)
      logoInserido=true
    }catch{/* O texto de identificação abaixo mantém a marca legível */}}
    if(!logoInserido){
      doc.setTextColor(22,49,77);doc.setFont('helvetica','bold');doc.setFontSize(12)
      doc.text('ESQUADRIFÁCIO',285,14,{align:'right'})
    }
    doc.setFontSize(8);doc.text('Página '+pagina,285,204,{align:'right'})
    doc.setDrawColor(220,228,238);doc.line(12,198,285,198)
   }
   const titulos=()=>{
    doc.setFillColor(30,49,81);doc.rect(12,y-5,273,9,'F')
    doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(7)
    let x=13
    colunas.forEach((c,i)=>{doc.text(c,x,y,{maxWidth:larguras[i]-2});x+=larguras[i]})
    y+=7
   }
   cabecalho()
   doc.setFontSize(9);doc.setFont('helvetica','bold')
   doc.text('Por cidade: '+porCidade.map(([k,n])=>k+' ('+n+')').join('; ').slice(0,140),12,41)
   doc.text('Por situação: '+porStatus.map(([k,n])=>k+' ('+n+')').join('; ').slice(0,140),12,46)
   y=55;titulos()
   for(const linha of valores){
    if(y>191){doc.addPage();pagina++;cabecalho();y=46;titulos()}
    doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(35,49,70)
    let x=13
    linha.forEach((valor,i)=>{const pedaco=doc.splitTextToSize(String(valor||''),Math.max(3,larguras[i]-3))[0]||'';doc.text(pedaco,x,y);x+=larguras[i]})
    doc.setDrawColor(237,240,245);doc.line(12,y+2,285,y+2);y+=7
   }
   if(!valores.length)doc.text('Nenhuma prospecção no período.',12,y+3)
   doc.save('atlas-relatorio-prospeccao.pdf')
  }catch(e){setErro(e instanceof Error?e.message:'Não foi possível gerar PDF')}
  finally{setExportando(false)}
 }
 if(!acesso.consultar)return <p role="alert" className="p-6 text-red-700">Acesso ao relatório comercial não autorizado.</p>
 return <main className="min-h-screen bg-slate-50 px-4 py-6"><div className="mx-auto max-w-[1500px] space-y-5">
  <header className="flex flex-wrap items-center justify-between gap-3">
   <div><Link href="/relatorios" className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-blue-700"><ArrowLeft size={15}/>Relatórios</Link>
    <h1 className="text-2xl font-bold">Relatório de Prospecção de Obras</h1>
    <p className="mt-1 text-sm text-slate-600">Análise por cidade, bairro, vendedor e etapa comercial.</p></div>
   <div className="flex flex-wrap gap-2">
    <button onClick={()=>void carregar()} disabled={carregando} className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-semibold"><RefreshCw size={15}/>Atualizar</button>
    {acesso.exportar&&<><button onClick={()=>void csv()} disabled={exportando||carregando} className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-semibold"><Download size={15}/>CSV</button>
     <button onClick={()=>void pdf()} disabled={exportando||carregando} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white"><FileDown size={15}/>PDF com logo</button></>}
   </div>
  </header>
  <section className="grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
   <label className="text-xs font-semibold">Data inicial<input type="date" value={inicio} onChange={e=>setInicio(e.target.value)} className="mt-1 block w-full rounded-lg border p-2"/></label>
   <label className="text-xs font-semibold">Data final<input type="date" value={fim} onChange={e=>setFim(e.target.value)} className="mt-1 block w-full rounded-lg border p-2"/></label>
   <label className="text-xs font-semibold">Cidade<select value={cidade} onChange={e=>{setCidade(e.target.value);setBairro('')}} className="mt-1 block w-full rounded-lg border p-2"><option value="">Todas</option>{cidades.map(c=><option key={c}>{c}</option>)}</select></label>
   <label className="text-xs font-semibold">Bairro<select value={bairro} onChange={e=>setBairro(e.target.value)} className="mt-1 block w-full rounded-lg border p-2"><option value="">Todos</option>{bairros.map(b=><option key={b}>{b}</option>)}</select></label>
   <label className="text-xs font-semibold">Vendedor<select value={vendedor} onChange={e=>setVendedor(e.target.value)} className="mt-1 block w-full rounded-lg border p-2"><option value="">Todos</option>{vendedores.map(v=><option key={v}>{v}</option>)}</select></label>
   <label className="text-xs font-semibold">Situação<select value={status} onChange={e=>setStatus(e.target.value)} className="mt-1 block w-full rounded-lg border p-2"><option value="">Todas</option>{STATUS_PROSPECCAO.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
   <label className="text-xs font-semibold sm:col-span-2 lg:col-span-3 xl:col-span-6">Pesquisar cliente ou endereço<input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Nome, rua, telefone..." className="mt-1 block w-full rounded-lg border p-2"/></label>
  </section>
  {erro&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
  {carregando&&<p className="text-sm text-slate-500">Carregando prospecções...</p>}
  {inicio>fim&&<p className="text-sm text-red-700">A data inicial deve ser anterior ou igual à final.</p>}
  <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
   {([['Prospecções',filtrados.length],['Em aberto',abertos],['Convertidas em cliente',convertidos],['Sem interesse',semInteresse],['Retornos agendados',retornos]] as [string,number][]).map(([n,v])=><div key={n} className="rounded-2xl border bg-white p-4"><p className="text-xs text-slate-500">{n}</p><b className="mt-2 block text-2xl">{v}</b></div>)}
  </section>
  <section className="grid gap-4 lg:grid-cols-2">
   <Grafico titulo="Prospecções por cidade" dados={porCidade} total={filtrados.length}/>
   <Grafico titulo="Prospecções por bairro" dados={porBairro} total={filtrados.length}/>
   <Grafico titulo="Etapas comerciais" dados={porStatus} total={filtrados.length}/>
   <Grafico titulo="Prospecções por vendedor" dados={porVendedor} total={filtrados.length}/>
  </section>
  <div className="flex flex-wrap justify-between gap-2"><h2 className="font-bold">Obras prospectadas ({filtrados.length})</h2><Link href="/prospeccao" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700"><MapPin size={15}/>Ver mapa de prospecção</Link></div>
  <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full min-w-[1060px] text-left text-xs"><thead className="bg-slate-100"><tr>{colunas.map(c=><th key={c} className="p-3">{c}</th>)}</tr></thead><tbody>
   {filtrados.map((r,i)=><tr key={r.id} className="border-t">{valores[i].map((v,j)=><td key={j} className="p-3">{j===1?<Link href={'/prospeccao/'+r.id} className="font-semibold text-blue-700">{v}</Link>:(v||'—')}</td>)}</tr>)}
   {!filtrados.length&&!carregando&&<tr><td colSpan={9} className="p-8 text-center text-slate-500">Nenhuma obra encontrada com estes filtros.</td></tr>}
  </tbody></table></div>
  <p className="text-xs text-slate-500">Indicadores conforme a situação atual das prospecções criadas no período. {semGps} sem GPS. Converter em cliente não significa venda confirmada.</p>
 </div></main>
}
