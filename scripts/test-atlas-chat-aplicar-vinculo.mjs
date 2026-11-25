import assert from 'node:assert/strict'
import {aplicarVinculoEncerrado as aplicar,ambienteVinculoIsolado as ambiente} from '../supabase/functions/_shared/atlasChatAplicarVinculo.ts'
const empresa='e1',canal={id:'canal',empresa_id:empresa,principal:true,ativo:true,usuario_id:'central'},telefone='5517999990000',jid=telefone+'@s.whatsapp.net'
const existente={id:'c',status:'finalizado',responsavel_id:'central',updated_at:'2026-11-24T22:00:00Z'}
const entrada={empresa,canal,telefone,jid,grupo:false,fromMe:false,existente,ativo:true,usuarios:'vendedor',numeros:telefone}
const opts={ativo:true,ref:'abcdefghijklmnopqrst',url:'https://abcdefghijklmnopqrst.supabase.co'}
let total=0
function fake({resultado='atribuido',erro=false,atualStatus='aguardando'}={}){
 let calls=0,reads=0
 const row={...existente,empresa_id:empresa,whatsapp_canal_id:canal.id,whatsapp_chat_tipo:'contato',telefone,whatsapp_chat_jid:jid}
 const tabelas={atendimento_conversas:[row],atlas_chat_vinculos:[{empresa_id:empresa,canal_id:canal.id,telefone,responsavel_id:'vendedor'}],usuarios:[{id:'vendedor',empresa_id:empresa,role:'vendedor'}],atlas_chat_acessos:[{empresa_id:empresa,usuario_id:'vendedor',habilitado:true}],atendimento_whatsapp_permissoes:[{empresa_id:empresa,canal_id:canal.id,usuario_id:'vendedor',pode_atender:true}]}
 return {get calls(){return calls},get reads(){return reads},async rpc(n,args){calls++;assert.equal(n,'atlas_chat_atribuir_encerrada');assert.equal(args.p_responsavel_anterior,'central');assert.equal(args.p_destino,'vendedor');assert.equal(args.p_atualizado_em,existente.updated_at);if(erro)return {error:true};Object.assign(row,{status:atualStatus,responsavel_id:resultado==='atribuido'?'vendedor':'outro'});return {data:resultado}},from(t){reads++;let data=tabelas[t];const q={select(){return q},eq(k,v){data=data.filter(r=>r[k]===v);return q},limit(n){data=data.slice(0,n);return q},maybeSingle(){return Promise.resolve({data:data[0]||null})},then(resolve){resolve({data})}};return q}}
}
async function check(n,f){await f();total++;console.log('PASS:',n)}
await check('projeto principal e flag desligada impedem consultas',async()=>{const d=fake();assert.equal(await aplicar(d,entrada,{...opts,ativo:false}),null);assert.equal(await aplicar(d,entrada,{ativo:true,ref:'urtqbvjpwnrfaayolymt',url:'https://urtqbvjpwnrfaayolymt.supabase.co'}),null);assert.equal(d.reads,0);assert.equal(d.calls,0)})
await check('origem divergente e URL inválida são recusadas',async()=>{assert.equal(ambiente(true,'https://outro.example',opts.ref),false);assert.equal(ambiente(true,'invalid',opts.ref),false)})
await check('conversa nova, grupo, mensagem própria ou atendimento ativo não executam',async()=>{for(const p of [{existente:null},{grupo:true},{fromMe:true},{existente:{...existente,status:'em_atendimento'}}]){const d=fake();assert.equal(await aplicar(d,{...entrada,...p},opts),null);assert.equal(d.calls,0)}})
await check('chama executor e retorna a linha atualizada',async()=>{const d=fake();const c=await aplicar(d,entrada,opts);assert.equal(c.responsavel_id,'vendedor');assert.equal(d.calls,1)})
await check('conflito com novo atendimento preserva responsável atual',async()=>{const d=fake({resultado:'conflito',atualStatus:'em_atendimento'});assert.equal((await aplicar(d,entrada,opts)).responsavel_id,'outro')})
await check('falha da RPC não retorna ao fluxo de atribuição antigo',async()=>assert.rejects(aplicar(fake({erro:true}),entrada,opts)))
await check('vínculo revogado durante execução pede reavaliação',async()=>assert.rejects(aplicar(fake({resultado:'vinculo',atualStatus:'finalizado'}),entrada,opts)))
console.log('TOTAL:',total,'testes de aplicação do vínculo em homologação aprovados.')
