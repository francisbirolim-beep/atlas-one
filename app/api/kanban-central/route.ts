import { NextRequest,NextResponse } from 'next/server'
import { autenticarCompras } from '@/lib/comprasServer'
import { supabaseAdmin as db } from '@/lib/supabaseAdmin'
import { ETAPAS,SETORES_ACESSO,QUADROS,calcPct,progressoOperacional,type QuadroId,type SetorBoard,type NivelBoard } from '@/lib/centralKanban'

export const dynamic='force-dynamic'
export const runtime='nodejs'
const ids=new Set<string>(QUADROS.map(q=>q.id))
const boards=new Set<string>(Object.keys(ETAPAS))
const peso:Record<NivelBoard,number>={oculto:0,visualizar:1,movimentar:2,administrar:3}
const erro=(mensagem:string,status=400)=>NextResponse.json({erro:mensagem},{status,headers:{'Cache-Control':'no-store'}})
const txt=(v:unknown,max=2000)=>String(v??'').trim().slice(0,max)
const validade=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(v)
const numero=(v:unknown)=>{const x=Number(v);return Number.isFinite(x)?x:0}
const ativo=(status:unknown)=>!['cancelado','cancelada'].includes(String(status||'').toLowerCase())

async function contexto(req:NextRequest){
 const u=await autenticarCompras(req)
 if(!u)return null
 const [p,a]=await Promise.all([
   db.from('permissoes').select('setor_id,nivel').eq('usuario_id',u.id).eq('empresa_id',u.empresa_id),
   db.from('central_kanban_acessos').select('setor,nivel,responsavel').eq('usuario_id',u.id).eq('empresa_id',u.empresa_id),
 ])
 if(p.error||a.error)throw new Error('Não foi possível verificar permissões do usuário.')
 const mapa:Record<string,NivelBoard>={}
 for(const q of QUADROS){
   const permitidas=(p.data||[]).filter(x=>SETORES_ACESSO[q.id].includes(x.setor_id))
   mapa[q.id]=u.role==='master'?'administrar':permitidas.some(x=>x.nivel==='edicao')?'movimentar':permitidas.some(x=>x.nivel==='consulta')?'visualizar':'oculto'
 }
 for(const ac of a.data||[])if(u.role!=='master'&&ids.has(ac.setor))mapa[ac.setor]=ac.nivel as NivelBoard
 return {u,mapa,responsaveis:(a.data||[]).filter(x=>x.responsavel).map(x=>x.setor)}
}
async function verificaVenda(empresa:string,id:string){
 if(!validade(id))return false
 const {data,error}=await db.from('vendas_obras').select('id').eq('id',id).eq('empresa_id',empresa).maybeSingle()
 if(error)throw error
 return !!data
}
const acesso=(mapa:Record<string,NivelBoard>,setor:string,min:NivelBoard='visualizar')=>ids.has(setor)&&peso[mapa[setor]||'oculto']>=peso[min]
async function semearColunas(empresa:string,setores:string[]){
 const r=await db.from('central_kanban_colunas').select('id,empresa_id,setor,nome,ordem')
   .eq('empresa_id',empresa).order('ordem',{ascending:true})
 if(r.error)throw r.error
 const tem=new Set((r.data||[]).map(x=>x.setor))
 for(const setor of setores.filter(s=>boards.has(s)&&!tem.has(s))){
   const linhas=ETAPAS[setor as SetorBoard].map((nome,ordem)=>({empresa_id:empresa,setor,nome,ordem}))
   const insert=await db.from('central_kanban_colunas').upsert(linhas,{onConflict:'empresa_id,setor,nome',ignoreDuplicates:true})
   if(insert.error)throw insert.error
 }
 const again=await db.from('central_kanban_colunas').select('id,empresa_id,setor,nome,ordem')
   .eq('empresa_id',empresa).order('ordem',{ascending:true})
 if(again.error)throw again.error
 return again.data||[]
}
export async function GET(req:NextRequest){
 try{
  const ctx=await contexto(req)
  if(!ctx)return erro('Sessão inválida.',401)
  const permitidos=QUADROS.filter(q=>acesso(ctx.mapa,q.id)).map(q=>q.id)
  if(!permitidos.length)return erro('Sem permissão para visualizar Kanbans.',403)
  const busca=req.nextUrl.searchParams
  const detalhe=txt(busca.get('venda'),60)
  if(detalhe){
   if(!await verificaVenda(ctx.u.empresa_id,detalhe))return erro('Obra não encontrada.',404)
   const [c,h]=await Promise.all([
    db.from('central_kanban_comentarios').select('id,setor,texto,usuario_nome,created_at').eq('empresa_id',ctx.u.empresa_id).eq('venda_obra_id',detalhe).in('setor',permitidos).order('created_at',{ascending:false}).limit(200),
    db.from('central_kanban_historico').select('id,setor,coluna_anterior_nome,coluna_nova_nome,motivo,usuario_nome,created_at').eq('empresa_id',ctx.u.empresa_id).eq('venda_obra_id',detalhe).in('setor',permitidos).order('created_at',{ascending:false}).limit(200)
   ])
   if(c.error||h.error)throw(c.error||h.error)
   return NextResponse.json({comentarios:c.data||[],historico:h.data||[]})
  }
  const selecionado=txt(busca.get('setor'),40)
  if(selecionado&&!acesso(ctx.mapa,selecionado))return erro('Sem permissão nesse Kanban.',403)
  const setorColunas=selecionado?[selecionado]:permitidos
  const [colunas,vr,acessos]=await Promise.all([
    semearColunas(ctx.u.empresa_id,setorColunas),
    db.from('vendas_obras').select('id,numero,cliente_id,obra_id,orcamento_id,created_at,status').eq('empresa_id',ctx.u.empresa_id)
      .order('created_at',{ascending:false}).limit(1000),
    ctx.u.role==='master'?db.from('central_kanban_acessos').select('usuario_id,setor,nivel,responsavel').eq('empresa_id',ctx.u.empresa_id):
      Promise.resolve({data:[],error:null}),
  ])
  if(vr.error||acessos.error)throw(vr.error||acessos.error)
  const vendas=vr.data||[],vids=vendas.map(v=>v.id)
  const obraIds=[...new Set(vendas.map(v=>v.obra_id).filter(Boolean))] as string[]
  const clienteIds=[...new Set(vendas.map(v=>v.cliente_id).filter(Boolean))] as string[]
  const todos=async(tabela:string,campos:string,filtro:string,lista:string[],limite=5000)=>{
    if(!lista.length)return [] as any[]
    const r=await db.from(tabela).select(campos).eq('empresa_id',ctx.u.empresa_id).in(filtro,lista).limit(limite)
    if(r.error)throw r.error
    return (r.data||[]) as any[]
  }
  const [clientes,obras,compras,ordens,instalacoes,contas,posicoes,comentarios]=await Promise.all([
   todos('clientes','id,nome,cidade','id',clienteIds),
   todos('obras','id,nome,cidade,previsao_entrega','id',obraIds),
   todos('compras_necessidades','id,obra_id,status,recebido_em','obra_id',obraIds),
   todos('ordens_producao','id,venda_obra_id,status,bloqueada','venda_obra_id',vids),
   todos('venda_instalacao_itens','id,venda_obra_id,status,quantidade,quantidade_instalada,pendencia,checklist','venda_obra_id',vids),
   todos('financeiro_contas_receber','id,venda_obra_id,status,valor,valor_pago,valor_desconto','venda_obra_id',vids),
   vids.length?db.from('central_kanban_posicoes').select('setor,venda_obra_id,coluna_id,updated_at').eq('empresa_id',ctx.u.empresa_id).in('setor',permitidos).in('venda_obra_id',vids).limit(5000).then(r=>{if(r.error)throw r.error;return r.data||[]}):Promise.resolve([]),
   vids.length?db.from('central_kanban_comentarios').select('venda_obra_id,setor,created_at').eq('empresa_id',ctx.u.empresa_id).in('setor',permitidos).in('venda_obra_id',vids).order('created_at',{ascending:false}).limit(5000).then(r=>{if(r.error)throw r.error;return r.data||[]}):Promise.resolve([]),
  ])
  const nomeCliente=new Map(clientes.map(x=>[x.id,x.nome]))
  const nomesObra=new Map(obras.map(x=>[x.id,{nome:x.nome,cidade:x.cidade,previsao:x.previsao_entrega}]))
  const comentarioMaisRecente=new Map<string,string>()
  const qtdComentarios=new Map<string,number>()
  for(const x of comentarios){
   const chave=x.venda_obra_id+':'+x.setor
   if(!comentarioMaisRecente.has(chave))comentarioMaisRecente.set(chave,x.created_at)
   qtdComentarios.set(chave,(qtdComentarios.get(chave)||0)+1)
  }
  const cards=vendas.map(v=>{
   const cp=compras.filter(x=>x.obra_id===v.obra_id&&v.obra_id)
   const op=ordens.filter(x=>x.venda_obra_id===v.id)
   const it=instalacoes.filter(x=>x.venda_obra_id===v.id)
   const co=contas.filter(x=>x.venda_obra_id===v.id&&ativo(x.status))
   const comprado=cp.filter(x=>['aprovado','pedido_emitido','aguardando_entrega','recebido'].includes(x.status)).length
   const recebido=cp.filter(x=>x.recebido_em||x.status==='recebido').length
   const feito=op.filter(x=>!x.bloqueada&&['concluido','concluida','concluído','concluída','finalizado','finalizada','produzido','pronto'].includes(String(x.status||'').toLowerCase())).length
   const pecas=it.reduce((s,x)=>s+numero(x.quantidade),0)
   const pecasFeitas=it.reduce((s,x)=>s+Math.min(numero(x.quantidade),Math.max(0,numero(x.quantidade_instalada))),0)
   const previsto=co.reduce((s,x)=>s+numero(x.valor),0)
   const recebidoFinanceiro=co.reduce((s,x)=>s+Math.min(numero(x.valor),numero(x.valor_pago)),0)
   const pv={compras:calcPct(comprado,cp.length),mercadoria:calcPct(recebido,cp.length),producao:calcPct(feito,op.length),instalacao:calcPct(pecasFeitas,pecas),financeiro:calcPct(recebidoFinanceiro,previsto)}
   const obra=nomesObra.get(v.obra_id)
   const obs:Object=Object.fromEntries(permitidos.filter(s=>s!=='financeiro'||acesso(ctx.mapa,'financeiro')).map(s=>[s,{comentarios:qtdComentarios.get(v.id+':'+s)||0,ultimoComentario:comentarioMaisRecente.get(v.id+':'+s)||null}]))
   return {id:v.id,numero:v.numero,clienteId:v.cliente_id,cliente:nomeCliente.get(v.cliente_id)||'Cliente não identificado',
     obra:obra?.nome||('Venda #'+v.numero),cidade:obra?.cidade||'',previsao:obra?.previsao||null,
     percentualGeral:progressoOperacional(pv.compras,pv.producao,pv.instalacao),
     percentuais:Object.fromEntries(Object.entries(pv).filter(([s])=>s!=='financeiro'||acesso(ctx.mapa,'financeiro'))),
     contagens:{compras:cp.length,producao:op.length,instalacao:it.length,financeiro:co.length},
     observacoes:obs}
  })
  const nativos:Record<string,{colunas:Array<{id:string;nome:string;ordem:number}>,cards:Array<{id:string;cliente:string;obra:string;numero:number;cidade:string;coluna_id:string|null;href:string}>}>={}
  if(permitidos.includes('comercial')){
   const [cc,ca]=await Promise.all([
    db.from('kanban_colunas').select('id,nome,ordem').eq('empresa_id',ctx.u.empresa_id).order('ordem'),
    db.from('orcamentos').select('id,numero,cliente_nome,obra_nome,cidade,coluna_id').eq('empresa_id',ctx.u.empresa_id).eq('eh_assistencia',false).order('created_at',{ascending:false}).limit(500),
   ])
   if(cc.error||ca.error)throw (cc.error||ca.error)
   nativos.comercial={colunas:cc.data||[],cards:(ca.data||[]).map(x=>({id:x.id,cliente:x.cliente_nome||'Cliente',obra:x.obra_nome||'Orçamento',numero:x.numero||0,cidade:x.cidade||'',coluna_id:x.coluna_id,href:'/kanban/comercial?orcamento='+encodeURIComponent(x.id)}))}
  }
  if(permitidos.includes('assistencia')){
   const [cc,ca]=await Promise.all([
    db.from('assistencia_colunas').select('id,nome,ordem').eq('empresa_id',ctx.u.empresa_id).order('ordem'),
    db.from('assistencias').select('id,numero,cliente_nome,cidade,coluna_id').eq('empresa_id',ctx.u.empresa_id).order('created_at',{ascending:false}).limit(500)
   ])
   if(cc.error||ca.error)throw (cc.error||ca.error)
   nativos.assistencia={colunas:cc.data||[],cards:(ca.data||[]).map(x=>({id:x.id,cliente:x.cliente_nome||'Cliente',obra:'Assistência técnica',numero:x.numero||0,cidade:x.cidade||'',coluna_id:x.coluna_id,href:'/assistencias'}))}
  }
  const funcionarios=ctx.u.role==='master'?(await db.from('usuarios').select('id,nome,role').eq('empresa_id',ctx.u.empresa_id).order('nome')).data||[]:[]
  return NextResponse.json({quadros:QUADROS.filter(q=>permitidos.includes(q.id)),permissoes:ctx.mapa,colunas:colunas.filter(c=>permitidos.includes(c.setor)),
    posicoes, cards, nativos, funcionarios,acessos:acessos.data||[],atualizadoEm:new Date().toISOString()}, {headers:{'Cache-Control':'no-store'}})
 }catch(e){console.error('central kanban GET',e);return erro('Não foi possível carregar a Central de Kanbans.',500)}
}
export async function POST(req:NextRequest){
 try{
  const ctx=await contexto(req)
  if(!ctx)return erro('Sessão inválida.',401)
  const body=await req.json().catch(()=>null)
  if(!body||typeof body!=='object')return erro('Dados inválidos.')
  const acao=txt(body.acao,30),setor=txt(body.setor,40)
  if(!ids.has(setor))return erro('Setor inválido.')
  const empresa_id=ctx.u.empresa_id
  if(acao==='permissao'){
   if(ctx.u.role!=='master')return erro('Apenas o Master administra acessos.',403)
   if(!validade(body.usuarioId)||!['oculto','visualizar','movimentar','administrar'].includes(body.nivel))return erro('Permissão inválida.')
   const u=await db.from('usuarios').select('id').eq('id',body.usuarioId).eq('empresa_id',empresa_id).maybeSingle()
   if(u.error||!u.data)return erro('Funcionário não encontrado.',404)
   const r=await db.from('central_kanban_acessos').upsert({empresa_id,usuario_id:body.usuarioId,setor,nivel:body.nivel,responsavel:!!body.responsavel,atualizado_em:new Date().toISOString()},{onConflict:'empresa_id,usuario_id,setor'})
   if(r.error)throw r.error
   return NextResponse.json({ok:true})
  }
  if(acao==='coluna'){
   if(!boards.has(setor)||!acesso(ctx.mapa,setor,'administrar'))return erro('Sem autorização para editar colunas.',403)
   const nome=txt(body.nome,80)
   if(nome.length<2)return erro('Informe o nome da coluna.')
   if(body.id){
    const rr=await db.from('central_kanban_colunas').update({nome}).eq('id',body.id).eq('setor',setor).eq('empresa_id',empresa_id).select('id').maybeSingle()
    if(rr.error)throw rr.error
    if(!rr.data)return erro('Coluna não encontrada.',404)
   }else{
    const cols=await db.from('central_kanban_colunas').select('ordem').eq('empresa_id',empresa_id).eq('setor',setor).order('ordem',{ascending:false}).limit(1)
    if(cols.error)throw cols.error
    const next=numero(cols.data?.[0]?.ordem)+1
    const r=await db.from('central_kanban_colunas').insert({empresa_id,setor,nome,ordem:next})
    if(r.error)throw r.error
   }
   return NextResponse.json({ok:true})
  }
  if(acao==='excluirColuna'){
   if(!boards.has(setor)||!acesso(ctx.mapa,setor,'administrar'))return erro('Sem autorização.',403)
   if(!validade(body.id))return erro('Coluna inválida.')
   const [cols,usos]=await Promise.all([
    db.from('central_kanban_colunas').select('id').eq('empresa_id',empresa_id).eq('setor',setor),
    db.from('central_kanban_posicoes').select('venda_obra_id').eq('empresa_id',empresa_id).eq('setor',setor).eq('coluna_id',body.id).limit(1)
   ])
   if(cols.error||usos.error)throw(cols.error||usos.error)
   if((cols.data||[]).length<=1)return erro('O quadro precisa de pelo menos uma coluna.')
   if(usos.data?.length)return erro('Esta coluna possui cards. Mova os cards antes de excluir.')
   const r=await db.from('central_kanban_colunas').delete().eq('empresa_id',empresa_id).eq('setor',setor).eq('id',body.id).select('id')
   if(r.error)throw r.error
   return NextResponse.json({ok:true})
  }
  if(acao==='comentario'){
   if(!acesso(ctx.mapa,setor,'movimentar'))return erro('Sem permissão para comentar.',403)
   const venda=txt(body.vendaId,60),comentario=txt(body.texto,2000)
   if(!comentario)return erro('Escreva um comentário.')
   if(!await verificaVenda(empresa_id,venda))return erro('Venda não encontrada.',404)
   const r=await db.from('central_kanban_comentarios').insert({empresa_id,venda_obra_id:venda,setor,texto:comentario,usuario_id:ctx.u.id,usuario_nome:ctx.u.nome})
   if(r.error)throw r.error
   return NextResponse.json({ok:true})
  }
  if(acao==='mover'){
   if(!boards.has(setor)||!acesso(ctx.mapa,setor,'movimentar'))return erro('Sem permissão para movimentar este quadro.',403)
   const venda=txt(body.vendaId,60),destino=txt(body.colunaId,60)
   if(!await verificaVenda(empresa_id,venda))return erro('Venda não encontrada.',404)
   const col=await db.from('central_kanban_colunas').select('id,nome,ordem').eq('id',destino).eq('empresa_id',empresa_id).eq('setor',setor).maybeSingle()
   if(col.error||!col.data)return erro('Etapa de destino inválida.',404)
   const anterior=await db.from('central_kanban_posicoes').select('coluna_id').eq('empresa_id',empresa_id).eq('setor',setor).eq('venda_obra_id',venda).maybeSingle()
   if(anterior.error)throw anterior.error
   const colunas=await db.from('central_kanban_colunas').select('id,nome,ordem').eq('empresa_id',empresa_id).eq('setor',setor).order('ordem')
   if(colunas.error)throw colunas.error
   const origemId=anterior.data?.coluna_id||((colunas.data||[]).some(x=>x.id===body.origemId)?body.origemId:colunas.data?.[0]?.id)
   if(origemId===destino)return NextResponse.json({ok:true})
   if(body.origemId!==origemId)return erro('O card foi movimentado por outra pessoa. Atualize o quadro.',409)
   const antes=(colunas.data||[]).find(x=>x.id===origemId)
   const motivo=txt(body.motivo,500)
   if(antes&&col.data.ordem<antes.ordem&&!motivo)return erro('Ao retroceder, informe o motivo.')
   const atualizado=await db.from('central_kanban_posicoes').upsert({empresa_id,setor,venda_obra_id:venda,coluna_id:destino,atualizado_por_id:ctx.u.id,updated_at:new Date().toISOString()},{onConflict:'empresa_id,setor,venda_obra_id'})
   if(atualizado.error)throw atualizado.error
   const historico=await db.from('central_kanban_historico').insert({
    empresa_id,setor,venda_obra_id:venda,coluna_anterior_id:origemId,coluna_anterior_nome:antes?.nome||null,
    coluna_nova_id:destino,coluna_nova_nome:col.data.nome,motivo:motivo||null,usuario_id:ctx.u.id,usuario_nome:ctx.u.nome
   })
   if(historico.error){
    // Melhor conservar a trilha de auditoria que deixar uma mudança sem registro.
    await db.from('central_kanban_posicoes').update({coluna_id:origemId,updated_at:new Date().toISOString()})
       .eq('empresa_id',empresa_id).eq('setor',setor).eq('venda_obra_id',venda).eq('coluna_id',destino)
    throw historico.error
   }
   return NextResponse.json({ok:true})
  }
  return erro('Operação não suportada.')
 }catch(e){console.error('central kanban POST',e);return erro('Não foi possível salvar a alteração.',500)}
}
