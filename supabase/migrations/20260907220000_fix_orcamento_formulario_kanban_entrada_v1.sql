-- Pedidos de orçamento sob medida devem iniciar em "Fazer orçamento".
-- A aplicação já define essa coluna; este gatilho legado a sobrescrevia
-- para "Orçamento feito" em todo INSERT de formulário.
drop trigger if exists trg_orcamento_obra_coluna_orcamento_feito_v1 on public.orcamentos;
