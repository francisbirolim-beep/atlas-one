-- Campos próprios para o fluxo simplificado de medição de contramarcos.
-- A medida do vão e a folga ficam preservadas separadamente da medida final de produção.

alter table public.medicao_itens
  add column if not exists vao_largura_mm numeric,
  add column if not exists vao_altura_mm numeric,
  add column if not exists folga_largura_mm numeric,
  add column if not exists folga_altura_mm numeric,
  add column if not exists producao_largura_mm numeric,
  add column if not exists producao_altura_mm numeric;

alter table public.medicao_itens
  drop constraint if exists medicao_itens_contramarco_medidas_validas;

alter table public.medicao_itens
  add constraint medicao_itens_contramarco_medidas_validas
  check (
    vao_largura_mm is null
    or (
      vao_largura_mm > 0
      and vao_altura_mm > 0
      and coalesce(folga_largura_mm, 0) >= 0
      and coalesce(folga_altura_mm, 0) >= 0
      and producao_largura_mm = vao_largura_mm - coalesce(folga_largura_mm, 0)
      and producao_altura_mm = vao_altura_mm - coalesce(folga_altura_mm, 0)
      and producao_largura_mm > 0
      and producao_altura_mm > 0
    )
  );
