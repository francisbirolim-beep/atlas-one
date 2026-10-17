import assert from 'node:assert/strict'
import { interpretarRespostaLembrete as parse, textoLembreteWhatsApp } from '../lib/lembretesIntencoes.ts'
const agora = new Date('2026-10-17T14:00:00.000Z')
const ctx={contextoVerificado:true,agora,timezone:'America/Sao_Paulo'}
const sem={...ctx,contextoVerificado:false}
function equals(texto,esperado,opcoes=ctx){
 const r=parse(texto,opcoes)
 assert.deepEqual(r,esperado,texto)
}
equals('sim',{acao:'esclarecer'},sem)
equals('sim',{acao:'concluir'})
equals('Concluí!',{acao:'concluir'})
equals('enviei',{acao:'concluir'})
equals('ainda não',{acao:'nao_concluido'})
equals('pendente',{acao:'nao_concluido'})
equals('não concluí',{acao:'nao_concluido'})
equals('adiar por 1 hora',{acao:'adiar',minutos:60})
equals('adiar 30 minutos',{acao:'adiar',minutos:30})
equals('adiar 2 dias',{acao:'adiar',minutos:2880})
equals('adiar 0 horas',{acao:'esclarecer'})
equals('vou enviar depois',{acao:'esclarecer'})
equals('sim para todas',{acao:'esclarecer'})
equals('reagendar amanhã às 9h',{acao:'reagendar',dataHora:'2026-10-18T12:00:00.000Z'})
equals('reagendar amanhã às 9:30',{acao:'reagendar',dataHora:'2026-10-18T12:30:00.000Z'})
equals('reagendar 18/10/2026 às 10h',{acao:'reagendar',dataHora:'2026-10-18T13:00:00.000Z'})
const mensagem = textoLembreteWhatsApp('Enviar orçamento de João','AT-TESTE')
assert.match(mensagem,/AT-TESTE/)
assert.match(mensagem,/Responda a ESTA mensagem/)
console.log('PASS: respostas contextuais, negativas, conclusão, adiamento, reagendamento, fusos e ambiguidades.')
