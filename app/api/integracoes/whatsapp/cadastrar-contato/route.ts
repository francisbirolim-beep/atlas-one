import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { conversaAcessivel } from '@/lib/whatsappServer'

export const dynamic = 'force-dynamic'

function digitos(valor: string | null | undefined) {
  const numero = String(valor || '').replace(/\D/g, '')
  if (!numero) return ''
  return numero.startsWith('55') ? numero : '55' + numero
}

function texto(valor: unknown, maximo: number) {
  return typeof valor === 'string' ? valor.trim().slice(0, maximo) : ''
}

async function clientePeloNumero(empresaId: string, numero: string) {
  for (let inicio = 0; inicio < 100000; inicio += 1000) {
    const { data, error } = await supabaseAdmin.from('clientes')
      .select('id,nome,whatsapp,telefone')
      .eq('empresa_id', empresaId)
      .order('id')
      .range(inicio, inicio + 999)
    if (error) throw error
    const encontrado = (data || []).find(c =>
      digitos(c.whatsapp) === numero || digitos(c.telefone) === numero
    )
    if (encontrado) return encontrado
    if (!data || data.length < 1000) return null
  }
  throw new Error('Não foi possível verificar contatos duplicados. Tente novamente.')
}

export async function POST(req: NextRequest) {
  const usuario = await autenticarTenant(req)
  if (!usuario) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  try {
    const body = await req.json()
    const conversaId = texto(body?.conversaId, 80)
    if (!conversaId) return NextResponse.json({ error: 'Conversa obrigatória.' }, { status: 400 })
    const conversa = await conversaAcessivel(conversaId, usuario, true)
    if (!conversa || conversa.whatsapp_chat_tipo === 'grupo') {
      return NextResponse.json({ error: 'Este contato não pode ser cadastrado por esta conversa.' }, { status: 403 })
    }
    if (conversa.cliente_id) {
      return NextResponse.json({ error: 'Esta conversa já possui um Cliente 360 vinculado.' }, { status: 409 })
    }
    const whatsapp = digitos(conversa.telefone)
    if (whatsapp.length < 12 || whatsapp.length > 13) {
      return NextResponse.json({ error: 'O WhatsApp desta conversa não possui telefone válido.' }, { status: 400 })
    }
    const nome = texto(body?.nome, 160)
    if (!nome || nome.length < 2) {
      return NextResponse.json({ error: 'Informe o nome completo (mínimo 2 caracteres).' }, { status: 400 })
    }
    const email = texto(body?.email, 254).toLowerCase()
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Informe um e-mail válido.' }, { status: 400 })
    }
    const cpfCnpj = texto(body?.cpfCnpj, 20)
    const empresa = texto(body?.empresa, 160)
    const observacoes = texto(body?.observacoes, 3000)
    const notas = [
      ...(empresa ? [`Empresa/organização: ${empresa}`] : []),
      ...(observacoes ? [observacoes] : []),
    ].join('\n')

    const existente = await clientePeloNumero(usuario.empresa_id, whatsapp)
    if (existente && body?.confirmarVinculo !== true) {
      return NextResponse.json({
        error: `Este número já pertence ao cadastro ${existente.nome}. Confirme o vínculo para evitar duplicidade.`,
        clienteExistente: { id: existente.id, nome: existente.nome },
      }, { status: 409 })
    }

    let clienteId = existente?.id || ''
    let criadoAgora = false
    if (!clienteId) {
      const { data: novo, error: criarError } = await supabaseAdmin.from('clientes').insert({
        empresa_id: usuario.empresa_id,
        nome,
        whatsapp,
        origem: 'whatsapp',
        email: email || null,
        telefone: texto(body?.telefoneSecundario, 30) || null,
        cidade: texto(body?.cidade, 120) || null,
        endereco: texto(body?.endereco, 250) || null,
        bairro: texto(body?.bairro, 120) || null,
        cpf_cnpj: cpfCnpj || null,
        observacoes: notas || null,
      }).select('id').single()
      if (criarError || !novo?.id) throw criarError || new Error('Não foi possível salvar o contato.')
      clienteId = novo.id
      criadoAgora = true
    }

    const { data: vinculada, error: vincularError } = await supabaseAdmin
      .from('atendimento_conversas')
      .update({
        cliente_id: clienteId,
        contato_nome: existente?.nome || nome,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversa.id)
      .eq('empresa_id', usuario.empresa_id)
      .is('cliente_id', null)
      .select('id').maybeSingle()
    if (vincularError || !vinculada) {
      // Em concorrência não deixar um cadastro órfão recém-criado.
      if (criadoAgora) await supabaseAdmin.from('clientes')
        .delete().eq('id', clienteId).eq('empresa_id', usuario.empresa_id)
      throw vincularError || new Error('Conversa vinculada por outra operação. Atualize a página.')
    }

    await supabaseAdmin.from('atendimento_eventos').insert({
      empresa_id: usuario.empresa_id,
      conversa_id: conversa.id,
      tipo: existente ? 'contato_existente_vinculado' : 'contato_cadastrado_whatsapp',
      usuario_id: usuario.id,
      usuario_nome: usuario.nome,
      dados: { cliente_id: clienteId, contato_nome: existente?.nome || nome },
    })
    return NextResponse.json({
      ok: true,
      cliente: { id: clienteId, nome: existente?.nome || nome },
      vinculadoExistente: Boolean(existente),
    })
  } catch (e) {
    return NextResponse.json({
      error: e instanceof Error ? e.message : 'Erro ao cadastrar contato.',
    }, { status: 400 })
  }
}
