const fs=require('node:fs')
const path=require('node:path')
const crypto=require('node:crypto')
const assert=require('node:assert/strict')
const dir='supabase/migrations'
const doc=JSON.parse(fs.readFileSync('docs/supabase-migration-reconciliation-manifest.json','utf8'))
const files=fs.readdirSync(dir).filter(f=>f.endsWith('.sql'))
const versions=files.map(f=>f.slice(0,14))
assert.equal(new Set(versions).size,files.length,'Timestamps duplicados nas migrações')
assert.ok(files.length>=doc.database_migration_count,'Versão histórica aplicada foi omitida')
const md5=s=>crypto.createHash('md5').update(s).digest('hex')
for(const r of doc.recovered){
 const file=r.version+'_'+r.name+'.sql'
 assert.ok(files.includes(file),'SQL histórico aplicado ausente: '+file)
 const sql=fs.readFileSync(path.join(dir,file))
 assert.equal(md5(sql),r.md5,'SQL recuperado não bate com SQL aplicado: '+file)
}
for(const a of doc.archived){
 const file=path.join('supabase/migrations-review/20261010',a.file)
 assert.ok(fs.existsSync(file),'Arquivo preservado para análise ausente: '+a.file)
 const actual=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
 assert.equal(actual,a.sha256,'Versão arquivada foi alterada: '+a.file)
 assert.ok(!files.includes(a.file),'Migração não verificada continua na pasta ativa: '+a.file)
}
console.log('PASS: histórico de '+doc.database_migration_count+' versões, SQL recuperado intacto, '+doc.archived.length+' arquivos preservados.')
