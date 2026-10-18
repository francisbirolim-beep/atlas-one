import assert from 'node:assert/strict'
import { datasDoMes, estadoInicialMarketing, prepararCalendarioLocal, MAX_ARQUIVO } from '../lib/marketing/rascunhosLocais.ts'

assert.equal(datasDoMes('2026-11').length, 30)
assert.equal(datasDoMes('2028-02').length, 29)
assert.equal(datasDoMes('2026-02').length, 28)
assert.equal(datasDoMes('invalid').length, 0)
assert.equal(MAX_ARQUIVO, 30 * 1024 * 1024)
const inicial = estadoInicialMarketing()
assert.equal(inicial.campanhaPausada, true)
assert.deepEqual(inicial.posts, [])
const proibida = { id: 'm1', nome: 'sem-permissao.jpg', tipo: 'image/jpeg', tamanho: 1, criadoEm: '2026-10-17', obra: 'Obra 1', autorizado: false }
assert.equal(prepararCalendarioLocal('2026-11', [proibida], []).length, 0, 'mídia não autorizada nunca gera post')
const liberada = { ...proibida, autorizado: true }
const gerados = prepararCalendarioLocal('2026-11', [liberada], [])
assert.equal(gerados.length, 30)
assert.ok(gerados.every(p => p.status === 'rascunho'))
assert.ok(gerados.every(p => p.midiaId === liberada.id))
assert.equal(prepararCalendarioLocal('2026-11', [liberada], gerados).length, 30, 'geração do mês precisa ser idempotente')
const aprovado = { ...gerados[0], status: 'aprovado' }
const repetidos = prepararCalendarioLocal('2026-11', [liberada], [aprovado, ...gerados.slice(1)])
assert.equal(repetidos.filter(p => p.status === 'aprovado').length, 1, 'regerar mês deve preservar aprovação')
console.log('Marketing Inteligente: 9 verificações de calendário, autorização e segurança aprovadas.')