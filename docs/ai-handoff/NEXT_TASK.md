# NEXT_TASK.md — Atlas One

## TAREFA ATUAL — validar link do técnico, assinaturas e PDF direto da Assistência

Após deploy desta implementação:
1. abrir um chamado no Kanban de Assistências e confirmar que aparece o bloco `Acesso do técnico`;
2. gerar um link informando nome do técnico e validade e confirmar que o endereço pode ser copiado;
3. abrir o link em janela anônima ou celular sem login no Atlas e confirmar que somente aquela assistência fica acessível;
4. conferir se cliente, telefone, endereço, problema e fotos já aparecem preenchidos;
5. preencher técnico, data do atendimento, serviço realizado, materiais/peças e observações;
6. assinar no campo do técnico e no campo do cliente usando toque ou mouse;
7. concluir e confirmar que os dados e assinaturas voltam para a assistência;
8. abrir a Ordem de Serviço e confirmar técnico, data, serviço, materiais, observações e as duas assinaturas;
9. clicar em `Salvar PDF` e confirmar download direto do arquivo `.pdf`;
10. clicar em `Imprimir` e confirmar que a OS permanece em A4, com bordas escuras, e que `Voltar`, `Início` e `Favoritos` não aparecem no papel/PDF;
11. revogar um link pelo modal e confirmar que o mesmo endereço deixa de abrir a assistência;
12. testar expiração de um link quando possível.

Banco:
- migration `assistencia_link_tecnico` já aplicada no Supabase de produção;
- histórico da migration `engenharia_formulas_corte_v1` reconciliado localmente com a versão remota `20260820160019`;
- ainda existe a migration local histórica `20260819150000_engenharia_campos_corte_preset_v1` sem registro correspondente no histórico remoto, embora a coluna `campos_corte` já exista no schema; tratar essa reconciliação separadamente sem remover o campo existente.

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