# NEXT_TASK.md — Atlas One

## TAREFA ATUAL — validar Plano de Corte final A4

O Editor de Acessórios PC2–PC4 e a identidade white-label do Plano de Corte já foram integrados em `main`. A etapa atual é validar o novo relatório final do Atlas em uso real.

Validar no Atlas:
1. abrir `Engenharia > Fórmulas de Corte`;
2. selecionar a tipologia/configuração desejada;
3. preencher Cliente, Obra e `Ambiente / localização`;
4. escolher a cor do perfil e a cor do acessório nos seletores;
5. escolher o vidro no seletor, incluindo opções padrão como Temperado 6 mm, 8 mm, 10 mm e Laminado 4+4, além dos vidros cadastrados;
6. gerar o plano e confirmar que o cabeçalho usa logo, nome e cor da empresa vindos de `Configurações > Empresa`;
7. confirmar que Perfis / Plano de Corte e Acessórios / Consumíveis aparecem lado a lado, alinhados e com imagens reais quando existe `foto_url` no cadastro;
8. conferir que os acessórios usam as fórmulas/referências da configuração técnica e não inventam quantidade para itens sem fórmula validada;
9. conferir o quadro de vidro alinhado com a largura total do relatório;
10. imprimir/salvar PDF e confirmar que a configuração testada cabe em uma única folha A4 com margens compactas;
11. testar pelo menos PC2, PC3 e PC4 Suprema em `2000 x 2100` antes de considerar o formato fechado para produção diária.

## REGRAS DE SEGURANÇA TÉCNICA

- não alterar fórmulas de perfis para fazer o relatório “bater visualmente”;
- acessórios sem fórmula comprovada continuam usando `quantidade_referencia` e permanecem como referência técnica;
- imagens devem vir do cadastro real do produto/perfil; quando não houver imagem cadastrada, mostrar `—`;
- o logo nunca é fixo da Esquadrifácio: sempre vem da empresa configurada no Atlas;
- manter separadas folga de encaixe da esquadria e folga técnica do vidro.

## DEPOIS

Após a validação visual/operacional do Plano de Corte final, continuar a validação estrutural das fórmulas Suprema 3F–9F, principalmente marcos/trilhos compostos acima de 6 planos e regras de acessórios ainda marcadas como referência.

## OUTRAS VALIDAÇÕES PENDENTES

- Cadastro do cliente como central operacional.
- Assistência em campo com rota, GPS e tempo.
- Link do técnico, assinaturas e PDF direto.
- Navegação organizada e Central de Cadastros.
