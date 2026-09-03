"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Loader2, Upload, Bot, PackageSearch, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  carregarCatalogosFornecedor,
  importarAnaliseFornecedor,
  registrarDocumentoFornecedor,
} from "@/lib/fornecedorCatalogos";

type Props = { fornecedorId: string };

type Documento = {
  id: string;
  nome_arquivo: string;
  url: string;
  status: string;
  extracao_metodo?: string | null;
  custo_modelo?: number | null;
  created_at: string;
};

type Item = {
  id: string;
  documento_id: string;
  produto_id?: string | null;
  codigo_fornecedor?: string | null;
  descricao: string;
  categoria_sugerida?: string | null;
  preco?: number | null;
  status: string;
};

export default function FornecedorCatalogos({ fornecedorId }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [itens, setItens] = useState<Item[]>([]);
  const [vinculos, setVinculos] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [documentoAnalise, setDocumentoAnalise] = useState("");
  const [jsonAnalise, setJsonAnalise] = useState("");
  const [importando, setImportando] = useState(false);

  useEffect(() => {
    void carregar();
  }, [fornecedorId]);

  async function carregar() {
    setCarregando(true);
    setErro("");
    try {
      const dados = await carregarCatalogosFornecedor(fornecedorId);
      setDocumentos(dados.documentos || []);
      setItens(dados.itens || []);
      setVinculos(dados.vinculos || []);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar os catálogos.");
    } finally {
      setCarregando(false);
    }
  }

  async function enviarArquivo(file: File) {
    setEnviando(true);
    setErro("");
    setMensagem("");
    try {
      const resultado = await registrarDocumentoFornecedor({ fornecedorId, file });
      const r = resultado.resumo;
      if (resultado.documento?.status === "precisa_analise_ia") {
        setMensagem("Arquivo guardado. Ele precisa de análise visual/IA; nenhum modelo pago foi chamado.");
      } else {
        setMensagem(`Catálogo processado sem custo de modelo: ${r.vinculados} item(ns) vinculados, ${r.criados} novo(s) cadastro(s) pendente(s) e ${r.revisar} para revisar.`);
      }
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao enviar catálogo.");
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function importarJson() {
    setErro("");
    setMensagem("");
    if (!documentoAnalise) {
      setErro("Selecione o documento que foi analisado.");
      return;
    }
    let dados: unknown;
    try {
      dados = JSON.parse(jsonAnalise);
    } catch {
      setErro("O conteúdo não é um JSON válido.");
      return;
    }
    const lista = Array.isArray(dados) ? dados : Array.isArray((dados as any)?.itens) ? (dados as any).itens : [];
    if (!lista.length) {
      setErro("O JSON precisa conter uma lista de itens.");
      return;
    }
    setImportando(true);
    try {
      const resultado = await importarAnaliseFornecedor({ fornecedorId, documentoId: documentoAnalise, itens: lista });
      const r = resultado.resumo;
      setMensagem(`Análise importada: ${r.vinculados} item(ns) existentes vinculados, ${r.criados} produto(s) novo(s) criado(s) como pendente(s) e ${r.revisar} para revisar. Custo de modelo no Atlas: US$ 0.`);
      setJsonAnalise("");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao importar a análise.");
    } finally {
      setImportando(false);
    }
  }

  const resumo = useMemo(() => ({
    vinculados: itens.filter(i => i.status === "vinculado").length,
    criados: itens.filter(i => i.status === "criado_pendente").length,
    revisar: itens.filter(i => i.status === "revisar").length,
  }), [itens]);

  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <FileText size={16} className="text-brand-navy" /> Catálogos e documentos
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            PDF textual é analisado localmente. Arquivo visual fica aguardando análise assistida, sem cobrança automática de IA.
          </p>
        </div>
        <div>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.xlsx,.xls,.doc,.docx,.json"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) void enviarArquivo(file);
            }}
          />
          <button
            type="button"
            disabled={enviando}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-navy px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {enviando ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {enviando ? "Analisando..." : "Subir catálogo"}
          </button>
        </div>
      </div>

      {erro && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{erro}</div>}
      {mensagem && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">{mensagem}</div>}

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-slate-50 p-3 text-center"><p className="text-lg font-bold text-slate-800">{vinculos.length}</p><p className="text-[11px] text-slate-500">Produtos do fornecedor</p></div>
        <div className="rounded-xl bg-slate-50 p-3 text-center"><p className="text-lg font-bold text-slate-800">{resumo.criados}</p><p className="text-[11px] text-slate-500">Novos pendentes</p></div>
        <div className="rounded-xl bg-slate-50 p-3 text-center"><p className="text-lg font-bold text-slate-800">{resumo.revisar}</p><p className="text-[11px] text-slate-500">Para revisar</p></div>
      </div>

      {carregando ? (
        <div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 size={16} className="animate-spin" /> Carregando...</div>
      ) : documentos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-400">Nenhum catálogo enviado ainda.</div>
      ) : (
        <div className="space-y-2">
          {documentos.map(doc => {
            const totalDoc = itens.filter(i => i.documento_id === doc.id).length;
            const precisaIa = doc.status === "precisa_analise_ia";
            return (
              <div key={doc.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-slate-100 p-2"><FileText size={16} className="text-slate-600" /></div>
                  <div className="min-w-0 flex-1">
                    <a href={doc.url} target="_blank" rel="noreferrer" className="block truncate text-sm font-medium text-slate-800 hover:underline">{doc.nome_arquivo}</a>
                    <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-500">
                      <span>{new Date(doc.created_at).toLocaleDateString("pt-BR")}</span>
                      <span>•</span><span>{totalDoc} item(ns)</span>
                      <span>•</span><span>IA do Atlas: US$ 0</span>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium ${precisaIa ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                    {precisaIa ? <AlertTriangle size={11} /> : <CheckCircle2 size={11} />}
                    {precisaIa ? "Análise assistida" : "Processado"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 space-y-3">
        <div className="flex items-start gap-2">
          <Bot size={17} className="mt-0.5 text-blue-700" />
          <div>
            <p className="text-sm font-semibold text-blue-900">Importar análise feita no ChatGPT — custo zero no Atlas</p>
            <p className="mt-1 text-xs text-blue-700">Para catálogo escaneado ou complexo: envie o mesmo arquivo no ChatGPT, peça a análise estruturada e cole o JSON aqui. O Atlas vincula o que já existe e cria o que falta como cadastro pendente.</p>
          </div>
        </div>
        <select value={documentoAnalise} onChange={e => setDocumentoAnalise(e.target.value)} className="w-full rounded-xl border border-blue-200 bg-white p-2.5 text-sm">
          <option value="">Selecione o catálogo analisado</option>
          {documentos.map(doc => <option key={doc.id} value={doc.id}>{doc.nome_arquivo}</option>)}
        </select>
        <textarea
          value={jsonAnalise}
          onChange={e => setJsonAnalise(e.target.value)}
          rows={5}
          placeholder={'Cole aqui o JSON. Ex.: {"itens":[{"codigo":"SU001","descricao":"Perfil ...","categoria":"perfil","unidade":"KG","preco":12.5}]}' }
          className="w-full rounded-xl border border-blue-200 bg-white p-3 font-mono text-xs"
        />
        <button type="button" disabled={importando || !jsonAnalise.trim()} onClick={() => void importarJson()} className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-800 disabled:opacity-50">
          {importando ? <Loader2 size={15} className="animate-spin" /> : <PackageSearch size={15} />}
          Importar e reconciliar catálogo
        </button>
      </div>
    </section>
  );
}
