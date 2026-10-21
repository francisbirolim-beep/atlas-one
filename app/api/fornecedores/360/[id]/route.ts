import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { autenticarCompras } from "@/lib/comprasServer";

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
      .eq("empresa_id", usuario.empresa_id)
      .eq("id", fornecedorId)
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

    return NextResponse.json({
      fornecedor,
      cotacoes: cotacoes || [],
      necessidades: necessidades || [],
    });
  } catch (error) {
    console.error("Erro ao carregar Fornecedor 360:", error);
    return NextResponse.json(
      { error: "Não foi possível carregar o fornecedor." },
      { status: 500 },
    );
  }
}