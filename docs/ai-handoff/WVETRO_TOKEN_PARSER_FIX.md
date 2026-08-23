# Correção do parser de autenticação W.Vetro — 2026-08-23

Após configurar as três credenciais reais na Vercel, o endpoint `ValidarUsuario` passou a responder, mas o cliente do Atlas não reconheceu o token retornado.

Correção aplicada em `lib/wvetroApi.ts`:
- o parser agora reconhece JWT puro e JWT com prefixo `Bearer`;
- percorre arrays e objetos aninhados até profundidade segura, sem depender de um nome fixo de campo;
- prioriza campos cujo nome sugere token/autenticação;
- não aceita qualquer texto longo como token, exigindo formato JWT de três segmentos;
- em caso de falha, informa apenas o tipo/nomes dos campos da estrutura recebida, sem expor credenciais nem conteúdo do token.

A integração continua em modo somente leitura e nenhuma escrita no cadastro do Atlas foi adicionada nesta correção.
