# NEXT_TASK.md — Atlas One

## TAREFA ATUAL — validar Editor Técnico + fórmulas Suprema

Após o deploy/preview da PR #232:
1. abrir `Engenharia > Editor Técnico` e confirmar que aparecem as configurações de Porta de Correr Suprema;
2. selecionar `Porta De Correr 02 Folhas (L. Suprema) — Mão-amiga comum sem reforço`, testar `2000 x 2100` e conferir: SU053/SU225/SU102 horizontal = 917 mm, SU280/SU040/SU041 = 2066 mm, SU102 vertical = 1915 mm e vidro = 911 x 1933 mm;
3. selecionar `Porta De Correr 02 Folhas (L. Suprema) — Mão-amiga larga sem reforço`, testar `2000 x 2100` e conferir: SU053/SU225/SU102 horizontal = 908 mm, SU280/SU243/SU242 = 2066 mm, SU102 vertical = 1915 mm e vidro = 902 x 1933 mm;
4. confirmar que `CEIL()` arredonda qualquer resultado decimal sempre para cima;
5. alterar temporariamente um código de perfil/fórmula/quantidade no editor, executar `Calcular teste` e confirmar que a simulação muda antes de salvar;
6. conferir que o campo `Composição / origem do desconto` fica visível e que constantes sem decomposição física validada permanecem explicitamente como pendentes, sem inferência;
7. confirmar que somente fórmulas com status `Validada` podem ser marcadas como `Liberar no Plano de Corte`;
8. testar a configuração larga de 9 folhas em `2000 x 2100`: desconto estrutural 468, SU053/SU225/SU102 horizontal = 170 mm, vidro = 164 x 1933 mm, SU243/SU242 = 8 peças cada;
9. não liberar automaticamente 3F–9F para produção até validar os marcos/trilhos específicos de cada quantidade; 7F/8F/9F continuam sem composição estrutural automática dos marcos;
10. acessórios/reforços/variantes continuam editáveis em `Engenharia > Receitas Técnicas`; validar a navegação entre o Editor Técnico e Receitas.

Banco/segurança:
- migrations `engenharia_editor_formulas_suprema` e `formula_legacy_status` já foram aplicadas no Supabase de produção;
- fórmulas novas em validação ficam `ativo=false` por padrão;
- PC2 comum/estreita foi cadastrada como `Validada` e ativa por ser a receita já confirmada em duas medidas;
- o registro PC3 legado continua ativo por compatibilidade, mas está rotulado `Em validação`;
- o histórico de alterações salva snapshots e incrementa a versão quando a fórmula/configuração é editada.

## VALIDAÇÃO AINDA PENDENTE — lista de vidros e folgas no Plano de Corte

1. abrir `Engenharia > Fórmulas de Corte` e confirmar os campos `Vidro / composição`, `Folga na largura do vidro` e `Folga na altura do vidro`;
2. confirmar que o vidro pode ser digitado livremente e que produtos organizados como categoria/grupo `Vidro` aparecem como sugestões;
3. gerar um plano da Porta de Correr 03 Folhas Suprema e conferir se a seção `Lista de Vidros` aparece junto ao plano de perfis;
4. informar folgas diferentes para largura e altura e conferir se a medida final do vidro é atualizada separadamente nos dois eixos;
5. validar tecnicamente, antes de usar em produção, a referência atual da PC3 que utiliza os baguetes SU102 horizontal e vertical como medida-base do vidro;
6. conferir se a quantidade de panos da PC3 está coerente com os baguetes (3 panos por esquadria na configuração atualmente validada) e com a quantidade de esquadrias informada no plano;
7. imprimir/salvar PDF e conferir se a lista de vidros, tipo de vidro, medida-base, folgas, medida de corte e quantidade aparecem legíveis;
8. testar uma tipologia sem regra de vidro e confirmar que o Atlas mostra aviso em vez de inventar a medida a partir da largura/altura total da esquadria;
9. integrar futuramente as fórmulas diretas de vidro do Editor Técnico ao relatório oficial somente depois da validação do fluxo, mantendo separadas a folga de encaixe da esquadria e a folga técnica do vidro.

Regra técnica: novas tipologias só devem ganhar geração automática de vidro depois que a referência/fórmula de vidro estiver validada. Não usar a dimensão total da esquadria como fallback automático.

## VALIDAÇÃO AINDA PENDENTE — cadastro do cliente como central operacional

1. abrir um cliente existente em `/clientes/[id]` e confirmar a nova `Central do cliente`;
2. confirmar que propostas/orçamentos continuam aparecendo normalmente e que cards espelho de Assistência não aparecem como proposta;
3. em cliente com venda já confirmada, conferir a seção `Vendas confirmadas`, valor e acesso ao processo de Medição Final;
4. em cliente com assistência já criada, conferir a seção `Assistências e manutenções`, data, status, técnico, duração e link da OS/PDF;
5. dentro do cadastro, clicar em `Novo orçamento`, confirmar que nome/telefone/cidade são preenchidos e concluir o envio; depois voltar ao mesmo cliente e confirmar que o orçamento ficou no histórico correto;
6. dentro do cadastro, clicar em `Nova assistência / manutenção`, confirmar autopreenchimento, criar o chamado e depois confirmar que ele aparece no histórico do mesmo cliente;
7. repetir com cliente sem WhatsApp para validar que o `cliente_id` explícito impede criação de cadastro duplicado;
8. validar também um cliente sem histórico: as seções devem ficar vazias sem erro.

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