"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  ShoppingCart,
  Truck,
  WalletCards,
} from "lucide-react";
import { tokenAtual } from "@/lib/auth";

type Fornecedor = {
  id: string;
  nome: string;
  cnpj_cpf: string | null;
  contato: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  cidade: string | null;
  observacoes: string | null;
  ativo: boolean;
  pedido_minimo: number | null;
  prazo_entrega_dias: number | null;
};

type Cotacao = {
  id: string;
  necessidade_id: string;
  preco_unitario: number;
  frete: number | null;
  prazo_dias: number | null;
  previsao_entrega: string | null;
  validade: string | null;
  forma_pagamento: string | null;
  observacoes: string | null;
  selecionada: boolean;
  created_at: string;
};

type Necessidade = {
  id: string;
  status: string;
  descricao: string;
  categoria: string | null;
  quantidade: number;
  unidade: string;
  destino: "obra" | "estoque" | null;
  cliente_nome: string | null;
  obra_nome: string | null;
  updated_at: string;
};

type Dados = {
  fornecedor: Fornecedor;
  cotacoes: Cotacao[];
  necessidades: Necessidade[];
};

function moeda(v: number | null | undefined) {
  return (v ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function FornecedorPagina() {
  const params = useParams();
  const id = String(params?.id || "");
  const [dados, setDados] = useState<Dados | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (id) void carregar();
  }, [id]);

  async function carregar() {
    setCarregando(true);
    setErro("");
    try {
      const token = await tokenAtual();
      if (!token)
        throw new Error("Sua sessão expirou. Entre novamente no Atlas.");
      const r = await fetch(`/api/fornecedores/360/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Não foi possível carregar.");
      setDados(j);
    } catch (e) {
      setErro(
        e instanceof Error ? e.message : "Erro ao carregar o fornecedor.",
      );
    } finally {
      setCarregando(false);
    }
  }

  const necessidadePorId = useMemo(() => {
    const m = new Map<string, Necessidade>();
    for (const n of dados?.necessidades || []) m.set(n.id, n);
    return m;
  }, [dados]);

  const cotacoesPendentes = useMemo(() => {
    return (dados?.cotacoes || []).filter((c) => {
      const n = necessidadePorId.get(c.necessidade_id);
      return n && n.status !== "recebido" && n.status !== "cancelado";
    });
  }, [dados, necessidadePorId]);

  const historico = useMemo(() => {
    return (dados?.cotacoes || []).filter((c) => {
      const n = necessidadePorId.get(c.necessidade_id);
      return n && n.status === "recebido";
    });
  }, [dados, necessidadePorId]);

  const totalPendente = useMemo(() => {
    return cotacoesPendentes.reduce((soma, c) => {
      const n = necessidadePorId.get(c.necessidade_id);
      const qtd = n?.quantidade ?? 1;
      return soma + c.preco_unitario * qtd;
    }, 0);
  }, [cotacoesPendentes, necessidadePorId]);

  const fornecedor = dados?.fornecedor;
  const faltaPedidoMinimo =
    fornecedor?.pedido_minimo != null
      ? fornecedor.pedido_minimo - totalPendente
      : null;

  if (carregando && !dados) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (erro && !dados) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-slate-500">
        <p>{erro}</p>
        <Link href="/cadastro/fornecedores" className="text-brand-navy underline">
          Voltar para fornecedores
        </Link>
      </div>
    );
  }

  if (!fornecedor) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link
            href="/cadastro/fornecedores"
            className="p-2 hover:bg-slate-100 rounded-lg transition"
          >
            <ArrowLeft size={20} />
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-slate-800">
              {fornecedor.nome}
            </h1>
            <p className="text-sm text-slate-500">
              {[fornecedor.cnpj_cpf, fornecedor.contato, fornecedor.cidade]
                .filter(Boolean)
                .join(" • ") || "Fornecedor"}
            </p>
          </div>
          <button
            onClick={() => void carregar()}
            className="p-2 hover:bg-slate-100 rounded-lg transition text-slate-500"
            title="Atualizar"
          >
            <RefreshCw size={18} className={carregando ? "animate-spin" : ""} />
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {erro && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {erro}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {fornecedor.telefone && (
              <div className="flex items-center gap-2 text-slate-600">
                <Phone size={14} className="text-slate-400" />
                {fornecedor.telefone}
              </div>
            )}
            {fornecedor.email && (
              <div className="flex items-center gap-2 text-slate-600">
                <Mail size={14} className="text-slate-400" />
                {fornecedor.email}
              </div>
            )}
            {fornecedor.endereco && (
              <div className="flex items-center gap-2 text-slate-600 sm:col-span-2">
                <MapPin size={14} className="text-slate-400" />
                {fornecedor.endereco}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Pedido mínimo</p>
              <p className="text-sm font-semibold text-slate-800">
                {fornecedor.pedido_minimo != null
                  ? moeda(fornecedor.pedido_minimo)
                  : "Não definido"}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Prazo de entrega</p>
              <p className="text-sm font-semibold text-slate-800">
                {fornecedor.prazo_entrega_dias != null
                  ? `${fornecedor.prazo_entrega_dias} dia(s)`
                  : "Não definido"}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <ShoppingCart size={16} className="text-brand-navy" />
              Cotações pendentes
            </h2>
            <span className="text-sm font-semibold text-slate-800">
              {moeda(totalPendente)}
            </span>
          </div>

          {fornecedor.pedido_minimo != null && (
            <div
              className={`rounded-xl p-3 text-xs ${
                faltaPedidoMinimo != null && faltaPedidoMinimo > 0
                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <WalletCards size={14} />
                {faltaPedidoMinimo != null && faltaPedidoMinimo > 0
                  ? `Falta ${moeda(faltaPedidoMinimo)} para atingir o pedido mínimo.`
                  : "Pedido mínimo já atingido com as cotações pendentes."}
              </div>
            </div>
          )}

          {cotacoesPendentes.length === 0 ? (
            <p className="text-sm text-slate-400">
              Nenhuma cotação pendente para este fornecedor.
            </p>
          ) : (
            <div className="space-y-2">
              {cotacoesPendentes.map((c) => {
                const n = necessidadePorId.get(c.necessidade_id);
                return (
                  <div
                    key={c.id}
                    className="rounded-xl border border-slate-200 p-3 text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-slate-800">
                        {n?.descricao || "Item"}
                      </p>
                      <p className="font-semibold text-slate-800">
                        {moeda(c.preco_unitario)}
                        <span className="text-xs text-slate-400 font-normal">
                          {" "}
                          / {n?.unidade || "un"}
                        </span>
                      </p>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {[
                        n?.quantidade ? `${n.quantidade} ${n.unidade}` : null,
                        n?.destino === "obra"
                          ? [n.cliente_nome, n.obra_nome]
                              .filter(Boolean)
                              .join(" - ")
                          : "Estoque",
                        c.prazo_dias ? `${c.prazo_dias} dia(s)` : null,
                        c.selecionada ? "Selecionada" : null,
                      ]
                        .filter(Boolean)
                        .join(" • ")}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Truck size={16} className="text-brand-navy" />
            Histórico de compras
          </h2>

          {historico.length === 0 ? (
            <p className="text-sm text-slate-400">
              Ainda não há compras recebidas deste fornecedor.
            </p>
          ) : (
            <div className="space-y-2">
              {historico.map((c) => {
                const n = necessidadePorId.get(c.necessidade_id);
                return (
                  <div
                    key={c.id}
                    className="rounded-xl border border-slate-100 p-3 text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-slate-800">
                        {n?.descricao || "Item"}
                      </p>
                      <p className="font-semibold text-slate-800">
                        {moeda(c.preco_unitario)}
                      </p>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {[
                        n?.categoria,
                        new Date(n?.updated_at || c.created_at).toLocaleDateString(
                          "pt-BR",
                        ),
                      ]
                        .filter(Boolean)
                        .join(" • ")}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
