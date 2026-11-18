'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Copy, FileText, Loader2, Plus, Printer, RefreshCw, Save, Trash2 } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'

type Evento = { dia: string; codigo: string; descricao: string; quantidade: string; referencia: string; base: string; vencimentos: number; descontos: number }
type Dados = {
 empresa_codigo: string; empresa_nome: string; empresa_endereco: string; empresa_cnpj: string;
 titulo: string; tipo_pagamento: string; data_pagamento: string; funcionario_codigo: string;
 pis: string; cbo: string; folha: string; local_codigo: string; local_nome: string;
 data_admissao: string; cargo_codigo: string; cargo: string; banco: string; agencia: string;
 conta: string; salario_base: string; salario_contrib_inss: string; base_fgts: string;
 fgts_mes: string; base_irrf: string; observacoes: string; rodape: string; itens: Evento[];
}
type Form = { id?: string; rh_pessoa_id: string; funcionario_nome: string; competencia: string; situacao: 'rascunho'|'emitido'; dados: Dados }
type Pessoa = { id: string; nome: string; cargo: string|null; setor: string|null; data_admissao: string|null; salario_base: number|null; ativo: boolean }
type Recibo = Form & { id: string; total_vencimentos: number; total_descontos: number; valor_liquido: number; created_at: string; emitido_em: string|null }
const hoje = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
const dataBr = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) ? s.split('-').reverse().join('/') : ''
const numeroBr = (n: number) => new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n || 0)
const moeda = (n: number) => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n || 0)
const parseNumero = (s: string) => { const t=String(s||'').trim(); return Number(t.includes(',')?t.replace(/\./g,'').replace(',','.'):t)||0 }
const arredonda = (n: number) => Math.round(n * 100) / 100
const campo = 'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none'
const eventoInicial = (base = 0): Evento => ({
 dia: hoje().slice(8,10), codigo: '07503', descricao: 'Adiantamento Obrigatório', quantidade:'40,00',
 referencia:'', base: numeroBr(base), vencimentos: arredonda(base * .4), descontos: 0,
})
const dadosIniciais = (): Dados => ({
 empresa_codigo:'05691', empresa_nome:'ESQUADRIFACIO SOLUCAO EM ALUMINIO LTDA',
 empresa_endereco:'AV LEONEL GUILHERME PEREIRA,775 José Bonifácio SP',
 empresa_cnpj:'38.370.906/0001-70', titulo:'Recibo de Pagto. de Salário',
 tipo_pagamento:'Adiant.Obrigatório', data_pagamento:hoje(), funcionario_codigo:'',
 pis:'', cbo:'', folha:'01', local_codigo:'00001', local_nome:'Esquadrifacio',
 data_admissao:'', cargo_codigo:'', cargo:'', banco:'', agencia:'', conta:'',
 salario_base:'', salario_contrib_inss:'', base_fgts:'', fgts_mes:'', base_irrf:'',
 observacoes:'', rodape:'Documento gerado pelo Atlas One — Esquadrifácio', itens:[eventoInicial()],
})
const vazio = (): Form => ({
 rh_pessoa_id:'', funcionario_nome:'', competencia:hoje().slice(0,7), situacao:'rascunho', dados:dadosIniciais(),
})
const somas = (itens:Evento[]) => {
 const cents=(tipo:'vencimentos'|'descontos')=>itens.reduce((acc,item)=>acc+Math.round((Number(item[tipo])||0)*100),0)
 const vencimentos=cents('vencimentos'),descontos=cents('descontos')
 return {vencimentos:vencimentos/100,descontos:descontos/100,liquido:(vencimentos-descontos)/100}
}
function Via({form,via}:{form:Form;via:'empregador'|'empregado'}) {
 const d=form.dados, t=somas(d.itens)
 const bases:[string,string][]=[
  ['Salário Base',d.salario_base],['Sal.Contr.INSS',d.salario_contrib_inss],
  ['Base Cálc.F.G.T.S.',d.base_fgts],['F.G.T.S. do Mês',d.fgts_mes],['Base Cálc. IRRF',d.base_irrf],
 ]
 return <div className="rh-recibo-via">
  <div className="rh-empresa-codigo">Empresa: {d.empresa_codigo||'—'}</div>
  <div className="rh-encab">
   <div className="rh-lateral-vazia"/>
   <div className="rh-dados-principais">
    <b>{[d.empresa_codigo,d.empresa_nome].filter(Boolean).join(' ')}</b>
    <div>{d.empresa_endereco||'Endereço não informado'}</div>
    <div>{d.empresa_cnpj||'CNPJ não informado'}</div>
    <div className="rh-pessoa-nome"><b>{d.funcionario_codigo}</b>&nbsp; <b>{form.funcionario_nome||'FUNCIONÁRIO NÃO INFORMADO'}</b></div>
    <div className="rh-linha-dupla"><span>PIS: {d.pis}</span><span>CBO: {d.cbo}</span></div>
    <div className="rh-linha-dupla"><span>Local: {d.local_codigo} {d.local_nome}</span><span>Funcionário desde: {dataBr(d.data_admissao)}</span></div>
    <div className="rh-linha-dupla"><span>Cargo: {d.cargo_codigo} {d.cargo}</span><span>Banco: {d.banco} &nbsp; Ag.:{d.agencia} &nbsp; C/C: {d.conta}</span></div>
   </div>
   <div className="rh-encab-direita">
    <b>{d.titulo||'Recibo de Pagto. de Salário'}</b>
    <div><b>{d.tipo_pagamento||'Adiant.Obrigatório'}</b> &nbsp; <b>{dataBr(d.data_pagamento)}</b></div>
    <div className="rh-folha">Folha: {d.folha||'01'}</div>
   </div>
  </div>
  <div className="rh-corpo">
   <div className="rh-corpo-principal">
    <table className="rh-tabela-recibo">
     <colgroup><col style={{width:'6%'}}/><col style={{width:'6%'}}/><col style={{width:'27%'}}/><col style={{width:'11%'}}/><col style={{width:'18%'}}/><col style={{width:'12%'}}/><col style={{width:'10%'}}/><col style={{width:'10%'}}/></colgroup>
     <thead><tr>{['Data','Código','Descrição','Quant/ %','Referência','Vr.Unit./Base','Vencimentos','Descontos'].map(h=><th key={h}>{h}</th>)}</tr></thead>
     <tbody><tr className="rh-altura-lancamentos"><td colSpan={8}>
      <table className="rh-tabela-interna"><colgroup><col style={{width:'6%'}}/><col style={{width:'6%'}}/><col style={{width:'27%'}}/><col style={{width:'11%'}}/><col style={{width:'18%'}}/><col style={{width:'12%'}}/><col style={{width:'10%'}}/><col style={{width:'10%'}}/></colgroup>
      <tbody>{d.itens.map((it,i)=><tr key={i}>
       <td>{it.dia}</td><td>{it.codigo}</td><td className="rh-descricao">{it.descricao}</td>
       <td>{it.quantidade}</td><td>{it.referencia}</td><td>{it.base}</td>
       <td>{it.vencimentos?numeroBr(Number(it.vencimentos)):''}</td>
       <td>{it.descontos?numeroBr(Number(it.descontos)):''}</td>
      </tr>)}</tbody></table>
     </td></tr></tbody>
    </table>
    <div className="rh-inferior">
     <div className="rh-observacoes">{d.observacoes}</div>
     <div className="rh-valores"><div className="rh-dois-totais"><div>Total vencimentos<br/><b>{numeroBr(t.vencimentos)}</b></div><div>Total descontos<br/><b>{t.descontos?numeroBr(t.descontos):''}</b></div></div><div className="rh-liquido"><b>Vr. Líquido &nbsp; ➤➤</b><b>{numeroBr(t.liquido)}</b></div></div>
    </div>
    <div className="rh-bases">{bases.map(([label,value])=><div key={label}><b>{label}</b><br/>{value}</div>)}<div className="rh-via-label"><b>via do<br/>{via}</b></div></div>
   </div>
   <div className="rh-assinatura"><div className="rh-declaracao">DECLARO TER RECEBIDO A IMPORTÂNCIA LÍQUIDA DISCRIMINADA NESTE RECIBO</div><div className="rh-assinatura-area"><span>ASSINATURA DO FUNCIONÁRIO</span><span>DATA</span></div></div>
  </div>
  <div className="rh-rodape">{d.rodape}</div>
 </div>
}
export default function AdiantamentosRH() {
 const [pessoas,setPessoas]=useState<Pessoa[]>([])
 const [recibos,setRecibos]=useState<Recibo[]>([])
 const [form,setForm]=useState<Form>(vazio)
 const [edicao,setEdicao]=useState('')
 const [carregando,setCarregando]=useState(true)
 const [salvando,setSalvando]=useState(false)
 const [simulacao,setSimulacao]=useState(false)
 const [erro,setErro]=useState(''),[aviso,setAviso]=useState('')
 const [filtro,setFiltro]=useState('')
 const [selecionados,setSelecionados]=useState<string[]>([])
 const totais=useMemo(()=>somas(form.dados.itens),[form.dados.itens])
 const emitido=form.situacao==='emitido'
 const filtrados=recibos.filter(r=>(r.funcionario_nome+' '+r.competencia).toLocaleLowerCase('pt-BR').includes(filtro.toLocaleLowerCase('pt-BR')))
 const imprimirFormularios:Form[]=selecionados.length?recibos.filter(r=>selecionados.includes(r.id)).map(r=>({rh_pessoa_id:r.rh_pessoa_id||'',funcionario_nome:r.funcionario_nome,competencia:r.competencia,situacao:r.situacao,dados:r.dados})): [form]
 async function carregar() {
  setCarregando(true);setErro('')
  try {
   const token=await tokenAtual()
   if(!token) throw new Error('Sessão expirada. Entre novamente no Atlas.')
   const res=await fetch('/api/rh/adiantamentos',{headers:{Authorization:'Bearer '+token},cache:'no-store'})
   const json=await res.json()
   if(!res.ok) throw new Error(json.error||'Falha ao carregar recibos.')
   setPessoas(json.pessoas||[]);setRecibos(json.recibos||[]);setSimulacao(!!json.simulacao)
  } catch(e) {setErro(e instanceof Error?e.message:'Erro ao carregar recibos.')}
  finally {setCarregando(false)}
 }
 useEffect(()=>{void carregar()},[])
 function novo(){setEdicao('');setForm(vazio());setErro('');setAviso('')}
 function abrir(r:Recibo,duplicar=false){
  setEdicao(duplicar?'':r.id)
  setForm({rh_pessoa_id:r.rh_pessoa_id||'',funcionario_nome:r.funcionario_nome,competencia:r.competencia,situacao:duplicar?'rascunho':r.situacao,dados:JSON.parse(JSON.stringify(r.dados))})
  setErro('');setAviso('')
 }
 function mudarDados<K extends keyof Dados>(key:K,value:Dados[K]) {
  setForm(p=>({...p,dados:{...p.dados,[key]:value}}))
 }
 function escolherPessoa(id:string) {
  const p=pessoas.find(x=>x.id===id),salario=p?.salario_base||0
  setForm(v=>({...v,rh_pessoa_id:id,funcionario_nome:p?.nome||v.funcionario_nome,dados:{
   ...v.dados,cargo:p?.cargo||v.dados.cargo,data_admissao:p?.data_admissao||v.dados.data_admissao,
   salario_base:p?.salario_base!=null?numeroBr(salario):v.dados.salario_base,
   itens:v.dados.itens.length===1&&v.dados.itens[0].codigo==='07503'?
   [{...v.dados.itens[0],base:numeroBr(salario),vencimentos:arredonda(salario * parseNumero(v.dados.itens[0].quantidade) / 100)}]:v.dados.itens,
  }}))
 }
 function evento(index:number,key:keyof Evento,value:string|number){
  setForm(v=>({...v,dados:{...v.dados,itens:v.dados.itens.map((it,i)=>i===index?{...it,[key]:value}:it)}}))
 }
 function aplicarPercentual(){
  const base=parseNumero(form.dados.salario_base)
  setForm(v=>({...v,dados:{...v.dados,itens:v.dados.itens.map(it=>it.codigo==='07503'?{
   ...it,base:numeroBr(base),vencimentos:arredonda(base*parseNumero(it.quantidade)/100)
  }:it)}}))
  setAviso('Percentual aplicado ao código 07503. Confira o valor antes de emitir.')
 }
 async function salvar(situacao:'rascunho'|'emitido'){
  setErro('');setAviso('')
  if(form.funcionario_nome.trim().length<3){setErro('Informe o nome do funcionário.');return}
  if(!form.competencia){setErro('Informe a competência.');return}
  if(!form.dados.itens.length||form.dados.itens.some(it=>!it.descricao.trim()||Number(it.vencimentos)<0||Number(it.descontos)<0)){setErro('Confira as linhas de valores.');return}
  if(totais.liquido<0){setErro('O líquido não pode ser negativo.');return}
  if(situacao==='emitido'&&!window.confirm('Conferiu nomes, competência e valores? O recibo emitido ficará bloqueado para alterações. Isso não registra pagamento nem assinatura.'))return
  setSalvando(true)
  try {
   const token=await tokenAtual();if(!token)throw new Error('Sessão expirada.')
   const response=await fetch('/api/rh/adiantamentos',{
    method:edicao?'PATCH':'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify({...form,id:edicao||undefined,situacao,conferido:situacao==='emitido'}),
   })
   const json=await response.json()
   if(!response.ok)throw new Error(json.error||'Não foi possível salvar.')
   setEdicao(json.id);setForm(v=>({...v,situacao}))
   await carregar()
   setAviso(situacao==='emitido'?'Recibo emitido. Imprima as duas vias.':'Rascunho salvo.')
  }catch(e){setErro(e instanceof Error?e.message:'Erro ao salvar.')}
  finally{setSalvando(false)}
 }
 return <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
  <style jsx global>{`
  .rh-pagina-a4{width:210mm;height:297mm;padding:5mm 3mm 3mm;box-sizing:border-box;background:#fff;color:#111;font-family:Arial,Helvetica,sans-serif;font-size:7.1pt}
  .rh-recibo-via{width:100%;height:138mm;position:relative;box-sizing:border-box;color:#111;overflow:hidden}
  .rh-empresa-codigo{height:4.5mm;font-weight:bold;font-size:7.5pt}
  .rh-encab{display:grid;grid-template-columns:23mm minmax(0,1fr) 52mm;height:26mm;border:.35mm solid black;font-size:7pt}
  .rh-lateral-vazia{border-right:.25mm solid black}
  .rh-dados-principais{padding:1mm 1.3mm;overflow:hidden;white-space:nowrap;line-height:1.33}
  .rh-dados-principais>div{overflow:hidden;text-overflow:ellipsis}
  .rh-pessoa-nome{border-top:.2mm solid #111;margin-top:.35mm}
  .rh-linha-dupla{display:flex;justify-content:space-between;gap:1mm;font-size:6.8pt}
  .rh-encab-direita{position:relative;padding:1.5mm 1mm 0;text-align:right;white-space:nowrap;font-size:6.8pt}
  .rh-encab-direita>b{font-size:10pt;white-space:normal}
  .rh-encab-direita>div{margin-top:2mm}
  .rh-encab-direita .rh-folha{position:absolute;bottom:6mm;right:1mm}
  .rh-corpo{display:grid;grid-template-columns:minmax(0,1fr) 17mm;height:102mm;gap:0}
  .rh-corpo-principal{min-width:0}
  .rh-tabela-recibo{width:100%;border-collapse:collapse;table-layout:fixed;border:.35mm solid black;font-size:6.6pt}
  .rh-tabela-recibo th{border-right:.2mm solid black;border-bottom:.35mm solid black;padding:.45mm .15mm;text-align:center;white-space:nowrap;font-weight:bold}
  .rh-altura-lancamentos{height:65mm}
  .rh-altura-lancamentos>td{padding:0;vertical-align:top;
   background-image:
   linear-gradient(to right, transparent calc(6% - .1mm), #222 calc(6% - .1mm), #222 calc(6% + .1mm), transparent calc(6% + .1mm)),
   linear-gradient(to right, transparent calc(12% - .1mm), #222 calc(12% - .1mm), #222 calc(12% + .1mm), transparent calc(12% + .1mm)),
   linear-gradient(to right, transparent calc(39% - .1mm), #222 calc(39% - .1mm), #222 calc(39% + .1mm), transparent calc(39% + .1mm)),
   linear-gradient(to right, transparent calc(50% - .1mm), #222 calc(50% - .1mm), #222 calc(50% + .1mm), transparent calc(50% + .1mm)),
   linear-gradient(to right, transparent calc(68% - .1mm), #222 calc(68% - .1mm), #222 calc(68% + .1mm), transparent calc(68% + .1mm)),
   linear-gradient(to right, transparent calc(80% - .1mm), #222 calc(80% - .1mm), #222 calc(80% + .1mm), transparent calc(80% + .1mm)),
   linear-gradient(to right, transparent calc(90% - .1mm), #222 calc(90% - .1mm), #222 calc(90% + .1mm), transparent calc(90% + .1mm));}
  .rh-tabela-interna{width:100%;border-collapse:collapse;table-layout:fixed}
  .rh-tabela-interna td{padding:.65mm .15mm;border-right:.2mm solid black;text-align:right;vertical-align:top;height:4.1mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .rh-tabela-interna td.rh-descricao{text-align:left}
  .rh-inferior{height:20.5mm;display:grid;grid-template-columns:minmax(0,1fr) 48mm;border-left:.35mm solid black;border-bottom:.35mm solid black}
  .rh-observacoes{padding:2mm;align-self:center;white-space:pre-wrap;font-size:6.2pt}
  .rh-valores{border-left:.35mm solid black}
  .rh-dois-totais{height:10mm;display:grid;grid-template-columns:1fr 1fr;font-size:6.5pt}
  .rh-dois-totais>div{border-right:.25mm solid black;padding:1mm .5mm;line-height:1.5}
  .rh-dois-totais b{display:block;text-align:right;font-size:7pt}
  .rh-liquido{border-top:.25mm solid black;height:10mm;display:flex;justify-content:space-between;align-items:center;padding:.7mm 1.2mm;font-size:7.3pt}
  .rh-bases{height:11mm;display:grid;grid-template-columns:repeat(5,minmax(0,1fr)) 24mm;border:.35mm solid black;border-top:0;text-align:center;font-size:6.2pt}
  .rh-bases>div{padding:.9mm .2mm;white-space:nowrap;overflow:hidden}
  .rh-bases .rh-via-label{border-left:.25mm solid black;white-space:normal}
  .rh-assinatura{border:.35mm solid black;border-left:0;display:grid;grid-template-columns:9mm 8mm;height:102mm;font-size:6pt}
  .rh-declaracao{writing-mode:vertical-rl;transform:rotate(180deg);text-align:center;border-left:.2mm solid black;padding:1mm}
  .rh-assinatura-area{display:flex;flex-direction:column;justify-content:space-around;align-items:center;writing-mode:vertical-rl;transform:rotate(180deg);text-align:center;font-size:5.8pt}
  .rh-assinatura-area span{border-top:.2mm solid #111;padding-top:2mm}
  .rh-rodape{font-size:6.4pt;margin-top:1mm;white-space:nowrap;text-overflow:ellipsis;overflow:hidden}
  .rh-separacao{height:5mm;border-bottom:.2mm dashed #aaa;margin-bottom:3mm}
  @media screen{.rh-pagina-a4{box-shadow:0 4px 20px rgba(0,0,0,.16);transform-origin:top left}}
  @media print{
   @page{size:A4 portrait;margin:0}
   html,body{margin:0!important;padding:0!important;background:#fff!important}
   body *{visibility:hidden!important}
   #rh-impressao-adiantamento,#rh-impressao-adiantamento *{visibility:visible!important}
   #rh-impressao-adiantamento{display:block!important;position:absolute!important;left:0!important;top:0!important;margin:0!important;padding:0!important}
   .rh-pagina-a4{box-shadow:none!important;page-break-after:always;break-after:page}
  }
  `}</style>
  <div className="mx-auto max-w-6xl space-y-5">
   <header className="flex flex-wrap items-start justify-between gap-3">
    <div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Recursos Humanos</p><h1 className="text-2xl font-bold text-slate-900">Recibo de adiantamento — modelo em duas vias</h1><p className="mt-1 text-sm text-slate-600">Modelo fiel ao PDF fornecido: empregador e empregado na mesma página A4, com campos editáveis.</p></div>
    <div className="flex flex-wrap gap-2"><Link href="/rh/holerites" className="rounded-lg border bg-white px-3 py-2 text-sm">Holerites</Link><Link href="/rh/pessoas" className="rounded-lg border bg-white px-3 py-2 text-sm">Funcionários</Link><button onClick={()=>void carregar()} title="Atualizar" className="rounded-lg border bg-white p-2"><RefreshCw size={17}/></button><button onClick={novo} className="inline-flex items-center gap-2 rounded-lg bg-blue-900 px-3 py-2 text-sm font-semibold text-white"><Plus size={16}/>Novo recibo</button></div>
   </header>
   <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Documento de preenchimento manual. A declaração de recebimento exige assinatura real; imprimir ou emitir não comprova o pagamento, não calcula encargos e não gera lançamento no financeiro.</div>
   {erro&&<p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erro}</p>}
   {aviso&&<p role="status" className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">{aviso}</p>}
   {simulacao&&<p className="text-sm text-blue-800">Prévia de homologação: impressão disponível sem gravação no banco.</p>}
   <section className="rounded-xl border bg-white p-4">
    <h2 className="text-sm font-bold">Recibos anteriores ({recibos.length})</h2>
    <input value={filtro} onChange={e=>setFiltro(e.target.value)} placeholder="Buscar funcionário ou competência" className={campo}/>
    <p className="mt-2 text-xs text-slate-500">Marque os recibos no campo Lote para imprimir vários funcionários em um único PDF, com duas vias por página.</p>
    <div className="mt-3 max-h-60 space-y-2 overflow-y-auto">{carregando?<p className="flex items-center gap-2 text-sm"><Loader2 size={16} className="animate-spin"/>Carregando...</p>:filtrados.length?filtrados.map(r=><div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2 text-sm"><div><b>{r.funcionario_nome}</b><div className="text-xs text-slate-600">{r.competencia} · {r.situacao==='emitido'?'Emitido':'Rascunho'} · {moeda(r.valor_liquido)}</div></div><div className="flex gap-2"><label className="flex items-center gap-1 rounded-lg border px-2 text-xs"><input type="checkbox" checked={selecionados.includes(r.id)} onChange={e=>setSelecionados(a=>e.target.checked?[...a,r.id]:a.filter(id=>id!==r.id))}/>Lote</label><button onClick={()=>abrir(r)} className="rounded-lg border px-3 py-1.5 text-xs">{r.situacao==='emitido'?'Visualizar':'Editar'}</button><button onClick={()=>abrir(r,true)} className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs"><Copy size={13}/>Duplicar</button></div></div>):<p className="text-sm text-slate-500">Nenhum recibo salvo.</p>}</div>
   </section>
   <section className="rounded-xl border bg-white p-4 sm:p-5">
    <div className="mb-4 flex flex-wrap items-center justify-between"><h2 className="text-lg font-bold">{edicao?emitido?'Recibo emitido (leitura)':'Editar rascunho':'Preencher novo recibo'}</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-xs uppercase">{form.situacao}</span></div>
    <fieldset disabled={emitido} className="space-y-5 disabled:opacity-80">
     <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label className="text-xs font-semibold">Carregar do cadastro RH<select className={campo} value={form.rh_pessoa_id} onChange={e=>escolherPessoa(e.target.value)}><option value="">Preencher manualmente</option>{pessoas.filter(p=>p.ativo||p.id===form.rh_pessoa_id).map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
      <label className="text-xs font-semibold">Nome do funcionário *<input value={form.funcionario_nome} onChange={e=>setForm(v=>({...v,funcionario_nome:e.target.value}))} className={campo}/></label>
      <label className="text-xs font-semibold">Competência *<input type="month" value={form.competencia} onChange={e=>setForm(v=>({...v,competencia:e.target.value}))} className={campo}/></label>
     </div>
     <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {([
       ['empresa_codigo','Código da empresa'],['empresa_nome','Razão social'],['empresa_endereco','Endereço da empresa'],
       ['empresa_cnpj','CNPJ'],['titulo','Título impresso'],['tipo_pagamento','Tipo de recibo'],
       ['data_pagamento','Data informada do pagamento'],['funcionario_codigo','Matrícula'],['pis','PIS'],
       ['cbo','CBO'],['folha','Número da folha'],['local_codigo','Código local'],
       ['local_nome','Local'],['data_admissao','Data de admissão'],['cargo_codigo','Código do cargo'],
       ['cargo','Cargo'],['banco','Banco'],['agencia','Agência'],['conta','Conta corrente'],
       ['salario_base','Salário base (R$)'],['salario_contrib_inss','Sal. contribuição INSS'],
       ['base_fgts','Base FGTS'],['fgts_mes','FGTS do mês'],['base_irrf','Base IRRF'],
      ] as [keyof Dados,string][]).map(([key,label])=><label key={key} className={'text-xs font-semibold '+(key==='empresa_nome'||key==='empresa_endereco'?'sm:col-span-2':'')} >{label}<input type={key==='data_pagamento'||key==='data_admissao'?'date':'text'} className={campo} value={String(form.dados[key])} onChange={e=>mudarDados(key,e.target.value as never)}/></label>)}
     </div>
     <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">Lançamentos do recibo</h3><div className="flex flex-wrap gap-2"><button type="button" onClick={aplicarPercentual} className="rounded-lg border px-3 py-2 text-xs font-semibold">Recalcular percentual do adiantamento</button><button type="button" disabled={form.dados.itens.length>=12} onClick={()=>mudarDados('itens',[...form.dados.itens,{dia:hoje().slice(8,10),codigo:'',descricao:'',quantidade:'',referencia:'',base:'',vencimentos:0,descontos:0}])} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs"><Plus size={13}/>Linha</button></div></div>
      <div className="space-y-2">{form.dados.itens.map((it,i)=><div key={i} className="grid grid-cols-2 gap-2 rounded-lg border bg-slate-50 p-3 sm:grid-cols-4 lg:grid-cols-10 lg:items-end">
       {([['dia','Dia'],['codigo','Código'],['descricao','Descrição'],['quantidade','Quant/%'],['referencia','Referência'],['base','Vr.Unit./Base']] as [keyof Evento,string][]).map(([key,label])=><label key={key} className={'text-xs '+(key==='descricao'?'col-span-2 lg:col-span-2':'')} >{label}<input value={String(it[key])} onChange={e=>evento(i,key,e.target.value)} className={campo}/></label>)}
       <label className="text-xs">Vencimentos<input type="number" min="0" step=".01" value={it.vencimentos} onChange={e=>evento(i,'vencimentos',Number(e.target.value)||0)} className={campo}/></label>
       <label className="text-xs">Descontos<input type="number" min="0" step=".01" value={it.descontos} onChange={e=>evento(i,'descontos',Number(e.target.value)||0)} className={campo}/></label>
       <button type="button" aria-label="Remover linha" onClick={()=>mudarDados('itens',form.dados.itens.filter((_,n)=>i!==n))} className="rounded-lg border p-2 text-red-700"><Trash2 size={16}/></button>
      </div>)}</div>
      <div className="grid gap-3 rounded-lg bg-slate-100 p-3 sm:grid-cols-3"><div className="text-sm">Total vencimentos <b className="block text-lg">{moeda(totais.vencimentos)}</b></div><div className="text-sm">Total descontos <b className="block text-lg">{moeda(totais.descontos)}</b></div><div className="text-sm">Valor líquido <b className="block text-lg">{moeda(totais.liquido)}</b></div></div>
     </div>
     <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold">Observações no recibo<textarea className={campo} rows={2} value={form.dados.observacoes} onChange={e=>mudarDados('observacoes',e.target.value)}/></label><label className="text-xs font-semibold">Rodapé do modelo<input className={campo} value={form.dados.rodape} onChange={e=>mudarDados('rodape',e.target.value)}/></label></div>
    </fieldset>
    <div className="mt-4 flex flex-wrap justify-end gap-2"><button onClick={()=>window.print()} className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold"><Printer size={16}/>{selecionados.length?`Imprimir lote (${selecionados.length}) / PDF`:'Imprimir duas vias / PDF'}</button>{!emitido&&<><button disabled={salvando||simulacao} onClick={()=>void salvar('rascunho')} className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm disabled:opacity-50"><Save size={16}/>Salvar rascunho</button><button disabled={salvando||simulacao||totais.liquido<0} onClick={()=>void salvar('emitido')} className="rounded-lg bg-blue-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{salvando?'Salvando...':'Conferir e emitir'}</button></>}</div>
   </section>
   <section className="rounded-xl border bg-white p-4">
    <h2 className="mb-3 text-sm font-bold">Prévia A4 — duas vias iguais ao modelo do arquivo</h2>
    <p className="mb-3 text-xs text-slate-500">Na impressão, as duas vias saem na mesma folha. Recomendado: A4, escala 100%, sem cabeçalhos e rodapés do navegador.</p>
    <div className="overflow-x-auto rounded-lg bg-slate-200 p-2">
     <div className="rh-pagina-a4"><Via form={form} via="empregador"/><div className="rh-separacao"/><Via form={form} via="empregado"/></div>
    </div>
   </section>
  </div>
  <div id="rh-impressao-adiantamento" style={{display:'none'}}>{imprimirFormularios.map((doc,i)=><div key={i} className="rh-pagina-a4"><Via form={doc} via="empregador"/><div className="rh-separacao"/><Via form={doc} via="empregado"/></div>)}</div>
 </main>
}
