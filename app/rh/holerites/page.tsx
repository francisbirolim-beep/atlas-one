'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { FileText, Loader2, Plus, Printer, RefreshCw, Save, Trash2 } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'

type Rubrica={tipo:'provento'|'desconto';descricao:string;referencia:string;valor:number}
type Funcionario={id:string;nome:string;cpf_cnpj:string|null;cargo:string|null;setor:string|null;salario_base:number|null;ativo:boolean}
type Situacao='rascunho'|'emitido'
type Formulario={rh_pessoa_id:string;competencia:string;empresa_nome:string;empresa_documento:string;cargo_funcionario:string;setor_funcionario:string;salario_base:string;data_pagamento:string;observacoes:string;situacao:Situacao;itens:Rubrica[]}
type Registro=Omit<Formulario,'salario_base'> & {id:string;nome_funcionario:string;cpf_funcionario:string|null;salario_base:number|null;total_proventos:number;total_descontos:number;valor_liquido:number;created_at:string;emitido_em:string|null}
const dinheiro=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0)
const hoje=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'America/Sao_Paulo'})
const rubricaVazia=():Rubrica=>({tipo:'provento',descricao:'',referencia:'',valor:0})
const formularioVazio=():Formulario=>({rh_pessoa_id:'',competencia:hoje().slice(0,7),empresa_nome:'Esquadrifácio',empresa_documento:'',cargo_funcionario:'',setor_funcionario:'',salario_base:'',data_pagamento:'',observacoes:'',situacao:'rascunho',itens:[rubricaVazia()]})
const campo='mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none'
const calc=(itens:Rubrica[])=>{
 const soma=(tipo:Rubrica['tipo'])=>Math.round(itens.filter(i=>i.tipo===tipo).reduce((s,i)=>s+Math.round((Number(i.valor)||0)*100),0))/100
 const proventos=soma('provento'),descontos=soma('desconto')
 return {proventos,descontos,liquido:Math.round((proventos-descontos)*100)/100}
}
const dataBR=(s:string)=>s?new Date(s+'T12:00:00').toLocaleDateString('pt-BR'):'—'

export default function HoleritesRH(){
 const [pessoas,setPessoas]=useState<Funcionario[]>([])
 const [podeEditar,setPodeEditar]=useState(false)
 const [registros,setRegistros]=useState<Registro[]>([])
 const [carregando,setCarregando]=useState(true)
 const [salvando,setSalvando]=useState(false)
 const [simulacao,setSimulacao]=useState(false)
 const [erro,setErro]=useState(''),[aviso,setAviso]=useState('')
 const [form,setForm]=useState<Formulario>(formularioVazio)
 const [edicao,setEdicao]=useState('')
 const [nomePreview,setNomePreview]=useState('')
 const [filtro,setFiltro]=useState('')
 const [mostrarHistorico,setMostrarHistorico]=useState(true)
 const selecionado=pessoas.find(p=>p.id===form.rh_pessoa_id)
 const nomeHolerite=registros.find(r=>r.id===edicao)?.nome_funcionario||selecionado?.nome||nomePreview
 const cpfHolerite=registros.find(r=>r.id===edicao)?.cpf_funcionario||selecionado?.cpf_cnpj||''
 const totais=useMemo(()=>calc(form.itens),[form.itens])
 const emitido=form.situacao==='emitido'
 const filtrados=registros.filter(r=>(r.nome_funcionario+' '+r.competencia).toLowerCase().includes(filtro.toLowerCase()))
 async function carregar(){
  setCarregando(true);setErro('')
  try{
   const token=await tokenAtual()
   if(!token)throw new Error('Sessão expirada.')
   const res=await fetch('/api/rh/holerites',{headers:{Authorization:'Bearer '+token},cache:'no-store'})
   const data=await res.json()
   if(!res.ok)throw new Error(data.error||'Erro ao carregar holerites.')
   setPessoas(data.pessoas||[]);setRegistros(data.holerites||[]);setSimulacao(!!data.simulacao);setPodeEditar(data.podeEditar===true)
  }catch(e){setErro(e instanceof Error?e.message:'Falha ao consultar holerites.')}
  finally{setCarregando(false)}
 }
 useEffect(()=>{void carregar()},[])
 function definirPessoa(id:string){
  const p=pessoas.find(x=>x.id===id)
  setForm(v=>({...v,rh_pessoa_id:id,cargo_funcionario:p?.cargo||'',setor_funcionario:p?.setor||'',salario_base:p?.salario_base==null?'':String(p.salario_base),itens:v.itens.length===1&&(!v.itens[0].descricao.trim()||v.itens[0].descricao==='Salário base')?[{...v.itens[0],valor:p?.salario_base||0}]:v.itens}))
 }
 function iniciarNovo(p?:Funcionario){
  setErro('');setAviso('');setEdicao('');setNomePreview('')
  const vazio=formularioVazio()
  setForm(p?{...vazio,rh_pessoa_id:p.id,cargo_funcionario:p.cargo||'',setor_funcionario:p.setor||'',salario_base:p.salario_base==null?'':String(p.salario_base),itens:[{tipo:'provento',descricao:'Salário base',referencia:'',valor:p.salario_base||0}]}:vazio)
  setMostrarHistorico(false)
 }
 function abrir(r:Registro,duplicar=false){
  setErro('');setAviso('');setEdicao(duplicar?'':r.id);setNomePreview(r.nome_funcionario)
  setForm({rh_pessoa_id:r.rh_pessoa_id,competencia:r.competencia,empresa_nome:r.empresa_nome||'',empresa_documento:r.empresa_documento||'',cargo_funcionario:r.cargo_funcionario||'',setor_funcionario:r.setor_funcionario||'',salario_base:r.salario_base==null?'':String(r.salario_base),data_pagamento:r.data_pagamento||'',observacoes:r.observacoes||'',situacao:duplicar?'rascunho':r.situacao,itens:r.itens.map(i=>({...i}))})
  setMostrarHistorico(false)
 }
 function campoForm<K extends keyof Formulario>(nome:K,valor:Formulario[K]){setForm(v=>({...v,[nome]:valor}))}
 function mudarRubrica(index:number,key:keyof Rubrica,valor:string|number){
  setForm(v=>({...v,itens:v.itens.map((i,n)=>n===index?{...i,[key]:valor}:i)}))
 }
 async function salvar(situacao:Situacao){
  setErro('');setAviso('')
  if(!form.rh_pessoa_id){setErro('Selecione um funcionário cadastrado para salvar. Na prévia é possível preencher e imprimir sem gravar.');return}
  if(!form.competencia){setErro('Informe a competência.');return}
  if(form.itens.some(i=>!i.descricao.trim()||!Number.isFinite(Number(i.valor))||Number(i.valor)<0)){setErro('Preencha a descrição e os valores de todas as rubricas.');return}
  if(totais.liquido<0){setErro('Descontos maiores que os proventos. Confira os valores.');return}
  if(situacao==='emitido'&&!window.confirm('Confirmar emissão deste holerite manual? O documento ficará bloqueado para edição. A emissão NÃO registra pagamento nem envia ao eSocial.'))return
  setSalvando(true)
  try{
   const token=await tokenAtual();if(!token)throw new Error('Sessão expirada.')
   const res=await fetch('/api/rh/holerites',{method:edicao?'PATCH':'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({...form,id:edicao||undefined,situacao,conferido:situacao==='emitido',salario_base:form.salario_base===''?null:Number(form.salario_base)})})
   const data=await res.json()
   if(!res.ok)throw new Error(data.error||'Falha ao salvar.')
   setEdicao(data.id);setForm(v=>({...v,situacao}))
   setAviso(situacao==='emitido'?'Holerite emitido. Pode imprimir ou salvar como PDF.':'Rascunho salvo.')
   await carregar()
  }catch(e){setErro(e instanceof Error?e.message:'Erro ao salvar holerite.')}finally{setSalvando(false)}
 }
 return <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
  <style jsx global>{`@media print {
   @page{size:A4 portrait;margin:12mm}
   body *{visibility:hidden!important}
   #holerite-impressao,#holerite-impressao *{visibility:visible!important}
   #holerite-impressao{display:block!important;position:absolute!important;left:0;top:0;width:100%;margin:0!important;padding:0!important;color:#111!important;background:white!important}
  }`}</style>
  <div className="mx-auto max-w-6xl space-y-5">
   <header className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-slate-500">Recursos Humanos</p><h1 className="text-2xl font-bold">Holerites manuais</h1><p className="mt-1 text-sm text-slate-600">Preencha rubricas e valores livremente, confira os totais e imprima ou salve em PDF.</p></div><div className="flex flex-wrap gap-2"><Link href="/rh/pessoas" className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold">Cadastro RH</Link><button onClick={()=>void carregar()} className="rounded-lg border bg-white p-2" title="Atualizar"><RefreshCw size={18}/></button>{podeEditar&&<button onClick={()=>iniciarNovo()} className="flex items-center gap-2 rounded-lg bg-blue-900 px-3 py-2 text-sm font-bold text-white"><Plus size={16}/>Novo holerite</button>}</div></header>
   <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">O preenchimento é manual. INSS, IRRF, FGTS e demais encargos não são calculados automaticamente. A impressão não comprova pagamento, não gera contas a pagar e não substitui a escrituração da folha/eSocial.</div>
   {simulacao&&<p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900">Prévia de homologação: edição e impressão disponíveis, mas salvar exige a migração em um banco de testes isolado.</p>}
   {erro&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{erro}</p>}
   {aviso&&<p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{aviso}</p>}
   <section className="rounded-xl border bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">Holerites salvos ({registros.length})</h2><button className="text-sm font-semibold text-blue-800 underline" onClick={()=>setMostrarHistorico(!mostrarHistorico)}>{mostrarHistorico?'Recolher':'Mostrar'} histórico</button></div>
    {mostrarHistorico&&<div className="mt-3 space-y-2"><input value={filtro} onChange={e=>setFiltro(e.target.value)} placeholder="Pesquisar funcionário ou competência" className={campo}/>{carregando?<p className="text-sm"><Loader2 className="inline animate-spin" size={16}/> Carregando...</p>:filtrados.length?filtrados.map(r=><div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"><div><b>{r.nome_funcionario}</b><p className="text-xs text-slate-600">{r.competencia} · {r.situacao==='emitido'?'Emitido':'Rascunho'} · Líquido: {dinheiro(r.valor_liquido)}</p></div><div className="flex gap-2"><button onClick={()=>abrir(r)} className="rounded-lg border px-3 py-2 text-xs font-bold">{r.situacao==='emitido'||!podeEditar?'Visualizar':'Editar'}</button>{podeEditar&&<button onClick={()=>abrir(r,true)} className="rounded-lg border px-3 py-2 text-xs">Duplicar</button>}</div></div>):<p className="py-3 text-sm text-slate-500">Nenhum holerite salvo nesta busca.</p>}</div>}
   </section>
   <section className="rounded-xl border bg-white p-4 sm:p-5">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold">{edicao?(emitido?'Holerite emitido (somente leitura)':'Editar rascunho'):'Novo holerite manual'}</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase text-slate-600">{form.situacao}</span></div>
    <fieldset disabled={emitido||!podeEditar} className="space-y-5 disabled:opacity-80">
     <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label className="text-xs font-semibold">Funcionário *<select value={form.rh_pessoa_id} onChange={e=>definirPessoa(e.target.value)} className={campo}><option value="">Selecione</option>{pessoas.filter(p=>p.ativo||p.id===form.rh_pessoa_id).map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
      {!pessoas.length&&<label className="text-xs font-semibold">Nome para prévia (não salva)<input value={nomePreview} onChange={e=>setNomePreview(e.target.value)} className={campo} placeholder="Nome do funcionário"/></label>}
      <label className="text-xs font-semibold">Competência (mês/ano) *<input type="month" value={form.competencia} onChange={e=>campoForm('competencia',e.target.value)} className={campo}/></label>
      <label className="text-xs font-semibold">Data do pagamento (opcional)<input type="date" value={form.data_pagamento} onChange={e=>campoForm('data_pagamento',e.target.value)} className={campo}/></label>
      <label className="text-xs font-semibold sm:col-span-2">Empresa / razão social<input value={form.empresa_nome} onChange={e=>campoForm('empresa_nome',e.target.value)} className={campo}/></label>
      <label className="text-xs font-semibold">CNPJ da empresa<input value={form.empresa_documento} onChange={e=>campoForm('empresa_documento',e.target.value)} className={campo}/></label>
      <label className="text-xs font-semibold">Cargo no demonstrativo<input value={form.cargo_funcionario} onChange={e=>campoForm('cargo_funcionario',e.target.value)} className={campo}/></label>
      <label className="text-xs font-semibold">Setor<input value={form.setor_funcionario} onChange={e=>campoForm('setor_funcionario',e.target.value)} className={campo}/></label>
      <label className="text-xs font-semibold">Salário-base de referência (R$)<input type="number" min="0" step="0.01" value={form.salario_base} onChange={e=>campoForm('salario_base',e.target.value)} className={campo}/></label>
     </div>
     <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">Rubricas — proventos e descontos</h3><button type="button" onClick={()=>campoForm('itens',[...form.itens,rubricaVazia()])} disabled={form.itens.length>=60} className="flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-bold"><Plus size={14}/>Adicionar linha</button></div>
      <div className="space-y-2">{form.itens.map((item,i)=><div key={i} className="grid gap-2 rounded-xl border bg-slate-50 p-3 sm:grid-cols-[125px_1fr_110px_130px_35px] sm:items-end"><label className="text-xs font-semibold">Tipo<select value={item.tipo} onChange={e=>mudarRubrica(i,'tipo',e.target.value)} className={campo}><option value="provento">Provento</option><option value="desconto">Desconto</option></select></label><label className="text-xs font-semibold">Descrição livre<input value={item.descricao} onChange={e=>mudarRubrica(i,'descricao',e.target.value)} placeholder="Salário, hora extra, INSS..." className={campo}/></label><label className="text-xs font-semibold">Referência<input value={item.referencia} onChange={e=>mudarRubrica(i,'referencia',e.target.value)} placeholder="Horas / %" className={campo}/></label><label className="text-xs font-semibold">Valor (R$)<input type="number" inputMode="decimal" min="0" step="0.01" value={item.valor} onChange={e=>mudarRubrica(i,'valor',e.target.value===''?0:Number(e.target.value))} className={campo}/></label><button type="button" aria-label="Remover rubrica" title="Remover rubrica" onClick={()=>campoForm('itens',form.itens.filter((_,n)=>n!==i))} className="mb-1 flex items-center justify-center rounded-lg border p-2 text-red-700"><Trash2 size={16}/></button></div>)}</div>
      <div className="grid gap-3 rounded-xl bg-slate-100 p-4 sm:grid-cols-3"><div><p className="text-xs text-slate-500">Total proventos</p><b className="text-lg">{dinheiro(totais.proventos)}</b></div><div><p className="text-xs text-slate-500">Total descontos</p><b className="text-lg">{dinheiro(totais.descontos)}</b></div><div><p className="text-xs text-slate-500">Líquido calculado</p><b className={'text-xl '+(totais.liquido<0?'text-red-700':'text-emerald-800')}>{dinheiro(totais.liquido)}</b></div></div>
     </div>
     <label className="block text-xs font-semibold">Observações opcionais<textarea rows={3} value={form.observacoes} onChange={e=>campoForm('observacoes',e.target.value)} className={campo}/></label>
    </fieldset>
    <div className="mt-5 flex flex-wrap justify-end gap-2"><button type="button" onClick={()=>window.print()} className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-bold"><Printer size={16}/>Imprimir / PDF</button>{podeEditar&&!emitido&&<><button type="button" onClick={()=>void salvar('rascunho')} disabled={salvando||simulacao} className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-bold disabled:opacity-40"><Save size={16}/>Salvar rascunho</button><button type="button" onClick={()=>void salvar('emitido')} disabled={salvando||simulacao||totais.liquido<0} className="flex items-center gap-2 rounded-lg bg-blue-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"><FileText size={16}/>{salvando?'Salvando...':'Conferir e emitir'}</button></>}</div>
   </section>
  </div>
  <section id="holerite-impressao" className="hidden bg-white text-black">
   <div className="border-b-2 border-slate-800 pb-3"><p className="text-center text-xl font-bold">{form.empresa_nome||'Empresa não informada'}</p><p className="text-center text-xs">CNPJ: {form.empresa_documento||'Não informado'}</p><h1 className="mt-4 text-center text-lg font-bold">{emitido?'HOLERITE':'DEMONSTRATIVO DE PAGAMENTO — RASCUNHO'}</h1><p className="text-center text-xs">Competência: {form.competencia.split('-').reverse().join('/')} {form.data_pagamento?' | Data informada para pagamento: '+dataBR(form.data_pagamento):''}</p></div>
   <div className="mt-4 grid grid-cols-2 gap-2 text-sm"><p><b>Funcionário:</b> {nomeHolerite||'Não informado'}</p><p><b>CPF:</b> {cpfHolerite||'Não informado'}</p><p><b>Cargo:</b> {form.cargo_funcionario||'—'}</p><p><b>Setor:</b> {form.setor_funcionario||'—'}</p><p><b>Salário-base:</b> {form.salario_base===''?'—':dinheiro(Number(form.salario_base))}</p></div>
   <table className="mt-5 w-full border-collapse text-sm"><thead><tr className="border-y border-black"><th className="p-2 text-left">Descrição</th><th className="p-2 text-left">Referência</th><th className="p-2 text-right">Proventos</th><th className="p-2 text-right">Descontos</th></tr></thead><tbody>{form.itens.map((item,i)=><tr key={i} className="border-b border-slate-200"><td className="p-2">{item.descricao||'—'}</td><td className="p-2">{item.referencia||'—'}</td><td className="p-2 text-right">{item.tipo==='provento'?dinheiro(Number(item.valor)):'—'}</td><td className="p-2 text-right">{item.tipo==='desconto'?dinheiro(Number(item.valor)):'—'}</td></tr>)}</tbody><tfoot><tr className="border-t-2 border-black font-bold"><td colSpan={2} className="p-2">Totais</td><td className="p-2 text-right">{dinheiro(totais.proventos)}</td><td className="p-2 text-right">{dinheiro(totais.descontos)}</td></tr></tfoot></table>
   <p className="mt-4 border-2 border-black p-3 text-right text-lg font-bold">Valor líquido: {dinheiro(totais.liquido)}</p>
   {form.observacoes&&<p className="mt-4 whitespace-pre-wrap text-sm"><b>Observações:</b> {form.observacoes}</p>}
   <p className="mt-8 text-xs">Demonstrativo manual sujeito à conferência de rubricas, encargos e obrigações trabalhistas. Sua emissão não equivale à comprovação de pagamento nem ao envio ao eSocial.</p>
  </section>
 </main>
}
