"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import FornecedorCatalogos from "@/components/fornecedores/FornecedorCatalogos";

export default function FornecedorCatalogosPagina() {
  const params = useParams();
  const id = String(params?.id || "");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <Link href={`/fornecedores/${id}`} className="rounded-lg p-2 hover:bg-slate-100">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Catálogos do fornecedor</h1>
            <p className="text-sm text-slate-500">Documentos, produtos, custos e análise assistida.</p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">
        {id ? <FornecedorCatalogos fornecedorId={id} /> : null}
      </main>
    </div>
  );
}
