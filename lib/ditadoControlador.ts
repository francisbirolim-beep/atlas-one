/** Controlador do ditado: evita escuta infinita se o navegador não responder. */
export type FaseDitado = 'ouvindo' | 'finalizando' | 'reconhecido' | 'erro' | 'pronto'
export type EstadoDitado = { fase: FaseDitado; mensagem: string; parcial?: string }

type ResultadoFala = { isFinal?: boolean; [index: number]: { transcript?: string } }
export type ReconhecedorFala = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((evento: { results?: ArrayLike<ResultadoFala>; resultIndex?: number }) => void) | null
  onend: (() => void) | null
  onerror: ((evento: { error?: string }) => void) | null
  onnomatch: (() => void) | null
  onspeechend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
type Relogio = {
  agendar: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>
  limpar: (id: ReturnType<typeof setTimeout>) => void
}
export type ControleDitado = { parar: () => void; cancelar: () => void }

const RELOGIO: Relogio = {
  agendar: (fn, ms) => setTimeout(fn, ms),
  limpar: id => clearTimeout(id),
}
const LIMITE_MS = 15000
const ESPERA_RESULTADO_MS = 2200

export function iniciarDitado(opts: {
  Reconhecimento: new () => ReconhecedorFala
  onEstado: (estado: EstadoDitado) => void
  onResultado: (texto: string) => void
  relogio?: Relogio
  limiteMs?: number
  esperaMs?: number
}): ControleDitado {
  const clock = opts.relogio || RELOGIO
  let reconhecimento: ReconhecedorFala
  let ativo = true
  let parando = false
  let parcial = ''
  let prazo: ReturnType<typeof setTimeout> | null = null
  let espera: ReturnType<typeof setTimeout> | null = null

  function limpar() {
    if (prazo !== null) { clock.limpar(prazo); prazo = null }
    if (espera !== null) { clock.limpar(espera); espera = null }
    reconhecimento.onresult = null
    reconhecimento.onend = null
    reconhecimento.onerror = null
    reconhecimento.onnomatch = null
    reconhecimento.onspeechend = null
  }

  function encerrar(fase: 'pronto' | 'reconhecido' | 'erro', mensagem: string, texto?: string) {
    if (!ativo) return
    ativo = false
    limpar()
    try { reconhecimento.abort() } catch {}
    opts.onEstado({ fase, mensagem })
    if (fase === 'reconhecido' && texto) opts.onResultado(texto)
  }

  function concluirOuFalhar() {
    if (!ativo) return
    if (parcial.trim()) {
      encerrar('reconhecido', 'Texto reconhecido. Confira o título e o horário antes de salvar.', parcial.trim())
    } else {
      encerrar('erro', 'A escuta terminou sem reconhecer a frase. Tente novamente ou digite a tarefa.')
    }
  }

  function parar() {
    if (!ativo || parando) return
    parando = true
    if (prazo !== null) { clock.limpar(prazo); prazo = null }
    opts.onEstado({ fase: 'finalizando', mensagem: 'Finalizando o reconhecimento…', parcial })
    // Alguns navegadores nunca chamam onend após stop(). A espera é sempre limitada.
    espera = clock.agendar(concluirOuFalhar, opts.esperaMs ?? ESPERA_RESULTADO_MS)
    try { reconhecimento.stop() } catch { concluirOuFalhar() }
  }

  function cancelar() {
    encerrar('pronto', 'Escuta cancelada. Você pode tentar novamente.')
  }

  reconhecimento = new opts.Reconhecimento()
  reconhecimento.lang = 'pt-BR'
  reconhecimento.continuous = false
  reconhecimento.interimResults = true
  reconhecimento.maxAlternatives = 1
  reconhecimento.onresult = e => {
    if (!ativo) return
    const resultados = e.results
    if (!resultados) return
    let finais = ''
    let partes = ''
    for (let i = 0; i < resultados.length; i++) {
      const item = resultados[i]
      const frase = String(item?.[0]?.transcript || '').trim()
      if (!frase) continue
      if (item.isFinal) finais += (finais ? ' ' : '') + frase
      else partes += (partes ? ' ' : '') + frase
    }
    if (finais) {
      encerrar('reconhecido', 'Texto reconhecido. Confira antes de salvar.', finais)
    } else if (partes) {
      parcial = partes
      opts.onEstado({
        fase: parando ? 'finalizando' : 'ouvindo',
        mensagem: parando ? 'Finalizando o reconhecimento…' : 'Estou ouvindo. Você também pode parar manualmente.',
        parcial,
      })
    }
  }
  reconhecimento.onend = concluirOuFalhar
  reconhecimento.onnomatch = () => encerrar('erro', 'Não consegui entender a frase. Tente novamente ou digite.')
  reconhecimento.onspeechend = parar
  reconhecimento.onerror = e => {
    if (!ativo) return
    const erro = e.error || ''
    if (erro === 'aborted' && parando) { concluirOuFalhar(); return }
    const msg = erro === 'not-allowed' || erro === 'service-not-allowed'
      ? 'Microfone ou serviço de voz bloqueado. Autorize o acesso no navegador.'
      : erro === 'no-speech'
        ? 'Nenhuma fala foi identificada. Tente novamente, falando próximo ao microfone.'
        : erro === 'network'
          ? 'O reconhecimento de voz está sem conexão. Tente novamente ou digite a tarefa.'
          : 'Não foi possível reconhecer a fala. Tente novamente ou digite a tarefa.'
    encerrar('erro', msg)
  }

  opts.onEstado({ fase: 'ouvindo', mensagem: 'Fale sua frase. A escuta para sozinha em até 15 segundos.' })
  prazo = clock.agendar(parar, opts.limiteMs ?? LIMITE_MS)
  try { reconhecimento.start() } catch {
    encerrar('erro', 'Não foi possível iniciar o microfone. Confira a permissão do navegador.')
  }

  return { parar, cancelar }
}
