import { supabase } from './supabase'
import { obterOuCriarCliente } from './clientes'
import { primeiraColunaId } from './kanban'
import { uploadFoto, uploadArquivo } from './upload'
import { usuarioAtual, tokenAtual } from './auth'
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
  fotos: File[]
  larguraBaixo: string
  larguraMeio: string
  larguraCima: string
  alturaDireita: string
  alturaMeio: string
  alturaEsquerda: string
  modoLargura?: 'digitar' | 'foto'
  modoAltura?: 'digitar' | 'foto'
  fotoLargura?: File | null
  fotoAltura?: File | null
  modoOrigem?: 'manual' | 'produto'
  produtoId?: string | null
  precoUnit?: number | null
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

function numeroOpcional(valor: string): number | null {
  const n = parseFloat((valor || '').replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : null
}

async function lerTrena(url: string, eixo: 'largura' | 'altura'): Promise<number[]> {
  try {
    const token = await tokenAtual()
    if (!token) return []
    const resp = await fetch('/api/medicao-final/ler-trena', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ imageUrl: url, eixo }),
    })
    const json = await resp.json().catch(() => ({}))
    if (!resp.ok || !Array.isArray(json?.medidas_mm)) return []
    return json.medidas_mm
      .map((v: unknown) => Number(v))
      .filter((v: number) => Number.isFinite(v) && v > 0)
      .slice(0, 3)
  } catch (e) {
    console.error('Erro ao ler foto da trena no orçamento:', e)
    return []
  }
}

export async function criarOrcamentoNoServidor(
  dados: DadosOrcamentoForm
): Promise<{ ok: boolean; id?: string; error?: string }> {
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

  const itensSalvos: ItemEsquadria[] = []
  const fotosUrls: string[] = []
  for (const foto of fotos) {
    const url = await uploadFoto(foto)
    if (url) fotosUrls.push(url)
  }

  const anexosSalvos: Anexo[] = []
  for (const arquivo of arquivos) {
    const url = await uploadArquivo(arquivo)
    if (url) anexosSalvos.push({ titulo: arquivo.name, nome: arquivo.name, url })
  }

  for (const it of itens) {
    const itemFotoUrls: string[] = []
    for (const f of it.fotos) {
      const url = await uploadFoto(f)
      if (url) itemFotoUrls.push(url)
    }

    const produto_id = it.modoOrigem === 'produto' ? (it.produtoId || null) : null
    const preco_unit = it.modoOrigem === 'produto' && it.precoUnit != null ? it.precoUnit : null
    const quantidadeNum = parseInt(it.quantidade) || 1
    const preco_total = preco_unit != null ? preco_unit * quantidadeNum : null

    if (tipoMedida === 'final') {
      const usaFotoLargura = it.modoLargura === 'foto'
      const usaFotoAltura = it.modoAltura === 'foto'
      const foto_larguras_url = usaFotoLargura && it.fotoLargura ? await uploadFoto(it.fotoLargura) : null
      const foto_alturas_url = usaFotoAltura && it.fotoAltura ? await uploadFoto(it.fotoAltura) : null

      const medidasLidasLargura = foto_larguras_url ? await lerTrena(foto_larguras_url, 'largura') : []
      const medidasLidasAltura = foto_alturas_url ? await lerTrena(foto_alturas_url, 'altura') : []

      const lb = medidasLidasLargura[0] ?? numeroOpcional(it.larguraBaixo)
      const lm = medidasLidasLargura[1] ?? numeroOpcional(it.larguraMeio)
      const lc = medidasLidasLargura[2] ?? numeroOpcional(it.larguraCima)
      const ad = medidasLidasAltura[0] ?? numeroOpcional(it.alturaDireita)
      const am = medidasLidasAltura[1] ?? numeroOpcional(it.alturaMeio)
      const ae = medidasLidasAltura[2] ?? numeroOpcional(it.alturaEsquerda)

      const todasFotosItem = [
        ...itemFotoUrls,
        ...(foto_larguras_url ? [foto_larguras_url] : []),
        ...(foto_alturas_url ? [foto_alturas_url] : []),
      ]

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
        quantidade: quantidadeNum,
        foto_url: itemFotoUrls[0] || foto_larguras_url || foto_alturas_url || null,
        foto_urls: todasFotosItem.length ? todasFotosItem : null,
        descricao: it.descricao || undefined,
        cor: it.cor || null,
        produto_id,
        preco_unit,
        preco_total,
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
        quantidade: quantidadeNum,
        foto_url: itemFotoUrls[0] || null,
        foto_urls: itemFotoUrls.length ? itemFotoUrls : null,
        descricao: it.descricao || undefined,
        cor: it.cor || null,
        produto_id,
        preco_unit,
        preco_total,
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

  if (error) return { ok: false, error: error.message }
  if (colunaId) {
    executarAutomacoesColuna(colunaId, {
      cliente_nome: clienteNome,
      criado_por_id: usuario?.id || null,
    }).catch(() => {})
  }

  await registrarHistorico(novoId, usuario, 'Criou o orcamento')
  return { ok: true, id: novoId }
}
