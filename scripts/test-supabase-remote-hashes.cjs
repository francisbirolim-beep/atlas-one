#!/usr/bin/env node
// Confere o histórico realmente aplicado. Nunca executa SQL nem altera o banco.
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const crypto = require('node:crypto')
const assert = require('node:assert/strict')
const md5 = data => crypto.createHash('md5').update(data).digest('hex')
const versionPattern = /^20\d{12}$/
const hashPattern = /^[a-f0-9]{32}$/i
function validate(remoteText,directory) {
  const remote = new Map()
  for(const raw of remoteText.split(/\r?\n/)){
    const line=raw.trim()
    if(!line)continue
    const a=line.split('|')
    if(a.length!==2||!versionPattern.test(a[0])||!hashPattern.test(a[1]))
      throw new Error('Resposta do banco contém linha de histórico inválida.')
    if(remote.has(a[0]))throw new Error('Versão duplicada no histórico remoto: '+a[0])
    remote.set(a[0],a[1].toLowerCase())
  }
  if(!remote.size)throw new Error('Não foi possível consultar os hashes de migrações aplicadas.')
  const local=new Map()
  for(const name of fs.readdirSync(directory).filter(x=>x.endsWith('.sql'))){
    const version=name.slice(0,14)
    if(!versionPattern.test(version)||name[14]!=='_')
      throw new Error('Arquivo de migração fora do padrão: '+name)
    if(local.has(version))throw new Error('Timestamp duplicado em migrações locais: '+version)
    local.set(version,md5(fs.readFileSync(path.join(directory,name))))
  }
  const missing=[...remote.keys()].filter(v=>!local.has(v))
  const mismatched=[...remote.keys()].filter(v=>local.has(v)&&local.get(v)!==remote.get(v))
  const pending=[...local.keys()].filter(v=>!remote.has(v))
  if(missing.length||mismatched.length)throw new Error(
    'Histórico de SQL divergente. Versões aplicadas ausentes: '+(missing.join(', ')||'nenhuma')+
    '. Versões com conteúdo distinto: '+(mismatched.join(', ')||'nenhuma')+
    '. Confira o histórico real; nunca execute migration repair automaticamente.'
  )
  return {checked:remote.size,pending:pending.length}
}
function selfTest(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-supabase-hashes-'))
  try{
    const sql='-- Exemplo\nSELECT 1;\n',file='20261010000000_exemplo.sql'
    fs.writeFileSync(path.join(dir,file),sql)
    const valid='20261010000000|'+md5(Buffer.from(sql))+'\n'
    assert.deepEqual(validate(valid,dir),{checked:1,pending:0})
    fs.writeFileSync(path.join(dir,'20261010000001_futura.sql'),'SELECT 2;\n')
    assert.deepEqual(validate(valid,dir),{checked:1,pending:1})
    assert.throws(()=>validate('20261010000000|00000000000000000000000000000000',dir),/conteúdo distinto/)
    assert.throws(()=>validate(valid+'20261010000002|'+md5('SELECT 3;'),dir),/ausentes/)
    assert.throws(()=>validate(valid+valid,dir),/duplicada/)
    assert.throws(()=>validate('',dir),/Não foi possível/)
    assert.throws(()=>validate('malformed',dir),/inválida/)
    console.log('PASS: hash, pendentes, divergência, versão ausente, duplicidade e resposta inválida.')
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
}
if(require.main===module){
  try{
    if(process.argv[2]==='--self-test')selfTest()
    else{
      if(!process.argv[2])throw Error('Informe o arquivo version|md5 exportado pelo psql.')
      const result=validate(fs.readFileSync(process.argv[2],'utf8'),'supabase/migrations')
      console.log('PASS: '+result.checked+' versões aplicadas conferidas por hash. '+result.pending+' locais pendentes.')
    }
  }catch(e){console.error('ERRO:',e.message);process.exitCode=1}
}
module.exports={validate}
