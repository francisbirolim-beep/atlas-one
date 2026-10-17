'use client'

import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff, CheckCircle2, AlertCircle } from 'lucide-react'

type Props = {
  onResultado: (texto: string) => void
  tipo?: 'tarefa' | 'agenda'
}

type Estado = 'pronto' | 'ouvindo' | 'reconhecido' | 'erro'

/** Ditado rápido para preencher o formulário. Não cria nem envia itens automaticamente. */
export default function DitarCompromisso({ onResultado, tipo = 'tarefa' }: Props) {
  const [estado, setEstado] = useState<Estado>('pronto')
  const [mensagem, setMensagem] = useState('')
  const recRef = useRef<any>(null)

  useEffect(() => () => {
    try { recRef.current?.abort() } catch {}
    recRef.current = null
  }, [])

  function alternar() {
    if (estado === 'ouvindo') {
      try { recRef.current?.stop() } catch {}
      return
    }

    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!Recognition) {
      setEstado('erro')
      setMensagem('O ditado não está disponível neste navegador. Para testar, abra pelo Chrome e permita o microfone. Você também pode digitar a tarefa normalmente.')
      return
    }

    try {
      const rec = new Recognition()
      rec.lang = 'pt-BR'
      rec.interimResults = false
      rec.maxAlternatives = 1
      rec.onresult = (evento: any) => {
        const texto = String(evento.results?.[0]?.[0]?.transcript || '').trim()
        if (!texto) return
        onResultado(texto)
        setEstado('reconhecido')
        setMensagem('Reconhecido: ' + texto)
      }
      rec.onerror = (evento: any) => {
        setEstado('erro')
        setMensagem(evento.error === 'not-allowed'
          ? 'O microfone foi bloqueado. Libere a permissão do site no navegador e tente de novo.'
          : evento.error === 'no-speech'
            ? 'Não consegui ouvir sua voz. Tente falar novamente.'
            : 'Não consegui reconhecer a fala. Tente novamente ou use o campo de texto.')
      }
      rec.onend = () => {
        setEstado(atual => atual === 'ouvindo' ? 'pronto' : atual)
      }
      recRef.current = rec
      rec.start()
      setMensagem('Fale normalmente. O texto aparecerá no campo para você conferir.')
      setEstado('ouvindo')
    } catch {
      setEstado('erro')
      setMensagem('Não foi possível iniciar o microfone. Confira a permissão de acesso no navegador.')
    }
  }

  return (
    <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-3" data-testid="ditado-tarefa">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={alternar}
          aria-label={estado === 'ouvindo' ? 'Parar ditado' : 'Falar ' + (tipo === 'tarefa' ? 'tarefa' : 'compromisso')}
          aria-pressed={estado === 'ouvindo'}
          className={'inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold shadow-sm transition ' +
            (estado === 'ouvindo' ? 'bg-red-600 text-white animate-pulse' : 'bg-blue-700 text-white hover:bg-blue-800')}
        >
          {estado === 'ouvindo' ? <MicOff size={19} /> : <Mic size={19} />}
          {estado === 'ouvindo' ? 'Ouvindo... Parar' : 'Falar ' + (tipo === 'tarefa' ? 'tarefa' : 'compromisso')}
        </button>
        <span className="text-xs text-slate-600">Toque, fale e confira o texto antes de salvar.</span>
      </div>
      {mensagem && (
        <p role="status" aria-live="polite" className={'mt-2 flex items-start gap-1 text-xs ' +
          (estado === 'erro' ? 'text-red-700' : estado === 'reconhecido' ? 'text-emerald-700' : 'text-blue-700')}>
          {estado === 'erro' ? <AlertCircle size={14} /> : estado === 'reconhecido' ? <CheckCircle2 size={14} /> : <Mic size={14} />}
          <span>{mensagem}</span>
        </p>
      )}
    </div>
  )
}
