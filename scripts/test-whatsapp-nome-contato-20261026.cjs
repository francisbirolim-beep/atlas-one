const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const path = require('node:path')
const raiz = path.join(__dirname, '..')
const src = fs.readFileSync(path.join(raiz,'lib/whatsappIdentidadeContato.ts'),'utf8')
const js = ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
const obj={exports:{}}
new Function('module','exports',js)(obj,obj.exports)
const {normalizarNumeroContato,identificarConversasWhatsApp,nomeDePessoa}=obj.exports

const canal='f9a441a2-26c7-4e12-9333-44703a5c5158'
const outroCanal='f47e980b-83b3-4f7a-82ae-685aefeb62f0'
const clienteId='cliente-francis'
const diretorio=[
 {whatsapp_canal_id:canal,telefone:'5517996361318',contato_jid:'5517996361318@s.whatsapp.net',nome:'Francis Birolim Esquadrifácio',nome_verificado:null},
 {whatsapp_canal_id:outroCanal,telefone:'5517996361318',nome:'Outro nome em outro canal'},
]
const clientes=[{id:clienteId,nome:'francis ',whatsapp:'17996361318',telefone:null}]
const base={id:'conversa-sem-vinculo',telefone:'17996361318',contato_nome:'5517996361318',whatsapp_canal_id:canal,cliente_id:null,whatsapp_chat_tipo:'contato'}
const resultado=identificarConversasWhatsApp([
 base,
 {...base,id:'outro-canal',whatsapp_canal_id:outroCanal},
 {...base,id:'com-vinculo',cliente_id:clienteId},
 {...base,id:'grupo',whatsapp_chat_tipo:'grupo',contato_nome:'Nome do grupo'},
 {...base,id:'sem-diretorio',whatsapp_canal_id:'sem-contato'},
],diretorio,clientes)
assert.equal(normalizarNumeroContato('17996361318'),'5517996361318')
assert.equal(normalizarNumeroContato('+55 (17) 99636-1318'),'5517996361318')
assert.equal(nomeDePessoa('5517996361318'),'')
assert.equal(resultado[0].contato_nome,'Francis Birolim Esquadrifácio')
assert.equal(resultado[0].contato_whatsapp_salvo,true)
assert.equal(resultado[0].cliente_candidato_id,clienteId)
assert.equal(resultado[0].cliente_candidato_nome,'francis')
assert.equal(resultado[0].cliente_id,null)
assert.equal(resultado[1].contato_nome,'Outro nome em outro canal')
assert.equal(resultado[2].contato_nome,'Francis Birolim Esquadrifácio')
assert.equal(resultado[2].cliente_candidato_id,null)
assert.equal(resultado[3].contato_nome,'Nome do grupo')
assert.equal(resultado[3].contato_whatsapp_salvo,false)
assert.equal(resultado[4].contato_nome,'francis')
assert.equal(resultado[4].contato_whatsapp_salvo,false)
const ui=fs.readFileSync(path.join(raiz,'components/whatsapp/FichaContatoWhatsApp.tsx'),'utf8')
const server=fs.readFileSync(path.join(raiz,'lib/whatsappServer.ts'),'utf8')
assert.ok(ui.includes('Salvo no WhatsApp'))
assert.ok(ui.includes('Vincular Cliente 360'))
assert.ok(ui.includes('window.confirm('))
assert.ok(ui.includes('Cadastrar no Cliente 360'))
assert.ok(server.includes("identificarConversasWhatsApp(permitidas, diretorio, clientes)"))
assert.ok(server.includes("...(nomeRealGrupo ? { grupo_nome: nomeRealGrupo, contato_nome: nomeRealGrupo } : {})"))
console.log('OK: 20 verificações — número brasileiro, canal, WhatsApp, CRM, vínculo, grupos e interface')
