'use client'

import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff, CheckCircle2, AlertCircle, X } from 'lucide-react'
import { iniciarDitado, type ControleDitado, type EstadoDitado } from '@/lib/ditadoControlador'

type Props = {
  onResultado: (texto: string) => void
  tipo?: 'tarefa' | 'agenda'
}

const INICIAL: EstadoDitado = { fase: 'pronto', mensagem: '' }

/** Ditado rápido com tempo limite, parada manual e saída segura. Não salva tarefa. */
export default function DitarCompromisso({ onResultado, tipo = 'tarefa' }: Props) {
  const [estado, setEstado] = useState<EstadoDitado>(INICIAL)
  const sessaoRef = useRef<ControleDitado | null>(null)
  const montadoRef = useRef(true)

  useEffect(() => {
    montadoRef.current = true
    return () => {
      montadoRef.current = false
      sessaoRef.current?.cancelar()
      sessaoRef.current = null
    }
  }, [])

  function alternar() {
    if (estado.fase === 'ouvindo') {
      sessaoRef.current?.parar()
      return
    }
    if (estado.fase === 'finalizando') {
      sessaoRef.current?.cancelar()
      sessaoRef.current = null
      return
    }

    const Reconhecimento = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!Reconhecimento) {
      setEstado({
        fase: 'erro',
        mensagem: 'O reconhecimento de voz não está disponível neste navegador. Você pode digitar a tarefa normalmente.',
      })
      return
    }

    // Uma sessão antiga nunca pode continuar comandando o botão.
    sessaoRef.current?.cancelar()
    try {
      sessaoRef.current = iniciarDitado({
        Reconhecimento,
        onEstado: novo => {
          if (!montadoRef.current) return
          setEstado(novo)
        },
        onResultado: texto => {
          if (montadoRef.current) onResultado(texto)
        },
      })
    } catch {
      setEstado({ fase: 'erro', mensagem: 'Falha ao abrir o microfone. Verifique as permissões do site.' })
    }
  }

  const ouvindo = estado.fase === 'ouvindo'
  const finalizando = estado.fase === 'finalizando'
  const ativo = ouvindo || finalizando
  const classeStatus = estado.fase === 'erro'
    ? 'text-red-700'
    : estado.fase === 'reconhecido'
      ? 'text-emerald-700'
      : 'text-blue-700'

  return (
    <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-3" data-testid="ditado-tarefa">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={alternar}
          aria-label={ouvindo ? 'Parar escuta' : finalizando ? 'Cancelar escuta' : 'Falar ' + (tipo === 'tarefa' ? 'tarefa' : 'compromisso')}
          aria-pressed={ativo}
          className={'inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold shadow-sm transition ' +
            (ativo ? 'bg-red-600 text-white' : 'bg-blue-700 text-white hover:bg-blue-800')}
        >
          {ativo ? <MicOff size={19} /> : <Mic size={19} />}
          {ouvindo ? 'Parar escuta' : finalizando ? 'Cancelar escuta' : 'Falar ' + (tipo === 'tarefa' ? 'tarefa' : 'compromisso')}
        </button>
        {ativo && (
          <button
            type="button"
            onClick={() => { sessaoRef.current?.cancelar(); sessaoRef.current = null }}
            className="inline-flex min-h-[40px] items-center gap-1 rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-700"
          >
            <X size={14} /> Cancelar
          </button>
        )}
        <span className="text-xs text-slate-600">
          {ouvindo ? 'Fale a frase e toque em Parar; máximo de 15 segundos.' : 'Toque, fale e confira o texto antes de salvar.'}
        </span>
      </div>
      {estado.mensagem && (
        <div role="status" aria-live="polite" className={'mt-2 flex items-start gap-1 text-xs ' + classeStatus}>
          {estado.fase === 'erro' ? <AlertCircle size={14} className="shrink-0" />
            : estado.fase === 'reconhecido' ? <CheckCircle2 size={14} className="shrink-0" />
              : <Mic size={14} className="shrink-0" />}
          <div>
            <p>{estado.mensagem}</p>
            {estado.parcial && (
              <p className="mt-1 rounded-lg bg-white/75 p-2 font-semibold text-slate-700">
                Texto capturado: {estado.parcial}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
