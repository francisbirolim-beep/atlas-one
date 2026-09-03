'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import SeletorV4, {
  type SelecaoEsquadriaOrcamento,
  type StatusConfiguracaoOrcamento,
} from './SeletorEsquadriaInteligenteV4'

export type { SelecaoEsquadriaOrcamento, StatusConfiguracaoOrcamento }

type Props = {
  value: SelecaoEsquadriaOrcamento
  onChange: (patch: Partial<SelecaoEsquadriaOrcamento>) => void
}

type CampoAprendizado = 'ambiente' | 'descricao'
type TermoAprendido = { valor: string; usos: number; ultimoUso: number }

const SUGESTOES_AMBIENTE = [
  'WC', 'Banheiro', 'Banheiro social', 'Lavabo', 'Suíte', 'Quarto', 'Quarto 1', 'Quarto 2',
  'Sala', 'Sala de estar', 'Sala de jantar', 'Cozinha', 'Área gourmet', 'Lavanderia', 'Garagem',
  'Escritório', 'Varanda', 'Sacada', 'Hall', 'Corredor', 'Fachada',
]

const SUGESTOES_DESCRICAO = [
  'Porta de correr', 'Porta de correr 2 folhas', 'Porta de correr 3 folhas', 'Porta de correr 4 folhas',
  'Porta de giro', 'Porta pivotante', 'Janela de correr', 'Maxim-ar', 'Quadro fixo',
  'Box Frontal', 'Box de Canto', 'Box de correr', 'Box de abrir',
]

function normalizar(valor: string) {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function chaveAprendizado(usuarioId: string, campo: CampoAprendizado) {
  return `atlas:sugestoes-digitacao:${usuarioId}:${campo}:v1`
}

function lerAprendizado(usuarioId: string, campo: CampoAprendizado): TermoAprendido[] {
  if (typeof window === 'undefined') return []
  try {
    const bruto = localStorage.getItem(chaveAprendizado(usuarioId, campo))
    if (!bruto) return []
    const itens = JSON.parse(bruto)
    if (!Array.isArray(itens)) return []
    return itens
      .filter(item => item && typeof item.valor === 'string' && item.valor.trim())
      .map(item => ({
        valor: item.valor.trim(),
        usos: Math.max(1, Number(item.usos) || 1),
        ultimoUso: Number(item.ultimoUso) || 0,
      }))
      .sort((a, b) => b.usos - a.usos || b.ultimoUso - a.ultimoUso)
      .slice(0, 40)
  } catch {
    return []
  }
}

function registrarAprendizado(usuarioId: string, campo: CampoAprendizado, texto: string) {
  const valor = texto.trim().replace(/\s+/g, ' ')
  if (valor.length < 2) return lerAprendizado(usuarioId, campo)

  const atual = lerAprendizado(usuarioId, campo)
  const alvo = normalizar(valor)
  const existente = atual.find(item => normalizar(item.valor) === alvo)
  const agora = Date.now()
  const proximo = existente
    ? atual.map(item => normalizar(item.valor) === alvo ? { ...item, valor, usos: item.usos + 1, ultimoUso: agora } : item)
    : [...atual, { valor, usos: 1, ultimoUso: agora }]

  const ordenado = proximo
    .sort((a, b) => b.usos - a.usos || b.ultimoUso - a.ultimoUso)
    .slice(0, 40)

  try {
    localStorage.setItem(chaveAprendizado(usuarioId, campo), JSON.stringify(ordenado))
  } catch {
    // Sugestões são conveniência: falha de armazenamento nunca bloqueia orçamento.
  }
  return ordenado
}

function combinarSugestoes(aprendidas: TermoAprendido[], padrao: string[]) {
  const resultado: string[] = []
  const vistos = new Set<string>()
  for (const valor of [...aprendidas.map(item => item.valor), ...padrao]) {
    const chave = normalizar(valor)
    if (!chave || vistos.has(chave)) continue
    vistos.add(chave)
    resultado.push(valor)
  }
  return resultado.slice(0, 50)
}

function habilitarDigitacaoInteligente(input: HTMLInputElement | null, listId?: string) {
  if (!input) return
  input.setAttribute('autocomplete', 'on')
  input.setAttribute('autocorrect', 'on')
  input.setAttribute('autocapitalize', 'sentences')
  input.setAttribute('spellcheck', 'true')
  input.setAttribute('enterkeyhint', 'next')
  if (listId) input.setAttribute('list', listId)
}

export default function SeletorEsquadriaInteligenteV5({ value, onChange }: Props) {
  const raizRef = useRef<HTMLDivElement>(null)
  const ambienteListId = `atlas-ambientes-${useId().replace(/:/g, '')}`
  const descricaoListId = `atlas-descricoes-${useId().replace(/:/g, '')}`
  const [usuarioId, setUsuarioId] = useState('dispositivo')
  const [aprendidasAmbiente, setAprendidasAmbiente] = useState<TermoAprendido[]>([])
  const [aprendidasDescricao, setAprendidasDescricao] = useState<TermoAprendido[]>([])

  const sugestoesAmbiente = useMemo(
    () => combinarSugestoes(aprendidasAmbiente, SUGESTOES_AMBIENTE),
    [aprendidasAmbiente],
  )
  const sugestoesDescricao = useMemo(
    () => combinarSugestoes(aprendidasDescricao, SUGESTOES_DESCRICAO),
    [aprendidasDescricao],
  )

  useEffect(() => {
    let ativo = true
    supabase.auth.getSession().then(({ data }) => {
      if (!ativo) return
      const id = data.session?.user.id || 'dispositivo'
      setUsuarioId(id)
      setAprendidasAmbiente(lerAprendizado(id, 'ambiente'))
      setAprendidasDescricao(lerAprendizado(id, 'descricao'))
    })
    return () => { ativo = false }
  }, [])

  useEffect(() => {
    const raiz = raizRef.current
    if (!raiz) return

    // O bloco de Ambiente é o irmão imediatamente anterior deste seletor.
    // Assim o autocomplete funciona sem mudar o estado nem duplicar o campo.
    const blocoAmbiente = raiz.previousElementSibling
    const inputAmbiente = blocoAmbiente?.querySelector('input[type="text"]') as HTMLInputElement | null
    habilitarDigitacaoInteligente(inputAmbiente, ambienteListId)

    const inputs = Array.from(raiz.querySelectorAll('input[type="text"]')) as HTMLInputElement[]
    inputs.forEach(input => habilitarDigitacaoInteligente(input))

    const descricao = inputs.find(input => input.placeholder.startsWith('Ex.: Porta')) || null
    habilitarDigitacaoInteligente(descricao, descricaoListId)

    const aprenderAmbiente = () => {
      if (!inputAmbiente?.value.trim()) return
      setAprendidasAmbiente(registrarAprendizado(usuarioId, 'ambiente', inputAmbiente.value))
    }
    const aprenderDescricao = () => {
      if (!descricao?.value.trim()) return
      setAprendidasDescricao(registrarAprendizado(usuarioId, 'descricao', descricao.value))
    }

    inputAmbiente?.addEventListener('change', aprenderAmbiente)
    inputAmbiente?.addEventListener('blur', aprenderAmbiente)
    descricao?.addEventListener('change', aprenderDescricao)
    descricao?.addEventListener('blur', aprenderDescricao)

    return () => {
      inputAmbiente?.removeEventListener('change', aprenderAmbiente)
      inputAmbiente?.removeEventListener('blur', aprenderAmbiente)
      descricao?.removeEventListener('change', aprenderDescricao)
      descricao?.removeEventListener('blur', aprenderDescricao)
    }
  }, [ambienteListId, descricaoListId, usuarioId])

  function aplicarPatch(patch: Partial<SelecaoEsquadriaOrcamento>) {
    const ajustado: Partial<SelecaoEsquadriaOrcamento> = { ...patch }

    // Se o vendedor já escreveu uma descrição livre e depois escolheu uma
    // tipologia, a descrição continua sendo o texto principal do item.
    // O vínculo técnico permanece em tipologiaId/linhaId para uso futuro.
    if (patch.tipologiaId && value.tipoOutroTexto.trim()) {
      ajustado.tipo = 'outro'
      ajustado.tipoOutroTexto = value.tipoOutroTexto
    }

    const variaveis = patch.variaveis ?? value.variaveis
    if (variaveis?.atlas_medida_layout === 'box_canto') {
      const esquerda = String(variaveis.largura_esquerda_mm || patch.largura || value.largura || '')
      const direita = String(variaveis.largura_direita_mm || '')

      // A validação existente da página exige largura + altura. Para Box de
      // Canto, só liberamos a largura principal quando AS DUAS larguras estão
      // preenchidas; assim não é possível enviar um canto incompleto.
      ajustado.largura = esquerda && direita ? esquerda : ''
    }

    onChange(ajustado)
  }

  return (
    <div ref={raizRef}>
      <datalist id={ambienteListId}>
        {sugestoesAmbiente.map(opcao => <option key={opcao} value={opcao} />)}
      </datalist>
      <datalist id={descricaoListId}>
        {sugestoesDescricao.map(opcao => <option key={opcao} value={opcao} />)}
      </datalist>
      <SeletorV4 value={value} onChange={aplicarPatch} />
    </div>
  )
}
