-- Custo real por cor: preco do Kg natural (global, ja existe em
-- configuracoes_precificacao.preco_kg_aluminio) + adicional por cor (novo).
-- Substitui o modelo anterior de "custo_pintura_kg" unico global, que nao
-- refletia a realidade: cada cor no Wvetro tem seu proprio valor total de
-- Kg (ex: Natural R$36, Branco R$39, Anodizado Brilhante R$48,64, etc).
-- Formula de custo: preco_kg_aluminio (natural) + cores.adicional_kg (por cor).

alter table public.cores add column if not exists adicional_kg numeric not null default 0;

comment on column public.cores.adicional_kg is 'Valor em R$ somado ao preco do Kg do aluminio natural quando essa cor e selecionada. Custo total da cor = configuracoes_precificacao.preco_kg_aluminio + cores.adicional_kg.';

-- Valor real de hoje do Kg do aluminio natural (Wvetro).
update public.configuracoes_precificacao set valor = 36.00, updated_at = now() where chave = 'preco_kg_aluminio';
insert into public.configuracoes_precificacao (chave, valor)
values ('preco_kg_aluminio', 36.00)
on conflict (chave) do nothing;

-- Seed com as cores reais e os valores de Kg extraidos da tela
-- "Precos dos Perfis por Kg" do Wvetro (Tratamento por Cor). adicional_kg
-- = valor total da cor no Wvetro - 36.00 (preco natural).
insert into public.cores (nome, pintura, adicional_kg, ativo) values
('AÇO CORTEN', true, 18.00, true),
('AMADEIRADO CAMBARA 01', true, 18.00, true),
('AMADEIRADO CARVALHO AMERICANO 15', true, 18.00, true),
('AMADEIRADO CEDRO 17', true, 18.00, true),
('AMADEIRADO CEREJEIRA REAL 12', true, 18.00, true),
('AMADEIRADO IMBUIA', true, 18.00, true),
('AMADEIRADO LINHEIRO CLARO', true, 18.00, true),
('AMADEIRADO SAVANA', true, 18.00, true),
('ANODIZADO BRILHANTE', true, 12.64, true),
('ANODIZADO BRONZE', true, 12.64, true),
('ANODIZADO BRONZE 1001', true, 12.64, true),
('ANODIZADO BRONZE 1002', true, 12.64, true),
('ANODIZADO BRONZE 1003', true, 12.64, true),
('ANODIZADO BRONZE 1004', true, 12.64, true),
('ANODIZADO CHAMPAGNE', true, 12.64, true),
('ANODIZADO FOSCO', true, 7.65, true),
('ANODIZADO FOSCO A6', true, 7.65, true),
('ANODIZADO PRETO', true, 12.64, true),
('AZUL 40423 MT', true, 16.72, true),
('AZUL CELESTE 40632', true, 10.92, true),
('AZUL GLACIAL', true, 14.00, true),
('AZUL GLACIAL 40599', true, 14.00, true),
('BEGE ATACAMA 21038MT', true, 10.86, true),
('BEGE CAPPUCCINO PE-FO', true, 11.44, true),
('BEGE DOURADO', true, 12.44, true),
('BEGE PAPIRUS 21042', true, 12.45, true),
('BEGE PERITA 209', true, 10.06, true),
('BRANCO', true, 3.00, true),
('BRANCO POLAR UV', true, 12.64, true),
('CINZA ARGILA', true, 11.36, true),
('CINZA JASPE', true, 14.61, true),
('CINZA URBANO', true, 11.68, true),
('CINZA URBANO 11299', true, 11.68, true),
('CINZA W RAL9023', true, 10.98, true),
('COR A DEFINIR', true, 29.00, true),
('DRAFITE 10562 PE', true, 12.61, true),
('FOSCO', true, 13.13, true),
('GALHO SECO', true, 12.45, true),
('GRAFITE', true, 12.61, true),
('GRAFITE ELEGANCE 11297 LI', true, 10.98, true),
('ITAUBA AMADEIRADO', true, 18.00, true),
('MARROM BRONZE AVELÃ 75204', true, 10.98, true),
('MARROM BRONZE CACAU 75206', true, 10.98, true),
('MARROM MESCLADO', true, 10.98, true),
('MARROM MESCLADO 77180 MT', true, 10.98, true),
('MARROM TIRAMISSU', true, 10.98, true),
('NATURAL', false, 0.00, true),
('NATURAL BRUTO', false, 0.00, true),
('NATURAL FOSCO', false, 0.00, true),
('PINTURA AMADEIRADO', true, 18.00, true),
('PINTURA BRANCO', true, 3.00, true),
('PINTURA BRANCO BRILHANTE', true, 3.00, true),
('PINTURA BRONZE 1002', true, 12.64, true),
('PINTURA BRONZE 1003', true, 12.64, true),
('PINTURA PRETO', true, 3.00, true),
('PRETO', true, 3.00, true),
('VERDE MUSGO 50593 LI', true, 11.74, true),
('VERDE W 7 5BG3', true, 10.69, true);
