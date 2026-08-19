# Recuperação e redefinição de senha — 2026-08-19

## Escopo

Implementação sem migration para dois fluxos de autenticação do Atlas One:

1. Master redefine diretamente a senha de um usuário em `Configurações > Usuários e Senhas`;
2. usuário sem acesso usa `Esqueci minha senha` na tela de login e recebe o link de recuperação no e-mail cadastrado.

## Implementação

- `lib/auth.ts`: resolve usuário/e-mail, chama `resetPasswordForEmail` e expõe atualização da própria senha;
- `app/login/page.tsx`: modo de recuperação por e-mail;
- `app/redefinir-senha/page.tsx`: valida sessão de recovery e grava a nova senha;
- `components/AuthGate.tsx`: `/redefinir-senha` é rota pública;
- `app/configuracoes/usuarios/page.tsx`: Master seleciona usuário e define nova senha;
- `app/api/atualizar-usuario/route.ts`: reaproveita `auth.admin.updateUserById` e preserva campos que não vieram no POST;
- `components/Sidebar.tsx`: acesso Master para `Usuários e Senhas`.

## Segurança

- senha administrativa é alterada somente por endpoint autenticado e restrito a `role=master`;
- service role continua apenas no servidor;
- nova senha exige no mínimo 6 caracteres e confirmação na interface;
- atualização de senha administrativa não deve limpar WhatsApp/nome/e-mail/role se esses campos não tiverem sido enviados;
- link de recuperação usa a infraestrutura de e-mail do Supabase Auth e redireciona para `/redefinir-senha` no mesmo origin da aplicação.

## Operação

Não existe migration nem write de dados de negócio nesta implementação. A validação final deve incluir Build Validation, Vercel Preview e teste real do e-mail de recuperação no domínio de produção.
