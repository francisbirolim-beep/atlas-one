# CURRENT_STATE.md — Atlas One

> Checkpoint anterior preservado em `docs/ai-handoff/archive/2026-08-23-pre-pr258-CURRENT_STATE.md`.

## EM VALIDAÇÃO — BUSCA PADRÃO ATLAS V1 — 2026-08-25

Branch: `feat/busca-atlas-unificada-v1`

Objetivo: substituir buscas isoladas/inconsistentes por um comportamento operacional único, sem criar base paralela e sem alterar as regras técnicas/comerciais dos módulos.

### Regra oficial de busca

Criados `lib/buscaAtlas.ts` e `components/system/BuscaAtlasInput.tsx`.

O padrão V1:
- ignora diferença entre maiúsculas/minúsculas;
- ignora acentos (`JOAO` encontra `João`);
- aceita várias palavras em qualquer ordem;
- cada palavra pode existir em um campo diferente do cadastro;
- CPF/CNPJ/telefone podem ser pesquisados sem a pontuação usada no cadastro;
- filtros específicos podem ser combinados com a pesquisa geral.

### Fluxos já padronizados nesta branch

- Clientes: nome, apelido, CPF/CNPJ, WhatsApp, telefone, e-mail, cidade, bairro, endereço, CEP, observação, responsável e origem; filtros específicos de cidade, bairro, CPF/CNPJ, telefone e apelido.
- Orçamento Balcão: `Categoria → Linha → Pesquisa`; produto por código, código de origem, nome, descrição, categoria, grupo, marca, NCM e dados das linhas; seleção do cliente cadastrado sem duplicar `clientes.id`.
- Venda Balcão: a API compartilhada do catálogo passou a reconhecer também apelido, e-mail, bairro, endereço e CEP do cliente; pesquisa de produtos continua integrada ao estoque da rede.
- Assistência: seleção de cliente usa o mesmo critério amplo do Atlas e preenche cidade/endereço/bairro/telefone do cadastro escolhido.
- Produtos: pesquisa geral combinada aos filtros de categoria e linha.
- Linhas técnicas e catálogo por linha: busca por nome, fabricante, descrição, apelidos, produtos e tipologias associados.
- Precificação e unidades pendentes: busca de produto usando o padrão Atlas.
- Fornecedores e Materiais: pesquisa ampla pelos dados exibidos/cadastrados.
- Estoque: pesquisa por produto/código/unidade/local/endereço.
- Endereçamento: pesquisa por produto, unidade, local e endereço.
- Transferências: busca de produtos na origem e pesquisa do histórico por nº, status, origem, destino, motivo e produtos.
- Compras/NFs: histórico de notas por NF, fornecedor, CNPJ e arquivo.
- Vínculos de compra: pesquisa dos itens pendentes e pesquisa real do produto Atlas antes do vínculo.
- Pesquisa/Histórico de Orçamentos: busca ampliada preservando filtros de número/data/status.
- Central de Cadastros: usa o mesmo mecanismo de normalização.

### Segurança funcional

- nenhuma migration nova foi necessária;
- `clientes.apelido` e `clientes.bairro` já existiam e foram reutilizados;
- cliente selecionado em Venda/Orçamento/Assistência continua apontando para o mesmo cadastro compartilhado;
- regras de preço, margem, estoque, reserva, caixa, vínculo de NF e precedência técnica Atlas/W.Vetro não foram alteradas;
- previews Vercel dos commits da branch vêm compilando como `READY`.

## MODO VENDA BALCÃO INTEGRADO AO ATLAS — 2026-08-25

Decisão consolidada: **Venda Balcão é um modo operacional do Atlas One, não um sistema separado**.

Estado integrado:
- `components/system/BalcaoShell.tsx` identifica explicitamente `Modo Venda Balcão`;
- botão `Voltar ao Atlas` retorna ao ERP completo (`/`);
- no mobile existe acesso direto `Atlas` no cabeçalho do balcão;
- menu do balcão continua focado em Venda, Orçamento, Consulta, Atendimentos, Histórico, Caixa, Contas a Receber e Relatórios;
- seção `Gestão compartilhada` aponta para Clientes, Cadastros, Estoque e Compras do próprio Atlas;
- nenhum cadastro/banco/estoque foi duplicado;
- fiscal/NFC-e/NF-e permanece evolução posterior, dependente de provedor e regras fiscais.

## Base já integrada na `main`

- PR #255: Compras → fiscal → fornecedores → Contas a Pagar → recebimento → estoque → custo médio + precificação balcão;
- PR #257: estoque multiunidade, endereçamento, reservas e transferências;
- PR #256: Venda Balcão multiunidade, caixas por unidade, estoque da rede e atendimento reservado;
- PR #258: auditoria completa W.Vetro integrada na `main`;
- PR #271: cancelamento/devolução transacional da Venda Balcão;
- PR #272: busca combinada + layout compacto do balcão;
- PR #273: busca incremental;
- PR #274: captura nativa de digitação na Consulta de preço;
- PR #275: Modo Venda Balcão integrado ao mesmo Atlas;
- PR #276: busca incremental de clientes na Venda Balcão.

### Referência W.Vetro disponível

- 1.307 perfis W.Vetro preservados;
- 1.174 acessórios W.Vetro;
- 111 tipologias de referência, 109 mapeadas;
- 119 linhas de referência;
- 1.529 códigos de perfil observados no histórico;
- 1.294 códigos de acessório observados no histórico;
- 14 vidros referência;
- 2.481 produtos consultados na API;
- 1.287 imagens copiadas para o Atlas;
- configuração/fórmula/receita validada Atlas sempre tem prioridade sobre W.Vetro.

## REGRAS TÉCNICAS A PRESERVAR

- GitHub é a única fonte da verdade do código.
- Nunca commitar direto em `main`; branch → PR → Build/Preview → merge manual.
- Venda Balcão e Atlas completo compartilham a mesma base e os mesmos cadastros; não duplicar backend.
- Busca operacional deve seguir o padrão Atlas V1 sempre que a tela pesquisar cadastros/listagens.
- W.Vetro é referência/origem; Atlas validado é a versão técnica oficial.
- Nunca sobrescrever automaticamente fórmula, receita, custo, preço, margem ou unidade operacional Atlas com valor histórico W.Vetro.
- Variável inferida sem regra Atlas validada deve permanecer `A definir`.
- Associação externa automática somente por identidade segura/exata; sem fuzzy.
- Imagem W.Vetro nunca substitui automaticamente imagem Atlas existente.
- `produtos.unidade` é unidade operacional; `unidade_origem`/`qtde_embalagem_origem` são proveniência.
- Tipologia = custo técnico. Venda Balcão = preço comercial próprio.
- Hardening legado da Engenharia continua tarefa separada; não habilitar RLS às cegas.
