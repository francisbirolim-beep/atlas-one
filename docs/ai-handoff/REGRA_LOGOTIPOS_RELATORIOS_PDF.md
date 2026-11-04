# Atlas One — regra de contraste do logotipo em relatórios PDF

- **Fundo branco, gelo ou cinza-claro:** utilizar `LOGOTIPO_PDF_FUNDO_CLARO` de `lib/brandingRelatorios.ts`, que aponta para `public/branding/esquadrifacio-logo-r-transparente-claro.webp` (letras escuras).
- **Nunca** utilizar `esquadrifacio-logo-r-transparente-escuro.webp` em cabeçalhos claros. Esse arquivo tem letras claras e se torna ilegível sobre branco.
- Validar a cor real da arte: o nome do arquivo indica o fundo ao qual ela se destina.
- Preservar proporções, não aplicar opacidade ou filtros de clareamento e manter fallback legível caso a imagem não carregue.
- Aplicar a mesma regra em **todos os novos PDFs** de relatórios e documentos, sem alterar cálculos, dados, filtros ou autorizações existentes.
- O gerador gerencial em `lib/relatoriosGerenciaisPdf.ts` já usa a imagem adequada, portanto não foi modificado.
