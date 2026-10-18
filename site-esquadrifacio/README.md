# Site público Esquadrifácio® — homologação premium v5

## Origem e objetivo
- Construído **sobre o HTML exato da prévia premium v5 aprovada em 18/10/2026**, preservando a composição, tipografia, cores, fotografias e estrutura principal.
- Esta pasta é **um site estático independente** do app Next.js do Atlas One. Não importar os arquivos no roteamento `app/` nem na navegação privada do ERP.
- `index.html`: homepage institucional com oito imagens incorporadas, seções de soluções, portfólio, apresentação e botões de orçamento funcionais.
- `politica-de-privacidade.html`: orientações sobre o uso dos canais de contato.
- `vercel.json`: cabeçalhos de segurança; `robots.txt` e meta robots em ambas as páginas **bloqueiam indexação enquanto estiver em homologação**.

## Contatos provisórios para confirmação antes de publicar
- WhatsApp configurado: (17) 99636-1318, previamente usado em material público da Esquadrifácio. Confirmar se este será o destino de orçamento do site ou trocar pelo WhatsApp Business oficial.
- Instagram: https://www.instagram.com/esquadrifacio/.
- Região atendida: José Bonifácio — SP e região.
- Verificar endereço informado na política e escolher dado oficial de contato LGPD.

## Publicação segura, SOMENTE após aprovação explícita do usuário
1. Conferir com Francis a versão responsiva e as fotografias, autorizações dos titulares/obras, textos e canal de WhatsApp. Não apresentar imagens ilustrativas como obras da empresa sem validação.
2. Validar a página em um projeto Vercel **separado** do Atlas com a raiz deste site como Root Directory; não alterar domínios nem deploy do projeto `atlas-one`. O usuário precisa aprovar o preview antes de apontar domínio.
3. Verificar redirecionamento WhatsApp real em celular e desktop; abrir Instagram e a política de privacidade; testar imagens e navegação com teclado e leitores de tela.
4. Resolver situação e DNS do domínio **esquadrifacio.com.br** na conta do proprietário, e só então atualizar canonical/og:url, gerar `sitemap.xml`, permitir indexação em `robots.txt` e retirar `noindex,nofollow`.
5. Validar textos legais, título/meta SEO local, Search Console, Perfil da Empresa no Google, compartilhamento social, performance de imagens e política de privacidade antes de ativar analytics.
6. Registrar rollback: manter última versão aprovada e DNS anterior para reversão, sem interferir no Atlas One.

## Critérios de aceite automático
Executar `node site-esquadrifacio/validar-site.mjs` na raiz do repositório. O teste não faz requisições externas.

## Limites desta etapa
- A página agora tem links de atendimento reais, porém o telefone ainda requer confirmação final para uso público.
- Não há formulário, banco, CRM, integração com Marketing Inteligente, automação IA nem publicações em redes sociais.
- Os originais incorporam mídia no HTML para preservar exatamente a prévia visual. Em etapa posterior, exportar imagens autorizadas para arquivos otimizados, mantendo a mesma aparência.
- **Não publicar esta versão na internet ou indexá-la sem aprovação expressa.**
