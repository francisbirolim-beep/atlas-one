import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { autenticarCompras } from "@/lib/comprasServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_VALIDOS = new Set([
  "necessidade",
  "cotacao",
  "aprovado",
  "pedido_emitido",
  "aguardando_entrega",
  "recebido",
  "cancelado",
]);

const PROXIMO_STATUS: Record<string, string> = {
  necessidade: "cotacao",
  cotacao: "aprovado",
  aprovado: "pedido_emitido",
  pedido_emitido: "aguardando_entrega",
  aguardando_entrega: "recebido",
};

function texto(valor: unknown, maximo = 500) {
  return String(valor ?? "")
    .trim()
    .slice(0, maximo);
}

function numero(valor: unknown) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

export async function GET(req: NextRequest) {
  const usuario = await autenticarCompras(req);
  if (!usuario)
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });

  try {
    const [
      necessidadesResp,
      cotacoesResp,
      produtosResp,
      fornecedoresResp,
      historicoResp,
      clientesResp,
      obrasResp,
    ] = await Promise.all([
      supabaseAdmin
        .from("compras_necessidades")
        .select("*")
        .neq("status", "cancelado")
        .order("updated_at", { ascending: false })
        .limit(500),
      supabaseAdmin
        .from("compras_cotacoes")
        .select("*")
        .order("preco_unitario", { ascending: true })
        .limit(2000),
      supabaseAdmin
        .from("produtos")
        .select("id,nome,codigo,categoria,unidade,custo,ativo")
        .eq("ativo", true)
        .order("nome")
        .limit(5000),
      supabaseAdmin
        .from("fornecedores")
        .select(
          "id,nome,cnpj_cpf,contato,telefone,email,cidade,observacoes,ativo,pedido_minimo,prazo_entrega_dias",
        )
        .eq("ativo", true)
        .order("nome")
        .limit(1000),
      supabaseAdmin
        .from("compras_nf_itens")
        .select(
          "produto_id,nf_id,valor_unitario,custo_aquisicao_unitario,created_at",
        )
        .not("produto_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(3000),
      supabaseAdmin
        .from("clientes")
        .select("id,nome,apelido,cidade")
        .order("nome")
        .limit(2000),
      supabaseAdmin
        .from("obras")
        .select("id,cliente_id,nome,status")
        .order("nome")
        .limit(4000),
    ]);

    for (const resposta of [
      necessidadesResp,
      cotacoesResp,
      produtosResp,
      fornecedoresResp,
      historicoResp,
      clientesResp,
      obrasResp,
    ]) {
      if (resposta.error) throw new Error(resposta.error.message);
    }

    const nfIds = Array.from(
      new Set(
        (historicoResp.data || []).map((item) => item.nf_id).filter(Boolean),
      ),
    );
    const { data: nfs, error: nfsError } = nfIds.length
      ? await supabaseAdmin
          .from("compras_nfs")
          .select("id,fornecedor_id,fornecedor_nome,data_emissao,data_entrada")
          .in("id", nfIds)
      : { data: [], error: null };
    if (nfsError) throw new Error(nfsError.message);

    const nfPorId = new Map((nfs || []).map((nf) => [nf.id, nf]));
    const ultimoPorProduto = new Map<string, Record<string, unknown>>();
    for (const item of historicoResp.data || []) {
      if (!item.produto_id || ultimoPorProduto.has(item.produto_id)) continue;
      const nf = nfPorId.get(item.nf_id);
      ultimoPorProduto.set(item.produto_id, {
        precoUnitario:
          item.custo_aquisicao_unitario ?? item.valor_unitario ?? null,
        fornecedorId: nf?.fornecedor_id ?? null,
        fornecedorNome: nf?.fornecedor_nome ?? null,
        data: nf?.data_emissao ?? nf?.data_entrada ?? item.created_at,
      });
    }

    return NextResponse.json({
      necessidades: necessidadesResp.data || [],
      cotacoes: cotacoesResp.data || [],
      produtos: produtosResp.data || [],
      fornecedores: fornecedoresResp.data || [],
      ultimoPrecoPorProduto: Object.fromEntries(ultimoPorProduto),
      clientes: clientesResp.data || [],
      obras: obrasResp.data || [],
    });
  } catch (error) {
    console.error("Erro ao carregar Compras 360:", error);
    return NextResponse.json(
      { error: "Não foi possível carregar o Compras 360." },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const usuario = await autenticarCompras(req);
  if (!usuario)
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });

  try {
    const body = await req.json();
    const acao = texto(body.acao, 50);

    if (acao === "criar_necessidade") {
      const descricao = texto(body.descricao, 300);
      const quantidade = numero(body.quantidade);
      if (!descricao || quantidade === null || quantidade <= 0) {
        return NextResponse.json(
          { error: "Informe o material e uma quantidade válida." },
          { status: 400 },
        );
      }

      const destino = body.destino === "obra" ? "obra" : "estoque";
      const clienteId = destino === "obra" ? texto(body.cliente_id, 80) : "";
      const obraId = destino === "obra" ? texto(body.obra_id, 80) : "";
      if (destino === "obra" && (!clienteId || !obraId)) {
        return NextResponse.json(
          { error: "Selecione o cliente e a obra, ou marque Estoque." },
          { status: 400 },
        );
      }

      let clienteNome: string | null = null;
      let obraNome: string | null = null;
      if (destino === "obra") {
        const [{ data: cliente }, { data: obra }] = await Promise.all([
          supabaseAdmin
            .from("clientes")
            .select("id,nome")
            .eq("id", clienteId)
            .maybeSingle(),
          supabaseAdmin
            .from("obras")
            .select("id,nome,cliente_id")
            .eq("id", obraId)
            .maybeSingle(),
        ]);
        if (!cliente || !obra || obra.cliente_id !== clienteId) {
          return NextResponse.json(
            { error: "Cliente ou obra inválidos." },
            { status: 400 },
          );
        }
        clienteNome = cliente.nome;
        obraNome = obra.nome;
      }

      const { data, error } = await supabaseAdmin
        .from("compras_necessidades")
        .insert({
          produto_id: body.produto_id || null,
          descricao,
          categoria: texto(body.categoria, 80) || null,
          quantidade,
          unidade: texto(body.unidade, 20) || "UN",
          prioridade: ["baixa", "normal", "alta", "urgente"].includes(
            body.prioridade,
          )
            ? body.prioridade
            : "normal",
          data_limite: body.data_limite || null,
          destino,
          cliente_id: destino === "obra" ? clienteId : null,
          cliente_nome: clienteNome,
          obra_id: destino === "obra" ? obraId : null,
          obra_nome: obraNome,
          obra_referencia:
            destino === "obra"
              ? obraNome
              : texto(body.obra_referencia, 160) || null,
          observacoes: texto(body.observacoes, 1000) || null,
          criado_por_id: usuario.id,
          criado_por_nome: usuario.nome,
          responsavel_id: usuario.id,
          responsavel_nome: usuario.nome,
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return NextResponse.json({ necessidade: data }, { status: 201 });
    }

    if (acao === "convidar_fornecedores") {
      const necessidadeId = texto(body.necessidade_id, 80);
      const fornecedorIds = Array.isArray(body.fornecedor_ids)
        ? Array.from(
            new Set(
              body.fornecedor_ids
                .map((id: unknown) => texto(id, 80))
                .filter(Boolean),
            ),
          )
        : [];
      if (!necessidadeId || !fornecedorIds.length) {
        return NextResponse.json(
          { error: "Selecione ao menos um fornecedor para cotar." },
          { status: 400 },
        );
      }

      const { data: necessidade, error: necessidadeError } = await supabaseAdmin
        .from("compras_necessidades")
        .select("id,status")
        .eq("id", necessidadeId)
        .maybeSingle();
      if (necessidadeError) throw new Error(necessidadeError.message);
      if (!necessidade) {
        return NextResponse.json(
          { error: "Necessidade de compra não encontrada." },
          { status: 404 },
        );
      }

      const linhas = fornecedorIds.map((fornecedorId) => ({
        necessidade_id: necessidadeId,
        fornecedor_id: fornecedorId,
        preco_unitario: null,
        frete: 0,
        criado_por_id: usuario.id,
        criado_por_nome: usuario.nome,
      }));
      const { error: cotacoesError } = await supabaseAdmin
        .from("compras_cotacoes")
        .upsert(linhas, {
          onConflict: "necessidade_id,fornecedor_id",
          ignoreDuplicates: true,
        });
      if (cotacoesError) throw new Error(cotacoesError.message);

      if (necessidade.status === "necessidade") {
        const { error: statusError } = await supabaseAdmin
          .from("compras_necessidades")
          .update({ status: "cotacao", updated_at: new Date().toISOString() })
          .eq("id", necessidadeId)
          .eq("status", "necessidade");
        if (statusError) throw new Error(statusError.message);
      }

      const { data: cotacoesAtuais, error: listaError } = await supabaseAdmin
        .from("compras_cotacoes")
        .select("*")
        .eq("necessidade_id", necessidadeId);
      if (listaError) throw new Error(listaError.message);

      return NextResponse.json({ cotacoes: cotacoesAtuais || [] });
    }

    if (acao === "adicionar_cotacao") {
      const preco = numero(body.preco_unitario);
      if (
        !body.necessidade_id ||
        !body.fornecedor_id ||
        preco === null ||
        preco < 0
      ) {
        return NextResponse.json(
          { error: "Informe fornecedor e preço válido." },
          { status: 400 },
        );
      }
      const { data, error } = await supabaseAdmin
        .from("compras_cotacoes")
        .upsert(
          {
            necessidade_id: body.necessidade_id,
            fornecedor_id: body.fornecedor_id,
            preco_unitario: preco,
            frete: Math.max(0, numero(body.frete) || 0),
            prazo_dias: numero(body.prazo_dias),
            previsao_entrega: body.previsao_entrega || null,
            validade: body.validade || null,
            forma_pagamento: texto(body.forma_pagamento, 200) || null,
            observacoes: texto(body.observacoes, 1000) || null,
            criado_por_id: usuario.id,
            criado_por_nome: usuario.nome,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "necessidade_id,fornecedor_id" },
        )
        .select("*")
        .single();
      if (error) throw new Error(error.message);

      await supabaseAdmin
        .from("compras_necessidades")
        .update({
          status: "cotacao",
          updated_at: new Date().toISOString(),
        })
        .eq("id", body.necessidade_id)
        .eq("status", "necessidade");

      return NextResponse.json({ cotacao: data });
    }

    if (acao === "selecionar_cotacao") {
      const necessidadeId = texto(body.necessidade_id, 80);
      const cotacaoId = texto(body.cotacao_id, 80);
      if (!necessidadeId || !cotacaoId) {
        return NextResponse.json(
          { error: "Informe a necessidade e a cotação." },
          { status: 400 },
        );
      }

      const { data: cotacao, error: cotacaoError } = await supabaseAdmin
        .from("compras_cotacoes")
        .select("id,necessidade_id")
        .eq("id", cotacaoId)
        .eq("necessidade_id", necessidadeId)
        .maybeSingle();
      if (cotacaoError) throw new Error(cotacaoError.message);
      if (!cotacao) {
        return NextResponse.json(
          { error: "Cotação não encontrada para esta necessidade." },
          { status: 404 },
        );
      }

      const { error: limparError } = await supabaseAdmin
        .from("compras_cotacoes")
        .update({ selecionada: false, updated_at: new Date().toISOString() })
        .eq("necessidade_id", necessidadeId);
      if (limparError) throw new Error(limparError.message);

      const { data, error } = await supabaseAdmin
        .from("compras_cotacoes")
        .update({ selecionada: true, updated_at: new Date().toISOString() })
        .eq("id", cotacaoId)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return NextResponse.json({ cotacao: data });
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (error) {
    console.error("Erro ao salvar Compras 360:", error);
    return NextResponse.json(
      { error: "Não foi possível salvar a informação de compra." },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  const usuario = await autenticarCompras(req);
  if (!usuario)
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });

  try {
    const body = await req.json();
    const status = texto(body.status, 40);
    if (!body.id || !STATUS_VALIDOS.has(status)) {
      return NextResponse.json(
        { error: "Necessidade ou situação inválida." },
        { status: 400 },
      );
    }

    const { data: atual, error: atualError } = await supabaseAdmin
      .from("compras_necessidades")
      .select("id,status")
      .eq("id", body.id)
      .maybeSingle();
    if (atualError) throw new Error(atualError.message);
    if (!atual) {
      return NextResponse.json(
        { error: "Necessidade de compra não encontrada." },
        { status: 404 },
      );
    }
    if (status !== "cancelado" && PROXIMO_STATUS[atual.status] !== status) {
      return NextResponse.json(
        { error: "Avance a compra seguindo a ordem do processo." },
        { status: 409 },
      );
    }
    if (status === "aprovado") {
      const { data: cotacaoSelecionada, error: cotacaoError } =
        await supabaseAdmin
          .from("compras_cotacoes")
          .select("id")
          .eq("necessidade_id", body.id)
          .eq("selecionada", true)
          .maybeSingle();
      if (cotacaoError) throw new Error(cotacaoError.message);
      if (!cotacaoSelecionada) {
        return NextResponse.json(
          { error: "Selecione a cotação vencedora antes de aprovar a compra." },
          { status: 409 },
        );
      }
    }
    const agora = new Date().toISOString();
    const atualizacao: Record<string, unknown> = { status, updated_at: agora };
    if (status === "recebido") atualizacao.recebido_em = agora;
    if (status === "cancelado") atualizacao.cancelado_em = agora;

    const { data, error } = await supabaseAdmin
      .from("compras_necessidades")
      .update(atualizacao)
      .eq("id", body.id)
      .eq("status", atual.status)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ necessidade: data });
  } catch (error) {
    console.error("Erro ao movimentar necessidade de compra:", error);
    return NextResponse.json(
      { error: "Não foi possível atualizar a situação da compra." },
      { status: 500 },
    );
  }
}
