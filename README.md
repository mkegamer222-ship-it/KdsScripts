# KDS Scripts

Site de scripts para jogos do Roblox com **contas de usuário**, **envio de scripts pela
comunidade** e **catálogo de jogos identificado por Place ID**, validado pela staff.
Banco de dados **MongoDB**. Pronto para deploy na Vercel.

---

## Como rodar

```bash
npm install
npm run check                  # testa a conexão com o banco (ou o modo local)
npm run dev                    # http://localhost:3000
```

As credenciais ficam no **`.env` da raiz (versionado a pedido do dono — mantenha o
repositório PRIVADO)**. Sem `.env`, copie `.env.example` e preencha `MONGODB_URI`,
`STAFF_USERNAME` e `STAFF_PASSWORD`. ⚠️ Se trocar a senha do Mongo no Atlas, atualize
a `MONGODB_URI` aqui **e** nas variáveis da hospedagem (Vercel), senão volta o erro
"Não foi possível entrar / criar a conta".

A primeira requisição cria os índices e a **conta de staff** definida em `STAFF_USERNAME` /
`STAFF_PASSWORD`, e ressincroniza a senha dela com o `.env` a cada boot (trocar a senha
pelo site é sobrescrito no restart se o `.env` estiver diferente — troque no `.env`).
Entre por `/entrar` e o painel fica em `/staff`.

**Dois modos de armazenamento:**

- **MongoDB** (recomendado, produção): defina `MONGODB_URI`. Com o banco fora do ar, o site
  continua abrindo (circuit breaker + fallback em cache).
- **Modo local** (desenvolvimento): sem `MONGODB_URI` (e sem `MONGODB_HOSTS`/`MONGODB_HOST`),
  o site guarda tudo no arquivo `data/local-db.json` — contas, sessões, scripts e jogos
  funcionam sem banco nenhum. As senhas de staff continuam em `STAFF_USERNAME`/`STAFF_PASSWORD`.

O `.env` da raiz já vem preenchido e versionado (a pedido do dono). Na Vercel, cadastre
as **mesmas** variáveis em *Settings → Environment Variables* — a Vercel não lê o `.env`
do Git. Sem `MONGODB_URI`, o site roda em modo local (`data/local-db.json`).

---

## Funcionalidades

**Contas e sessões**

- Cadastro com usuário + senha (senha com hash `scrypt` e salt por usuário).
- Sessões persistidas no banco (`sessions`, com índice TTL) e cookie `httpOnly`
  (`sameSite=lax`, `secure` em produção), válido por 30 dias.
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

## Deploy na Vercel

1. Suba o projeto para um repositório Git.
2. Importe na Vercel (framework Next.js detectado automaticamente).
3. Em **Settings → Environment Variables**, defina:

```env
MONGODB_URI="mongodb+srv://USUARIO:SENHA@cluster.mongodb.net/?retryWrites=true&w=majority"
MONGODB_DB="kdss"
STAFF_USERNAME="kdss"
STAFF_PASSWORD="troque-esta-senha"
NEXT_PUBLIC_SITE_URL="https://seu-dominio"
```

4. Deploy. A conta de staff é criada na primeira visita ao site.
5. Entre em `/entrar` com `STAFF_USERNAME` / `STAFF_PASSWORD` e troque a senha em
   **Minha conta → Trocar senha**.

**No MongoDB Atlas:** em *Security → Network Access*, libere `0.0.0.0/0`. Na Vercel a
execução é serverless e o IP muda a cada requisição.

Datas e textos ficam em `lib/config.ts`. Nada de configuração de infraestrutura aparece
nas páginas públicas: as páginas do site não exibem rotas de API, nome de hospedagem nem
variáveis de ambiente.

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
  mongodb.ts      conexão, circuit breaker e diagnóstico
  auth.ts         senhas, sessões, cadastro e login
  bootstrap.ts    índices + criação da conta de staff
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

O site não depende de o banco responder para carregar:

- **Circuit breaker** (`lib/mongodb.ts`): a conexão espera no máximo `MONGODB_TIMEOUT_MS`
  (2,5 s por padrão); se falhar, o circuito abre e as chamadas seguintes falham na hora por
  `MONGODB_COOLDOWN_MS` (60 s), com tentativa automática depois.
- **Cache em memória** com TTL curto, *stale-while-revalidate* e deduplicação de consultas.
- **ISR** nas páginas públicas (30 s na home e nas páginas de script, 60 s em jogos).
- **Cache-Control** nas rotas internas de leitura.

Estados vazios e de carregamento são renderizados no lugar de erro quando não há conteúdo.

---

## Aviso

O conteúdo é enviado pela comunidade e passa por revisão manual da staff, sem garantia de
funcionamento ou de segurança. Revise o código antes de executar. Projeto não afiliado à
Roblox Corporation.
