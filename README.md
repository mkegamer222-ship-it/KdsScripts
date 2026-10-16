# KDS Scripts

Site de scripts para jogos do Roblox com **contas de usuário**, **envio de scripts pela
comunidade** e **catálogo de jogos identificado por Place ID**, validado pela staff.
O banco de produção é **MySQL**, acessado pelo driver `mysql2`.

---

## Como rodar

```bash
npm install
npm run check                  # testa a conexão MySQL (ou o modo local)
npm run dev                    # http://localhost:3000
```

Para desenvolvimento, copie `.env.example` para `.env.local` e preencha as variáveis
`MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`, `MYSQL_USER` e `MYSQL_PASSWORD`, além de
`STAFF_USERNAME` e `STAFF_PASSWORD`. Não coloque credenciais reais no `.env.example`.
Esta versão usa MySQL; variáveis antigas `MONGODB_*` não ativam nem conectam um banco.

⚠️ O arquivo `.env` da raiz já é versionado neste repositório e contém credenciais:
conserve o repositório privado. Em produção, prefira cadastrar as variáveis diretamente
no painel da hospedagem; nunca copie senhas para o `.env.example`.

A primeira requisição cria as tabelas e a **conta de staff** definida em
`STAFF_USERNAME` / `STAFF_PASSWORD`. A senha dessa conta é sincronizada com o ambiente
a cada boot. Entre por `/entrar`; o painel fica em `/staff`.

**Dois modos de armazenamento:**

- **MySQL**: quando as variáveis `MYSQL_*` obrigatórias estão configuradas, o app cria
  automaticamente as tabelas `users`, `sessions`, `scripts` e `games`.
- **Modo local**: sem configuração MySQL, os dados ficam em `data/local-db.json`. É útil
  para desenvolvimento, mas não substitui um banco persistente em produção. Em `NODE_ENV=production`,
  o app recusa esse modo e informa que o MySQL precisa ser configurado — assim uma instância
  serverless não aparenta desconectar contas ao não encontrar sessões gravadas em outra instância.

> **Compatibilidade de hospedagem:** o projeto é Next.js/Node.js. O InfinityFree oferece
> hospedagem PHP e pode restringir conexões MySQL remotas; portanto, o app hospedado na
> Vercel ou em outro provedor pode não conseguir acessar esse banco. Rode `npm run check`
> no mesmo ambiente do deploy. Se a conexão remota for bloqueada, use um MySQL que aceite
> conexões da hospedagem do Next.js ou um backend intermediário permitido pelo provedor.
> O InfinityFree não executa diretamente este app Next.js/Node.js.

A troca de MongoDB para MySQL não importa automaticamente os dados antigos. As tabelas
MySQL começam vazias; a conta de staff é criada no primeiro acesso e os usuários/scripts
anteriores precisam ser migrados separadamente, caso devam ser preservados.

---

## Funcionalidades

**Contas e sessões**

- Cadastro com usuário + senha (senha com hash `scrypt` e salt por usuário).
- Sessões persistidas no banco (`sessions`) e cookie `httpOnly` (`sameSite=lax`, `secure`
  em produção), válido por 30 dias.
- Troca de senha pelo site; ao trocar, as outras sessões são encerradas.
- Limite de tentativas nas rotas de login, cadastro, senha, envio e sugestão.

**Cargos**

| Cargo | Pode |
| --- | --- |
| `user` | Publicar scripts, editar e remover os próprios envios, curtir, baixar |
| `staff` | Tudo acima + aprovar/recusar scripts, validar/recusar jogos, cadastrar jogo pelo Place ID, corrigir nome do jogo, excluir script publicado |
| `owner` | Tudo acima + promover/rebaixar staff e suspender contas |

**Jogos por Place ID**

- O usuário informa o Place ID no envio; o site consulta a API pública da Roblox
  (`apis.roblox.com` + `games.roblox.com` + `thumbnails.roblox.com`) e grava nome, criador e capa.
- Jogo novo entra como **pendente**; a staff valida antes de aparecer na lista pública.
- Se a consulta falhar, o envio continua e a staff confere manualmente.

**Scripts**

- Envios de membros ficam `pending` até aprovação; envios de staff publicam direto.
- Edição de membro volta para a fila de análise.
- Contadores de visualizações, curtidas e cópias gravados no banco.
- Página do script com destaque de sintaxe, copiar, baixar `.lua`, tela cheia e instruções.

**Páginas**

| Rota | Descrição |
| --- | --- |
| `/` | Busca, números reais do banco, scripts recentes, jogos validados, como funciona |
| `/scripts` | Lista com busca, filtro por jogo (Place ID) e ordenação |
| `/scripts/[slug]` | Script, código, autor, informações do jogo e relacionados |
| `/jogos` e `/jogos/[placeId]` | Jogos validados e os scripts de cada um |
| `/entrar`, `/criar-conta` | Acesso |
| `/conta` | Perfil, troca de senha e seus envios (com status) |
| `/enviar` | Formulário de publicação |
| `/staff` | Painel: fila de scripts, jogos para validar, catálogo de jogos, contas |

O site começa **vazio**: sem scripts, sem jogos e sem categorias pré-cadastradas.

---

## Deploy na Vercel (ou hospedagem Node.js)

1. Importe o projeto em uma hospedagem compatível com Next.js.
2. Em **Environment Variables**, configure as credenciais e as opções do site:

```env
MYSQL_HOST="sql311.infinityfree.com"
MYSQL_PORT="3306"
MYSQL_DATABASE="SEU_BANCO"
MYSQL_USER="SEU_USUARIO"
MYSQL_PASSWORD="SUA_SENHA"
MYSQL_CONNECTION_LIMIT="2"
STAFF_USERNAME="kdss"
STAFF_PASSWORD="troque-esta-senha"
NEXT_PUBLIC_SITE_URL="https://seu-dominio"
```

3. Execute `npm run check` no ambiente de hospedagem para validar acesso e autenticação.
   As tabelas são criadas automaticamente quando o app inicia pela primeira vez.
4. A conta de staff é criada na primeira visita ao site. Entre em `/entrar` e troque a
   senha em **Minha conta → Trocar senha**.

**Atenção ao InfinityFree:** confirme no painel/documentação se sua conta permite que a
hospedagem do app abra conexões MySQL externas. Se a porta 3306 estiver acessível apenas
para sites PHP hospedados dentro do InfinityFree, a Vercel não conseguirá conectar.

Datas e textos ficam em `lib/config.ts`. Nenhuma configuração de infraestrutura aparece
nas páginas públicas do site.

---

## Estrutura

```
app/
  page.tsx                     início
  scripts/                     lista e página do script
  jogos/                       lista e página do jogo
  entrar/ criar-conta/ conta/  contas e sessão
  enviar/                      publicação de script
  staff/                       painel da staff
  actions/                     server actions (auth, scripts, staff)
  api/                         endpoints internos usados pela interface
components/
  Header, Footer, AuthProvider, ScriptCard, ScriptForm, CodeBlock,
  FilterBar, Pagination, staff/*
lib/
  mysql.ts        pool MySQL, esquema SQL, consultas e circuit breaker
  local-store.ts  armazenamento JSON local para desenvolvimento
  auth.ts         senhas, sessões, cadastro e login
  bootstrap.ts    preparação do banco + conta de staff
  data.ts         consultas de scripts, jogos, contas e estatísticas (com cache)
  roblox.ts       Place ID → jogo (nome, criador, capa)
  permissions.ts  regras de cargo (usado no servidor e no cliente)
  config.ts       textos do site
scripts/
  check.mjs       diagnóstico da conexão com o banco
```

---

## Endpoints internos

Usados pela interface. Nenhum deles aparece listado nas páginas públicas.

| Método | Rota | Observação |
| --- | --- | --- |
| POST | `/api/auth/register` · `/api/auth/login` · `/api/auth/logout` · `/api/auth/password` | sessão em cookie |
| GET | `/api/me` | usuário da sessão |
| GET | `/api/scripts` · `/api/scripts/[slug]` | somente conteúdo publicado |
| POST | `/api/scripts/[slug]/view` · `/like` · `/copy` | contadores |
| GET | `/api/game?placeId=` | nome e capa do jogo |
| GET | `/api/games` | jogos validados |
| POST | `/api/submit` | publicar script (exige sessão) |
| GET/PATCH/DELETE | `/api/my-scripts` · `/api/my-scripts/[slug]` | envios do próprio autor |
| POST | `/api/staff/games` | cadastrar jogo validado (staff) |
| GET | `/api/health` | resposta mínima; detalhes apenas para staff |

---

## Desempenho

- **Pool MySQL** (`lib/mysql.ts`): pool pequeno reaproveitado entre requisições, timeout de
  conexão configurável e circuit breaker para evitar que o site fique esperando quando o
  banco estiver indisponível.
- **Cache em memória** com TTL curto, *stale-while-revalidate* e deduplicação de consultas.
- **ISR** nas páginas públicas (30 s na home e nas páginas de script, 60 s em jogos).
- **Cache-Control** nas rotas internas de leitura.

Estados vazios e de carregamento são renderizados no lugar de erro quando não há conteúdo.

---

## Aviso

O conteúdo é enviado pela comunidade e passa por revisão manual da staff, sem garantia de
funcionamento ou de segurança. Revise o código antes de executar. Projeto não afiliado à
Roblox Corporation.
