'use client'

import SeletorV4, {
  type SelecaoEsquadriaOrcamento,
  type StatusConfiguracaoOrcamento,
} from './SeletorEsquadriaInteligenteV4'

export type { SelecaoEsquadriaOrcamento, StatusConfiguracaoOrcamento }

type Props = {
  value: SelecaoEsquadriaOrcamento
  onChange: (patch: Partial<SelecaoEsquadriaOrcamento>) => void
}

export default function SeletorEsquadriaInteligenteV5({ value, onChange }: Props) {
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

  return <SeletorV4 value={value} onChange={aplicarPatch} />
}
