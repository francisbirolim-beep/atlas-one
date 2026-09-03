# Estado atual — pacote Orçamento / Box / Kit — 2026-09-02

Branch em validação: `feat/orcamento-box-kit-fluxo`.

Estado:
- descrição livre é o caminho principal e Linha/Tipologia são opcionais;
- sequência do item: Ambiente → Descrição livre → Linha → Pesquisa de tipologia → medidas;
- Linha ganhou busca por digitação e, quando selecionada, passa a filtrar a pesquisa de tipologia apenas para vínculos daquela linha;
- sem Linha selecionada, a pesquisa de tipologia continua global;
- o campo duplicado de Modelo/Tipologia foi removido deste fluxo para reduzir ruído;
- campos de Ambiente e Descrição livre aceitam autocomplete/autocorreção do dispositivo e sugestões do Atlas;
- sugestões de Ambiente e Descrição livre aprendem com os termos usados e priorizam os mais frequentes por usuário no dispositivo, sem bloquear digitação manual;
- Linha BOX e tipologias Box Frontal / Box de Canto foram cadastradas e vinculadas na base técnica;
- Box de Canto usa duas larguras + uma altura;
- categoria Kit foi incluída no cadastro de produtos, Balcão e Catálogo Técnico;
- criação de pedido passa a procurar explicitamente a coluna Fazer orçamento;
- caso Rogério foi usado como evidência do bug de entrada incorreta;
- aguardando Build Validation/Vercel do último ajuste e validação manual final do usuário no Preview;
- não mergear antes dessa validação.
