'use client'
import { useEffect, useMemo, useState } from 'react'
import { Plus, X, Loader2 } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'
import { dinheiro, isoLocal } from '@/lib/financeiroPeriodo'

type Cadastro={id:string;nome:string;cnpj_cpf?:string|null}
type Plano={id:string;codigo:string;nome:string;grupo:string}
type Obra={id:string;cliente_id:string;nome:string;numero?:number|null}
type Compra={id:string;numero:string|null;fornecedor_id:string|null}
type Lookups={fornecedores:Cadastro[];clientes:Cadastro[];planoContas:Plano[];obras:Obra[];compras:Compra[];grupos:Record<string,string>}
type Tipo='pagar'|'receber'
const hoje=()=>isoLocal(new Date())
function adicionarMeses(data:string,n:number){
 const [a,m,d]=data.split('-').map(Number)
 if(!a||!m||!d)return ''
 const mes=new Date(a,m-1+n,1),ult=new Date(mes.getFullYear(),mes.getMonth()+1,0).getDate()
 return isoLocal(new Date(mes.getFullYear(),mes.getMonth(),Math.min(d,ult)))
}
export default function FormLancamentoManual({tipo,onSalvo}:{tipo:Tipo;onSalvo:()=>void}){
 const[aberto,setAberto]=useState(false),[consultando,setConsultando]=useState(false),[salvando,setSalvando]=useState(false)
 const[erro,setErro]=useState(''),[aviso,setAviso]=useState('')
 const[look,setLook]=useState<Lookups>({fornecedores:[],clientes:[],planoContas:[],obras:[],compras:[],grupos:{}})
 const[identificador,setIdentificador]=useState(''),[categoriaId,setCategoriaId]=useState(''),[obraId,setObraId]=useState(''),[compraId,setCompraId]=useState('')
 const[nomeNovo,setNomeNovo]=useState(''),[documentoNovo,setDocumentoNovo]=useState(''),[telefoneNovo,setTelefoneNovo]=useState('')
 const[grupoNovo,setGrupoNovo]=useState('despesa_operacional'),[categoriaNova,setCategoriaNova]=useState(''),[codigoNovo,setCodigoNovo]=useState('')
 const[gerenciarCategorias,setGerenciarCategorias]=useState(false),[categoriaEditandoId,setCategoriaEditandoId]=useState('')
 const[codigoEdicao,setCodigoEdicao]=useState(''),[nomeEdicao,setNomeEdicao]=useState(''),[grupoEdicao,setGrupoEdicao]=useState('despesa_operacional')
 const[adicionarPessoa,setAdicionarPessoa]=useState(false),[adicionarCategoria,setAdicionarCategoria]=useState(false)
 const[descricao,setDescricao]=useState(''),[documento,setDocumento]=useState(''),[valorTotal,setValorTotal]=useState(''),[forma,setForma]=useState('boleto'),[observacoes,setObservacoes]=useState('')
 const[dataEmissao,setDataEmissao]=useState(hoje()),[quantidade,setQuantidade]=useState(1),[vencimentos,setVencimentos]=useState<string[]>([hoje()])
 const[valoresIndividuais,setValoresIndividuais]=useState<string[]|null>(null)
 const[simulado,setSimulado]=useState(false)
 const[chaveLote,setChaveLote]=useState(()=>crypto.randomUUID())
 const cadastrados=tipo==='pagar'?look.fornecedores:look.clientes
 const obrasCliente=useMemo(()=>look.obras.filter(o=>o.cliente_id===identificador),[look.obras,identificador])
 const comprasFornecedor=useMemo(()=>look.compras.filter(c=>c.fornecedor_id===identificador),[look.compras,identificador])
 const valores=useMemo(()=>{
  const total=Math.round(Number(valorTotal||0)*100),q=quantidade
  return Array.from({length:q},(_,i)=>Math.max(0,Math.floor(total/q)+(i<total%q?1:0))/100)
 },[valorTotal,quantidade])
 const somaCentavos=valoresIndividuais?valoresIndividuais.reduce((s,v)=>s+Math.round((Number(v)||0)*100),0):Math.round((Number(valorTotal)||0)*100)
 const totalCentavos=Math.round((Number(valorTotal)||0)*100)
 const diferencaCentavos=somaCentavos-totalCentavos
 const valoresVisiveis=valoresIndividuais??valores.map(v=>v.toFixed(2))
 const demonstracao=typeof window!=='undefined' && (window.location.hostname.endsWith('.vercel.app') || window.location.hostname==='localhost')
 const auth=async()=>{const t=await tokenAtual();if(!t)throw new Error('Sessão expirada. Faça login novamente.');return t}
 async function carregar(){setConsultando(true);setErro('');try{
  const t=await auth(),r=await fetch('/api/financeiro/lancamentos-manuais',{headers:{Authorization:`Bearer ${t}`},cache:'no-store'}),j=await r.json()
  if(!r.ok)throw new Error(j.error||'Não foi possível carregar cadastros.')
  setLook(j)
 }catch(e){setErro(e instanceof Error?e.message:'Erro de consulta.')}finally{setConsultando(false)}}
 useEffect(()=>{if(aberto)void carregar()},[aberto,tipo])
 function mudarQuantidade(n:number){
  const q=Math.max(1,Math.min(36,n||1));setQuantidade(q)
  setVencimentos(prev=>Array.from({length:q},(_,i)=>prev[i]||adicionarMeses(prev[0]||hoje(),i)))
  if(valoresIndividuais)setValoresIndividuais(prev=>Array.from({length:q},(_,i)=>prev?.[i]??'0.00'))
 }
 function editarParcela(i:number,novo:string){
  setValoresIndividuais(prev=>{const valoresAtuais=prev??valores.map(v=>v.toFixed(2));return valoresAtuais.map((v,j)=>j===i?novo:v)})
  setErro('');setAviso('')
 }
 function selecionarCategoriaEdicao(id:string){
  const cat=look.planoContas.find(c=>c.id===id)
  setCategoriaEditandoId(id);setCodigoEdicao(cat?.codigo||'');setNomeEdicao(cat?.nome||'');setGrupoEdicao(cat?.grupo||'despesa_operacional');setErro('');setAviso('')
 }
 async function gerenciarCategoria(operacao:'editar-categoria'|'excluir-categoria'){
  if(!categoriaEditandoId)return
  if(operacao==='editar-categoria'&&(nomeEdicao.trim().length<3||!codigoEdicao.trim())){setErro('Informe código e nome da categoria.');return}
  if(operacao==='excluir-categoria'&&!window.confirm('Excluir esta categoria do DRE? Se estiver vinculada a algum título, o Atlas bloqueará a exclusão para preservar o histórico.'))return
  if(demonstracao){
   if(operacao==='editar-categoria')setLook(prev=>({...prev,planoContas:prev.planoContas.map(c=>c.id===categoriaEditandoId?{...c,codigo:codigoEdicao.trim(),nome:nomeEdicao.trim(),grupo:grupoEdicao}:c)}))
   else {setLook(prev=>({...prev,planoContas:prev.planoContas.filter(c=>c.id!==categoriaEditandoId)}));if(categoriaId===categoriaEditandoId)setCategoriaId('');setCategoriaEditandoId('')}
   setAviso('Alteração demonstrativa concluída. Nenhum cadastro real foi alterado.');return
  }
  setSalvando(true);setErro('');setAviso('')
  try{
   const token=await auth()
   const r=await fetch('/api/financeiro/lancamentos-manuais',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({tipo:'pagar',operacao,categoriaId:categoriaEditandoId,codigo:codigoEdicao.trim(),nome:nomeEdicao.trim(),grupo:grupoEdicao})})
   const j=await r.json();if(!r.ok)throw new Error(j.error||'Não foi possível atualizar o DRE.')
   const removida=operacao==='excluir-categoria';if(removida&&categoriaId===categoriaEditandoId)setCategoriaId('');if(removida)setCategoriaEditandoId('')
   await carregar();setAviso(removida?'Categoria excluída.':'Código, nome e grupo atualizados no DRE.')
  }catch(e){setErro(e instanceof Error?e.message:'Erro ao alterar categoria.')}
  finally{setSalvando(false)}
 }
 function trocarPrimeiroVencimento(data:string){setVencimentos(prev=>Array.from({length:quantidade},(_,i)=>i===0?data:adicionarMeses(data,i)))}
 async function cadastrarPessoa(){if(nomeNovo.trim().length<3||(tipo==='receber'&&nomeNovo.trim().split(/\s+/).length<2)){setErro(tipo==='receber'?'Informe nome e sobrenome do cliente.':'Informe o nome do fornecedor ou prestador.');return}
  if(demonstracao){const novo={id:`demo-${Date.now()}`,nome:nomeNovo.trim(),cnpj_cpf:documentoNovo};setLook(prev=>({...prev,[tipo==='pagar'?'fornecedores':'clientes']:[...(tipo==='pagar'?prev.fornecedores:prev.clientes),novo]}));setIdentificador(novo.id);setAdicionarPessoa(false);setAviso('Cadastro criado apenas nesta demonstração; não foi gravado.');return}
  setSalvando(true);setErro('');try{const t=await auth(),r=await fetch('/api/financeiro/lancamentos-manuais',{method:'POST',headers:{Authorization:`Bearer ${t}`,'Content-Type':'application/json'},body:JSON.stringify({tipo,operacao:'novo-cadastro',nome:nomeNovo,documento:documentoNovo,telefone:telefoneNovo})});const j=await r.json();if(!r.ok)throw new Error(j.error||'Falha ao cadastrar.');await carregar();setIdentificador(j.cadastro.id);setAdicionarPessoa(false);setAviso(j.existente?'Cadastro já existente selecionado.':'Cadastro criado.')}
 catch(e){setErro(e instanceof Error?e.message:'Erro ao cadastrar.')}finally{setSalvando(false)}
 }
 async function cadastrarCategoria(){if(categoriaNova.trim().length<3){setErro('Informe o nome da categoria.');return}
  if(demonstracao){const novo={id:`demo-${Date.now()}`,nome:categoriaNova.trim(),codigo:codigoNovo.trim()||'8.001',grupo:grupoNovo};setLook(prev=>({...prev,planoContas:[...prev.planoContas,novo]}));setCategoriaId(novo.id);setAdicionarCategoria(false);setAviso('Nova categoria disponível apenas nesta prévia; não salva no DRE real.');return}
  setSalvando(true);setErro('');try{const t=await auth(),r=await fetch('/api/financeiro/lancamentos-manuais',{method:'POST',headers:{Authorization:`Bearer ${t}`,'Content-Type':'application/json'},body:JSON.stringify({tipo,operacao:'nova-categoria',nome:categoriaNova,grupo:grupoNovo,codigo:codigoNovo.trim()})});const j=await r.json();if(!r.ok)throw new Error(j.error||'Falha ao cadastrar categoria.');await carregar();setCategoriaId(j.categoria.id);setAdicionarCategoria(false);setAviso('Categoria adicionada ao plano de contas.')}
  catch(e){setErro(e instanceof Error?e.message:'Erro ao cadastrar categoria.')}finally{setSalvando(false)}
 }
 async function salvar(e:React.FormEvent){e.preventDefault();setErro('');setAviso('');setSimulado(false)
  if(!identificador){setErro(tipo==='pagar'?'Selecione um fornecedor obrigatório.':'Selecione um cliente obrigatório.');return}
  if(tipo==='pagar'&&!categoriaId){setErro('Classificação de DRE obrigatória.');return}
  if(!Number.isFinite(Number(valorTotal))||Number(valorTotal)<=0||!vencimentos.every(Boolean)){setErro('Informe valor e todas as datas de vencimento.');return}
  if(valoresIndividuais){
   if(valoresIndividuais.length!==quantidade||valoresIndividuais.some(v=>!v.trim()||!Number.isFinite(Number(v))||Number(v)<=0||Math.abs(Number(v)*100-Math.round(Number(v)*100))>0.001)){setErro('Informe valores positivos com até duas casas decimais em todas as parcelas.');return}
   if(diferencaCentavos!==0){setErro(`A soma das parcelas (${dinheiro(somaCentavos/100)}) difere do valor total (${dinheiro(Number(valorTotal))}). Ajuste os valores ou use “Atualizar total pela soma”.`);return}
  }
  if(demonstracao){setSimulado(true);setAviso(`Simulação concluída: ${quantidade} título(s), total ${dinheiro(Number(valorTotal))}. Nenhum dado real foi salvo.`);return}
  setSalvando(true)
  try{const t=await auth(),r=await fetch('/api/financeiro/lancamentos-manuais',{method:'POST',headers:{Authorization:`Bearer ${t}`,'Content-Type':'application/json'},body:JSON.stringify({tipo,operacao:'titulo',identificador,categoriaId,obraId,compraId,valorTotal:Number(valorTotal),dataEmissao,vencimentos,quantidade,documento,descricao,forma,observacoes,chaveLote,valoresParcelas:valoresIndividuais?.map(Number)??null})});const j=await r.json();if(!r.ok)throw new Error(j.error||'Falha ao salvar.');setAviso(`${j.quantidade} título(s) criado(s).`);onSalvo();setChaveLote(crypto.randomUUID());setAberto(false)}
  catch(e){setErro(e instanceof Error?e.message:'Erro ao salvar.')}finally{setSalvando(false)}
 }
 return <>
  <button type="button" onClick={()=>setAberto(v=>!v)} className="inline-flex items-center gap-2 rounded-xl bg-blue-900 px-4 py-2.5 text-sm font-bold text-white"><Plus size={16}/>Lançar manualmente</button>
  {aberto&&<div role="dialog" aria-modal="true" aria-label="Lançamento financeiro manual" className="fixed inset-0 z-[60] overflow-y-auto bg-slate-900/60 p-3 sm:p-8"><section className="mx-auto max-w-4xl rounded-2xl border border-blue-200 bg-white p-4 shadow-xl" aria-label="Novo lançamento financeiro">
   <header className="mb-4 flex items-start justify-between"><div><h2 className="text-lg font-bold">Novo título — Contas a {tipo==='pagar'?'Pagar':'Receber'}</h2><p className="text-xs text-slate-500">O lançamento manual ficará na mesma lista dos títulos automáticos, sem substituir nenhum cadastro.</p></div><button onClick={()=>setAberto(false)} title="Fechar" className="rounded-lg border p-2"><X size={18}/></button></header>
   {demonstracao&&<p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-800">Modo prévia: simule a criação sem gravar valores no financeiro real.</p>}
   {erro&&<p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
   {aviso&&<p role="status" className="mb-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">{aviso}</p>}
   {consultando&&<p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={15} className="animate-spin"/>Carregando cadastros...</p>}
   <form onSubmit={salvar} className="grid gap-3 sm:grid-cols-2">
    <div className="sm:col-span-2"><label className="block text-xs font-semibold">{tipo==='pagar'?'Fornecedor / prestador de serviço':'Cliente / pagador'} *<select required value={identificador} onChange={e=>{setIdentificador(e.target.value);setObraId('');setCompraId('')}} className="mt-1 w-full rounded-lg border p-2.5 text-sm"><option value="">Selecione um cadastro</option>{cadastrados.map(x=><option key={x.id} value={x.id}>{x.nome}</option>)}</select></label><button type="button" onClick={()=>setAdicionarPessoa(x=>!x)} className="mt-1 text-xs font-bold text-blue-700">+ Novo {tipo==='pagar'?'fornecedor / prestador':'cliente'}</button></div>
    {adicionarPessoa&&<div className="sm:col-span-2 rounded-xl border bg-slate-50 p-3"><div className="grid gap-2 sm:grid-cols-3"><input aria-label="Nome do cadastro" placeholder="Nome completo *" className="rounded-lg border p-2" value={nomeNovo} onChange={e=>setNomeNovo(e.target.value)}/><input aria-label="CPF ou CNPJ" placeholder="CPF/CNPJ (se houver)" className="rounded-lg border p-2" value={documentoNovo} onChange={e=>setDocumentoNovo(e.target.value)}/>{tipo==='receber'&&<input aria-label="Telefone" placeholder="Telefone" className="rounded-lg border p-2" value={telefoneNovo} onChange={e=>setTelefoneNovo(e.target.value)}/>}</div><button type="button" disabled={salvando} onClick={()=>void cadastrarPessoa()} className="mt-2 rounded-lg border bg-white px-3 py-2 text-xs font-bold">Criar e selecionar cadastro</button></div>}
    {tipo==='pagar'?<><label className="text-xs font-semibold">Classificação do DRE *<select required value={categoriaId} onChange={e=>setCategoriaId(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm"><option value="">Escolha a natureza da despesa</option>{look.planoContas.map(x=><option key={x.id} value={x.id}>{x.codigo} · {x.nome}</option>)}</select><div className="mt-1 flex flex-wrap gap-3"><button type="button" onClick={()=>setAdicionarCategoria(x=>!x)} className="text-xs font-bold text-blue-700">+ Nova categoria de despesa</button><button type="button" onClick={()=>{setGerenciarCategorias(x=>!x);if(!categoriaEditandoId&&categoriaId)selecionarCategoriaEdicao(categoriaId)}} className="text-xs font-bold text-blue-700">Editar / excluir cadastro do DRE</button></div></label><label className="text-xs font-semibold">Vincular compra (opcional)<select value={compraId} onChange={e=>setCompraId(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm"><option value="">Sem vínculo de compra</option>{comprasFornecedor.map(x=><option key={x.id} value={x.id}>Nota / compra {x.numero||x.id.slice(0,8)}</option>)}</select></label></>:<><label className="text-xs font-semibold">Vincular obra (opcional)<select value={obraId} onChange={e=>setObraId(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm"><option value="">Sem vínculo com obra</option>{obrasCliente.map(x=><option key={x.id} value={x.id}>{x.nome} {x.numero?`#${x.numero}`:''}</option>)}</select></label></>}
    {gerenciarCategorias&&tipo==='pagar'&&<div className="sm:col-span-2 space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-3"><h3 className="text-sm font-bold text-blue-900">Gerenciar categorias do DRE</h3><p className="text-xs text-blue-800">Corrija código, nome e grupo. Excluir só é permitido se a categoria não estiver utilizada em títulos, para preservar o histórico financeiro.</p><select aria-label="Selecionar categoria para editar ou excluir" className="w-full rounded-lg border p-2 text-sm" value={categoriaEditandoId} onChange={e=>selecionarCategoriaEdicao(e.target.value)}><option value="">Selecione uma categoria</option>{look.planoContas.map(c=><option value={c.id} key={c.id}>{c.codigo} · {c.nome}</option>)}</select>{categoriaEditandoId&&<><div className="grid gap-2 sm:grid-cols-[130px_1fr_200px]"><label className="text-xs font-semibold">Código<input aria-label="Editar código do DRE" value={codigoEdicao} onChange={e=>setCodigoEdicao(e.target.value)} className="mt-1 w-full rounded-lg border p-2 text-sm"/></label><label className="text-xs font-semibold">Nome da categoria<input aria-label="Editar nome do DRE" value={nomeEdicao} onChange={e=>setNomeEdicao(e.target.value)} className="mt-1 w-full rounded-lg border p-2 text-sm"/></label><label className="text-xs font-semibold">Grupo<select aria-label="Editar grupo do DRE" value={grupoEdicao} onChange={e=>setGrupoEdicao(e.target.value)} className="mt-1 w-full rounded-lg border p-2 text-sm">{Object.entries(look.grupos).map(([v,t])=><option value={v} key={v}>{t}</option>)}</select></label></div><div className="flex flex-wrap gap-2"><button type="button" disabled={salvando} onClick={()=>void gerenciarCategoria('editar-categoria')} className="rounded-lg bg-blue-800 px-3 py-2 text-xs font-bold text-white">Salvar alterações</button><button type="button" disabled={salvando} onClick={()=>void gerenciarCategoria('excluir-categoria')} className="rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-bold text-red-700">Excluir categoria</button></div></>}</div>}
    {adicionarCategoria&&tipo==='pagar'&&<div className="sm:col-span-2 rounded-xl border bg-slate-50 p-3"><div className="flex flex-wrap gap-2"><input aria-label="Código da nova categoria" placeholder="Código (opcional, ex.: 8.001)" value={codigoNovo} onChange={e=>setCodigoNovo(e.target.value)} className="w-48 rounded-lg border p-2 text-sm"/><input aria-label="Nome da nova categoria" placeholder="Ex.: Material de limpeza" value={categoriaNova} onChange={e=>setCategoriaNova(e.target.value)} className="flex-1 rounded-lg border p-2 text-sm"/><select aria-label="Grupo da nova categoria" value={grupoNovo} onChange={e=>setGrupoNovo(e.target.value)} className="rounded-lg border p-2 text-sm">{Object.entries(look.grupos).map(([v,t])=><option value={v} key={v}>{t}</option>)}</select><button type="button" disabled={salvando} onClick={()=>void cadastrarCategoria()} className="rounded-lg bg-blue-900 px-3 py-2 text-xs font-bold text-white">Cadastrar categoria</button></div><p className="mt-2 text-xs text-slate-500">Compras para estoque não devem ser contabilizadas novamente como CMV; escolha o grupo correto.</p></div>}
    <label className="text-xs font-semibold">Documento / boleto<input value={documento} onChange={e=>setDocumento(e.target.value)} placeholder="Número do documento" className="mt-1 w-full rounded-lg border p-2.5 text-sm"/></label>
    <label className="text-xs font-semibold">Descrição<input value={descricao} onChange={e=>setDescricao(e.target.value)} placeholder="Motivo do lançamento" className="mt-1 w-full rounded-lg border p-2.5 text-sm"/></label>
    <label className="text-xs font-semibold">Valor total (R$) *<input type="number" min="0.01" step="0.01" required value={valorTotal} onChange={e=>setValorTotal(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm"/></label>
    <label className="text-xs font-semibold">Quantidade de parcelas *<input type="number" min="1" max="36" value={quantidade} onChange={e=>mudarQuantidade(Number(e.target.value))} className="mt-1 w-full rounded-lg border p-2.5 text-sm"/></label>
    <label className="text-xs font-semibold">Data de emissão<input type="date" required value={dataEmissao} onChange={e=>setDataEmissao(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm"/></label>
    <label className="text-xs font-semibold">Forma prevista<select value={forma} onChange={e=>setForma(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm">{['boleto','pix','transferencia','dinheiro','cartao','cheque','financiamento','outro'].map(x=><option key={x} value={x}>{x}</option>)}</select></label>
    <div className="sm:col-span-2 rounded-xl bg-slate-50 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-bold">Vencimentos e valores por parcela</h3><button type="button" onClick={()=>{setValoresIndividuais(null);setErro('')}} className="rounded-lg border bg-white px-2 py-1 text-xs font-bold text-blue-700">Dividir igualmente / redistribuir</button></div><p className="mb-3 mt-1 text-xs text-slate-600">Edite cada boleto individualmente. O total dos boletos deve conferir com o Valor total acima.</p><div className="grid gap-3 sm:grid-cols-3">{vencimentos.map((v,i)=><div key={i} className="rounded-lg border bg-white p-2"><p className="mb-1 text-xs font-bold text-slate-600">Parcela {i+1}/{quantidade}</p><label className="text-xs font-semibold text-slate-600">Valor do boleto (R$)<input type="number" min="0.01" step="0.01" required value={valoresVisiveis[i]??''} onChange={e=>editarParcela(i,e.target.value)} className="mt-1 w-full rounded-lg border bg-white p-2 text-sm" aria-label={`Valor da parcela ${i+1}`}/></label><label className="mt-2 block text-xs font-semibold text-slate-600">Vencimento<input type="date" required value={v} onChange={e=>i===0?trocarPrimeiroVencimento(e.target.value):setVencimentos(a=>a.map((x,j)=>j===i?e.target.value:x))} className="mt-1 w-full rounded-lg border bg-white p-2 text-sm"/></label></div>)}</div><div className={`mt-3 rounded-lg p-3 text-xs font-semibold ${diferencaCentavos===0?'bg-emerald-50 text-emerald-800':'bg-amber-100 text-amber-900'}`}><p>Soma dos boletos: {dinheiro(somaCentavos/100)} · Valor total: {dinheiro(Number(valorTotal)||0)}</p>{diferencaCentavos!==0&&<><p className="mt-1">Diferença: {dinheiro(diferencaCentavos/100)}. Ajuste as parcelas ou atualize o total.</p><button type="button" disabled={somaCentavos<=0} onClick={()=>setValorTotal((somaCentavos/100).toFixed(2))} className="mt-2 rounded-lg border border-amber-600 bg-white px-3 py-2 text-xs font-bold">Atualizar total pela soma das parcelas</button></>}</div></div>
    <label className="sm:col-span-2 text-xs font-semibold">Observações<textarea rows={2} value={observacoes} onChange={e=>setObservacoes(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm" placeholder="Opcional"/></label>
    <div className="sm:col-span-2 flex flex-wrap items-center justify-end gap-2"><button type="button" onClick={()=>setAberto(false)} className="rounded-lg border px-4 py-2 text-sm font-bold">Fechar</button><button type="submit" disabled={salvando||consultando} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{salvando?'Salvando...':demonstracao?'Simular lançamento (sem gravar)':'Salvar títulos'}</button></div>
    {simulado&&<p className="sm:col-span-2 text-xs font-semibold text-emerald-700">Simulação concluída. Para registrar títulos reais, será necessária a publicação aprovada.</p>}
   </form>
  </section></div>}
 </>
}
