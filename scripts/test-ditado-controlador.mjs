import assert from 'node:assert/strict'
import { iniciarDitado } from '../lib/ditadoControlador.ts'

// Navegador simulado: os testes não usam microfone, rede nem banco.
class FakeClock {
  now = 0
  current = 0
  timers = new Map()
  agendar = (fn, ms) => {
    const id = ++this.current
    this.timers.set(id, { fn, quando: this.now + ms })
    return id
  }
  limpar = id => this.timers.delete(id)
  avancar(ms) {
    const alvo = this.now + ms
    for (;;) {
      const proximos = [...this.timers].filter(([, t]) => t.quando <= alvo).sort((a,b)=>a[1].quando-b[1].quando)
      if (!proximos.length) break
      const [id, timer] = proximos[0]
      this.timers.delete(id)
      this.now = timer.quando
      timer.fn()
    }
    this.now = alvo
  }
}
class MockSpeech {
  static ultimo
  lang = ''
  continuous = true
  interimResults = false
  maxAlternatives = 0
  onresult = null
  onend = null
  onerror = null
  onnomatch = null
  onspeechend = null
  stopCalls = 0
  abortCalls = 0
  startCalls = 0
  constructor() { MockSpeech.ultimo = this }
  start() { this.startCalls++ }
  stop() { this.stopCalls++ }
  abort() { this.abortCalls++ }
  resultado(texto, final=false) { this.onresult?.({results:[Object.assign([{transcript:texto}],{isFinal:final})],resultIndex:0}) }
  fim() { this.onend?.() }
  semFala() { this.onerror?.({error:'no-speech'}) }
  microfoneNegado() { this.onerror?.({error:'not-allowed'}) }
  terminouFala() { this.onspeechend?.() }
}
function criar() {
 const clock = new FakeClock()
 const estados = [], textos = []
 const handle = iniciarDitado({
  Reconhecimento:MockSpeech,
  onEstado: e => estados.push(e),
  onResultado: t => textos.push(t),
  relogio:clock,
 })
 return {clock,estados,textos,handle,rec:MockSpeech.ultimo}
}
function fase(x) { return x.estados.at(-1).fase }
{
 const x=criar()
 assert.equal(fase(x),'ouvindo')
 assert.equal(x.rec.lang,'pt-BR')
 assert.equal(x.rec.continuous,false)
 assert.equal(x.rec.interimResults,true)
 x.rec.resultado('Enviar orçamento do João amanhã',false)
 assert.equal(x.estados.at(-1).parcial,'Enviar orçamento do João amanhã')
 x.rec.resultado('Enviar orçamento do João amanhã',true)
 assert.equal(fase(x),'reconhecido')
 assert.deepEqual(x.textos,['Enviar orçamento do João amanhã'])
 x.rec.fim()
 x.clock.avancar(22000)
 assert.equal(x.textos.length,1,'resultado só pode ser disparado uma vez')
 assert.equal(x.clock.timers.size,0)
}
{
 const x=criar()
 x.rec.resultado('Visitar obra do cliente',false)
 x.handle.parar()
 assert.equal(fase(x),'finalizando')
 // Mesmo sem onend, o resultado parcial deve virar texto no máximo em 2,2 s.
 x.clock.avancar(2201)
 assert.equal(fase(x),'reconhecido')
 assert.deepEqual(x.textos,['Visitar obra do cliente'])
}
{
 const x=criar()
 // Caso relatado pelo usuário: Chrome fica ouvindo e não retorna qualquer evento.
 x.clock.avancar(15000)
 assert.equal(fase(x),'finalizando')
 assert.equal(x.rec.stopCalls,1)
 x.clock.avancar(2201)
 assert.equal(fase(x),'erro','não pode ficar ouvindo para sempre')
 assert.equal(x.rec.abortCalls,1)
 assert.deepEqual(x.textos,[])
 assert.equal(x.clock.timers.size,0)
}
{
 const x=criar()
 x.handle.parar()
 x.clock.avancar(2201)
 assert.equal(fase(x),'erro')
 assert.equal(x.clock.timers.size,0)
}
{
 const x=criar()
 x.rec.resultado('Corrigir medidas',false)
 x.rec.terminouFala()
 assert.equal(fase(x),'finalizando')
 x.rec.fim()
 assert.equal(fase(x),'reconhecido')
 assert.deepEqual(x.textos,['Corrigir medidas'])
}
{
 const x=criar()
 x.handle.cancelar()
 assert.equal(fase(x),'pronto')
 x.rec.resultado('não deve preencher',true)
 x.clock.avancar(30000)
 assert.deepEqual(x.textos,[])
 assert.equal(x.clock.timers.size,0)
}
{
 const x=criar()
 x.rec.microfoneNegado()
 assert.equal(fase(x),'erro')
 assert.match(x.estados.at(-1).mensagem,/bloqueado/)
 assert.equal(x.clock.timers.size,0)
}
{
 const x=criar()
 x.rec.semFala()
 assert.equal(fase(x),'erro')
 assert.match(x.estados.at(-1).mensagem,/Nenhuma fala/)
}
{
 const x=criar()
 x.handle.parar()
 x.handle.cancelar()
 x.clock.avancar(20000)
 assert.equal(fase(x),'pronto')
 assert.equal(x.clock.timers.size,0)
}
class FalhaAoIniciar extends MockSpeech { start() { throw new Error('browser broken') } }
{
 const clock = new FakeClock(),estados=[]
 iniciarDitado({Reconhecimento:FalhaAoIniciar,onEstado:e=>estados.push(e),onResultado:()=>{},relogio:clock})
 assert.equal(estados.at(-1).fase,'erro')
 assert.equal(clock.timers.size,0)
}
console.log('PASS: stop manual, fim da fala, parcial, resultado final, timeout sem eventos, cancelar, permissões, erro e limpeza.')
