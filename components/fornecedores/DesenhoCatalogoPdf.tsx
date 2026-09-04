"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";

type Crop = { x: number; y: number; width: number; height: number };
type Props = {
  url: string;
  pagina?: number | null;
  crop?: Crop | null;
  codigo?: string | null;
};

type PdfJsLib = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (src: string | { url: string }) => { promise: Promise<any> };
};

declare global {
  interface Window {
    pdfjsLib?: PdfJsLib;
    __atlasPdfJsPromise?: Promise<PdfJsLib>;
    __atlasPdfDocs?: Map<string, Promise<any>>;
  }
}

const PDF_JS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDF_WORKER_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

function carregarPdfJs(): Promise<PdfJsLib> {
  if (typeof window === "undefined") return Promise.reject(new Error("PDF.js indisponível."));
  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;
    return Promise.resolve(window.pdfjsLib);
  }
  if (window.__atlasPdfJsPromise) return window.__atlasPdfJsPromise;

  window.__atlasPdfJsPromise = new Promise<PdfJsLib>((resolve, reject) => {
    const existente = document.querySelector<HTMLScriptElement>(`script[src="${PDF_JS_URL}"]`);
    const concluir = () => {
      if (!window.pdfjsLib) return reject(new Error("Não foi possível iniciar o leitor do catálogo."));
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;
      resolve(window.pdfjsLib);
    };

    if (existente) {
      existente.addEventListener("load", concluir, { once: true });
      existente.addEventListener("error", () => reject(new Error("Falha ao carregar o leitor do catálogo.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = PDF_JS_URL;
    script.async = true;
    script.onload = concluir;
    script.onerror = () => reject(new Error("Falha ao carregar o leitor do catálogo."));
    document.head.appendChild(script);
  });

  return window.__atlasPdfJsPromise;
}

async function carregarDocumento(url: string) {
  const pdfjs = await carregarPdfJs();
  window.__atlasPdfDocs ||= new Map<string, Promise<any>>();
  const existente = window.__atlasPdfDocs.get(url);
  if (existente) return existente;
  const promessa = pdfjs.getDocument({ url }).promise;
  window.__atlasPdfDocs.set(url, promessa);
  return promessa;
}

export default function DesenhoCatalogoPdf({ url, pagina, crop, codigo }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [visivel, setVisivel] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    if (!rootRef.current) return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) setVisivel(true);
      },
      { rootMargin: "250px" },
    );
    observer.observe(rootRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visivel || !pagina || !canvasRef.current) return;
    let cancelado = false;

    async function renderizar() {
      setCarregando(true);
      setFalhou(false);
      try {
        const documento = await carregarDocumento(url);
        const paginaPdf = await documento.getPage(pagina);
        const viewportBase = paginaPdf.getViewport({ scale: 1 });
        const area: Crop = crop || { x: 0, y: 0, width: viewportBase.width, height: viewportBase.height };
        const larguraAlvo = 220;
        const escala = Math.max(0.9, Math.min(2.4, larguraAlvo / Math.max(1, area.width)));
        const viewport = paginaPdf.getViewport({ scale: escala });
        const canvas = canvasRef.current;
        if (!canvas || cancelado) return;
        canvas.width = Math.max(1, Math.round(area.width * escala));
        canvas.height = Math.max(1, Math.round(area.height * escala));
        const ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx) throw new Error("Canvas indisponível.");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await paginaPdf.render({
          canvasContext: ctx,
          viewport,
          transform: [1, 0, 0, 1, -area.x * escala, -area.y * escala],
        }).promise;
      } catch {
        if (!cancelado) setFalhou(true);
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }

    void renderizar();
    return () => {
      cancelado = true;
    };
  }, [visivel, url, pagina, crop?.x, crop?.y, crop?.width, crop?.height]);

  const href = pagina ? `${url}#page=${pagina}` : url;

  return (
    <div ref={rootRef} className="w-[150px]">
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        title={codigo ? `Abrir desenho ${codigo} no catálogo` : "Abrir desenho no catálogo"}
        className="group relative flex h-[96px] w-[150px] items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white hover:border-blue-300"
      >
        {pagina && !falhou && <canvas ref={canvasRef} className="max-h-full max-w-full object-contain" />}
        {carregando && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/70 text-slate-400">
            <Loader2 size={16} className="animate-spin" />
          </span>
        )}
        {(!pagina || falhou) && (
          <span className="px-2 text-center text-[10px] text-slate-500">
            {pagina ? `Ver desenho · pág. ${pagina}` : "Ver catálogo"}
          </span>
        )}
        <span className="absolute right-1.5 top-1.5 rounded bg-white/90 p-1 text-slate-500 opacity-0 shadow-sm transition group-hover:opacity-100">
          <ExternalLink size={11} />
        </span>
      </a>
      {pagina && <p className="mt-1 text-center text-[10px] text-slate-400">Catálogo · pág. {pagina}</p>}
    </div>
  );
}
