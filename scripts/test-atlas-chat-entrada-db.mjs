import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {pathToFileURL} from 'node:url'
import path from 'node:path'
import os from 'node:os'
const {PGlite}=await import(pathToFileURL(process.env.ATLAS_CHAT_PGLITE_MODULE||path.join(os.homedir(),'Atlas-Chat-DB-Homologacao-20261124/node_modules/@electric-sql/pglite/dist/index.js')).href)
const db=new PGlite()
try{
 await db.exec('create table atlas_chat_acessos(empresa_id text,usuario_id text,habilitado boolean not null,primary key(empresa_id,usuario_id));insert into atlas_chat_acessos values (\'e1\',\'u1\',true),(\'e1\',\'u2\',false)')
 await db.exec(await readFile('docs/atlas-chat/esquema-entrada-permissoes.sql','utf8'))
 assert.deepEqual((await db.query('select habilitado,central_habilitado from atlas_chat_acessos order by usuario_id')).rows,[{habilitado:true,central_habilitado:null},{habilitado:false,central_habilitado:null}])
 await db.exec("update atlas_chat_acessos set central_habilitado=false where empresa_id='e1' and usuario_id='u1'")
 assert.deepEqual((await db.query('select habilitado,central_habilitado from atlas_chat_acessos order by usuario_id')).rows,[{habilitado:true,central_habilitado:false},{habilitado:false,central_habilitado:null}])
 console.log('PASS: migração preserva acessos existentes e separa a entrada na central')
}finally{await db.close()}
