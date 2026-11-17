'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Building2, CalendarDays, Camera, CheckCircle2, ExternalLink, MapPin, MessageCircle, Pencil, Phone, Plus, Save, UserRound, Users, X } from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import { adicionarContato, atualizarProspeccao, buscarClientesSemelhantes, buscarProspeccao, converterProspeccao, listarEquipeProspeccao, moverProspeccao, PAPEIS_CONTATO, registrarInteracao, STATUS_PROSPECCAO, type ContatoProspeccao, type InteracaoProspeccao, type PapelContatoProspeccao, type Prospeccao, type StatusProspeccao, type TipoInteracaoProspeccao } from '@/lib/prospeccao'
import type { Cliente, Usuario } from '@/lib/tipos'
import { enviarFotosProspeccao, listarFotosProspeccao, type FotoProspeccao } from '@/lib/prospeccaoFotos'
import {formatarCep} from '@/lib/geocodificacaoCep'

function dataHora(valor?:string|null){return valor?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(valor)):'—'}
const TIPOS:{id:TipoInteracaoProspeccao;label:string}[]=[{id:'ligacao',label:'Ligação'},{id:'whatsapp',label:'WhatsApp'},{id:'visita',label:'Visita'},{id:'nota',label:'Anotação'},{id:'outro',label:'Outro'}]

export default function ProspeccaoDetalhePage(){
  const id=String(useParams().id);const router=useRouter()
  const [usuario,setUsuario]=useState<Usuario|null>(null)
  const [p,setP]=useState<Prospeccao|null>(null);const [contatos,setContatos]=useState<ContatoProspeccao[]>([]);const [interacoes,setInteracoes]=useState<InteracaoProspeccao[]>([])
  const [carregando,setCarregando]=useState(true);const [erro,setErro]=useState('');const [salvando,setSalvando]=useState(false)
  const [tipo,setTipo]=useState<TipoInteracaoProspeccao>('ligacao');const [descricao,setDescricao]=useState('');const [proximaAcao,setProximaAcao]=useState('');const [proximaEm,setProximaEm]=useState('');const [statusNovo,setStatusNovo]=useState<StatusProspeccao|''>('')
  const [modalContato,setModalContato]=useState(false);const [papel,setPapel]=useState<PapelContatoProspeccao>('pedreiro');const [contatoNome,setContatoNome]=useState('');const [contatoTelefone,setContatoTelefone]=useState('');const [contatoEmpresa,setContatoEmpresa]=useState('')
  const [editando,setEditando]=useState(false);const [form,setForm]=useState<Record<string,string>>({});const [equipe,setEquipe]=useState<Pick<Usuario,'id'|'nome'>[]>([])
  const [modalConverter,setModalConverter]=useState(false);const [semelhantes,setSemelhantes]=useState<Cliente[]>([]);const [clienteEscolhido,setClienteEscolhido]=useState('');const [criarObra,setCriarObra]=useState(true)
  const [cadastroConversao,setCadastroConversao]=useState({nome_cliente:'',telefone:'',cidade:'',bairro:'',endereco:'',cep:'',complemento:''})
  const [confirmarClienteNovo,setConfirmarClienteNovo]=useState(false)
  const [fotos,setFotos]=useState<FotoProspeccao[]>([])
  const [erroFotos,setErroFotos]=useState('')
  const [enviandoFotos,setEnviandoFotos]=useState(false)

  async function carregarFotos(){
    const resultado=await listarFotosProspeccao(id)
    setFotos(resultado.fotos)
    setErroFotos(resultado.erro||'')
  }
  async function adicionarFotos(arquivos:File[]){
    if(!arquivos.length)return
    setEnviandoFotos(true);setErroFotos('')
    try{
      const resultado=await enviarFotosProspeccao(id,arquivos)
      await carregarFotos()
      if(resultado.falhas.length)setErroFotos(resultado.falhas.join(' · '))
    }catch(e){setErroFotos(e instanceof Error?e.message:'Erro ao enviar fotos.')}
    finally{setEnviandoFotos(false)}
  }
  async function carregar(){setCarregando(true);const me=await usuarioAtual();setUsuario(me);const d=await buscarProspeccao(id);setP(d.prospeccao);setContatos(d.contatos);setInteracoes(d.interacoes);if(me?.role==='master')setEquipe(await listarEquipeProspeccao());setCarregando(false);if(d.prospeccao)void carregarFotos()}
  useEffect(()=>{void carregar()},[id])

  async function mudarStatus(valor:StatusProspeccao){if(!p)return;const anterior=p;setP({...p,status:valor});const r=await moverProspeccao(anterior,valor);if(!r.ok){setErro(r.error||'Erro ao mover.');await carregar()}else await carregar()}
  async function salvarInteracao(){if(!p)return;setErro('');setSalvando(true);const r=await registrarInteracao(p,{tipo,descricao,proxima_acao:proximaAcao,proxima_acao_em:proximaEm?new Date(proximaEm).toISOString():undefined,status_novo:statusNovo||undefined});setSalvando(false);if(!r.ok){setErro(r.error||'Não foi possível registrar.');return}setDescricao('');setProximaAcao('');setProximaEm('');setStatusNovo('');await carregar()}
  async function salvarContato(){if(!contatoNome.trim())return;setSalvando(true);const r=await adicionarContato(id,{papel,nome:contatoNome,telefone:contatoTelefone,empresa:contatoEmpresa,observacoes:null});setSalvando(false);if(!r.ok){setErro(r.error||'Erro ao salvar contato.');return}setModalContato(false);setContatoNome('');setContatoTelefone('');setContatoEmpresa('');await carregar()}
  function abrirEdicao(){if(!p)return;setForm({nome_cliente:p.nome_cliente,telefone:p.telefone||'',nome_obra:p.nome_obra||'',cidade:p.cidade||'',bairro:p.bairro||'',cep:p.cep||'',endereco:p.endereco||'',complemento:p.complemento||'',fase_obra:p.fase_obra||'',observacoes:p.observacoes||'',temperatura:p.temperatura,responsavel_id:p.responsavel_id,responsavel_nome:p.responsavel_nome});setEditando(true)}
  async function salvarEdicao(){if(!p||!form.nome_cliente?.trim())return;setSalvando(true);const patch:any={...form};if(form.responsavel_id!==p.responsavel_id){patch.responsavel_nome=equipe.find(u=>u.id===form.responsavel_id)?.nome||form.responsavel_nome}const r=await atualizarProspeccao(id,patch);setSalvando(false);if(!r.ok){setErro(r.error||'Erro ao atualizar.');return}setEditando(false);await carregar()}
  async function abrirConversao(){
    if(!p)return
    // O título automático da visita pode ser o endereço, não o nome do cliente.
    const nome=p.nome_cliente===p.nome_obra?'':p.nome_cliente
    setCadastroConversao({nome_cliente:nome,telefone:p.telefone||'',cidade:p.cidade||'',bairro:p.bairro||'',endereco:p.endereco||'',cep:p.cep||'',complemento:p.complemento||''})
    setSemelhantes(await buscarClientesSemelhantes(nome,p.telefone))
    setClienteEscolhido('')
    setConfirmarClienteNovo(false)
    setModalConverter(true)
  }
  async function converter(){
    setErro('')
    if(!clienteEscolhido&&!cadastroConversao.nome_cliente.trim()){setErro('Informe o nome do cliente antes de converter.');return}
    if(!clienteEscolhido&&cadastroConversao.cep.trim()&&!formatarCep(cadastroConversao.cep)){setErro('O CEP precisa conter 8 números válidos.');return}
    setSalvando(true)
    if(!clienteEscolhido){
      // Nova pesquisa com os dados ATUAIS do formulário evita criar duplicados
      // apenas porque o nome foi preenchido depois da abertura do modal.
      const encontrados=await buscarClientesSemelhantes(cadastroConversao.nome_cliente,cadastroConversao.telefone)
      setSemelhantes(encontrados)
      if(encontrados.length&&!confirmarClienteNovo){
        setErro('Encontramos possíveis clientes cadastrados. Selecione um existente ou confirme expressamente a criação de um novo.')
        setSalvando(false)
        return
      }
      const atualizado=await atualizarProspeccao(id,{...cadastroConversao,cep:cadastroConversao.cep?formatarCep(cadastroConversao.cep):''})
      if(!atualizado.ok){setErro(atualizado.error||'Não foi possível salvar os dados do cadastro.');setSalvando(false);return}
    }
    const r=await converterProspeccao(id,clienteEscolhido||null,criarObra)
    setSalvando(false)
    if(!r.ok){setErro(r.error||'Não foi possível converter.');return}
    setModalConverter(false)
    router.push(`/clientes/${r.clienteId}`)
  }

  if(carregando)return <div className="min-h-screen grid place-items-center text-slate-400">Carregando prospecção...</div>
  if(!p)return <div className="min-h-screen grid place-items-center p-6 text-center"><div><p className="text-slate-500">Prospecção não encontrada ou sem acesso.</p><Link href="/prospeccao" className="mt-3 inline-block text-blue-600">Voltar</Link></div></div>
  const mapa=p.latitude!=null&&p.longitude!=null?`https://www.google.com/maps?q=${p.latitude},${p.longitude}`:null
  const streetView=p.latitude!=null&&p.longitude!=null?`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${p.latitude},${p.longitude}`:null
  const status=STATUS_PROSPECCAO.find(s=>s.id===p.status)

  return <div className="min-h-screen bg-slate-50">
    <header className="border-b bg-white"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4"><div className="flex items-center gap-3"><Link href="/prospeccao" className="rounded-xl border p-2"><ArrowLeft size={18}/></Link><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-blue-600">Prospecção</p><h1 className="text-xl font-bold">{p.nome_cliente}</h1><p className="text-xs text-slate-500">Responsável: {p.responsavel_nome}</p></div></div><div className="flex flex-wrap gap-2"><button onClick={abrirEdicao} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold"><Pencil size={15}/>Editar cadastro</button>{p.status!=='convertido'&&<button onClick={()=>void abrirConversao()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white"><CheckCircle2 size={16}/>Converter em cliente</button>}</div></div></header>
    <main className="mx-auto max-w-6xl space-y-4 px-4 py-5 pb-28">
      {erro&&<p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}
      <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <article className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${status?.cor||'bg-slate-400'} text-white`}>{status?.label}</span>{p.nome_obra&&<h2 className="mt-3 text-lg font-bold">{p.nome_obra}</h2>}</div><select value={p.status} onChange={e=>void mudarStatus(e.target.value as StatusProspeccao)} className="rounded-xl border px-3 py-2 text-sm">{STATUS_PROSPECCAO.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></div><div className="mt-5 grid gap-3 text-sm sm:grid-cols-2"><p className="flex items-center gap-2"><Phone size={15} className="text-slate-400"/>{p.telefone||'Telefone não informado'}</p><p className="flex items-center gap-2"><MapPin size={15} className="text-slate-400"/>{[p.endereco,p.bairro,p.cidade,p.cep].filter(Boolean).join(' · ')||'Endereço não informado'}</p><p><b>Fase da obra:</b> {p.fase_obra||'Não informada'}</p><p><b>Temperatura:</b> {p.temperatura}</p><p className="sm:col-span-2"><b>Interesses:</b> {p.interesses?.length?p.interesses.join(', '):'Ainda não identificados'}</p>{p.observacoes&&<p className="rounded-xl bg-slate-50 p-3 sm:col-span-2">{p.observacoes}</p>}</div>{mapa&&<a href={mapa} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700"><MapPin size={15}/>Abrir localização no mapa<ExternalLink size={13}/></a>}{streetView&&<a href={streetView} target="_blank" rel="noreferrer" className="mt-2 ml-2 inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700"><MapPin size={15}/>Ver Street View<ExternalLink size={13}/></a>}</article>
        <aside className={`rounded-2xl border p-5 shadow-sm ${p.proxima_acao_em&&new Date(p.proxima_acao_em).getTime()<Date.now()?'border-red-200 bg-red-50':'bg-white'}`}><div className="flex items-center gap-2"><CalendarDays size={18} className="text-blue-600"/><h2 className="font-bold">Próxima ação</h2></div><p className="mt-4 text-sm font-semibold">{p.proxima_acao||'Nenhuma ação definida'}</p><p className="mt-1 text-xs text-slate-500">{dataHora(p.proxima_acao_em)}</p>{p.proxima_acao_em&&new Date(p.proxima_acao_em).getTime()<Date.now()&&<span className="mt-3 inline-block rounded-full bg-red-600 px-2 py-1 text-[10px] font-bold text-white">ATRASADA</span>}</aside>
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="flex items-center gap-2 font-bold"><Camera size={17} className="text-blue-600"/>Fotos do local</h2><p className="text-xs text-slate-500">Imagens da visita vinculadas à obra prospectada. Acesso privado e temporário.</p></div>
          <label className={`cursor-pointer rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 ${enviandoFotos?'pointer-events-none opacity-50':''}`}>
            {enviandoFotos?'Enviando fotos...':'Adicionar fotos'}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple disabled={enviandoFotos} className="sr-only" onChange={e=>{const arquivos=Array.from(e.target.files||[]);e.target.value='';void adicionarFotos(arquivos)}}/>
          </label>
        </div>
        {erroFotos&&<p role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">{erroFotos}</p>}
        {fotos.length>0?<div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{fotos.map(foto=><a key={foto.nome} href={foto.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl border"><img loading="lazy" src={foto.url} alt={'Foto de '+(p.nome_obra||p.nome_cliente)} className="h-36 w-full object-cover"/><span className="block p-2 text-[11px] text-slate-500">{foto.criadoEm?dataHora(foto.criadoEm):'Foto da visita'}</span></a>)}</div>:<p className="mt-3 rounded-xl border border-dashed p-5 text-center text-xs text-slate-400">Nenhuma foto anexada.</p>}
      </section>
      <section className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <article className="rounded-2xl border bg-white p-5"><div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2"><Users size={17} className="text-violet-600"/><h2 className="font-bold">Pessoas da obra</h2></div><button onClick={()=>setModalContato(true)} className="rounded-lg border p-2 text-blue-600"><Plus size={15}/></button></div><div className="space-y-2">{contatos.map(c=><div key={c.id} className="rounded-xl border bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{PAPEIS_CONTATO.find(x=>x.id===c.papel)?.label}</p><p className="mt-1 text-sm font-bold">{c.nome}</p>{c.telefone&&<a href={`tel:${c.telefone}`} className="mt-1 block text-xs text-blue-600">{c.telefone}</a>}{c.empresa&&<p className="text-xs text-slate-500">{c.empresa}</p>}</div>)}{contatos.length===0&&<p className="rounded-xl border border-dashed p-5 text-center text-sm text-slate-400">Nenhum contato registrado.</p>}</div></article>
        <div className="space-y-4"><article className="rounded-2xl border bg-white p-5"><div className="flex items-center gap-2"><MessageCircle size={17} className="text-blue-600"/><h2 className="font-bold">Registrar contato</h2></div><div className="mt-4 grid gap-3"><select value={tipo} onChange={e=>setTipo(e.target.value as TipoInteracaoProspeccao)} className="rounded-xl border px-3 py-2.5 text-sm">{TIPOS.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select><textarea value={descricao} onChange={e=>setDescricao(e.target.value)} rows={4} placeholder="O que o cliente falou? O que ficou combinado?" className="rounded-xl border px-3 py-3 text-sm"/><div className="grid gap-3 sm:grid-cols-3"><input value={proximaAcao} onChange={e=>setProximaAcao(e.target.value)} placeholder="Próxima ação" className="rounded-xl border px-3 py-2.5 text-sm"/><input type="datetime-local" value={proximaEm} onChange={e=>setProximaEm(e.target.value)} className="rounded-xl border px-3 py-2.5 text-sm"/><select value={statusNovo} onChange={e=>setStatusNovo(e.target.value as StatusProspeccao|'')} className="rounded-xl border px-3 py-2.5 text-sm"><option value="">Manter etapa atual</option>{STATUS_PROSPECCAO.filter(s=>s.id!==p.status&&(s.id!=='convertido'||!!p.cliente_id)).map(s=><option key={s.id} value={s.id}>Mover para: {s.label}</option>)}</select></div><button onClick={()=>void salvarInteracao()} disabled={salvando||!descricao.trim()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white disabled:opacity-50"><Save size={16}/>{salvando?'Salvando...':'Salvar no diário'}</button></div></article>
        <article className="overflow-hidden rounded-2xl border bg-white"><div className="border-b px-5 py-4"><h2 className="font-bold">Diário da prospecção</h2><p className="text-xs text-slate-500">Histórico cronológico de visitas, ligações e mudanças.</p></div><div className="divide-y">{interacoes.map(i=><div key={i.id} className="flex gap-3 px-5 py-4"><span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500"/><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm capitalize">{i.tipo}</strong><span className="text-[11px] text-slate-400">{dataHora(i.created_at)}</span></div><p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{i.descricao}</p><p className="mt-2 text-[11px] text-slate-400">{i.usuario_nome}</p>{i.proxima_acao&&<p className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700"><b>Próxima ação:</b> {i.proxima_acao} · {dataHora(i.proxima_acao_em)}</p>}</div></div>)}{interacoes.length===0&&<p className="p-8 text-center text-sm text-slate-400">Nenhum registro no diário.</p>}</div></article></div>
      </section>
    </main>

    {modalContato&&<div className="fixed inset-0 z-[100] grid place-items-center bg-black/50 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-5"><div className="mb-4 flex justify-between"><h2 className="font-bold">Adicionar pessoa da obra</h2><button onClick={()=>setModalContato(false)}><X size={18}/></button></div><div className="space-y-3"><select value={papel} onChange={e=>setPapel(e.target.value as PapelContatoProspeccao)} className="w-full rounded-xl border px-3 py-2.5 text-sm">{PAPEIS_CONTATO.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select><input value={contatoNome} onChange={e=>setContatoNome(e.target.value)} placeholder="Nome" className="w-full rounded-xl border px-3 py-2.5"/><input value={contatoTelefone} onChange={e=>setContatoTelefone(e.target.value)} placeholder="Telefone" className="w-full rounded-xl border px-3 py-2.5"/><input value={contatoEmpresa} onChange={e=>setContatoEmpresa(e.target.value)} placeholder="Empresa / escritório" className="w-full rounded-xl border px-3 py-2.5"/><button onClick={()=>void salvarContato()} disabled={salvando||!contatoNome.trim()} className="w-full rounded-xl bg-blue-600 py-3 font-bold text-white">Salvar contato</button></div></div></div>}
    {editando&&<div className="fixed inset-0 z-[100] grid place-items-center bg-black/50 p-4"><div className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5"><div className="mb-4 flex justify-between"><div><h2 className="font-bold">Completar pré-cadastro</h2><p className="text-xs text-slate-500">Atualize os dados descobertos depois da primeira visita.</p></div><button onClick={()=>setEditando(false)}><X size={18}/></button></div><div className="grid gap-3 sm:grid-cols-2"><input value={form.nome_cliente||''} onChange={e=>setForm({...form,nome_cliente:e.target.value})} placeholder="Nome do cliente" className="rounded-xl border px-3 py-2.5 sm:col-span-2"/><input value={form.telefone||''} onChange={e=>setForm({...form,telefone:e.target.value})} placeholder="Telefone" className="rounded-xl border px-3 py-2.5"/><input value={form.nome_obra||''} onChange={e=>setForm({...form,nome_obra:e.target.value})} placeholder="Nome da obra" className="rounded-xl border px-3 py-2.5"/><input value={form.cidade||''} onChange={e=>setForm({...form,cidade:e.target.value})} placeholder="Cidade" className="rounded-xl border px-3 py-2.5"/><input value={form.bairro||''} onChange={e=>setForm({...form,bairro:e.target.value})} placeholder="Bairro" className="rounded-xl border px-3 py-2.5"/><input value={form.cep||''} onChange={e=>setForm({...form,cep:e.target.value})} placeholder="CEP" inputMode="numeric" maxLength={9} className="rounded-xl border px-3 py-2.5"/><input value={form.endereco||''} onChange={e=>setForm({...form,endereco:e.target.value})} placeholder="Endereço" className="rounded-xl border px-3 py-2.5 sm:col-span-2"/><input value={form.fase_obra||''} onChange={e=>setForm({...form,fase_obra:e.target.value})} placeholder="Fase da obra" className="rounded-xl border px-3 py-2.5"/><select value={form.temperatura||'frio'} onChange={e=>setForm({...form,temperatura:e.target.value})} className="rounded-xl border px-3 py-2.5"><option value="frio">Frio</option><option value="morno">Morno</option><option value="quente">Quente</option></select>{usuario?.role==='master'&&<select value={form.responsavel_id||''} onChange={e=>setForm({...form,responsavel_id:e.target.value})} className="rounded-xl border px-3 py-2.5 sm:col-span-2">{equipe.map(u=><option key={u.id} value={u.id}>Responsável: {u.nome}</option>)}</select>}<textarea value={form.observacoes||''} onChange={e=>setForm({...form,observacoes:e.target.value})} rows={4} placeholder="Observações" className="rounded-xl border px-3 py-2.5 sm:col-span-2"/></div><button onClick={()=>void salvarEdicao()} disabled={salvando} className="mt-4 w-full rounded-xl bg-slate-900 py-3 font-bold text-white">Salvar alterações</button></div></div>}
    {modalConverter&&<div className="fixed inset-0 z-[100] grid place-items-center bg-black/50 p-4"><div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5"><div className="mb-4 flex justify-between"><div><h2 className="font-bold">Converter em Cliente 360</h2><p className="text-xs text-slate-500">Confira e complete o cadastro antes de criar o cliente; o pin só muda para orçamento quando existir uma proposta vinculada à obra.</p></div><button onClick={()=>setModalConverter(false)}><X size={18}/></button></div>
      {semelhantes.length>0?<div className="space-y-2"><p className="text-xs font-bold text-amber-700">Possíveis clientes já cadastrados</p>{semelhantes.map(c=><label key={c.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${clienteEscolhido===c.id?'border-blue-500 bg-blue-50':''}`}><input type="radio" name="cliente" checked={clienteEscolhido===c.id} onChange={()=>setClienteEscolhido(c.id)}/><span><strong className="block text-sm">{c.nome}</strong><small className="text-slate-500">{c.whatsapp||c.telefone||'Sem telefone'} · {c.cidade||'Sem cidade'}</small></span></label>)}<label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${clienteEscolhido===''?'border-blue-500 bg-blue-50':''}`}><input type="radio" name="cliente" checked={clienteEscolhido===''} onChange={()=>setClienteEscolhido('')}/><span className="text-sm font-semibold">Criar um novo Cliente 360</span></label></div>:<p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">Se o cliente já estiver cadastrado, pesquise pelo nome ou telefone antes de confirmar.</p>}
      {semelhantes.length>0&&!clienteEscolhido&&<label className="mt-3 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900"><input type="checkbox" checked={confirmarClienteNovo} onChange={e=>setConfirmarClienteNovo(e.target.checked)} className="mt-0.5"/><span>Conferi os cadastros semelhantes e confirmo que preciso criar um cliente novo, sem vincular os existentes.</span></label>}
      {!clienteEscolhido&&<div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold sm:col-span-2">Nome do cliente ou razão social *<input value={cadastroConversao.nome_cliente} onChange={e=>{setCadastroConversao({...cadastroConversao,nome_cliente:e.target.value});setConfirmarClienteNovo(false)}} placeholder="Informe o nome verdadeiro, não apenas o endereço da obra" className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-normal"/></label>
        <label className="text-xs font-semibold">Telefone / WhatsApp<input value={cadastroConversao.telefone} onChange={e=>{setCadastroConversao({...cadastroConversao,telefone:e.target.value});setConfirmarClienteNovo(false)}} placeholder="Telefone" className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-normal"/></label>
        <label className="text-xs font-semibold">CEP<input value={cadastroConversao.cep} onChange={e=>setCadastroConversao({...cadastroConversao,cep:e.target.value})} placeholder="CEP" className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-normal"/></label>
        <label className="text-xs font-semibold">Cidade<input value={cadastroConversao.cidade} onChange={e=>setCadastroConversao({...cadastroConversao,cidade:e.target.value})} placeholder="Cidade" className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-normal"/></label>
        <label className="text-xs font-semibold">Bairro<input value={cadastroConversao.bairro} onChange={e=>setCadastroConversao({...cadastroConversao,bairro:e.target.value})} placeholder="Bairro" className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-normal"/></label>
        <label className="text-xs font-semibold sm:col-span-2">Rua e número<input value={cadastroConversao.endereco} onChange={e=>setCadastroConversao({...cadastroConversao,endereco:e.target.value})} placeholder="Rua e número" className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-normal"/></label>
        <label className="text-xs font-semibold sm:col-span-2">Referência / trecho aproximado<input value={cadastroConversao.complemento} onChange={e=>setCadastroConversao({...cadastroConversao,complemento:e.target.value})} placeholder="Referência da obra" className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-normal"/></label>
        <button type="button" onClick={async()=>{setSemelhantes(await buscarClientesSemelhantes(cadastroConversao.nome_cliente,cadastroConversao.telefone));setClienteEscolhido('');setConfirmarClienteNovo(false)}} className="rounded-xl border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 sm:col-span-2">Verificar se já existe cliente com este nome/telefone</button>
      </div>}
      <label className="mt-4 flex items-start gap-3 rounded-xl border p-3"><input type="checkbox" checked={criarObra} onChange={e=>setCriarObra(e.target.checked)} className="mt-1"/><span><strong className="block text-sm">Criar também a obra</strong><small className="text-slate-500">A obra recebe os dados da prospecção e poderá ser vinculada ao orçamento futuro.</small></span></label>
      {erro&&<p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-700">{erro}</p>}
      <button onClick={()=>void converter()} disabled={salvando||(!clienteEscolhido&&!cadastroConversao.nome_cliente.trim())} className="sticky bottom-0 mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 font-bold text-white disabled:opacity-50"><Building2 size={17}/>{salvando?'Convertendo...':'Confirmar cadastro e conversão'}</button></div></div>}
  </div>
}
