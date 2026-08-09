import { supabase } from './supabase'
import { obterOuCriarCliente } from './clientes'
import { primeiraColunaId } from './kanban'
import { uploadFoto, uploadArquivo } from './upload'
import { usuarioAtual } from './auth'
import { registrarHistorico } from './historico'
import { executarAutomacoesColuna } from './automacoes'
import { v4 as uuidv4 } from 'uuid'
import { TipoEsquadria, Acabamento, OrigemCliente, Contramarco, ItemEsquadria, TemperaturaLead, Anexo } from './tipos'

export interface ItemOrcamentoForm {
  id: string
  ambiente?: string
  tipo: TipoEsquadria | ''
  tipoOutroTexto: string
  folhas: string
  largura: string
  altura: string
  quantidade: string
  descricao: string
  cor: string
  // Fotos gerais da esquadria (varias, nao so uma).
  fotos: File[]
  larguraBaixo: string
  larguraMeio: string
  larguraCima: string
  alturaDireita: string
  alturaMeio: string
  alturaEsquerda: string
  // Fase 6: em vez de digitar as 3 larguras / 3 alturas (medida final), da
  // pra anexar uma foto da trena com as medidas — mesmo padrao ja usado na
  // Medicao Final.
  modoLargura?: 'digitar' | 'foto'
  modoAltura?: 'digitar' | 'foto'
  fotoLargura?: File | null
  fotoAltura?: File | null
}

export interface DadosOrcamentoForm {
  itens: ItemOrcamentoForm[]
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
  fotos: File[]
  arquivos: File[]
}

// Faz de fato a gravacao no Supabase (cliente, upload de fotos, orcamento e
// historico). Usada tanto pelo formulario (quando ha internet na hora) quanto
// pelo sincronizador da fila offline (quando a internet volta depois).
//
// Obs: o modo "texto livre" (Orcamento Rapido antigo) foi removido na Fase 5 —
// esse formulario so grava no modo "formulario" (Orcamento Detalhado) daqui pra frente.
export async function criarOrcamentoNoServidor(
  dados: DadosOrcamentoForm
): Promise<{ ok: boolean; error?: string }> {
  const {
    itens, clienteNome, clienteWhatsapp, cidade, origem,
    temperatura, acabamento, acabamentoOutroTexto, contramarco, tipoMedida,
    arquitetoNome, arquitetoContato, fotos, arquivos = [],
  } = dados

  const [clienteId, colunaId, usuario] = await Promise.all([
    obterOuCriarCliente({ nome: clienteNome, whatsapp: clienteWhatsapp, cidade, origem }),
    primeiraColunaId(),
    usuarioAtual(),
  ])

  let itensSalvos: ItemEsquadria[] = []
  const fotosUrls: string[] = []
  for (const foto of fotos) { const url = await uploadFoto(foto); if (url) fotosUrls.push(url) }
  const anexosSalvos: Anexo[] = []
  for (const arquivo of arquivos) {
    const url = await uploadArquivo(arquivo)
    if (url) anexosSalvos.push({ titulo: arquivo.name, nome: arquivo.name, url })
  }
  for (const it of itens) {
    // Fotos gerais da esquadria (agora podem ser varias).
    const itemFotoUrls: string[] = []
    for (const f of it.fotos) { const url = await uploadFoto(f); if (url) itemFotoUrls.push(url) }
    const foto_url = itemFotoUrls[0] || null
    const foto_urls = itemFotoUrls.length ? itemFotoUrls : null

    if (tipoMedida === 'final') {
      const usaFotoLargura = it.modoLargura === 'foto'
      const usaFotoAltura = it.modoAltura === 'foto'
      const lb = usaFotoLargura ? NaN : parseFloat(it.larguraBaixo.replace(',', '.'))
      const lm = usaFotoLargura ? NaN : parseFloat(it.larguraMeio.replace(',', '.'))
      const lc = usaFotoLargura ? NaN : parseFloat(it.larguraCima.replace(',', '.'))
      const ad = usaFotoAltura ? NaN : parseFloat(it.alturaDireita.replace(',', '.'))
      const am = usaFotoAltura ? NaN : parseFloat(it.alturaMeio.replace(',', '.'))
      const ae = usaFotoAltura ? NaN : parseFloat(it.alturaEsquerda.replace(',', '.'))
      const foto_larguras_url = usaFotoLargura && it.fotoLargura ? await uploadFoto(it.fotoLargura) : null
      const foto_alturas_url = usaFotoAltura && it.fotoAltura ? await uploadFoto(it.fotoAltura) : null
      itensSalvos.push({
        id: it.id,
        ambiente: it.ambiente?.trim() || null,
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
        foto_larguras_url,
        foto_alturas_url,
        quantidade: parseInt(it.quantidade) || 1,
        foto_url,
        foto_urls,
        descricao: it.descricao || undefined,
        cor: it.cor || null,
      })
    } else {
      itensSalvos.push({
        id: it.id,
        ambiente: it.ambiente?.trim() || null,
        tipo_esquadria: it.tipo as TipoEsquadria,
        tipo_outro_texto: it.tipo === 'outro' ? it.tipoOutroTexto || null : null,
        folhas: it.folhas || null,
        largura_mm: parseFloat(it.largura),
        altura_mm: parseFloat(it.altura),
        quantidade: parseInt(it.quantidade) || 1,
        foto_url,
        foto_urls,
        descricao: it.descricao || undefined,
        cor: it.cor || null,
      })
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
    fotos_urls: fotosUrls,
    anexos: anexosSalvos,
    tipo_medida: tipoMedida,
    descricao_livre: null,
    valor_estimado: null,
    status: 'rascunho',
    modo_entrada: 'formulario',
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
