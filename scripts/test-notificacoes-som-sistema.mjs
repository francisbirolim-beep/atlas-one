import assert from 'node:assert/strict'
import { ehCelularParaNotificacoes, podeTocarAlertaNoNavegador } from '../lib/notificacoesSom.ts'
import fs from 'node:fs'

const desktop = { userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/605.1', platform:'MacIntel', maxTouchPoints:0 }
const iphone = { userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', platform:'iPhone' }
const android = { userAgent:'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Mobile', platform:'Linux armv8l' }
const ipad = { userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1', platform:'MacIntel', maxTouchPoints:5 }
const chromeMobileHint = { userAgent:'Mozilla/5.0', platform:'Linux x86_64', mobileHint:true }
const prefs = {
  som_ativo:true,
  nao_perturbe_ativo:false,
  nao_perturbe_inicio:'22:00:00',
  nao_perturbe_fim:'07:00:00',
  timezone:'America/Sao_Paulo',
}
const meioDia = new Date('2026-10-17T15:00:00Z')
const madrugada = new Date('2026-10-17T05:30:00Z')
const noite = new Date('2026-10-18T01:30:00Z')

for(const [nome,device] of [['iPhone',iphone],['Android',android],['iPad',ipad],['indicador mobile',chromeMobileHint]]){
 assert.equal(ehCelularParaNotificacoes(device),true,nome+' mobile')
 assert.equal(podeTocarAlertaNoNavegador(prefs,device,meioDia),false,nome+' não deve tocar som interno')
}
assert.equal(ehCelularParaNotificacoes(desktop),false)
assert.equal(podeTocarAlertaNoNavegador(prefs,desktop,meioDia),true,'PC com som habilitado mantém áudio existente')
assert.equal(podeTocarAlertaNoNavegador({...prefs,som_ativo:false},desktop,meioDia),false)
assert.equal(podeTocarAlertaNoNavegador({...prefs,nao_perturbe_ativo:true},desktop,madrugada),false,'silêncio noturno em São Paulo')
assert.equal(podeTocarAlertaNoNavegador({...prefs,nao_perturbe_ativo:true},desktop,noite),false,'silêncio 22h São Paulo')
assert.equal(podeTocarAlertaNoNavegador({...prefs,nao_perturbe_ativo:true},desktop,meioDia),true,'fora do DND permite áudio no PC')
assert.equal(podeTocarAlertaNoNavegador({...prefs,nao_perturbe_ativo:true,timezone:'invalid'},desktop,meioDia),false,'falha fechada')
const bell = fs.readFileSync('components/system/HomeNotificationBell.tsx','utf8')
assert.match(bell,/if \(!prefs \|\| !podeTocarAlertaNoNavegador\(/)
const guard = bell.indexOf('if (!prefs || !podeTocarAlertaNoNavegador(')
const api = bell.indexOf('const Ctx = window.AudioContext')
assert(guard > 0 && api > guard,'guard antecede AudioContext')
const sw = fs.readFileSync('public/sw.js','utf8')
assert(sw.includes("self.registration.showNotification("))
assert(sw.includes("silent: payload.silent === true"),'push respeita atributo de silêncio, sem áudio próprio')
assert(!sw.includes('renotify: true'),'sem toque forçado')
const cfg = fs.readFileSync('app/configuracoes/notificacoes/page.tsx','utf8')
assert(cfg.includes('No celular, vale o som do aparelho.'),'aviso explicativo na configuração')
console.log('PASS: iPhone/Android/iPad nunca executam áudio no Atlas; PC mantém configuração e silêncio; push é nativo do sistema.')
