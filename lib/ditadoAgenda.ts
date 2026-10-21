import { interpretarComandoDeVoz } from './comandoVoz'

/**
 * Complemento conservador para os formulários rápidos de Tarefas e Agenda.
 * Preserva a interpretação existente e só preenche hora quando a data foi dita.
 */
export function interpretarDitadoAgenda(texto: string) {
  const interpretado = interpretarComandoDeVoz(texto)
  if (!interpretado.data) return interpretado

  const horario = interpretado.titulo.match(/\s+(?:às|as)\s+(\d{1,2})(?:[:h](\d{2}))?\s*h?(?:\s*horas?)?(?=\s|$)/i)
  if (!horario) return interpretado

  const horas = Number(horario[1])
  const minutos = Number(horario[2] || 0)
  if (horas > 23 || minutos > 59) return interpretado

  const data = new Date(interpretado.data)
  data.setHours(horas, minutos, 0, 0)
  const titulo = interpretado.titulo.replace(horario[0], ' ').replace(/\s+/g, ' ').trim()
  return { data, titulo: titulo || interpretado.titulo }
}
