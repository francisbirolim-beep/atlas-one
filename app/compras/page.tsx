"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileClock,
  Link2,
  Loader2,
  PackageCheck,
  Plus,
  ReceiptText,
  RefreshCw,
  ShoppingCart,
  Truck,
  WalletCards,
  X,
} from "lucide-react";
import { tokenAtual } from "@/lib/auth";
import BuscaAtlasInput from "@/components/system/BuscaAtlasInput";
import { correspondeBuscaAtlas } from "@/lib/buscaAtlas";

type StatusCompra =
  | "necessidade"
  | "cotacao"
  | "aprovado"
  | "pedido_emitido"
  | "aguardando_entrega"
  | "recebido"
  | "cancelado";
type FiltroCategoriaProduto =
  | "todos"
  | "perfil"
  | "acessorio"
  | "vidro"
  | "produto_pronto"
  | "outros";
type Necessidade = {
  id: string;
  status: StatusCompra;
  produto_id: string | null;
  descricao: string;
  categoria: string | null;
  quantidade: number;
  unidade: string;
  prioridade: "baixa" | "normal" | "alta" | "urgente";
  data_limite: string | null;
  obra_referencia: string | null;
  observacoes: string | null;
  criado_por_nome: string | null;
  updated_at: string;
};
type Cotacao = {
  id: string;
  necessidade_id: string;
  fornecedor_id: string;
  preco_unitario: number;
  frete: number;
  prazo_dias: number | null;
  previsao_entrega: string | null;
  validade: string | null;
  forma_pagamento: string | null;
  observacoes: string | null;
  selecionada: boolean;
};
type Produto = {
  id: string;
  nome: string;
  codigo: string | null;
  categoria: string | null;
  unidade: string | null;
  custo: number | null;
};
type Fornecedor = {
  id: string;
  nome: string;
  cnpj_cpf: string | null;
  contato: string | null;
  telefone: string | null;
  email: string | null;
  cidade: string | null;
  observacoes: string | null;
};
type UltimoPreco = {
  precoUnitario: number | null;
  fornecedorId: string | null;
  fornecedorNome: string | null;
  data: string | null;
};
type Dados = {
  necessidades: Necessidade[];
  cotacoes: Cotacao[];
  produtos: Produto[];
  fornecedores: Fornecedor[];
  ultimoPrecoPorProduto: Record<string, UltimoPreco>;
};

const COLUNAS: {
  id: string;
  titulo: string;
  descricao: string;
  status: StatusCompra[];
  cor: string;
}[] = [
  {
    id: "faltas",
    titulo: "Lista de faltas",
    descricao: "O que precisa comprar",
    status: ["necessidade"],
    cor: "border-slate-300",
  },
  {
    id: "cotacao",
    titulo: "Em cotação",
    descricao: "Comparando fornecedores",
    status: ["cotacao"],
    cor: "border-blue-300",
  },
  {
    id: "pedido",
    titulo: "Compra aprovada",
    descricao: "Aprovar e emitir pedido",
    status: ["aprovado", "pedido_emitido"],
    cor: "border-violet-300",
  },
  {
    id: "entrega",
    titulo: "Aguardando chegar",
    descricao: "Pedido com fornecedor",
    status: ["aguardando_entrega"],
    cor: "border-amber-300",
  },
  {
    id: "recebido",
    titulo: "Recebido",
    descricao: "Pronto para entrada por NF",
    status: ["recebido"],
    cor: "border-emerald-300",
  },
];
const PROXIMO: Partial<
  Record<StatusCompra, { status: StatusCompra; label: string }>
> = {
  necessidade: { status: "cotacao", label: "Iniciar cotação" },
  cotacao: { status: "aprovado", label: "Aprovar compra" },
  aprovado: { status: "pedido_emitido", label: "Pedido emitido" },
  pedido_emitido: { status: "aguardando_entrega", label: "Aguardar entrega" },
  aguardando_entrega: { status: "recebido", label: "Marcar recebido" },
};
const vazio = {
  produto_id: "",
  descricao: "",
  categoria: "",
  quantidade: "1",
  unidade: "UN",
  prioridade: "normal",
  data_limite: "",
  obra_referencia: "",
  observacoes: "",
};
const cotacaoVazia = {
  fornecedor_id: "",
  preco_unitario: "",
  frete: "0",
  prazo_dias: "",
  previsao_entrega: "",
  validade: "",
  forma_pagamento: "",
  observacoes: "",
};
const FILTROS_CATEGORIA_PRODUTO: {
  id: FiltroCategoriaProduto;
  label: string;
}[] = [
  { id: "todos", label: "Todos" },
  { id: "perfil", label: "Perfis" },
  { id: "acessorio", label: "Acessórios" },
  { id: "vidro", label: "Vidros" },
  { id: "produto_pronto", label: "Produto pronto" },
  { id: "outros", label: "Outros" },
];

function grupoCategoriaProduto(categoria: string | null): FiltroCategoriaProduto {
  const valor = (categoria || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

  if (valor.includes("perfil")) return "perfil";
  if (valor.includes("acessor")) return "acessorio";
  if (valor.includes("vidro")) return "vidro";
  if (
    valor === "produto" ||
    valor === "pu" ||
    valor.includes("produto pronto")
  ) {
    return "produto_pronto";
  }
  return "outros";
}

function moeda(v: number | null | undefined) {
  return v === null || v === undefined
    ? "—"
    : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function dataBr(v: string | null | undefined) {
  if (!v) return "—";
  return v.split("T")[0].split("-").reverse().join("/");
}

export default function ComprasPage() {
  const [dados, setDados] = useState<Dados | null>(null),
    [erro, setErro] = useState(""),
    [carregando, setCarregando] = useState(true),
    [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState(""),
    [novaAberta, setNovaAberta] = useState(false),
    [form, setForm] = useState(vazio),
    [filtroCategoriaProduto, setFiltroCategoriaProduto] =
      useState<FiltroCategoriaProduto>("todos"),
    [selecionadaId, setSelecionadaId] = useState<string | null>(null),
    [formCotacao, setFormCotacao] = useState(cotacaoVazia);
  useEffect(() => {
    void carregar();
  }, []);
  async function requisicao(url: string, init?: RequestInit) {
    const token = await tokenAtual();
    if (!token)
      throw new Error("Sua sessão expirou. Entre novamente no Atlas.");
    const r = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...init?.headers,
      },
      cache: "no-store",
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok)
      throw new Error(j.error || "Não foi possível concluir a operação.");
    return j;
  }
  async function carregar() {
    setCarregando(true);
    setErro("");
    try {
      setDados(await requisicao("/api/compras/360"));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar Compras 360.");
    } finally {
      setCarregando(false);
    }
  }
  const necessidades = useMemo(() => {
    const lista = dados?.necessidades || [];
    return busca.trim()
      ? lista.filter((n) =>
          correspondeBuscaAtlas(
            busca,
            n.descricao,
            n.categoria,
            n.obra_referencia,
            n.observacoes,
            n.criado_por_nome,
            n.status,
          ),
        )
      : lista;
  }, [dados, busca]);
  const selecionada =
    dados?.necessidades.find((n) => n.id === selecionadaId) || null;
  const produtosFiltrados = useMemo(
    () =>
      (dados?.produtos || []).filter(
        (p) =>
          filtroCategoriaProduto === "todos" ||
          grupoCategoriaProduto(p.categoria) === filtroCategoriaProduto,
      ),
    [dados?.produtos, filtroCategoriaProduto],
  );
  const cotacoesSelecionadas = (dados?.cotacoes || [])
    .filter((c) => c.necessidade_id === selecionadaId)
    .sort(
      (a, b) =>
        a.preco_unitario * (selecionada?.quantidade || 0) +
        a.frete -
        (b.preco_unitario * (selecionada?.quantidade || 0) + b.frete),
    );
  const fornecedor = (id: string) =>
    dados?.fornecedores.find((f) => f.id === id);
  const produto = (id: string | null) =>
    dados?.produtos.find((p) => p.id === id);
  function selecionarProduto(id: string) {
    const p = produto(id);
    setForm((v) => ({
      ...v,
      produto_id: id,
      descricao: p?.nome || v.descricao,
      categoria: p?.categoria || "",
      unidade: p?.unidade || "UN",
    }));
  }
  function alterarFiltroCategoriaProduto(filtro: FiltroCategoriaProduto) {
    setFiltroCategoriaProduto(filtro);
    const produtoSelecionado = produto(form.produto_id || null);
    if (
      produtoSelecionado &&
      filtro !== "todos" &&
      grupoCategoriaProduto(produtoSelecionado.categoria) !== filtro
    ) {
      setForm((v) => ({ ...v, produto_id: "" }));
    }
  }
  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro("");
    try {
      await requisicao("/api/compras/360", {
        method: "POST",
        body: JSON.stringify({
          acao: "criar_necessidade",
          ...form,
          quantidade: Number(form.quantidade),
        }),
      });
      setForm(vazio);
      setNovaAberta(false);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar necessidade.");
    } finally {
      setSalvando(false);
    }
  }
  async function movimentar(id: string, status: StatusCompra) {
    setSalvando(true);
    setErro("");
    try {
      await requisicao("/api/compras/360", {
        method: "PATCH",
        body: JSON.stringify({ id, status }),
      });
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao atualizar compra.");
    } finally {
      setSalvando(false);
    }
  }
  async function adicionarCotacao(e: React.FormEvent) {
    e.preventDefault();
    if (!selecionada) return;
    setSalvando(true);
    setErro("");
    try {
      await requisicao("/api/compras/360", {
        method: "POST",
        body: JSON.stringify({
          acao: "adicionar_cotacao",
          necessidade_id: selecionada.id,
          ...formCotacao,
          preco_unitario: Number(formCotacao.preco_unitario),
          frete: Number(formCotacao.frete || 0),
          prazo_dias: formCotacao.prazo_dias
            ? Number(formCotacao.prazo_dias)
            : null,
        }),
      });
      setFormCotacao(cotacaoVazia);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar cotação.");
    } finally {
      setSalvando(false);
    }
  }
  async function selecionarCotacao(cotacaoId: string) {
    if (!selecionada) return;
    setSalvando(true);
    setErro("");
    try {
      await requisicao("/api/compras/360", {
        method: "POST",
        body: JSON.stringify({
          acao: "selecionar_cotacao",
          necessidade_id: selecionada.id,
          cotacao_id: cotacaoId,
        }),
      });
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao escolher a cotação.");
    } finally {
      setSalvando(false);
    }
  }
  const abertos = (dados?.necessidades || []).filter(
    (n) => !["recebido", "cancelado"].includes(n.status),
  ).length;
  const emCotacao = (dados?.necessidades || []).filter(
    (n) => n.status === "cotacao",
  ).length;
  const aguardando = (dados?.necessidades || []).filter(
    (n) => n.status === "aguardando_entrega",
  ).length;
  return (
    <main className="min-h-screen w-full min-w-0 overflow-x-hidden bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto w-full min-w-0 max-w-[1600px] space-y-5">
        <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[.14em] text-emerald-600">
              Operações • Setor 360
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">
              Compras 360
            </h1>
            <p className="mt-1 max-w-3xl break-words text-sm text-slate-600">
              Da necessidade à cotação, pedido, entrega e entrada no estoque —
              usando produtos, fornecedores e históricos reais do Atlas.
            </p>
          </div>
          <div className="flex min-w-0 flex-wrap gap-2">
            <Link
              href="/cadastro/fornecedores"
              className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
            >
              <Truck size={16} />
              Fornecedores
            </Link>
            <Link
              href="/compras/entrada"
              className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
            >
              <ReceiptText size={16} />
              Entrada por NF
            </Link>
            <button
              onClick={() => setNovaAberta(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm"
            >
              <Plus size={17} />
              Adicionar necessidade
            </button>
          </div>
        </header>
        {erro && (
          <div className="flex items-start justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <span>{erro}</span>
            <button onClick={() => setErro("")}>
              <X size={16} />
            </button>
          </div>
        )}
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Indicador
            label="Compras em aberto"
            valor={abertos}
            icon={<ClipboardList size={20} />}
          />
          <Indicador
            label="Em cotação"
            valor={emCotacao}
            icon={<ShoppingCart size={20} />}
          />
          <Indicador
            label="Aguardando entrega"
            valor={aguardando}
            icon={<CalendarClock size={20} />}
            destaque={aguardando > 0}
          />
          <Indicador
            label="Cotações registradas"
            valor={dados?.cotacoes.length || 0}
            icon={<WalletCards size={20} />}
          />
        </section>
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Atalho
            href="/compras/vinculos"
            icon={<Link2 size={18} />}
            label="Itens sem vínculo"
          />
          <Atalho
            href="/compras/notas"
            icon={<PackageCheck size={18} />}
            label="Recebimentos e NFs"
          />
          <Atalho href="/estoque" icon={<Boxes size={18} />} label="Estoque" />
          <Atalho
            href="/financeiro/contas-pagar"
            icon={<WalletCards size={18} />}
            label="Contas a pagar"
          />
        </section>
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row">
            <BuscaAtlasInput
              value={busca}
              onValueChange={setBusca}
              placeholder="Buscar material, obra, categoria, responsável ou situação..."
              containerClassName="min-w-0 flex-1"
              inputClassName="w-full rounded-xl border border-slate-200 py-2.5 pr-3 text-sm"
            />
            <button
              onClick={() => void carregar()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm text-slate-600"
            >
              <RefreshCw size={15} />
              Atualizar
            </button>
          </div>
        </div>
        {carregando ? (
          <div className="grid min-h-72 place-items-center text-slate-400">
            <span className="flex items-center gap-2">
              <Loader2 className="animate-spin" size={18} />
              Carregando compras...
            </span>
          </div>
        ) : (
          <section className="grid items-start gap-4 xl:grid-cols-5">
            {COLUNAS.map((coluna) => {
              const itens = necessidades.filter((n) =>
                coluna.status.includes(n.status),
              );
              return (
                <div
                  key={coluna.id}
                  className={`rounded-2xl border-t-4 bg-slate-100/70 p-3 ${coluna.cor}`}
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">
                        {coluna.titulo}
                      </h2>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {coluna.descricao}
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-slate-600">
                      {itens.length}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {itens.map((n) => (
                      <Card
                        key={n.id}
                        n={n}
                        produto={produto(n.produto_id)}
                        cotacoes={(dados?.cotacoes || []).filter(
                          (c) => c.necessidade_id === n.id,
                        )}
                        onAbrir={() => setSelecionadaId(n.id)}
                        onAvancar={(s) => void movimentar(n.id, s)}
                        salvando={salvando}
                      />
                    ))}
                    {!itens.length && (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-white/70 px-3 py-8 text-center text-xs text-slate-400">
                        Nenhum item
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        )}
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <strong>Regra preservada:</strong> marcar como recebido não aumenta o
          estoque. A entrada oficial continua pela conferência da NF, evitando
          saldo e custo incorretos.
        </div>
      </div>
      {novaAberta && (
        <Modal
          titulo="Adicionar à lista de faltas"
          onFechar={() => setNovaAberta(false)}
        >
          <form onSubmit={criar} className="space-y-4">
            <div>
              <p className="text-xs font-medium text-slate-600">
                Filtrar produtos cadastrados
              </p>
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                {FILTROS_CATEGORIA_PRODUTO.map((filtro) => {
                  const ativo = filtroCategoriaProduto === filtro.id;
                  return (
                    <button
                      key={filtro.id}
                      type="button"
                      onClick={() => alterarFiltroCategoriaProduto(filtro.id)}
                      className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                        ativo
                          ? "bg-blue-600 text-white"
                          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {filtro.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <label className="block text-xs font-medium text-slate-600">
              Produto cadastrado (opcional)
              <select
                value={form.produto_id}
                onChange={(e) => selecionarProduto(e.target.value)}
                className="mt-1 w-full rounded-xl border p-3 text-sm"
              >
                <option value="">Digitar material manualmente</option>
                {produtosFiltrados.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.codigo ? `${p.codigo} — ` : ""}
                    {p.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-slate-600">
              Material / necessidade *
              <input
                required
                value={form.descricao}
                onChange={(e) =>
                  setForm((v) => ({ ...v, descricao: e.target.value }))
                }
                className="mt-1 w-full rounded-xl border p-3 text-sm"
                placeholder="Ex.: Roldana RPCS100"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <Campo
                label="Quantidade *"
                type="number"
                value={form.quantidade}
                onChange={(v) => setForm((f) => ({ ...f, quantidade: v }))}
              />
              <Campo
                label="Unidade"
                value={form.unidade}
                onChange={(v) => setForm((f) => ({ ...f, unidade: v }))}
              />
              <label className="text-xs font-medium text-slate-600">
                Prioridade
                <select
                  value={form.prioridade}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, prioridade: e.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border p-3 text-sm"
                >
                  <option value="baixa">Baixa</option>
                  <option value="normal">Normal</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo
                label="Precisa até"
                type="date"
                value={form.data_limite}
                onChange={(v) => setForm((f) => ({ ...f, data_limite: v }))}
              />
              <Campo
                label="Obra / referência"
                value={form.obra_referencia}
                onChange={(v) => setForm((f) => ({ ...f, obra_referencia: v }))}
              />
            </div>
            <label className="block text-xs font-medium text-slate-600">
              Observações
              <textarea
                value={form.observacoes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, observacoes: e.target.value }))
                }
                rows={3}
                className="mt-1 w-full rounded-xl border p-3 text-sm"
              />
            </label>
            <button
              disabled={salvando}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {salvando ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <Plus size={17} />
              )}
              Adicionar à lista
            </button>
          </form>
        </Modal>
      )}
      {selecionada && (
        <Modal
          titulo={selecionada.descricao}
          onFechar={() => setSelecionadaId(null)}
          largo
        >
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <Info
                label="Necessidade"
                valor={`${selecionada.quantidade} ${selecionada.unidade}`}
              />
              <Info
                label="Obra / referência"
                valor={selecionada.obra_referencia || "Sem vínculo"}
              />
              <Info
                label="Precisa até"
                valor={dataBr(selecionada.data_limite)}
              />
            </div>
            {selecionada.produto_id &&
              dados?.ultimoPrecoPorProduto[selecionada.produto_id] && (
                <Historico
                  ultimo={dados.ultimoPrecoPorProduto[selecionada.produto_id]}
                />
              )}
            <TabelaCotacoes
              cotacoes={cotacoesSelecionadas}
              quantidade={selecionada.quantidade}
              fornecedor={fornecedor}
              onSelecionar={(id) => void selecionarCotacao(id)}
              salvando={salvando}
            />
            <form
              onSubmit={adicionarCotacao}
              className="rounded-2xl border border-blue-200 bg-blue-50 p-4"
            >
              <h3 className="font-semibold text-blue-950">
                Adicionar ou atualizar cotação
              </h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="text-xs font-medium text-blue-900">
                  Fornecedor *
                  <select
                    required
                    value={formCotacao.fornecedor_id}
                    onChange={(e) =>
                      setFormCotacao((v) => ({
                        ...v,
                        fornecedor_id: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border bg-white p-2.5 text-sm"
                  >
                    <option value="">Selecionar</option>
                    {dados?.fornecedores.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <Campo
                  label="Preço unitário *"
                  type="number"
                  value={formCotacao.preco_unitario}
                  onChange={(v) =>
                    setFormCotacao((f) => ({ ...f, preco_unitario: v }))
                  }
                />
                <Campo
                  label="Frete"
                  type="number"
                  value={formCotacao.frete}
                  onChange={(v) => setFormCotacao((f) => ({ ...f, frete: v }))}
                />
                <Campo
                  label="Prazo em dias"
                  type="number"
                  value={formCotacao.prazo_dias}
                  onChange={(v) =>
                    setFormCotacao((f) => ({ ...f, prazo_dias: v }))
                  }
                />
                <Campo
                  label="Previsão de entrega"
                  type="date"
                  value={formCotacao.previsao_entrega}
                  onChange={(v) =>
                    setFormCotacao((f) => ({ ...f, previsao_entrega: v }))
                  }
                />
                <Campo
                  label="Validade"
                  type="date"
                  value={formCotacao.validade}
                  onChange={(v) =>
                    setFormCotacao((f) => ({ ...f, validade: v }))
                  }
                />
                <div className="lg:col-span-2">
                  <Campo
                    label="Forma de pagamento"
                    value={formCotacao.forma_pagamento}
                    onChange={(v) =>
                      setFormCotacao((f) => ({ ...f, forma_pagamento: v }))
                    }
                  />
                </div>
              </div>
              <button
                disabled={salvando}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {salvando ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Plus size={16} />
                )}
                Salvar cotação
              </button>
            </form>
          </div>
        </Modal>
      )}
    </main>
  );
}

function Indicador({
  label,
  valor,
  icon,
  destaque = false,
}: {
  label: string;
  valor: number;
  icon: React.ReactNode;
  destaque?: boolean;
}) {
  return (
    <div
      className={`min-w-0 rounded-2xl border bg-white p-4 shadow-sm ${destaque ? "border-amber-300" : "border-slate-200"}`}
    >
      <div className="flex items-center justify-between text-slate-500">
        <span className="text-sm font-medium">{label}</span>
        {icon}
      </div>
      <div className="mt-2 text-3xl font-bold text-slate-950">{valor}</div>
    </div>
  );
}
function Atalho({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-w-0 items-center justify-between gap-2 rounded-xl border bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:border-emerald-300"
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="shrink-0">{icon}</span>
        <span className="break-words">{label}</span>
      </span>
      <ArrowRight className="shrink-0" size={15} />
    </Link>
  );
}
function Card({
  n,
  produto,
  cotacoes,
  onAbrir,
  onAvancar,
  salvando,
}: {
  n: Necessidade;
  produto?: Produto;
  cotacoes: Cotacao[];
  onAbrir: () => void;
  onAvancar: (s: StatusCompra) => void;
  salvando: boolean;
}) {
  const prox = PROXIMO[n.status],
    precisaEscolherCotacao =
      n.status === "cotacao" && !cotacoes.some((c) => c.selecionada),
    melhor = [...cotacoes].sort(
      (a, b) =>
        a.preco_unitario * n.quantidade +
        a.frete -
        (b.preco_unitario * n.quantidade + b.frete),
    )[0];
  return (
    <article className="min-w-0 rounded-xl border bg-white p-3 shadow-sm">
      <button onClick={onAbrir} className="w-full text-left">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="break-words text-sm font-bold text-slate-900">
              {n.descricao}
            </p>
            {produto?.codigo && (
              <p className="font-mono text-[10px] text-slate-400">
                {produto.codigo}
              </p>
            )}
          </div>
          <Prioridade valor={n.prioridade} />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
          <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold">
            {n.quantidade} {n.unidade}
          </span>
          {n.obra_referencia && (
            <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700">
              {n.obra_referencia}
            </span>
          )}
        </div>
        {melhor && (
          <div className="mt-3 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-800">
            <b>Melhor total:</b>{" "}
            {moeda(melhor.preco_unitario * n.quantidade + melhor.frete)}
          </div>
        )}
        <div className="mt-3 flex justify-between text-[10px] text-slate-400">
          <span>{cotacoes.length} cotação(ões)</span>
          <span>
            {n.data_limite ? `Até ${dataBr(n.data_limite)}` : "Sem prazo"}
          </span>
        </div>
      </button>
      {prox && (
        <button
          disabled={salvando}
          onClick={() =>
            precisaEscolherCotacao ? onAbrir() : onAvancar(prox.status)
          }
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-700"
        >
          <CheckCircle2 size={13} />
          {precisaEscolherCotacao ? "Escolher cotação" : prox.label}
        </button>
      )}
    </article>
  );
}
function Prioridade({ valor }: { valor: Necessidade["prioridade"] }) {
  const c =
    valor === "urgente"
      ? "bg-red-100 text-red-700"
      : valor === "alta"
        ? "bg-amber-100 text-amber-700"
        : valor === "baixa"
          ? "bg-slate-100 text-slate-500"
          : "bg-blue-50 text-blue-600";
  return (
    <span
      className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase ${c}`}
    >
      {valor}
    </span>
  );
}
function Modal({
  titulo,
  onFechar,
  children,
  largo = false,
}: {
  titulo: string;
  onFechar: () => void;
  children: React.ReactNode;
  largo?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-3 backdrop-blur-sm sm:p-6">
      <div
        className={`mx-auto my-3 w-full min-w-0 rounded-2xl bg-white shadow-2xl ${largo ? "max-w-6xl" : "max-w-2xl"}`}
      >
        <div className="sticky top-0 z-10 flex min-w-0 items-center justify-between gap-3 border-b bg-white px-5 py-4">
          <h2 className="min-w-0 break-words font-bold">{titulo}</h2>
          <button
            onClick={onFechar}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
function Campo({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block text-xs font-medium text-slate-600">
      {label}
      <input
        type={type}
        min={type === "number" ? "0" : undefined}
        step={type === "number" ? "0.01" : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border bg-white p-2.5 text-sm"
      />
    </label>
  );
}
function Info({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-xl border bg-slate-50 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-800">{valor}</p>
    </div>
  );
}
function Historico({ ultimo }: { ultimo: UltimoPreco }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <FileClock size={19} className="mt-0.5 text-amber-700" />
      <div>
        <p className="text-sm font-semibold text-amber-950">
          Última compra registrada
        </p>
        <p className="mt-1 text-xs text-amber-800">
          {ultimo.fornecedorNome || "Fornecedor não identificado"} •{" "}
          {moeda(ultimo.precoUnitario)} por unidade • {dataBr(ultimo.data)}
        </p>
      </div>
    </div>
  );
}
function TabelaCotacoes({
  cotacoes,
  quantidade,
  fornecedor,
  onSelecionar,
  salvando,
}: {
  cotacoes: Cotacao[];
  quantidade: number;
  fornecedor: (id: string) => Fornecedor | undefined;
  onSelecionar: (id: string) => void;
  salvando: boolean;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Comparação de fornecedores</h3>
          <p className="text-xs text-slate-500">
            Preço, frete, prazo e pagamento lado a lado.
          </p>
        </div>
        <span className="text-xs text-slate-400">
          {cotacoes.length} cotação(ões)
        </span>
      </div>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-slate-100 text-left text-xs text-slate-600">
            <tr>
              <th className="px-3 py-2">Fornecedor</th>
              <th className="px-3 py-2 text-right">Unitário</th>
              <th className="px-3 py-2 text-right">Frete</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2">Prazo</th>
              <th className="px-3 py-2">Pagamento</th>
              <th className="px-3 py-2 text-right">Escolha</th>
            </tr>
          </thead>
          <tbody>
            {cotacoes.map((c, i) => (
              <tr
                key={c.id}
                className={`border-t ${i === 0 ? "bg-emerald-50" : ""}`}
              >
                <td className="px-3 py-3 font-semibold">
                  {fornecedor(c.fornecedor_id)?.nome || "Fornecedor"}
                  {i === 0 && (
                    <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700">
                      menor total
                    </span>
                  )}
                </td>
                <td className="px-3 py-3 text-right">
                  {moeda(c.preco_unitario)}
                </td>
                <td className="px-3 py-3 text-right">{moeda(c.frete)}</td>
                <td className="px-3 py-3 text-right font-bold">
                  {moeda(c.preco_unitario * quantidade + c.frete)}
                </td>
                <td className="px-3 py-3">
                  {c.previsao_entrega
                    ? dataBr(c.previsao_entrega)
                    : c.prazo_dias !== null
                      ? `${c.prazo_dias} dias`
                      : "—"}
                </td>
                <td className="px-3 py-3">{c.forma_pagamento || "—"}</td>
                <td className="px-3 py-3 text-right">
                  {c.selecionada ? (
                    <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      Selecionada
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={salvando}
                      onClick={() => onSelecionar(c.id)}
                      className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-700 disabled:opacity-50"
                    >
                      Selecionar
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!cotacoes.length && (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-8 text-center text-slate-400"
                >
                  Nenhuma cotação registrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
