import { supabase } from './supabase'
import { obterOuCriarCliente } from './clientes'
import { uploadFoto } from './upload'
import { usuarioAtual } from './auth'

export interface DadosAssistenciaForm {
  clienteNome: string
  clienteWhatsapp: string
  cidade: string
  endereco: string
  numero: string
  bairro: string
  descricao: string
  fotos: File[]
}

// Faz de fato a gravacao no Supabase. Usada tanto pelo formulario (quando ha
// internet na hora) quanto pelo sincronizador da fila offline.
export async function criarAssistenciaNoServidor(
  dados: DadosAssistenciaForm
): Promise<{ ok: boolean; error?: string }> {
  const { clienteNome, clienteWhatsapp, cidade, endereco, numero, bairro, descricao, fotos } = dados

  const [clienteId, usuario] = await Promise.all([
    obterOuCriarCliente({ nome: clienteNome, whatsapp: clienteWhatsapp, cidade }),
    usuarioAtual(),
  ])

  const fotosUrls: string[] = []
  for (const f of fotos) {
    const url = await uploadFoto(f)
    if (url) fotosUrls.push(url)
  }

  const { error } = await supabase.from('assistencias').insert({
    cliente_id: clienteId,
    cliente_nome: clienteNome,
    cliente_whatsapp: clienteWhatsapp || null,
    cidade: cidade || null,
    endereco: endereco || null,
    numero: numero || null,
    bairro: bairro || null,
    descricao_problema: descricao,
    fotos_urls: fotosUrls,
    status: 'aberto',
    criado_por_nome: usuario?.nome || null,
    criado_por_id: usuario?.id || null,
  })

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
