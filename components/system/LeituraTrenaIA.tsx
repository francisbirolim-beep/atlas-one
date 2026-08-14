'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'
import { ItemEsquadria } from '@/lib/tipos'

type Eixo = 'largura' | 'altura'
type CampoMedida =
  | 'largura_baixo_mm'
  | 'largura_meio_mm'
  | 'largura_cima_mm'
  | 'altura_direita_mm'
  | 'altura_meio_mm'
  | 'altura_esquerda_mm'

type EstadoLeitura = {
  tipo: 'ocioso' | 'lendo' | 'sucesso' | 'erro'
  mensagem: string
}

type Props = {
  item: ItemEsquadria
  onAtualizar: (campo: CampoMedida, valor: number) => void
}

const CAMPOS: Record<Eixo, CampoMedida[]> = {
  largura: ['largura_baixo_mm', 'largura_meio_mm', 'largura_cima_mm'],
  altura: ['altura_direita_mm', 'altura_meio_mm', 'altura_esquerda_mm'],
}

function valorValido(valor: unknown) {
  return typeof valor === 'number' && Number.isFinite(valor) && valor > 0
}

function eixoTemValor(item: ItemEsquadria, eixo: Eixo) {
  return CAMPOS[eixo].some(campo => valorValido(item[campo]))
}

export default function LeituraTrenaIA({ item, onAtualizar }: Props) {
  const [estados, setEstados] = useState<Record<Eixo, EstadoLeitura>>({
    largura: { tipo: 'ocioso', mensagem: '' },
    altura: { tipo: 'ocioso', mensagem: '' },
  })
  const processados = useRef(new Set<string>())

  function atualizarEstado(eixo: Eixo, estado: EstadoLeitura) {
    setEstados(prev => ({ ...prev, [eixo]: estado }))
  }

  async function analisar(eixo: Eixo, manual = false) {
    const imageUrl = eixo === 'largura' ? item.foto_larguras_url : item.foto_alturas_url
    if (!imageUrl) return

    const chave = `${eixo}:${imageUrl}`
    if (!manual && processados.current.has(chave)) return
    if (!manual && eixoTemValor(item, eixo)) return

    processados.current.add(chave)
    atualizarEstado(eixo, {
      tipo: 'lendo',
      mensagem: `IA lendo a foto de ${eixo}...`,
    })

    try {
      const token = await tokenAtual()
      if (!token) {
        atualizarEstado(eixo, { tipo: 'erro', mensagem: 'Sessão inválida para leitura automática.' })
        return
      }

      const resp = await fetch('/api/medicao-final/ler-trena', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ imageUrl, eixo }),
      })
      const json = await resp.json().catch(() => ({}))

      if (!resp.ok) {
        atualizarEstado(eixo, {
          tipo: 'erro',
          mensagem: json?.error || `Não foi possível ler a foto de ${eixo}.`,
        })
        return
      }

      const medidas = Array.isArray(json?.medidas_mm)
        ? json.medidas_mm.map(Number).filter((v: number) => Number.isFinite(v) && v > 0 && v <= 10000)
        : []

      // Para não deslocar uma leitura para o campo errado, só preenche automaticamente
      // quando as três posições do visor foram identificadas.
      if (medidas.length !== 3) {
        atualizarEstado(eixo, {
          tipo: 'erro',
          mensagem: `A IA encontrou ${medidas.length} de 3 medidas de ${eixo}. Nenhum campo foi alterado para evitar troca de posição.`,
        })
        return
      }

      CAMPOS[eixo].forEach((campo, index) => onAtualizar(campo, Math.round(medidas[index])))

      const confianca = Math.round((Number(json?.confianca) || 0) * 100)
      const ordem = eixo === 'largura' ? 'Baixo · Meio · Cima' : 'Direita · Meio · Esquerda'
      atualizarEstado(eixo, {
        tipo: 'sucesso',
        mensagem: `${eixo === 'largura' ? 'Largura' : 'Altura'} preenchida: ${medidas.map((v: number) => `${Math.round(v)} mm`).join(' · ')} (${ordem})${confianca ? ` — confiança ${confianca}%` : ''}. Confira os valores.`,
      })
    } catch (e) {
      console.error(`Erro ao ler foto de ${eixo} no Kanban:`, e)
      atualizarEstado(eixo, {
        tipo: 'erro',
        mensagem: `A leitura automática de ${eixo} falhou. A foto continua salva e os campos podem ser preenchidos manualmente.`,
      })
    }
  }

  useEffect(() => {
    if (item.foto_larguras_url && !eixoTemValor(item, 'largura')) void analisar('largura')
    // A leitura automática deve ser disparada pela URL original da foto, não por cada atualização de campo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.foto_larguras_url])

  useEffect(() => {
    if (item.foto_alturas_url && !eixoTemValor(item, 'altura')) void analisar('altura')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.foto_alturas_url])

  const visiveis = (['largura', 'altura'] as Eixo[]).filter(eixo => estados[eixo].tipo !== 'ocioso')
  if (visiveis.length === 0) return null

  return (
    <div className="space-y-1.5">
      {visiveis.map(eixo => {
        const estado = estados[eixo]
        return (
          <div
            key={eixo}
            className={`flex items-start gap-2 rounded-lg px-2.5 py-2 text-[10px] ${
              estado.tipo === 'sucesso'
                ? 'bg-emerald-50 text-emerald-700'
                : estado.tipo === 'erro'
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-indigo-50 text-indigo-700'
            }`}
          >
            {estado.tipo === 'lendo' ? (
              <Loader2 size={13} className="mt-0.5 flex-shrink-0 animate-spin" />
            ) : estado.tipo === 'sucesso' ? (
              <CheckCircle2 size={13} className="mt-0.5 flex-shrink-0" />
            ) : estado.tipo === 'erro' ? (
              <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
            ) : (
              <Sparkles size={13} className="mt-0.5 flex-shrink-0" />
            )}
            <span className="flex-1 leading-relaxed">{estado.mensagem}</span>
            {estado.tipo === 'erro' && (
              <button
                type="button"
                onClick={() => analisar(eixo, true)}
                className="flex-shrink-0 rounded-md p-1 hover:bg-white/70"
                title={`Tentar ler ${eixo} novamente`}
              >
                <RefreshCw size={12} />
              </button>
            )}
          </div>
        )
      })}
      <p className="text-[10px] text-slate-400">A IA sugere as medidas; confira o visor antes de salvar o orçamento.</p>
    </div>
  )
}
