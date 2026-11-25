import assert from 'node:assert/strict'
import {test} from 'node:test'
import {avaliarArrobaEntrada as avaliar} from '../supabase/functions/_shared/atlasChatArrobaEntrada.ts'
const empresa='e',tel='5517999990000',canal={id:'c',empresa_id:empresa,principal:true,ativo:true,usuario_id:'central'}
const e={ativo:true,empresa,canal,telefone:tel,jid:tel+'@s.whatsapp.net',grupo:false,fromMe:false,texto:'@gabriel Bom dia',numeros:tel,usuarios:'g,d'}
const base={atlas_chat_arrobas:[{empresa_id:empresa,usuario_id:'g',apelido:'gabriel',nome_publico:'Gabriel',publico:true},{empresa_id:empresa,usuario_id:'d',apelido:'daiane',nome_publico:'Daiane',publico:true}],usuarios:[{empresa_id:empresa,id:'g',role:'vendedor'},{empresa_id:empresa,id:'d',role:'vendedor'}],atlas_chat_acessos:[{empresa_id:empresa,usuario_id:'g',habilitado:true},{empresa_id:empresa,usuario_id:'d',habilitado:false}],atendimento_whatsapp_permissoes:[{empresa_id:empresa,canal_id:'c',usuario_id:'g',pode_atender:true}]}
function fake(patch={}){let reads=0;const rows={...base,...patch};return {get reads(){return reads},from(t){reads++;let data=rows[t];const q={select(){return q},eq(k,v){if(Array.isArray(data))data=data.filter(r=>r[k]===v);return q},maybeSingle(){return Promise.resolve(data===null?{error:true}:{data:data[0]||null})},then(resolve){resolve(data===null?{error:true}:{data})}};return q}}}
test('desligado, grupo, mensagem própria, canal externo e número não autorizado não consultam banco',async()=>{for(const p of [{ativo:false},{grupo:true},{fromMe:true},{canal:{...canal,principal:false}},{numeros:''},{jid:'123@lid'}]){const db=fake();assert.equal((await avaliar(db,{...e,...p})).tipo,'fora_escopo');assert.equal(db.reads,0)}})
test('mensagem comum não consulta configuração',async()=>{const db=fake();assert.equal((await avaliar(db,{...e,texto:'Bom dia'})).tipo,'normal');assert.equal(db.reads,0)})
test('comando autorizado preserva texto',async()=>assert.deepEqual(await avaliar(fake(),e),{tipo:'usuario',destino:'g',mensagem:'Bom dia'}))
test('menu só mostra usuários com acesso e permissão efetivos',async()=>assert.deepEqual(await avaliar(fake(),{...e,texto:'@'}),{tipo:'menu',opcoes:[{apelido:'gabriel',nome:'Gabriel'}]}))
test('revogação, falta de permissão e usuário externo não recebem',async()=>{for(const p of [{atlas_chat_acessos:[]},{atendimento_whatsapp_permissoes:[]},{usuarios:[{empresa_id:'outra',id:'g',role:'master'}]}])assert.equal((await avaliar(fake(p),e)).tipo,'indisponivel')})
test('falha de banco não inventa destino',async()=>assert.equal((await avaliar(fake({atlas_chat_arrobas:null}),e)).tipo,'indisponivel'))
test('retorno à central reconhecido sem alteração',async()=>assert.equal((await avaliar(fake(),{...e,texto:'@central'})).tipo,'central'))
