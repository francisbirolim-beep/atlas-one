import assert from 'node:assert/strict'
import {test} from 'node:test'
import {apelidoArroba as a,comandoArroba as c,decidirArroba as d,linkArroba as l} from '../supabase/functions/_shared/atlasChatArroba.ts'
const lista=[{usuario_id:'g',apelido:'gabriely',nome_publico:'Gabriely',publico:true},{usuario_id:'d',apelido:'daiane',nome_publico:'Daiane',publico:false}]
test('normalização e reservas',()=>{assert.equal(a('@Gabriely'),'gabriely');for(const s of ['central','@master','@a','@gabriel da','@é','@a-b'])assert.equal(a(s),null)})
test('menu não expõe não autorizados nem identificadores internos',()=>assert.deepEqual(d('@',lista),{tipo:'menu',opcoes:[{apelido:'gabriely',nome:'Gabriely'}]}))
test('comando com texto conserva mensagem',()=>assert.deepEqual(d('@Gabriely Bom dia!',lista),{tipo:'usuario',destino:'g',mensagem:'Bom dia!'}))
test('comando central',()=>assert.deepEqual(d('@central preciso de ajuda',lista),{tipo:'central',mensagem:'preciso de ajuda'}))
test('não interpreta emails nem menções no meio de frase',()=>{for(const s of ['a@b.com','Olá @gabriely','@gabriely.com','@gabriely!'])assert.equal(c(s),null)})
test('inativo ou desconhecido não recebe mensagem',()=>{assert.equal(d('@daiane',lista).tipo,'indisponivel');assert.equal(d('@outro',lista).tipo,'indisponivel')})
test('duplicidade não escolhe destino',()=>assert.equal(d('@gabriely',[...lista,lista[0]]).tipo,'indisponivel'))
test('link usa mesmo número e comando preenchido',()=>{assert.equal(l('5517999990000','gabriely'),'https://wa.me/5517999990000?text=%40gabriely%20');assert.equal(l('123','gabriely'),null)})
