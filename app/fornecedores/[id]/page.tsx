"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  FileText,
  History,
  Loader2,
  Mail,
  MapPin,
  PackageSearch,
  Phone,
  RefreshCw,
  ReceiptText,
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
  whatsapp?: string | null;
  email: string | null;
  endereco: string | null;
  cidade: string | null;
  observacoes: string | null;
  observacoes_comerciais?: string | null;
  condicao_pagamento_padrao?: string | null;
  ativo: boolean;
  pedido_minimo: number | null;
  frete_gratis_minimo?: number | null;
  prazo_entrega_dias?: number | null;
  prazo_medio_dias?: number | null;
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
  if (v == null) return "—";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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
      if (!token) throw new Error("Sua sessão expirou. Entre novamente no Atlas.");
      const r = await fetch(`/api/fornecedores/360/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Não foi possível carregar.");
      setDados(j);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar o fornecedor.");
    } finally {
      setCarregando(false);
    }
  }

  const necessidadePorId = useMemo(() => {
    const m = new Map<string, Necessidade>();
    for (const n of dados?.necessidades || []) m.set(n.id, n);
    return m;
  }, [dados]);

  const cotacoesPendentes = useMemo(
    () => (dados?.cotacoes || []).filter((c) => {
      const n = necessidadePorId.get(c.necessidade_id);
      return n && n.status !== "recebido" && n.status !== "cancelado";
    }),
    [dados, necessidadePorId],
  );

  const historico = useMemo(
    () => (dados?.cotacoes || []).filter((c) => necessidadePorId.get(c.necessidade_id)?.status === "recebido"),
    [dados, necessidadePorId],
  );

  const totalPendente = useMemo(
    () => cotacoesPendentes.reduce((soma, c) => {
      const n = necessidadePorId.get(c.necessidade_id);
      return soma + c.preco_unitario * (n?.quantidade ?? 1) + (c.frete || 0);
    }, 0),
    [cotacoesPendentes, necessidadePorId],
  );

  const fornecedor = dados?.fornecedor;
  const prazo = fornecedor?.prazo_medio_dias ?? fornecedor?.prazo_entrega_dias ?? null;
  const faltaPedidoMinimo = fornecedor?.pedido_minimo != null ? fornecedor.pedido_minimo - totalPendente : null;

  if (carregando && !dados) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400"><Loader2 className="animate-spin" /></div>;
  }

  if (erro && !dados) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-slate-500">
        <p>{erro}</p>
        <Link href="/cadastro/fornecedores" className="text-brand-navy underline">Voltar para fornecedores</Link>
      </div>
    );
  }

  if (!fornecedor) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-5">
          <Link href="/cadastro/fornecedores" className="rounded-lg p-2 transition hover:bg-slate-100"><ArrowLeft size={20} /></Link>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-navy text-white"><Building2 size={22} /></div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-bold text-slate-900">{fornecedor.nome}</h1>
              <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${fornecedor.ativo ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{fornecedor.ativo ? "Ativo" : "Inativo"}</span>
            </div>
            <p className="mt-0.5 text-sm text-slate-500">Fornecedor 360 · {[fornecedor.cnpj_cpf, fornecedor.cidade].filter(Boolean).join(" • ") || "Central de relacionamento"}</p>
          </div>
          <button onClick={() => void carregar()} className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100" title="Atualizar"><RefreshCw size={18} className={carregando ? "animate-spin" : ""} /></button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        {erro && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{erro}</div>}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Resumo titulo="Pedido mínimo" valor={moeda(fornecedor.pedido_minimo)} detalhe={fornecedor.pedido_minimo != null && faltaPedidoMinimo != null && faltaPedidoMinimo > 0 ? `Falta ${moeda(faltaPedidoMinimo)}` : "Condição comercial"} />
          <Resumo titulo="Prazo médio" valor={prazo != null ? `${prazo} dia(s)` : "—"} detalhe="Entrega" />
          <Resumo titulo="Cotações abertas" valor={String(cotacoesPendentes.length)} detalhe={moeda(totalPendente)} />
          <Resumo titulo="Compras recebidas" valor={String(historico.length)} detalhe="Histórico registrado" />
          <Resumo titulo="Frete grátis" valor={moeda(fornecedor.frete_gratis_minimo)} detalhe="Valor mínimo" />
        </section>

        <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Acao href={`/fornecedores/${id}/catalogos`} icon={PackageSearch} titulo="Catálogos e produtos" texto="Subir PDFs, tabelas, fotos e vincular produtos do fornecedor." destaque />
          <Acao href="#compras" icon={ShoppingCart} titulo="Compras" texto="Consultar o que foi comprado e recebido deste fornecedor." />
          <Acao href="#cotacoes" icon={ReceiptText} titulo="Cotações" texto="Acompanhar preços, prazos, fretes e propostas em aberto." />
          <Acao href={`/fornecedores/${id}/catalogos#documentos`} icon={FileText} titulo="Documentos" texto="Catálogos e arquivos originais preservados por fornecedor." />
        </section>

        <section id="condicoes" className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center gap-2"><WalletCards size={18} className="text-brand-navy" /><h2 className="font-semibold text-slate-800">Dados e condições comerciais</h2></div>
          <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <Info icon={Phone} label="Telefone / WhatsApp" valor={fornecedor.whatsapp || fornecedor.telefone} />
            <Info icon={Mail} label="E-mail" valor={fornecedor.email} />
            <Info icon={MapPin} label="Cidade / endereço" valor={[fornecedor.cidade, fornecedor.endereco].filter(Boolean).join(" · ")} />
            <Info label="Contato" valor={fornecedor.contato} />
            <Info label="Pagamento padrão" valor={fornecedor.condicao_pagamento_padrao} />
            <Info label="Observações comerciais" valor={fornecedor.observacoes_comerciais || fornecedor.observacoes} />
          </div>
        </section>

        <section id="cotacoes" className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2"><ReceiptText size={18} className="text-brand-navy" /><h2 className="font-semibold text-slate-800">Cotações em aberto</h2></div>
            <span className="text-sm font-semibold text-slate-800">{moeda(totalPendente)}</span>
          </div>
          {cotacoesPendentes.length === 0 ? <Vazio texto="Nenhuma cotação pendente para este fornecedor." /> : <div className="space-y-2">{cotacoesPendentes.map((c) => <LinhaCotacao key={c.id} cotacao={c} necessidade={necessidadePorId.get(c.necessidade_id)} />)}</div>}
        </section>

        <section id="compras" className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center gap-2"><ShoppingCart size={18} className="text-brand-navy" /><h2 className="font-semibold text-slate-800">Compras deste fornecedor</h2></div>
          {historico.length === 0 ? <Vazio texto="Ainda não há compras recebidas deste fornecedor." /> : <div className="space-y-2">{historico.map((c) => <LinhaCotacao key={c.id} cotacao={c} necessidade={necessidadePorId.get(c.necessidade_id)} recebido />)}</div>}
        </section>

        <section id="historico" className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-center gap-2"><History size={18} className="text-brand-navy" /><h2 className="font-semibold text-slate-800">Histórico do fornecedor</h2></div>
          <p className="text-sm text-slate-500">O histórico comercial fica concentrado aqui: compras recebidas, cotações, preços, prazos e documentos. O histórico detalhado de preços por produto também será alimentado pelos catálogos e pelas compras.</p>
        </section>
      </main>
    </div>
  );
}

function Resumo({ titulo, valor, detalhe }: { titulo: string; valor: string; detalhe: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">{titulo}</p><p className="mt-1 text-lg font-bold text-slate-900">{valor}</p><p className="mt-1 text-[11px] text-slate-400">{detalhe}</p></div>;
}

function Acao({ href, icon: Icon, titulo, texto, destaque = false }: { href: string; icon: typeof Truck; titulo: string; texto: string; destaque?: boolean }) {
  return <Link href={href} className={`rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-sm ${destaque ? "border-blue-200 bg-blue-50/60" : "border-slate-200 bg-white"}`}><div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-brand-navy"><Icon size={18} /></div><p className="text-sm font-semibold text-slate-800">{titulo}</p><p className="mt-1 text-xs leading-5 text-slate-500">{texto}</p></Link>;
}

function Info({ icon: Icon, label, valor }: { icon?: typeof Phone; label: string; valor: string | null | undefined }) {
  return <div><p className="flex items-center gap-1.5 text-xs text-slate-400">{Icon && <Icon size={13} />}{label}</p><p className="mt-1 font-medium text-slate-700">{valor || "Não informado"}</p></div>;
}

function LinhaCotacao({ cotacao, necessidade, recebido = false }: { cotacao: Cotacao; necessidade?: Necessidade; recebido?: boolean }) {
  return <div className="rounded-xl border border-slate-100 p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium text-slate-800">{necessidade?.descricao || "Item"}</p><p className="font-semibold text-slate-800">{moeda(cotacao.preco_unitario)} <span className="text-xs font-normal text-slate-400">/ {necessidade?.unidade || "un"}</span></p></div><div className="mt-1 text-xs text-slate-500">{[necessidade?.quantidade ? `${necessidade.quantidade} ${necessidade.unidade}` : null, necessidade?.categoria, necessidade?.destino === "obra" ? [necessidade.cliente_nome, necessidade.obra_nome].filter(Boolean).join(" - ") : "Estoque", cotacao.prazo_dias ? `${cotacao.prazo_dias} dia(s)` : null, recebido ? "Recebido" : cotacao.selecionada ? "Selecionada" : null].filter(Boolean).join(" • ")}</div></div>;
}

function Vazio({ texto }: { texto: string }) {
  return <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">{texto}</div>;
}
