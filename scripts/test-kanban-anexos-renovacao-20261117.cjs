const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const ler = nome => fs.readFileSync(path.join(__dirname, '..', nome), 'utf8')

const interface = ler('components/system/WhatsAppOrcamentoNotas.tsx')
const api = ler('app/api/integracoes/whatsapp/orcamento-notas/route.ts')
const mesclagem = ler('app/api/kanban/comercial/mesclar-cards/route.ts')
const sql = ler('supabase/migrations/20261117185500_kanban_mesclagem_multiplos_cards_v2.sql')

// A origem do link é uma rota autenticada e restrita à empresa.
assert.match(api, /autenticarTenant\(req\)/)
assert.match(api, /usuarioPodeAcaoServer/)
assert.match(api, /\.eq\('empresa_id', usuario\.empresa_id\)/)
assert.match(api, /createSignedUrls\(paths, 1200\)/)
assert.match(api, /v\.startsWith\(usuario\.empresa_id \+ '\/'\)/)
assert.match(api, /'Cache-Control': 'private, no-store'/)

// A imagem não usa o endereço antigo ao clicar. O mesmo vale para PDF/projeto.
assert.match(interface, /async function renovarUrlAnexo\(/)
assert.match(interface, /async function ampliarImagem\(/)
assert.match(interface, /async function abrirEmOutraAba\(/)
assert.match(interface, /async function atualizarMidia\(/)
assert.match(interface, /headers: \{ Authorization: 'Bearer ' \+ token \}, cache: 'no-store'/)
assert.match(interface, /const url = await renovarUrlAnexo\(anexo, indice\)/)
assert.match(interface, /setImagemAberta\(\{ anexo, indice, url \}\)/)
assert.match(interface, /aba\.location\.replace\(url\)/)
assert.match(interface, /setNotas\(dados\)/)
assert.match(interface, /role="dialog" aria-modal="true"/)
assert.match(interface, /onError=\{\(\) => setImagemFalhou\(true\)\}/)
assert.match(interface, /Recuperar foto/)
assert.match(interface, /Atualizar acesso ao áudio/)
assert.match(interface, /Atualizar acesso ao vídeo/)
assert.match(interface, /Abrir original em nova aba/)
assert.match(interface, /<WhatsAppOrcamentoNotas|const grupos = \{/)

// Os snapshots e anexos do card de origem continuam disponíveis.
for (const trecho of ['origemCards', 'Fotos recebidas', 'Medições com trena recebidas',
  'Arquivos e anexos recebidos', 'Consultar registro completo deste card'])
  assert(interface.includes(trecho), 'Faltando seção histórica: ' + trecho)
assert(mesclagem.includes("db.rpc('kanban_mesclar_cards_comerciais_v1'"))
assert(sql.includes("'dados',to_jsonb(v_origem)"))
assert(sql.includes('v_anexos := v_anexos || jsonb_build_array(v_anexo)'))
assert(!/delete from public\.orcamentos/i.test(sql), 'Não pode apagar o card original')

// Simula a seleção após expirar o link, sem escolher outro anexo por engano.
function localizar(anexos, anterior, indice) {
  const corresponde = novo => novo.nome === anterior.nome &&
    novo.mimeType === anterior.mimeType &&
    (!anterior.id || !novo.id || novo.id === anterior.id)
  const noIndice = anexos[indice]
  return noIndice && corresponde(noIndice)
    ? noIndice : anexos.find(novo => !!anterior.id && novo.id === anterior.id && corresponde(novo))
}
const antigo = {id: 'msg-1', nome: 'foto.jpg', mimeType: 'image/jpeg', url:'https://example.test/expirou'}
const novo = {...antigo, url:'https://example.test/renovado'}
assert.equal(localizar([novo], antigo, 0).url, novo.url)
assert.equal(localizar([{id:'msg-2',nome:'outra.jpg',mimeType:'image/jpeg',url:'https://example.test/outra'},novo],
  antigo, 0).url, novo.url)
assert.equal(localizar([{id:'msg-2',nome:'foto.jpg',mimeType:'image/jpeg',url:'https://example.test/outra'}],
  antigo, 0), undefined)
assert.equal(localizar([], antigo, 0), undefined)

console.log('OK: renovação ao abrir, tenant/permissão, visualização e histórico preservado')
