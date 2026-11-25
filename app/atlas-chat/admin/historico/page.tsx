'use client'
import {useEffect,useState} from 'react'
import {tokenAtual} from '@/lib/auth'
type Registro={id:string;cliente_nome:string|null;telefone:string;usuario_nome:string;responsavel_nome:string|null;ocultado_em:string;restaurado_em:string|null;mensagem_id:string|null}
type Mensagem={id:string;texto:string|null;tipo:string;direcao:string;usuario_nome:string|null;created_at:string;media_url:string|null}
export default function HistoricoMaster(){
 const [cliente,setCliente]=useState(''),[funcionario,setFuncionario]=useState(''),[telefone,setTelefone]=useState('')
 const [registros,setRegistros]=useState<Registro[]>([]),[mensagens,setMensagens]=useState<Mensagem[]>([]),[selecionado,setSelecionado]=useState<Registro|null>(null)
 const [erro,setErro]=useState(''),[busy,setBusy]=useState(false),[mais,setMais]=useState(false),[maisMensagens,setMaisMensagens]=useState(false)
 async function api(params:URLSearchParams,body?:object){
  const t=await tokenAtual();if(!t)throw Error('Entre no Atlas.')
  const r=await fetch('/api/atlas-chat/admin/historico?'+params,{cache:'no-store',headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'},...(body?{method:'PUT',body:JSON.stringify(body)}:{})})
  const j=await r.json();if(!r.ok)throw Error(j.error||'Consulta indisponível.');return j
 }
 async function listar(offset=0){
  setBusy(true);setErro('')
  try{const j=await api(new URLSearchParams({cliente,funcionario,telefone,offset:String(offset)}));setRegistros(xs=>offset?[...xs,...j.registros]:j.registros);setMais(j.mais)}catch(e){setErro(e instanceof Error?e.message:'Falha na busca.')}finally{setBusy(false)}
 }
 async function abrir(r:Registro,offset=0){
  setBusy(true);setErro('');setSelecionado(r)
  if(!offset)setMensagens([])
  try{const j=await api(new URLSearchParams({ocultacaoId:r.id,offset:String(offset)}));setMensagens(xs=>offset?[...xs,...j.mensagens]:j.mensagens);setMaisMensagens(j.mais)}catch(e){setErro(e instanceof Error?e.message:'Falha na consulta.')}finally{setBusy(false)}
 }
 async function restaurar(r:Registro){
  if(!window.confirm('Restaurar este registro na caixa do funcionário, se ele ainda tiver autorização?'))return
  setBusy(true);setErro('')
  try{await api(new URLSearchParams(),{id:r.id});setSelecionado(null);setMensagens([]);await listar()}catch(e){setErro(e instanceof Error?e.message:'Falha na restauração.')}finally{setBusy(false)}
 }
 useEffect(()=>{void listar()},[])
 return <main className="min-h-[100dvh] bg-slate-100 text-slate-900 p-4 md:p-8"><div className="max-w-5xl mx-auto space-y-4">
 <header className="bg-[#182444] rounded-xl p-4 text-white"><a href="/atlas-chat/admin" className="text-xs underline">Voltar ao Master</a><h1 className="font-bold text-xl mt-2">Histórico de conversas ocultadas</h1><p className="text-sm">Acesso exclusivo do Master · registros da empresa</p></header>
 <form className="bg-white rounded-xl border p-4 grid gap-3 md:grid-cols-3" onSubmit={e=>{e.preventDefault();setSelecionado(null);setMensagens([]);void listar()}}>
 {([['Cliente',cliente,setCliente],['Funcionário',funcionario,setFuncionario],['Telefone',telefone,setTelefone]] as const).map(([label,value,setter])=><label key={label} className="text-sm">{label}<input className="block w-full border rounded p-2 mt-1" value={value} onChange={e=>setter(e.target.value)}/></label>)}
 <button disabled={busy} className="bg-[#182444] text-white p-2 rounded disabled:opacity-40">Pesquisar</button></form>
 {erro&&<p role="alert" className="text-red-800 bg-red-50 p-3 rounded">{erro}</p>}
 <div className="grid gap-4 md:grid-cols-2"><section className="space-y-2">{!registros.length&&!busy&&<p>Nenhum registro encontrado.</p>}{registros.map(r=><article key={r.id} className="bg-white border rounded-lg p-3 space-y-1"><b>{r.cliente_nome||r.telefone}</b><p className="text-sm break-words">{r.telefone} · {r.usuario_nome}</p><p className="text-xs text-slate-500">{r.mensagem_id?'Mensagem':'Conversa'} · {new Date(r.ocultado_em).toLocaleString('pt-BR')} · {r.restaurado_em?'Restaurado':'Ocultado'}</p><div className="flex flex-wrap gap-3"><button disabled={busy} onClick={()=>void abrir(r)} className="text-sm underline">Consultar</button>{!r.restaurado_em&&<button disabled={busy} onClick={()=>void restaurar(r)} className="text-sm underline">Restaurar</button>}</div></article>)}{mais&&<button disabled={busy} onClick={()=>void listar(registros.length)} className="underline">Mais registros</button>}</section>
 <section className="bg-white border rounded-xl p-4 min-w-0 space-y-3"><h2 className="font-bold">{selecionado?.cliente_nome||'Selecione um registro'}</h2>{selecionado&&<p className="text-xs text-slate-500">Mensagens do registro original, da mais recente para a mais antiga.</p>}{mensagens.map(m=><div key={m.id} className="border-b pb-2 break-words"><p className="text-xs text-slate-500">{m.usuario_nome|| (m.direcao==='entrada'?'Cliente':'Atlas')} · {new Date(m.created_at).toLocaleString('pt-BR')}</p><p className="whitespace-pre-wrap">{m.texto||m.tipo}</p>{m.media_url&&<a href={m.media_url} target="_blank" rel="noreferrer" className="underline text-sm">Abrir arquivo</a>}</div>)}{maisMensagens&&selecionado&&<button disabled={busy} onClick={()=>void abrir(selecionado,mensagens.length)} className="underline">Mais mensagens</button>}</section></div>
 </div></main>
}
