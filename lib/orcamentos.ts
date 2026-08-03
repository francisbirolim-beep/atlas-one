import { supabase } from './supabase'
import { obterOuCriarCliente } from './clientes'
import { primeiraColunaId } from './kanban'
import { uploadFoto } from './upload'
import { usuarioAtual } from './auth'
import { registrarHistorico } from './historico'
import { executarAutomacoesColuna } from './automacoes'
import { v4 as uuidv4 } from 'uuid'
import { TipoEsquadria, Acabamento, OrigemCliente, Contramarco, ItemEsquadria, TemperaturaLead } from './tipos'

export interface ItemOrcamentoForm {
  id: string
  tipo: TipoEsquadria | ''
  tipoOutroTexto: string
  folhas: string
  largura: string
  altura: string
  quantidade: string
  descricao: string
  cor: string
  foto?: File | null
  larguraBaixo: string
  larguraMeio: string
  larguraCima: string
  alturaDireita: string
  alturaMeio: string
  alturaEsquerda: string
}

export interface DadosOrcamentoForm {
  modo: 'formulario' | 'texto_livre'
  itens: ItemOrcamentoForm[]
  textosLivres: string[]
  clienteNome: string
  clienteWhatsapp: string
  cidade: string
  origem: OrigemCliente
  temperatura: TemperaturaLead | ''
  acabamento: Acabamento | ''
  acabamentoOutroTexto: string
  contramarco: Contramarco | ''
  tipoMedida: 'comum' | 'final' | ''
  arquitetoNome: string
  arquitetoContato: string
}

// Faz de fato a gravacao no Supabase (cliente, upload de fotos, orcamento e
// historico). Usada tanto pelo formulario (quando ha internet na hora) quanto
// pelo sincronizador da fila offline (quando a internet volta depois).
export async function criarOrcamentoNoServidor(
  dados: DadosOrcamentoForm
): Promise<{ ok: boolean; error?: string }> {
  const {
    modo, itens, textosLivres, clienteNome, clienteWhatsapp, cidade, origem,
    temperatura, acabamento, acabamentoOutroTexto, contramarco, tipoMedida,
    arquitetoNome, arquitetoContato,
  } = dados

  const [clienteId, colunaId, usuario] = await Promise.all([
    obterOuCriarCliente({ nome: clienteNome, whatsapp: clienteWhatsapp, cidade, origem }),
    primeiraColunaId(),
    usuarioAtual(),
  ])

  let itensSalvos: ItemEsquadria[] = []
  if (modo === 'formulario') {
    for (const it of itens) {
      const foto_url = it.foto ? await uploadFoto(it.foto) : null
      if (tipoMedida === 'final') {
        const lb = parseFloat(it.larguraBaixo.replace(',', '.'))
        const lm = parseFloat(it.larguraMeio.replace(',', '.'))
        const lc = parseFloat(it.larguraCima.replace(',', '.'))
        const ad = parseFloat(it.alturaDireita.replace(',', '.'))
        const am = parseFloat(it.alturaMeio.replace(',', '.'))
        const ae = parseFloat(it.alturaEsquerda.replace(',', '.'))
        itensSalvos.push({
          id: it.id,
          tipo_esquadria: it.tipo as TipoEsquadria,
          tipo_outro_texto: it.tipo === 'outro' ? it.tipoOutroTexto || null : null,
          folhas: it.folhas || null,
          largura_mm: lm,
          altura_mm: am,
          largura_baixo_mm: lb,
          largura_meio_mm: lm,
          largura_cima_mm: lc,
          altura_direita_mm: ad,
          altura_meio_mm: am,
          altura_esquerda_mm: ae,
          quantidade: parseInt(it.quantidade) || 1,
          foto_url,
          descricao: it.descricao || undefined,
          cor: it.cor || null,
        })
      } else {
        itensSalvos.push({
          id: it.id,
          tipo_esquadria: it.tipo as TipoEsquadria,
          tipo_outro_texto: it.tipo === 'outro' ? it.tipoOutroTexto || null : null,
          folhas: it.folhas || null,
          largura_mm: parseFloat(it.largura),
          altura_mm: parseFloat(it.altura),
          quantidade: parseInt(it.quantidade) || 1,
          foto_url,
          descricao: it.descricao || undefined,
          cor: it.cor || null,
        })
      }
    }
  }

  const primeiro = itensSalvos[0]
  const novoId = uuidv4()

  const { error } = await supabase.from('orcamentos').insert({
    id: novoId,
    cliente_id: clienteId,
    cliente_nome: clienteNome,
    cliente_whatsapp: clienteWhatsapp,
    cidade,
    origem,
    tipo_esquadria: primeiro?.tipo_esquadria || 'outro',
    largura_mm: primeiro?.largura_mm || null,
    altura_mm: primeiro?.altura_mm || null,
    quantidade: primeiro?.quantidade || 1,
    acabamento,
    acabamento_outro_texto: acabamento === 'outro' ? acabamentoOutroTexto : null,
    temperatura,
    contramarco,
    itens: itensSalvos,
    tipo_medida: modo === 'formulario' ? tipoMedida : null,
    descricao_livre: modo === 'texto_livre' ? textosLivres.filter(t => t.trim()).join('\n\n') : null,
    valor_estimado: null,
    status: 'rascunho',
    modo_entrada: modo,
    coluna_id: colunaId,
    coluna_atualizada_em: new Date().toISOString(),
    arquiteto_nome: arquitetoNome || null,
    arquiteto_contato: arquitetoContato || null,
    criado_por_nome: usuario?.nome || null,
    criado_por_id: usuario?.id || null,
  })

  if (error) {
    return { ok: false, error: error.message }
  }
  if (colunaId) { executarAutomacoesColuna(colunaId, { cliente_nome: clienteNome, criado_por_id: usuario?.id || null }).catch(() => {}) }

  await registrarHistorico(novoId, usuario, 'Criou o orcamento')
  return { ok: true }
}
