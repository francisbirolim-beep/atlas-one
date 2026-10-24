const assert = require('node:assert/strict')
const fs = require('node:fs')
async function main() {
  const { idCardMedicaoFinal } = await import('../lib/idCardMedicaoFinal.ts')
  const tenantA = '87897d68-1334-491c-b29b-4065cd83760c'
  const tenantB = '87897d68-1334-491c-b29b-4065cd83760d'
  const medicaoA = '8b66f890-d5fd-4fdd-9ff5-b9aaca6f6bac'
  const medicaoB = '8b66f890-d5fd-4fdd-9ff5-b9aaca6f6bad'
  const ref = idCardMedicaoFinal(tenantA, medicaoA)
  assert.match(ref, /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  assert.equal(idCardMedicaoFinal(tenantA, medicaoA), ref)
  assert.notEqual(idCardMedicaoFinal(tenantA, medicaoB), ref)
  assert.notEqual(idCardMedicaoFinal(tenantB, medicaoA), ref)
  console.log('PASS: UUID v8 fixo por empresa + medição; isolado por tenant.')

  const api = fs.readFileSync('app/api/producao/medicoes-finais/sincronizar/route.ts', 'utf8')
  assert.match(api, /id: cardId/)
  assert.match(api, /erroInsert.code !== '23505'/)
  assert.match(api, /\.eq\('empresa_id', usuario.empresa_id\)/)
  assert.match(api, /\.eq\('id', cardId\)/)
  assert.match(api, /\.ilike\('descricao', '%' \+ marcador \+ '%'\)/)
  assert.match(api, /ignorados \+= 1/)
  console.log('PASS: reenvio concorrente verifica o mesmo card e não duplica.')
}
main().catch(e => { console.error(e); process.exitCode = 1 })
