import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { autenticarCompras } from "@/lib/comprasServer";
import { usuarioPodeAcaoServer } from "@/lib/acessoUsuarioServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const usuario = await autenticarCompras(req);
  if (!usuario)
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });

  const fornecedorId = params.id;
  if (!fornecedorId)
    return NextResponse.json(
      { error: "Fornecedor inválido." },
      { status: 400 },
    );

  try {
    const { data: fornecedor, error: fornecedorError } = await supabaseAdmin
      .from("fornecedores")
      .select("*")
      .eq("id", fornecedorId)
      .eq("empresa_id", usuario.empresa_id)
      .maybeSingle();
    if (fornecedorError) throw new Error(fornecedorError.message);
    if (!fornecedor)
      return NextResponse.json(
        { error: "Fornecedor não encontrado." },
        { status: 404 },
      );

    const { data: cotacoes, error: cotacoesError } = await supabaseAdmin
      .from("compras_cotacoes")
      .select("*")
      .eq("empresa_id", usuario.empresa_id)
      .eq("fornecedor_id", fornecedorId)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (cotacoesError) throw new Error(cotacoesError.message);

    const necessidadeIds = Array.from(
      new Set((cotacoes || []).map((c) => c.necessidade_id).filter(Boolean)),
    );
    const { data: necessidades, error: necessidadesError } =
      necessidadeIds.length
        ? await supabaseAdmin
            .from("compras_necessidades")
            .select("*")
            .eq("empresa_id", usuario.empresa_id)
            .in("id", necessidadeIds)
        : { data: [], error: null };
    if (necessidadesError) throw new Error(necessidadesError.message);

    const financeiroAutorizado = await usuarioPodeAcaoServer({
      usuarioId: usuario.id, role: usuario.role, empresaId: usuario.empresa_id,
      setorId: "financeiro", acaoId: "financeiro.contas_pagar.consultar",
    });
    const contasFinanceiras = financeiroAutorizado
      ? await supabaseAdmin.from("financeiro_contas_pagar")
          .select("id,fornecedor_id,documento,parcela,descricao,vencimento,valor,valor_pago,status,data_pagamento,forma_pagamento_prevista,created_at")
          .eq("empresa_id", usuario.empresa_id).eq("fornecedor_id", fornecedorId)
          .order("vencimento", { ascending: false, nullsFirst: false }).limit(1000)
      : { data: [], error: null };
    if (contasFinanceiras.error) throw new Error(contasFinanceiras.error.message);

    return NextResponse.json({
      fornecedor,
      cotacoes: cotacoes || [],
      necessidades: necessidades || [],
      financeiroAutorizado,
      contasFinanceiras: contasFinanceiras.data || [],
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Erro ao carregar Fornecedor 360:", error);
    return NextResponse.json(
      { error: "Não foi possível carregar o fornecedor." },
      { status: 500 },
    );
  }
}
