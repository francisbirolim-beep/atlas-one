const assert=require('node:assert/strict')
const fs=require('node:fs')
const ts=require('typescript')
const code=ts.transpileModule(fs.readFileSync('app/api/producao/operacoes/route.ts','utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}
}).outputText
const ID={
 empresa:'11111111-1111-4111-8111-111111111111',outra:'22222222-2222-4222-8222-222222222222',
 usuario:'33333333-3333-4333-8333-333333333333',c1:'44444444-4444-4444-8444-444444444444',
 c2:'55555555-5555-4555-8555-555555555555',outroCol:'66666666-6666-4666-8666-666666666666',
 card:'77777777-7777-4777-8777-777777777777',ordem:'88888888-8888-4888-8888-888888888888',
 medicao:'99999999-9999-4999-8999-999999999999',orcamento:'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 cliente:'bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbbb',obra:'ccccccc1-cccc-4ccc-8ccc-cccccccccccc',
 venda:'ddddddd1-dddd-4ddd-8ddd-dddddddddddd',
}
let currentUser={id:ID.usuario,empresa_id:ID.empresa,role:'funcionario',nome:'Pessoa teste'}
let permission=true,authThrows=false
let mutations=0,records={}
function reset(){
 mutations=0
 records={
  setor_kanban_colunas:[
   {id:ID.c1,empresa_id:ID.empresa,setor_id:'producao',nome:'A Fazer',ordem:0},
   {id:ID.c2,empresa_id:ID.empresa,setor_id:'producao',nome:'Etapa Dois',ordem:1},
   {id:ID.outroCol,empresa_id:ID.outra,setor_id:'producao',nome:'Outra empresa',ordem:0}
  ],
  setor_kanban_itens:[{id:ID.card,empresa_id:ID.empresa,coluna_id:ID.c1,
   descricao:'Medição Final [medicao:'+ID.medicao+']',orcamento_id:ID.orcamento,
   liberado_producao_em:null}],
  ordens_producao:[{id:ID.ordem,empresa_id:ID.empresa,status:'liberada',bloqueada:false,origem:'workflow'}],
  medicoes_finais:[{id:ID.medicao,empresa_id:ID.empresa,tipo_medicao:'tipologia',
   status_operacional:'concluido',orcamento_id:ID.orcamento}],
  pacotes_tecnicos:[],
  clientes:[{id:ID.cliente,empresa_id:ID.empresa,nome:'Cliente'}],
  obras:[{id:ID.obra,empresa_id:ID.empresa,cliente_id:ID.cliente}],
  vendas_obras:[{id:ID.venda,empresa_id:ID.empresa,orcamento_id:ID.orcamento,cliente_id:ID.cliente,obra_id:ID.obra}],
 }
 currentUser={id:ID.usuario,empresa_id:ID.empresa,role:'funcionario',nome:'Pessoa teste'}
 permission=true;authThrows=false
}
reset()
const matches=(row,where)=>where.every(([field,mode,val])=>
 mode==='eq'?row[field]===val:mode==='neq'?row[field]!==val:
 mode==='is'?val===null?row[field]===null||row[field]===undefined:row[field]===val:true)
function table(name){
 let op='select',where=[],patch=null,orderby=null,lim=null
 let selection=''
 async function execute(single=false){
  let rows=(records[name]||[]).filter(r=>matches(r,where))
  if(orderby){
   rows=rows.slice().sort((a,b)=>((a[orderby.key]||0)>(b[orderby.key]||0)?1:-1)*(orderby.asc?1:-1))
  }
  if(lim)rows=rows.slice(0,lim)
  if(op==='insert'){
   mutations++
   const raw=Array.isArray(patch)?patch:[patch]
   rows=raw.map((v,i)=>({...v,id:v.id||('eeeeeee'+i+'-eeee-4eee-8eee-eeeeeeeeeeee')}))
   records[name]=(records[name]||[]).concat(rows)
  }
  if(op==='update'){
   mutations++
   rows.forEach(r=>Object.assign(r,patch))
  }
  if(op==='delete'){
   mutations++
   records[name]=(records[name]||[]).filter(r=>!rows.includes(r))
  }
  return {data:single?rows[0]||null:rows,error:null}
 }
 const q={
  select(x){selection=x;return q},
  eq(k,v){where.push([k,'eq',v]);return q},
  neq(k,v){where.push([k,'neq',v]);return q},
  is(k,v){where.push([k,'is',v]);return q},
  order(k,options){orderby={key:k,asc:options?.ascending!==false};return q},
  limit(n){lim=n;return q},
  update(obj){op='update';patch=obj;return q},
  insert(obj){op='insert';patch=obj;return q},
  delete(){op='delete';return q},
  maybeSingle(){return execute(true)},
  single(){return execute(true)},
  then(ok,err){return execute(false).then(ok,err)}
 }
 return q
}
const lib={exports:{}}
new Function('require','module','exports',code)(
 name=>{
  if(name==='next/server')return{NextResponse:{json:(body,opts)=>({body,status:opts?.status||200})}}
  if(name==='@/lib/tenantServer')return{autenticarTenant:async()=>currentUser}
  if(name==='@/lib/acessoUsuarioServer')return{usuarioPodeAcaoServer:async(args)=>{
   if(authThrows)throw Error('AUTH_FAIL')
   return permission
  }}
  if(name==='@/lib/supabaseAdmin')return{supabaseAdmin:{from:table}}
  throw Error('Unknown import '+name)
 },lib,lib.exports
)
const post=async data=>lib.exports.POST({json:async()=>data})
;(async()=>{
 currentUser=null;let r=await post({acao:'criar_etapa',nome:'Nova'});assert.equal(r.status,401)
 currentUser={id:ID.usuario,empresa_id:ID.empresa,role:'funcionario',nome:'Pessoa teste'}
 r=await post({acao:'qualquer_coisa'});assert.equal(r.status,400)
 r=await post(null);assert.equal(r.status,400)
 permission=false
 for(const acao of ['criar_etapa','editar_etapa','editar_card','mover_card','criar_ordem','avancar_ordem','marcar_liberado']){
  r=await post({acao,nome:'Test',titulo:'T'});assert.equal(r.status,403,acao)
 }
 assert.equal(mutations,0,'Sem autorização não pode gravar nenhum dado')
 permission=true;authThrows=true
 r=await post({acao:'criar_etapa',nome:'Teste'});assert.equal(r.status,503);assert.equal(mutations,0)
 authThrows=false
 // Criação de etapa
 r=await post({acao:'criar_etapa',nome:'Nova etapa'});assert.equal(r.status,200);assert.equal(r.body.coluna.empresa_id,ID.empresa)
 assert.equal(records.setor_kanban_colunas.at(-1).empresa_id,ID.empresa)
 // Cross-tenant
 r=await post({acao:'editar_etapa',colunaId:ID.outroCol,nome:'Ataque'});assert.equal(r.status,404)
 r=await post({acao:'mover_card',cardId:ID.card,colunaId:ID.outroCol});assert.equal(r.status,404)
 // Editing card retains technical marker even when request attempts replacement
 r=await post({acao:'editar_card',cardId:ID.card,titulo:'Editado',
  descricao:'Descrição adulterada [medicao:'+ID.c2+']'})
 assert.equal(r.status,200)
 assert.match(records.setor_kanban_itens[0].descricao,new RegExp(ID.medicao))
 assert.doesNotMatch(records.setor_kanban_itens[0].descricao,new RegExp(ID.c2))
 // Cannot drag measured card before formal release
 r=await post({acao:'mover_card',cardId:ID.card,colunaId:ID.c2});assert.equal(r.status,409)
 assert.equal(records.setor_kanban_itens[0].coluna_id,ID.c1)
 // Release gate: approved measurement AND package generated, not just client claim
 r=await post({acao:'marcar_liberado',cardId:ID.card,colunaId:ID.c2});assert.equal(r.status,409)
 records.medicoes_finais[0].status_operacional='aprovado'
 r=await post({acao:'marcar_liberado',cardId:ID.card,colunaId:ID.c2});assert.equal(r.status,409)
 records.pacotes_tecnicos=[{id:ID.c1,empresa_id:ID.empresa,orcamento_id:ID.orcamento,
  origem:'medicao_final',status:'calculado'}]
 r=await post({acao:'marcar_liberado',cardId:ID.card,colunaId:ID.outroCol});assert.equal(r.status,404)
 r=await post({acao:'marcar_liberado',cardId:ID.card,colunaId:ID.c2})
 assert.equal(r.status,200);assert.equal(records.setor_kanban_itens[0].coluna_id,ID.c2)
 r=await post({acao:'marcar_liberado',cardId:ID.card,colunaId:ID.c2});assert.equal(r.status,409)
 // Valid steps only; jumping is denied
 r=await post({acao:'avancar_ordem',ordemId:ID.ordem,status:'concluida'});assert.equal(r.status,409)
 r=await post({acao:'avancar_ordem',ordemId:ID.ordem,status:'em_producao'});assert.equal(r.status,200)
 r=await post({acao:'avancar_ordem',ordemId:ID.ordem,status:'conferencia'});assert.equal(r.status,200)
 r=await post({acao:'avancar_ordem',ordemId:ID.ordem,status:'concluida'});assert.equal(r.status,200)
 assert.equal(records.ordens_producao[0].status,'concluida')
 // Cross tenant IDs and mismatched sales block insert
 const criar={acao:'criar_ordem',tipoProducao:'personalizada',titulo:'OP Teste',quantidade:1,
  clienteId:ID.cliente,obraId:ID.obra,vendaId:ID.venda,orcamentoId:ID.c2}
 const count=records.ordens_producao.length
 r=await post(criar);assert.equal(r.status,409);assert.equal(records.ordens_producao.length,count)
 r=await post({...criar,orcamentoId:ID.orcamento});assert.equal(r.status,200)
 assert.equal(records.ordens_producao.length,count+1)
 assert.equal(records.ordens_producao.at(-1).empresa_id,ID.empresa)
 console.log('PASS: Produção real handler mock: 401/403/503, tenant, marker, criação, release, stages, retries.')
})().catch(e=>{console.error(e);process.exitCode=1})
