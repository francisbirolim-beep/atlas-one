const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript')
function load(path,imports={}){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,require:n=>{if(n in imports)return imports[n];throw Error(n)},console});return m.exports}
const p=load('lib/wvetroValidacaoItem.ts')
const clone=x=>JSON.parse(JSON.stringify(x))
const item={id:'i1',ambiente:'Sala',tipo_esquadria:'fixo',largura_mm:1000,altura_mm:1200,quantidade:1,wvetro_item:{Modelo:'Fixo',Linha:'Suprema'},foto_urls:['foto-original'],variaveis:{vidro:'incolor'}}
const outro={...clone(item),id:'i2',ambiente:'Quarto'}
let row,feedback,filters,allowed=true,scope='todos',conflict=false,feedbackFail=false,packageCalls=0
function reset(){row={id:'orc1',empresa_id:'e1',criado_por_id:'u1',updated_at:'t0',itens:[clone(item),clone(outro)],anexos:[{url:'pdf-original'}],valor_estimado:999,wvetro_fluxo:{numero:'1171',origem:'wvetro_api',payload_bruto:{preservar:true}}};feedback=[];filters=[];conflict=false;feedbackFail=false;allowed=true;scope='todos';packageCalls=0}
function query(table){
 let op='select',payload,conditions=[]
 const q={}
 q.select=()=>q
 q.update=v=>{op='update';payload=v;return q}
 q.insert=v=>{op='insert';payload=v;return q}
 q.delete=()=>{op='delete';return q}
 q.eq=(c,v)=>{assert.ok(String(v).length<4096,'URL de filtro não pode incluir JSON grande');conditions.push([c,v]);filters.push([table,c,v]);return q}
 q.is=(c,v)=>{conditions.push([c,v]);filters.push([table,c,v]);return q}
 for(const method of ['order','limit','contains'])q[method]=()=>q
 function run(){
  if(table==='orcamentos'){
   assert.ok(conditions.some(([c,v])=>c==='empresa_id'&&v==='e1'),'Tenant sempre filtrado')
   if(op==='update'){if(conflict||conditions.some(([c,v])=>c==='updated_at'&&v!==row.updated_at))return {data:null,error:null};Object.assign(row,payload)}
   return {data:clone(row),error:null}
  }
  if(table==='ai_orcamento_feedback'){
   if(op==='insert'){if(feedbackFail)return {data:null,error:{message:'feedback indisponivel'}};feedback.push(clone(payload))}
   if(op==='delete')feedback=feedback.filter(f=>f.id!==conditions.find(([c])=>c==='id')[1])
   return {data:op==='select'?clone(feedback):null,error:null}
  }
  if(table==='tipologias')return {data:{id:'tip-porta',chave:'porta_correr',label:'Porta de correr'},error:null}
  return {data:null,error:null}
 }
 q.maybeSingle=async()=>run()
 q.then=(resolve,reject)=>Promise.resolve(run()).then(resolve,reject)
 return q
}
const server=load('lib/wvetroValidacaoItemServer.ts',{
 'next/server':{NextResponse:{json:(data,o={})=>({data,status:o.status||200})}},
 'node:crypto':{randomUUID:require('node:crypto').randomUUID},
 './supabaseAdmin':{supabaseAdmin:{from:query}},
 './acessoUsuarioServer':{usuarioPodeAcaoServer:async()=>allowed},
 './ai/permissoesServer':{carregarPermissoesIA:async()=>({dominios:{orcamento:{permitido:true,escopo:scope}}})},
 './wvetroValidacaoItem':p,
 './wvetroPacoteTecnicoServer':{materializarPacoteTecnicoWVetro:async()=>{packageCalls++;return {ok:true}}},
})
const usuario={id:'u1',empresa_id:'e1',role:'master',nome:'Teste'}
const request=(acao,correcao={},itemId='i1',original)=>server.validarItemImportadoWVetro({},usuario,{acao,cardId:'orc1',itemId,original:original||p.snapshotItemWVetro(row.itens.find(i=>i.id===itemId)),correcao})
;(async()=>{
 reset()
 assert.equal(p.resolverTipologiaDigitada('PORTA DE CORRER',{'porta_correr':'Porta de correr'}).tipo_esquadria,'porta_correr')
 assert.equal(p.resolverTipologiaDigitada('Porta especial sem cadastro',{}).tipo_outro_texto,'Porta especial sem cadastro')
 let r=await request('validar_item_importacao')
 assert.equal(r.status,200);assert.equal(p.statusItemWVetro(row.itens[0],row.wvetro_fluxo),'validado')
 assert.equal(p.statusItemWVetro(row.itens[1],row.wvetro_fluxo),'pendente')
 assert.equal(row.wvetro_fluxo.validacao_status,'aguardando');assert.equal(packageCalls,0)
 assert.ok(filters.some(([t,c,v])=>t==='orcamentos'&&c==='updated_at'&&v==='t0'),'CAS compacto mantém versão anterior')
 assert.ok(!filters.some(([t,c])=>t==='orcamentos'&&(c==='itens'||c==='wvetro_fluxo')),'sem JSON grande na URL')
 assert.deepEqual(row.itens[1],outro);assert.equal(row.valor_estimado,999)
 const snapshot=row.wvetro_fluxo.validacoes_itens.i1.snapshot
 row.wvetro_fluxo.validacoes_itens.i1.snapshot=Object.fromEntries(Object.entries(snapshot).reverse())
 assert.equal(p.statusItemWVetro(row.itens[0],row.wvetro_fluxo),'validado','Ordem JSONB não invalida conferência')
 r=await request('corrigir_item_importacao',{tipo_esquadria:'porta_correr',largura_mm:1100})
 assert.equal(r.status,200);assert.equal(row.itens[0].ambiente,'Sala')
 assert.deepEqual(Object.keys(feedback.at(-1).diferencas).sort(),['largura_mm','tipo_esquadria'])
 assert.equal(row.itens[0].configuracao_validada,false)
 assert.deepEqual(row.itens[0].foto_urls,['foto-original']);assert.deepEqual(row.anexos,[{url:'pdf-original'}])
 assert.equal(p.statusItemWVetro({...row.itens[0],largura_mm:1500},row.wvetro_fluxo),'pendente','Editar invalida conferência antiga')
 r=await request('validar_item_importacao',{},'i2')
 assert.equal(r.status,200);assert.equal(row.wvetro_fluxo.validacao_status,'validado');assert.equal(packageCalls,1)
 // Conferências legadas (com os 11 campos antigos) não podem ser invalidadas pela ampliação do editor.
 reset()
 const antigo=p.snapshotItemWVetro(item)
 for(const campo of ['linha_nome','configuracao_nome','variaveis','observacao_tempera','largura_baixo_mm','largura_meio_mm','largura_cima_mm','altura_direita_mm','altura_meio_mm','altura_esquerda_mm'])delete antigo[campo]
 row.wvetro_fluxo.validacoes_itens={i1:{resultado:'correto',snapshot:antigo}}
 assert.equal(p.statusItemWVetro(row.itens[0],row.wvetro_fluxo),'validado','Não invalida orçamento 384 e demais confirmações legadas')
 // Linha, configuração, variáveis e observação técnica são corrigíveis isoladamente.
 reset()
 row.itens[0].variaveis.wvetro_importado='sim'
 r=await request('corrigir_item_importacao',{
  linha_nome:'Linha Gold',configuracao_nome:'Fixo Gold',
  variaveis:{vidro:'laminado',wvetro_importado:'nao'},
  observacao_producao:'Reforço lateral',observacao_tempera:'vidro temperado',
 })
 assert.equal(r.status,200)
 assert.equal(row.itens[0].linha_nome,'Linha Gold')
 assert.equal(row.itens[0].configuracao_nome,'Fixo Gold')
 assert.equal(row.itens[0].variaveis.vidro,'laminado')
 assert.equal(row.itens[0].variaveis.wvetro_importado,'sim','Metadados não podem ser sobrescritos')
 assert.equal(row.itens[0].configuracao_validada,false)
 assert.equal(row.itens[0].configuracao_status,'pendente')
 assert.deepEqual(row.itens[1],outro,'Outra esquadria inalterada')
 assert.equal(p.statusItemWVetro(row.itens[0],row.wvetro_fluxo),'corrigido')
 assert.equal(p.statusItemWVetro({...row.itens[0],linha_nome:'Suprema'},row.wvetro_fluxo),'pendente')
 assert.ok(feedback.at(-1).diferencas.variaveis)
 reset()
 r=await request('corrigir_item_importacao',{variaveis:['inválido']})
 assert.equal(r.status,400)
 reset();r=await request('corrigir_item_importacao',{tipo_esquadria:'outro',tipo_outro_texto:'Porta especial livre'})
 assert.equal(r.status,200);assert.equal(row.itens[0].tipo_outro_texto,'Porta especial livre')
 reset();r=await request('corrigir_item_importacao',{ambiente:'Cozinha'})
 assert.equal(r.status,200);assert.equal(row.itens[0].tipo_esquadria,'fixo');assert.equal(row.itens[0].largura_mm,1000)
 reset();r=await request('corrigir_item_importacao',{quantidade:0});assert.equal(r.status,400);assert.equal(feedback.length,0)
 r=await request('corrigir_item_importacao',{empresa_id:'outra'});assert.equal(r.status,400)
 r=await request('corrigir_item_importacao',{});assert.equal(r.status,400)
 r=await request('validar_item_importacao',{},'i1',{...p.snapshotItemWVetro(item),ambiente:'Antigo'});assert.equal(r.status,409)
 reset();allowed=false;r=await request('validar_item_importacao');assert.equal(r.status,403);assert.equal(feedback.length,0)
 reset();scope='proprio';row.criado_por_id='outro';r=await request('validar_item_importacao');assert.equal(r.status,404)
 reset();conflict=true;r=await request('corrigir_item_importacao',{ambiente:'Nova'});assert.equal(r.status,409);assert.equal(row.itens[0].ambiente,'Sala');assert.equal(feedback.length,0,'Conflito remove feedback não aplicado')
 reset();feedbackFail=true;await assert.rejects(request('corrigir_item_importacao',{ambiente:'Nova'}));assert.equal(row.itens[0].ambiente,'Sala')
 reset();row.updated_at=null;r=await request('validar_item_importacao');assert.equal(r.status,200);assert.ok(filters.some(([t,c,v])=>t==='orcamentos'&&c==='updated_at'&&v===null),'CAS para timestamps legados nulos')
 reset();row.wvetro_fluxo.payload_bruto={dados:'x'.repeat(200000)};row.itens=Array.from({length:18},(_,i)=>({...clone(item),id:'i'+(i+1)}))
 for(let i=1;i<=18;i++){r=await request('validar_item_importacao',{},'i'+i);assert.equal(r.status,200)}
 assert.equal(row.wvetro_fluxo.validacao_status,'validado');assert.equal(Object.keys(row.wvetro_fluxo.validacoes_itens).length,18)
 assert.equal(packageCalls,1,'pacote técnico apenas quando concluir 18 itens')
 reset();scope='proprio';r=await request('sugerir_item_importacao');assert.equal(r.status,200);assert.ok(filters.some(([t,c,v])=>t==='ai_orcamento_feedback'&&c==='usuario_id'&&v==='u1'))
 console.log('PASS: conferência individual, correções só por campo, texto livre, catálogo, JSONB, preservação, escopo, erros, concorrência e aprendizado.')
})().catch(e=>{console.error(e);process.exitCode=1})
