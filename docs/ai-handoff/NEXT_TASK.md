# NEXT_TASK.md — Atlas One

## TAREFA ATUAL — validar recuperação de senha em produção

A PR #207 já foi mergeada em `main` no commit `045f1fc8f4a75a02a19faa70e51c57d25672798d`, sem migration.

Funcionalidades prontas:
- login com `Esqueci minha senha`;
- recuperação por nome de usuário ou e-mail;
- envio do link pelo Supabase Auth;
- rota pública `/redefinir-senha` para criar nova senha;
- Master com `Configurações > Usuários e Senhas` para redefinição direta;
- endpoint administrativo preserva campos que não forem enviados.

### Próximos testes obrigatórios

1. na produção, abrir `/login` e clicar `Esqueci minha senha`;
2. informar um usuário/e-mail real controlado para teste;
3. confirmar recebimento do e-mail do Supabase Auth;
4. abrir o link e confirmar que retorna para `/redefinir-senha` no domínio do Atlas;
5. definir uma nova senha e confirmar login com ela;
6. como Master, abrir `Configurações > Usuários e Senhas`, escolher um usuário de teste e redefinir a senha diretamente;
7. confirmar que nome, e-mail, WhatsApp e role do usuário permanecem inalterados após a troca apenas de senha.

### Se o e-mail não redirecionar para o Atlas

Verificar no Supabase Auth a configuração de `Site URL` / `Redirect URLs` e incluir o domínio de produção do Atlas para `/redefinir-senha`. Não alterar essa configuração por suposição: conferir o estado real antes.

### Estado PC3 consolidado

PR #206 está em produção com os quatro desenhos exatos de `SUPREMA → PORTA DE CORRER 03 FOLHAS` e grid de 4 cards no desktop. A migration corretiva PC3 já foi aplicada anteriormente com autorização explícita; não há migration relacionada à tarefa de senhas.

### Regras permanentes

- GitHub é a única fonte da verdade;
- nunca commitar direto na `main`;
- branch → PR → Build Validation verde → merge;
- nunca aplicar migration sem autorização explícita e específica do Francis;
- antes de qualquer apply, auditar a fila completa de migrations pendentes;
- nunca interpretar um simples `pode continuar` como autorização de apply quando a autorização específica não tiver sido dada;
- nunca inventar vínculo, tipologia, composição, receita, perfil, acessório ou fórmula por semelhança de nome.
