import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import { supabaseAdmin as db } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ClienteGestao = {
  id: string; nome: string; apelido: string | null; cpf_cnpj: string | null
  whatsapp: string | null; telefone: string | null; email: string | null
  cidade: string | null; bairro: string | null; endereco: string | null
  cep: string | null; ativo: boolean; created_at: string; updated_at: string
}
const modulos = {
  orcamentos: 'orcamentos', balcao: 'balcao_orcamentos', obras: 'obras',
  vendas: 'vendas_obras', assistencias: 'assistencias',
} as const
const resposta = (dados: unknown, status = 200) =>
  NextResponse.json(dados, { status, headers: { 'Cache-Control': 'private, no-store, max-age=0' } })

function limparBusca(valor: string) {
  // .or e um filtro PostgREST; nao incorporar sua pontuacao de controle.
  return valor.normalize('NFC').replace(/[^A-Za-zÀ-ÿ0-9\s@.+-]/g, ' ')
    .replace(/\s+/g, ' ').trim().slice(0, 75)
}

export async function GET(req: NextRequest) {
  const usuario = await autenticarTenant(req)
  if (!usuario) return resposta({ error: 'Sessão inválida.' }, 401)
  const id = req.nextUrl.searchParams.get('id')?.trim() || ''
  const busca = limparBusca(req.nextUrl.searchParams.get('busca') || '')
  if (!id && busca.length < 2) return resposta({ clientes: [] })
  if (id && !/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(id)) {
    return resposta({ error: 'Identificador de cliente inválido.' }, 400)
  }
  try {
    let query = db.from('clientes')
      .select('id,nome,apelido,cpf_cnpj,whatsapp,telefone,email,cidade,bairro,endereco,cep,ativo,created_at,updated_at')
      .eq('empresa_id', usuario.empresa_id)
    if (id) {
      query = query.eq('id', id)
    } else {
      const termo = '%'+busca+'%'
      const digitos = busca.replace(/\D/g, '')
      // Ex.: 11999990000 localiza (11) 99999-0000, sem depender da pontuacao.
      const termoNumerico = digitos.length >= 4 && digitos.length <= 18
        ? '%'+digitos.split('').join('%')+'%' : ''
      const filtros = [
        'nome.ilike.'+termo,'apelido.ilike.'+termo,'cpf_cnpj.ilike.'+termo,
        'whatsapp.ilike.'+termo,'telefone.ilike.'+termo,'email.ilike.'+termo,
        'cidade.ilike.'+termo,'bairro.ilike.'+termo,
      ]
      if (termoNumerico) filtros.push(
        'cpf_cnpj.ilike.'+termoNumerico,'whatsapp.ilike.'+termoNumerico,
        'telefone.ilike.'+termoNumerico,
      )
      query = query.eq('ativo', true).or(filtros.join(',')).order('nome').limit(12)
    }
    const { data, error } = await query
    if (error) throw error
    const clientes = (data || []) as ClienteGestao[]
    const enriquecidos = await Promise.all(clientes.map(async cliente => {
      const resultados = await Promise.all(Object.entries(modulos).map(async ([chave, tabela]) => {
        const r = await db.from(tabela).select('id', { count: 'exact', head: true })
          .eq('empresa_id', usuario.empresa_id).eq('cliente_id', cliente.id)
        return [chave, r.error ? null : (r.count ?? null)] as const
      }))
      return { ...cliente, resumo: Object.fromEntries(resultados) }
    }))
    return resposta({ clientes: enriquecidos })
  } catch (e) {
    console.error('[Clientes/gestao] falha de consulta', e)
    return resposta({ error: 'Não foi possível consultar os cadastros. Tente novamente.' }, 503)
  }
}
