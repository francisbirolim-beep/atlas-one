# DECISIONS.md — Atlas One

Decisões técnicas já adotadas. Não reverter/alterar sem necessidade real e sem entender o motivo.

## Cliente 360 e fluxo oficial da venda

Cliente 360 consolida relacionamento, Obras, Financeiro e Andamento sem criar uma segunda fonte de status. O estado mostrado deve vir dos processos/cards reais.

Fluxo:
- Venda confirmada → snapshot + Financeiro + Conferir Projeto;
- Projeto conferido → Medição Final + Perfis + Acessórios + Outros + pacote técnico/ordens quando aplicável;
- Medição aprovada → Vidros + MEE;
- Produção só é liberada com Medição aprovada + Perfis/Acessórios/Outros em `Liberado`;
- Instalação só é criada/liberada com todas as ordens concluídas + Vidros em `Liberado`.

Nunca reintroduzir Medição, Produção ou Instalação diretamente em `Vendido`.

## Produção é derivada das ordens

O card de Produção é uma visão agregada das Ordens de Produção. Se existem ordens vinculadas, não permitir arrastar o card para um estado incompatível com elas.

Ordem de esquadria pode ficar bloqueada aguardando gates. Contramarco e esquadria podem ser ordens separadas.

A regra genérica `Materiais liberados → Produção` permanece inativa: o gate técnico das ordens é a fonte da liberação.

## Instalação depende de Produção + Vidro

`Produção concluída → Instalação` está ativa, mas o evento só é disparado quando todas as ordens não canceladas estiverem concluídas e Vidros estiverem `Liberado`.

Instalação: `Agendada → Em instalação → Concluída`. Concluir Instalação conclui a Obra.

## Pacote técnico e materiais

Necessidade técnica, plano de barras, separação, compra e consumo são conceitos diferentes.

Regras:
- fórmula não validada não gera compra automática inventada;
- otimização de orçamento não reserva estoque físico;
- separação física cria vínculo/reserva;
- retalhos reaproveitáveis devem ser rastreados;
- desfazer separação devolve disponibilidade;
- **comprado ≠ consumido**;
- devolução ao estoque/sobra não deve permanecer integralmente como custo realizado da obra.

## Precificação e sobra

Orçamento pode ter margem geral e margem individual por item.

Sobra pode ser cobrada geral ou individualmente. Quando cobrada, entra **somente pelo custo**, sem aplicação da margem comercial.

O orçamento deve preservar seu snapshot de custo/preço; alteração posterior do catálogo não deve reescrever margem histórica de venda fechada.

## Alteração de componente: orçamento x tipologia definitiva

Toda alteração deve declarar escopo:
- `orcamento`: override local, sem alterar a tipologia mestre;
- `tipologia_definitiva`: altera a regra técnica mestre, exige usuário master e justificativa.

Alteração definitiva gera nova versão histórica.

## Histórico / restauração de Tipologia

Nunca sobrescrever ou apagar silenciosamente uma versão técnica anterior.

- alteração relevante gera versão;
- restauração cria uma **nova versão** baseada na escolhida;
- duplicação cria tipologia independente em desenvolvimento;
- fórmula complexa que não puder ser trocada com segurança pelo helper simples deve ser encaminhada ao Editor Técnico.

## Venda fechada e revisões

`vendas_obras` preserva snapshot original. Alterações pós-venda relevantes usam revisão com justificativa, antes/depois e impacto. Não sobrescrever silenciosamente venda fechada.

## Venda Balcão é um modo do Atlas

Balcão compartilha produto, cliente, estoque, compras e financeiro com o Atlas, mas o orçamento/venda rápida permanece fora do Kanban/workflow de obra salvo processo sob medida explícito. Não criar base paralela.

## Financeiro único

Cliente e Obra são dimensões da mesma base financeira. Não criar dois financeiros. Recebimento geral pode ser alocado entre obras; recebimento direto de uma obra não deve ser redirecionado a outra.

## Plano de Corte

Plano de Corte = produto + receita mestre + variáveis + snapshot operacional.

- receita/fórmula não validada permanece pendente;
- alterar snapshot de produção não altera silenciosamente a receita mestre;
- fórmulas nunca devem ser inventadas por falta de evidência.

## Tipologias e produtos

- `tipologias` é fonte da verdade para tipos cadastrados;
- `TipoEsquadria` permanece string dinâmica;
- código não substitui nome visual do produto;
- `produtos.unidade = NULL` significa unidade operacional pendente;
- dados de origem/W.Vetro preservam proveniência, mas não substituem regra Atlas validada;
- `tamanho_barra_mm_origem` pode preencher `tamanho_barra_mm` apenas quando o operacional estiver vazio; nunca sobrescrever valor validado.

## RLS e segurança

RLS permissiva em algumas tabelas operacionais é dívida técnica consciente do estágio atual. Hardening deve ser mudança deliberada, não alteração incidental neste PR.

Helpers internos de workflow não devem ficar executáveis diretamente por `anon`/`authenticated`; RPCs de negócio necessárias podem permanecer expostas conforme decisão explícita.

## Migrations

Toda mudança nova de banco deve ser aplicada por migration e versionada em `supabase/migrations/`. Não voltar a aplicar DDL novo apenas no banco sem arquivo correspondente.

## Deploy

Nunca commit direto em `main`.

Fluxo obrigatório:
`branch → PR → Build Validation + Supabase Database Control → Vercel Preview → validação manual → merge manual`.

PR #280 permanece draft até aprovação do usuário.

## Campos controlados pelo React

Nunca alterar o valor de um input/textarea controlado com `elemento.value = ...` fora do React (providers globais, máscaras, conversões). Isso atualiza o rastreador interno do React e o `onChange` deixa de disparar. Usar o setter nativo do protótipo (`Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, novo)`), como em `UppercaseInputProvider` (PR #490).


## Preservação funcional / mudanças aditivas

Regra obrigatória para qualquer alteração no Atlas:

- alterar somente o escopo solicitado;
- não remover, ocultar, substituir, zerar ou recriar silenciosamente uma função que já existe;
- campos, botões, anexos, históricos, ações e dados manuais existentes devem ser preservados por padrão;
- integrações e automações devem usar patches seletivos, nunca regravar o registro inteiro quando apenas parte dele precisa mudar;
- quando uma tela for reorganizada, funcionalidades existentes precisam continuar acessíveis;
- se for realmente necessário retirar ou mudar um comportamento existente, isso exige pedido explícito e deve aparecer no diff/validação;
- antes do merge, conferir regressão do fluxo imediatamente vizinho ao que foi alterado.

Exemplo canônico: sincronizar um orçamento W.Vetro pode atualizar itens, valores e metadados da integração, mas não pode apagar anexos, fotos, observações, histórico ou outros dados preenchidos manualmente no card.

## WVetro: peças cortadas não são barras para comprar (2026-10-13)

- `wvetro_composicao.perfis` de `orcamentos.itens` origina linhas de corte (`pacote_tecnico_materiais`, com `comprimento_corte_mm` por peça). Essa fonte pertence à Produção e à Lista de Corte; não determina quantidade de barras comerciais.
- As barras inteiras são obtidas do relatório separado **BARRAS UTILIZADAS / Relatório de Cotação de Barras**, agrupadas por código, acabamento/tratamento, tipo e comprimento de barra.
- Um pedido deve usar apenas barras validadas e sempre manter os cortes originais, as cotações históricas e os grupos de card anteriores. Não recalcular arbitrariamente barras como ceil(soma dos cortes / 6000) porque sobra, usinagem, perdas e otimização mudam o resultado.
- Importação deve conferir número WVetro original da venda, quantidade de barras (BR), peso/sobra como indicadores e manter hash e campos originais do documento. Correções precisam de motivo e registro `antes/depois`, usuário e data.
- Aprendizado supervisionado de correções pode sugerir mapeamento em novos relatórios da mesma empresa e mesma chave; nunca corrigir automaticamente quantidades de outras obras, nem inferir uma compra realizada.
- Fonte PDF autenticada no WVetro depende do acesso do usuário; a API operacional atualmente não fornece diretamente `relbarrasutilizadasnovo`. Para importar futuros relatórios usar PDF exportado do WVetro, sem simular uma integração automática inexistente.

## Regra obrigatória: imagens de perfis e acessórios em TODAS as listas (13/10/2026)

**Escopo geral do Atlas One (todas as obras, clientes, empresas e setores):**
1. Qualquer linha ou card que represente **perfil** (inclusive contramarco, trilho, montante e baguete) ou **acessório** deve ter área visível de **imagem real do produto/desenho técnico**: cadastro, busca, catálogo, materiais de compra, barras WVetro, listas de corte, separação, orçamento, cotação, produção, estoque, relatórios e PDFs.
2. Fonte da imagem, nesta prioridade: (a) foto/desenho já vinculado ao cadastro do produto por **ID**; (b) catálogo técnico por **código EXATO**, com escopo de empresa; (c) imagem técnica de origem WVetro vinculada ao próprio item. Não associar foto por similaridade textual, não buscar imagem genérica enganosa.
3. Falta de imagem deve ser **explicitamente identificada** como `Imagem pendente` em cada linha/card e tratada como pendência do cadastro, com ação para anexar/corrigir imagem no cadastro do produto quando disponível. **Não inventar imagens** e não ocultar a linha. O processo operacional já em andamento não deve ser interrompido automaticamente.
4. Nova tela/lista/PDF envolvendo perfis/acessórios só é considerada concluída após validar: (a) imagens existentes aparecem corretas, (b) ausência mostra pendência claramente, (c) vínculo por ID/código exato e isolamento de empresa, (d) regressão de cards parciais e PDFs individuais, (e) nenhuma alteração destrutiva no que funciona.
5. Resolver imagem na apresentação ou no cadastro, sem alterar quantidade de compra, cor do acabamento, custo ou dimensão do produto.
6. Publicações são incrementalmente testadas em branch isolada, build/preflight e preview; fazer backup/snapshot e evitar mudanças fora do escopo. Não modificar funcionalidades prontas sem solicitação expressa.

**Origem:** aprovação do usuário para publicar a correção Materiais=lista de compra, Produção=lista de corte e Compras=Kanban, com regra adicional obrigatória de imagem para todo perfil e acessório (13/10/2026).

## 2026-10-13 — Instalação baseada nas tipologias vendidas, inclusive sem obra vinculada

A aba **Instalação da venda** acompanha exatamente as tipologias do snapshot do orçamento **fechado** (`vendas_obras.itens_snapshot`), independentemente de cadastro/vínculo formal da obra. O vínculo da obra continua obrigatório para fotos arquivadas, conclusão definitiva e encerramento dos gates da obra.

- Cada tipologia vendida deve estar visível individualmente, com referência estável, ambiente, descrição, medida, quantidade, imagem/croqui disponível e estado: A instalar, Em instalação, Com pendência/falta finalizar, Finalizada.
- O profissional registra quantidade instalada, pendência descritiva (ex. cantoneira, arremate, vedação), quatro verificações técnicas (nivelamento, vedação, acabamento, limpeza) e foto quando houver obra vinculada.
- **Instalação física não é finalização**. Mesmo com quantidade instalada integral, falta de checklist ou pendência impede estado finalizado e impede indicar 100% de conclusão no indicador da venda. Finalização é ação explícita, após produção liberada, vínculo da obra, checklists íntegros e ausência de pendência.
- Fazer preparação idempotente a partir do snapshot com chave única (empresa, venda, item_ref), usando `ignoreDuplicates`. Nunca recriar nem zerar peças, histórico, quantidades ou checklists existentes ao abrir o cliente ou vincular obra.
- Aumentar quantidade instalada continua limitado às unidades efetivamente liberadas pela Produção; OPs legadas concluídas mantêm compatibilidade. Controle de instalações/pendências sem obra não bypassa os gates de fabricação/encerramento.
- Avanços em etapas gerais da obra dependem de todos os itens finalizados, produção, compras, financeiro e regras de segurança já existentes. Não alterar os módulos de Produção nesta entrega inicial; tratar implementação mais profunda da Produção em tarefa separada.

### 2026-10-13 — Kanban de instalação, pendências com foto (aprovado)
- Preservar as quatro colunas aprovadas: A instalar, Em instalação, Pendência / falta finalizar e Finalizadas.
- Permitir arrastar a tipologia entre etapas, mantendo as validações de quantidade produzida, obra vinculada, checklist e finalização.
- Ao mover para Pendência, abrir formulário com descrição livre obrigatória e foto opcional, vinculados à venda + item_ref. Fotos podem ser anexadas antes do vínculo da obra.
- Em instalação pode iniciar com zero peças instaladas; registrar quantidade física continua exigindo disponibilidade de produção.
- Instalação fisicamente completa não equivale a serviço finalizado enquanto houver pendência. Nunca mudar automaticamente para Finalizadas.
- Alterar apenas os pontos necessários; preservar fluxos e registros operacionais existentes, com testes e publicação sem indisponibilizar o ambiente.
