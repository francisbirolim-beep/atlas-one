import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {avaliarRoteamentoAtlas as avaliar} from '../supabase/functions/_shared/atlasChatRoteamento.ts'
const empresa='e1',canal={id:'principal',empresa_id:empresa,principal:true,ativo:true,usuario_id:'central'},telefone='5517999990000'
const entrada={empresa,canal,telefone,jid:telefone+'@s.whatsapp.net',grupo:false,fromMe:false,existente:null,ativo:true,usuarios:'vendedor',numeros:telefone}
const vinc={empresa_id:empresa,canal_id:canal.id,telefone,responsavel_id:'vendedor'}
function fake(patch={}){
 let reads=0
 const rows={atendimento_conversas:[],atlas_chat_vinculos:[vinc],usuarios:[{id:'vendedor',empresa_id:empresa,role:'vendedor'},{id:'central',empresa_id:empresa,role:'vendedor'}],atlas_chat_acessos:[{empresa_id:empresa,usuario_id:'vendedor',habilitado:true}],atendimento_whatsapp_permissoes:[{empresa_id:empresa,canal_id:canal.id,usuario_id:'vendedor',pode_atender:true}],atendimento_whatsapp_distribuicao:[{empresa_id:empresa,ativo:true,usuario_principal_id:'central'}],...patch}
 return {get reads(){return reads},from(t){reads++;let data=rows[t];const q={select(){return q},eq(k,v){if(Array.isArray(data))data=data.filter(r=>r[k]===v);return q},limit(n){if(Array.isArray(data))data=data.slice(0,n);return q},maybeSingle(){return Promise.resolve(data===null?{error:true}:{data:data[0]||null})},then(resolve){resolve(data===null?{error:true}:{data})}};return q}}
}
let count=0
const check=async(n,f)=>{await f();count++;console.log('PASS:',n)}
const result=async(patch={},db=fake())=>avaliar(db,{...entrada,...patch})
await check('piloto desligado não consulta banco',async()=>{const db=fake();assert.equal((await result({ativo:false},db)).motivo,'desligado');assert.equal(db.reads,0)})
await check('grupo, envio próprio, canal secundário e número fora do piloto são ignorados',async()=>{for(const p of [{grupo:true},{fromMe:true},{canal:{...canal,principal:false}},{numeros:''},{canal:{...canal,empresa_id:'e2'}}]){const db=fake();assert.equal((await result(p,db)).motivo,'fora_escopo');assert.equal(db.reads,0)}})
await check('LID ou JID divergente não define destino',async()=>assert.equal((await result({jid:'123@lid'})).motivo,'identidade_ambigua'))
await check('atendimento ativo não é redirecionado',async()=>assert.equal((await result({existente:{id:'c',status:'aguardando'}})).motivo,'atendimento_aberto'))
await check('cliente vinculado vai ao vendedor autorizado',async()=>assert.deepEqual(await result(),{motivo:'vendedor',destino:'vendedor'}))
await check('cliente desconhecido mantém roteamento existente',async()=>assert.equal((await result({},fake({atlas_chat_vinculos:[]}))).motivo,'sem_vinculo'))
await check('revogação do acesso individual retorna à central',async()=>assert.deepEqual(await result({},fake({atlas_chat_acessos:[]})),{motivo:'central',destino:'central'}))
await check('permissão de canal revogada retorna à central',async()=>assert.deepEqual(await result({},fake({atendimento_whatsapp_permissoes:[]})),{motivo:'central',destino:'central'}))
await check('vínculo explicitamente devolvido à central',async()=>assert.deepEqual(await result({},fake({atlas_chat_vinculos:[{...vinc,responsavel_id:null}]})),{motivo:'central',destino:'central'}))
await check('outro tenant não é destinatário',async()=>assert.equal((await result({},fake({usuarios:[{id:'vendedor',empresa_id:'e2'}]}))).destino,null))
const c={id:'c',empresa_id:empresa,whatsapp_canal_id:canal.id,whatsapp_chat_tipo:'contato',telefone,whatsapp_chat_jid:entrada.jid,status:'finalizado'}
await check('conversa encerrada pode ser avaliada para o vínculo',async()=>assert.equal((await result({existente:{id:'c',status:'finalizado'}},fake({atendimento_conversas:[c]}))).destino,'vendedor'))
await check('duplicidade de telefone bloqueia destino',async()=>assert.equal((await result({existente:{id:'c',status:'finalizado'}},fake({atendimento_conversas:[c,{...c,id:'c2'}]}))).motivo,'identidade_ambigua'))
await check('falha na consulta não inventa destino',async()=>assert.equal((await result({},fake({atlas_chat_vinculos:null}))).motivo,'indisponivel'))
await check('integração é somente sombra e não registra destino ou dados pessoais',async()=>{const s=await readFile('supabase/functions/whatsapp-gateway/index.ts','utf8');assert.match(s,/ATLAS_CHAT_ROTEAMENTO_SOMBRA.*=== "true"/);assert.match(s,/console.info\("Atlas Chat roteamento sombra:",shadow.motivo\)/);assert.doesNotMatch(s,/shadow.destino/)})
console.log('TOTAL:',count,'verificações de roteamento aprovadas.')
