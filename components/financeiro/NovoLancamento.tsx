'use client'
import {useEffect,useState} from 'react'
import {X,Plus,Save} from 'lucide-react'
import {tokenAtual} from '@/lib/auth'
type Pessoa={id:string;nome:string}
type Plano={id:string;codigo:string;nome:string;grupo:string}
type Obra={id:string;nome:string}
type Parcela={valor:number;vencimento:string}
type Tipo='pagar'|'receber'
const hoje=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function gerar(valor:number,quantidade:number,primeiro:string):Parcela[]{
 const n=Math.max(1,Math.min(48,Math.trunc(quantidade)||1)),centavos=Math.round(Math.max(0,valor)*100)
 const base=new Date((primeiro||hoje())+'T12:00:00Z')
 return Array.from({length:n},(_,i)=>{
  const y=base.getUTCFullYear(),m=base.getUTCMonth()+i,d=base.getUTCDate()
  const ultimo=new Date(Date.UTC(y,m+1,0)).getUTCDate()
  const venc=new Date(Date.UTC(y,m,Math.min(d,ultimo))).toISOString().slice(0,10)
  return {valor:(Math.floor(centavos/n)+(i<centavos%n?1:0))/100,vencimento:venc}
 })
}
async function requisitar(caminho:string,options?:RequestInit){
 const t=await tokenAtual();if(!t)throw new Error('Sessão expirada.')
 const r=await fetch(caminho,{...options,headers:{Authorization:'Bearer '+t,...options?.headers}})
 const j=await r.json().catch(()=>({}))
 if(!r.ok)throw new Error(j.error||'Erro no cadastro.')
 return j
}
const classes='w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-emerald-500'
export function NovoLancamento({tipo,fechar,salvo}:{tipo:Tipo;fechar:()=>void;salvo:()=>void}){
 const [pessoas,setPessoas]=useState<Pessoa[]>([]),[planos,setPlanos]=useState<Plano[]>([]),[obras,setObras]=useState<Obra[]>([])
 const [pessoaId,setPessoaId]=useState(''),[obraId,setObraId]=useState(''),[planoContaId,setPlanoContaId]=useState('')
 const [documento,setDocumento]=useState(''),[descricao,setDescricao]=useState(''),[forma,setForma]=useState('boleto')
 const [valor,setValor]=useState(''),[qtde,setQtde]=useState(1),[primeiro,setPrimeiro]=useState(hoje())
 const [parcelas,setParcelas]=useState<Parcela[]>(gerar(0,1,hoje()))
 const [novo,setNovo]=useState<'fornecedor'|'categoria'|null>(null),[nomeNovo,setNomeNovo]=useState(''),[grupoNovo,setGrupoNovo]=useState('despesa_operacional')
 const [erro,setErro]=useState(''),[busy,setBusy]=useState(false),[carregando,setCarregando]=useState(true)
 async function atualizar(){
  const j=await requisitar('/api/financeiro/cadastros-rapidos')
  setPessoas(tipo==='pagar'?j.fornecedores||[]:j.clientes||[]);setPlanos(j.planos||[])
 }
 useEffect(()=>{let ativo=true;void requisitar('/api/financeiro/cadastros-rapidos').then(j=>{if(!ativo)return;setPessoas(tipo==='pagar'?j.fornecedores||[]:j.clientes||[]);setPlanos(j.planos||[])}).catch(e=>{if(ativo)setErro(e.message)}).finally(()=>{if(ativo)setCarregando(false)});return()=>{ativo=false}},[tipo])
 useEffect(()=>{setParcelas(gerar(Number(valor||0),qtde,primeiro))},[valor,qtde,primeiro])
 useEffect(()=>{setObraId('');if(tipo!=='receber'||!pessoaId)return;let ativo=true;void requisitar('/api/financeiro/cadastros-rapidos?clienteId='+encodeURIComponent(pessoaId)).then(j=>{if(ativo)setObras(j.obras||[])}).catch(()=>{if(ativo)setObras([])});return()=>{ativo=false}},[pessoaId,tipo])
 async function criarNovo(){
  if(!novo)return
  setBusy(true);setErro('')
  try{
   const j=await requisitar('/api/financeiro/cadastros-rapidos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tipo:novo,nome:nomeNovo,grupo:grupoNovo})})
   await atualizar()
   if(novo==='fornecedor')setPessoaId(j.cadastro.id)
   else setPlanoContaId(j.cadastro.id)
   setNovo(null);setNomeNovo('')
  }catch(e){setErro(e instanceof Error?e.message:'Não foi possível cadastrar.')}finally{setBusy(false)}
 }
 async function salvar(e:React.FormEvent){
  e.preventDefault();setBusy(true);setErro('')
  try{
   if(!pessoaId)throw new Error('Selecione um '+(tipo==='pagar'?'fornecedor/beneficiário.':'cliente.'))
   if(tipo==='pagar'&&!planoContaId)throw new Error('Selecione uma categoria para o DRE.')
   if(!parcelas.length||parcelas.some(p=>p.valor<=0||!p.vencimento))throw new Error('Confira as parcelas e vencimentos.')
   await requisitar('/api/financeiro/lancamentos-manuais',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tipo,pessoaId,obraId,planoContaId,documento,descricao,forma,parcelas})})
   salvo()
  }catch(e){setErro(e instanceof Error?e.message:'Falha ao salvar.')}finally{setBusy(false)}
 }
 const titulo=tipo==='pagar'?'Nova conta a pagar':'Nova conta a receber'
 return <div role="dialog" aria-modal="true" aria-label={titulo} className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-950/50 p-3 sm:p-8">
  <div className="w-full max-w-3xl rounded-2xl bg-slate-50 p-4 shadow-2xl sm:p-6">
   <div className="mb-4 flex justify-between gap-3"><div><h2 className="text-xl font-bold">{titulo}</h2><p className="text-xs text-slate-500">Lançamento financeiro manual, separado dos títulos automáticos.</p></div><button type="button" aria-label="Fechar" onClick={fechar}><X/></button></div>
   {erro&&<p className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
   {carregando?<p>Carregando cadastros...</p>:<form onSubmit={salvar} className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2">
     <label className="text-sm font-semibold">{tipo==='pagar'?'Fornecedor / beneficiário *':'Cliente *'}<select required className={classes+' mt-1'} value={pessoaId} onChange={e=>setPessoaId(e.target.value)}><option value="">Selecione...</option>{pessoas.map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}</select>{tipo==='pagar'?<button type="button" onClick={()=>setNovo('fornecedor')} className="mt-1 text-xs font-semibold text-emerald-800">+ Cadastrar novo fornecedor / prestador</button>:<p className="mt-1 text-xs text-slate-500">Para cliente novo, faça o cadastro completo no Cliente 360.</p>}</label>
     {tipo==='pagar'?<label className="text-sm font-semibold">Categoria / destino do DRE *<select required className={classes+' mt-1'} value={planoContaId} onChange={e=>setPlanoContaId(e.target.value)}><option value="">Selecione...</option>{planos.map(p=><option key={p.id} value={p.id}>{p.codigo} — {p.nome}</option>)}</select><button type="button" onClick={()=>setNovo('categoria')} className="mt-1 text-xs font-semibold text-emerald-800">+ Criar nova categoria</button></label>:<label className="text-sm font-semibold">Obra (opcional)<select className={classes+' mt-1'} value={obraId} onChange={e=>setObraId(e.target.value)}><option value="">Recebimento geral do cliente</option>{obras.map(o=><option key={o.id} value={o.id}>{o.nome}</option>)}</select></label>}
     <label className="text-sm font-semibold">Número do boleto / referência<input className={classes+' mt-1'} value={documento} onChange={e=>setDocumento(e.target.value)} maxLength={100} placeholder="Ex.: BOLETO-123"/></label>
     <label className="text-sm font-semibold">Forma prevista<select value={forma} onChange={e=>setForma(e.target.value)} className={classes+' mt-1'}><option value="boleto">Boleto</option><option value="pix">Pix</option><option value="transferencia">Transferência</option><option value="cheque">Cheque</option><option value="cartao">Cartão</option><option value="dinheiro">Dinheiro</option></select></label>
     <label className="text-sm font-semibold sm:col-span-2">Descrição / finalidade<textarea rows={2} className={classes+' mt-1'} value={descricao} onChange={e=>setDescricao(e.target.value)} placeholder="Ex.: compra de perfis ou pagamento de serviço"/></label>
    </div>
    <div className="grid grid-cols-1 gap-3 rounded-xl border bg-white p-3 sm:grid-cols-3">
     <label className="text-sm font-semibold">Valor total (R$)<input required min="0.01" step="0.01" type="number" className={classes+' mt-1'} value={valor} onChange={e=>setValor(e.target.value)}/></label>
     <label className="text-sm font-semibold">Quantidade de parcelas<input type="number" min="1" max="48" className={classes+' mt-1'} value={qtde} onChange={e=>setQtde(Math.min(48,Math.max(1,Number(e.target.value)||1)))}/></label>
     <label className="text-sm font-semibold">Primeiro vencimento<input required type="date" className={classes+' mt-1'} value={primeiro} onChange={e=>setPrimeiro(e.target.value)}/></label>
    </div>
    <div><h3 className="mb-2 text-sm font-bold">Parcelas — ajuste os valores e vencimentos individualmente</h3><div className="grid gap-2 sm:grid-cols-2">{parcelas.map((p,i)=><div key={i} className="flex items-center gap-2 rounded-lg border bg-white p-2"><span className="w-9 text-xs font-semibold">{i+1}/{parcelas.length}</span><input aria-label={'Valor parcela '+(i+1)} type="number" min="0.01" step="0.01" value={p.valor||''} className="min-w-0 flex-1 rounded border p-2 text-sm" onChange={e=>setParcelas(ps=>ps.map((x,j)=>j===i?{...x,valor:Number(e.target.value)}:x))}/><input aria-label={'Vencimento parcela '+(i+1)} type="date" value={p.vencimento} className="min-w-0 flex-1 rounded border p-2 text-sm" onChange={e=>setParcelas(ps=>ps.map((x,j)=>j===i?{...x,vencimento:e.target.value}:x))}/></div>)}</div></div>
    <div className="flex flex-wrap justify-between gap-2 border-t pt-3"><b>Total das parcelas: {parcelas.reduce((s,p)=>s+p.valor,0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</b><div className="flex gap-2"><button type="button" className="rounded-lg border px-4 py-2" onClick={fechar}>Cancelar</button><button disabled={busy} type="submit" className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 font-bold text-white disabled:opacity-50"><Save size={17}/>{busy?'Salvando...':'Salvar títulos'}</button></div></div>
   </form>}
   {novo&&<div className="mt-4 rounded-xl border border-emerald-300 bg-white p-4"><p className="mb-2 font-bold">Novo {novo==='fornecedor'?'fornecedor / prestador':'destino do DRE'}</p><input autoFocus className={classes} placeholder="Nome do cadastro" value={nomeNovo} onChange={e=>setNomeNovo(e.target.value)}/>{novo==='categoria'&&<select className={classes+' mt-2'} value={grupoNovo} onChange={e=>setGrupoNovo(e.target.value)}><option value="cmv">Custo direto / CMV</option><option value="estoque">Estoque (sem despesa imediata)</option><option value="despesa_operacional">Despesa operacional</option><option value="despesa_financeira">Despesa financeira</option><option value="tributo">Tributos</option><option value="investimento">Investimento</option><option value="transferencia">Transferência / ajuste</option></select>}<div className="mt-3 flex gap-2"><button disabled={busy} type="button" onClick={criarNovo} className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-2 text-sm text-white"><Plus size={15}/>Cadastrar</button><button type="button" onClick={()=>setNovo(null)} className="rounded-lg border px-3 py-2 text-sm">Voltar</button></div></div>}
  </div>
 </div>
}
