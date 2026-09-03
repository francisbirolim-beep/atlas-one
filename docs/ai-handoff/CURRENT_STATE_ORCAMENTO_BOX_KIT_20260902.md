# Estado atual — pacote Orçamento / Box / Kit — 2026-09-02

Branch em validação: `feat/orcamento-box-kit-fluxo`.

Estado:
- descrição livre é o caminho principal e Linha/Tipologia são opcionais;
- Linha e Modelo/Tipologia ganharam busca por digitação;
- campos de Ambiente e Descrição livre aceitam autocomplete/autocorreção do dispositivo e sugestões do Atlas;
- sugestões de Ambiente e Descrição livre aprendem com os termos usados e priorizam os mais frequentes por usuário no dispositivo, sem bloquear digitação manual;
- Linha BOX e tipologias Box Frontal / Box de Canto foram cadastradas e vinculadas na base técnica;
- Box de Canto usa duas larguras + uma altura;
- categoria Kit foi incluída no cadastro de produtos, Balcão e Catálogo Técnico;
- criação de pedido passa a procurar explicitamente a coluna Fazer orçamento;
- caso Rogério foi usado como evidência do bug de entrada incorreta;
- Build Validation e Vercel Preview passaram antes do ajuste de documentação; o código funcional do aprendizado também passou Build Validation e Preview READY no commit `22518ec`;
- aguardando validação manual final do usuário no Preview;
- não mergear antes dessa validação.
