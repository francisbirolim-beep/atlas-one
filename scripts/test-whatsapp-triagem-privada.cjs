const assert=require('node:assert/strict')
const fs=require('node:fs')
const ts=require('typescript')
const Module=require('node:module')
const source=fs.readFileSync('lib/whatsappTriagemVisibilidade.ts','utf8')
const cjs=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
const m=new Module('lib/whatsappTriagemVisibilidade.ts',module)
m.filename='lib/whatsappTriagemVisibilidade.ts';m.paths=module.paths;m._compile(cjs,m.filename)
const {pertenceFilaPrivada}=m.exports
const keila='keila',francis='francis',daiane='daiane',gabrielle='gabrielle'
// Aguardando com Keila: somente ela e os supervisores tratados fora da fila.
const inicial={responsavel_id:keila,triagem_destinos:[francis,daiane]}
assert.equal(pertenceFilaPrivada(inicial,keila,true),true)
assert.equal(pertenceFilaPrivada(inicial,francis,true),false)
assert.equal(pertenceFilaPrivada(inicial,daiane,true),false)
assert.equal(pertenceFilaPrivada(inicial,gabrielle,true),false)
// Após prazo, somente os substitutos autorizados podem ver ou assumir.
const escalonada={responsavel_id:null,triagem_destinos:[francis,daiane]}
assert.equal(pertenceFilaPrivada(escalonada,keila,true),false)
assert.equal(pertenceFilaPrivada(escalonada,francis,true),true)
assert.equal(pertenceFilaPrivada(escalonada,daiane,true),true)
assert.equal(pertenceFilaPrivada(escalonada,gabrielle,true),false)
assert.equal(pertenceFilaPrivada(escalonada,francis,false),false)
// Quando Francis aceita, ela some da fila compartilhada.
assert.equal(pertenceFilaPrivada({...escalonada,responsavel_id:francis},daiane,true),false)
assert.equal(pertenceFilaPrivada({...escalonada,responsavel_id:francis},francis,true),true)
// Nunca expor um chat sem dono e sem destinatários.
assert.equal(pertenceFilaPrivada({responsavel_id:null,triagem_destinos:[]},francis,true),false)
assert.equal(pertenceFilaPrivada({responsavel_id:null,triagem_destinos:[francis]},'',true),false)
const backend=fs.readFileSync('lib/whatsappServer.ts','utf8')
const sql=fs.readFileSync('supabase/migrations/20261016095000_whatsapp_triagem_privada_v1.sql','utf8')
const gateway=fs.readFileSync('supabase/functions/whatsapp-gateway/index.ts','utf8')
const config=fs.readFileSync('app/api/integracoes/whatsapp/configuracao/route.ts','utf8')
const cron=fs.readFileSync('app/api/integracoes/whatsapp/triagem/route.ts','utf8')
assert.match(backend,/if \(acesso\.supervisionar\) return data as AtendimentoConversa/)
assert.match(backend,/const \{ data: atribuida, error: atribuicaoErro \} = await atribuir\.select\('id'\)\.maybeSingle\(\)/)
assert.match(backend,/triagem_prazo_em: null,\s*triagem_destinos: \[\]/)
assert.match(gateway,/triagemAtiva = !isGroup && channel\.principal === true/)
assert.match(gateway,/const recipients = await destinatariosWhatsApp/)
assert.match(config,/triagemPrivadaAtiva/)
assert.match(config,/if \(triagemAtiva && \(!responsavel \|\| destinos\.length === 0\)\)/)
assert.match(cron,/process\.env\.CRON_SECRET/)
assert.match(sql,/DEFAULT false/)
assert.match(sql,/FOR UPDATE OF c SKIP LOCKED/)
assert.match(sql,/c\.status = 'aguardando'/)
assert.match(sql,/REVOKE ALL ON FUNCTION public\.whatsapp_escalonar_triagem/)
console.log('PASS: fila privada, atendente inicial, substitutos, visibilidade, CAS, cron e migração opt-in')
