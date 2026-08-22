# NEXT_TASK.md — Atlas One

## TAREFA ATUAL — validar cadastro do cliente como central operacional

Após deploy desta implementação:
1. abrir um cliente existente em `/clientes/[id]` e confirmar a nova `Central do cliente`;
2. confirmar que propostas/orçamentos continuam aparecendo normalmente e que cards espelho de Assistência não aparecem como proposta;
3. em cliente com venda já confirmada, conferir a seção `Vendas confirmadas`, valor e acesso ao processo de Medição Final;
4. em cliente com assistência já criada, conferir a seção `Assistências e manutenções`, data, status, técnico, duração e link da OS/PDF;
5. dentro do cadastro, clicar em `Novo orçamento`, confirmar que nome/telefone/cidade são preenchidos e concluir o envio; depois voltar ao mesmo cliente e confirmar que o orçamento ficou no histórico correto;
6. dentro do cadastro, clicar em `Nova assistência / manutenção`, confirmar autopreenchimento, criar o chamado e depois confirmar que ele aparece no histórico do mesmo cliente;
7. repetir com cliente sem WhatsApp para validar que o `cliente_id` explícito impede criação de cadastro duplicado;
8. validar também um cliente sem histórico: as seções devem ficar vazias sem erro;
9. nenhuma migration é necessária nesta etapa.

Regra para próximas evoluções: todo módulo operacional novo relacionado a uma pessoa/empresa cliente deve persistir `cliente_id` e ser acessível pelo cadastro central do cliente. Manutenção, enquanto não tiver tabela própria, usa o histórico de Assistências.

## VALIDAÇÃO AINDA PENDENTE — Assistência em campo com rota, GPS e tempo

1. abrir um chamado no Kanban, gerar um link com nome e telefone do técnico e testar os botões `WhatsApp`, `SMS` e `Copiar`;
2. abrir o link no celular do técnico sem login e confirmar cliente, telefone, endereço, problema e fotos;
3. tocar no telefone e confirmar abertura da ligação; testar também o WhatsApp do cliente;
4. tocar em `Abrir no Google Maps` e confirmar que o endereço é pesquisado corretamente; testar `Copiar endereço`;
5. ao chegar ao local, tocar em `Iniciar assistência` e aceitar a permissão de localização;
6. confirmar que aparece o cronômetro no celular e que o chamado muda automaticamente para `Em atendimento` no Kanban em até aproximadamente 12 segundos;
7. abrir o chamado no Atlas e confirmar técnico, horário de início, cronômetro e botão `GPS do início`, com precisão aproximada quando fornecida pelo aparelho;
8. repetir um teste negando a permissão de GPS e confirmar que o atendimento ainda pode iniciar sem coordenadas;
9. preencher serviço realizado, materiais/peças e observações e coletar assinatura do técnico e do cliente;
10. concluir o atendimento e confirmar tentativa de GPS final, registro do horário de conclusão e duração total;
11. confirmar que o card muda para `Resolvido`, que a duração deixa de correr e que o modal mostra GPS de início/fim quando disponíveis;
12. abrir a Ordem de Serviço e confirmar que os dados/assinaturas anteriores continuam íntegros e testar `Salvar PDF` e `Imprimir`;
13. confirmar que não existe solicitação de localização contínua: o GPS deve ser pedido apenas no início e na conclusão.

Banco:
- migration `assistencia_link_tecnico` já aplicada no Supabase de produção;
- migration `assistencia_gps_tempo_execucao`, versão remota `20260821220855`, já aplicada no Supabase de produção;
- os novos campos de horário/duração/GPS são nullable e não bloqueiam assistências antigas;
- ainda existe a migration local histórica `20260819150000_engenharia_campos_corte_preset_v1` sem registro correspondente no histórico remoto, embora a coluna `campos_corte` já exista no schema; tratar essa reconciliação separadamente sem remover o campo existente.

## VALIDAÇÃO AINDA PENDENTE — link do técnico, assinaturas e PDF direto

Permanece necessário validar em uso real:
- expiração/revogação do link;
- preenchimento completo e as duas assinaturas no celular;
- retorno dos dados à Ordem de Serviço;
- download direto por `Salvar PDF` e impressão limpa.

## VALIDAÇÃO AINDA PENDENTE — impressão A4 e data ajustável da Assistência

Permanece necessário validar em produção:
- alteração da data na abertura e no Kanban;
- impressão com e sem fotos em uma folha A4;
- contraste dos quadros e assinaturas.

## VALIDAÇÃO AINDA PENDENTE — navegação organizada e Central de Cadastros

Permanece necessário validar em produção:
- sidebar separada em `Geral`, `Comercial` e `Operações`;
- busca do menu;
- Central de Administração;
- Central de Cadastros e seus atalhos;
- tema claro/escuro e acesso Master/funcionário.

Pendência independente: localizar desenho técnico exato do TMC antes de exibi-lo no Plano de Corte.