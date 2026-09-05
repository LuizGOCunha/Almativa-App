# Almativa

Plataforma de gestão da Almativa — Pilates, Jiu-Jitsu e Fisioterapia.

Cobre quatro superfícies: o site público, a área do aluno, o painel
administrativo e a tela que roda na TV da sala de aula (cronômetro de rounds +
playlist do YouTube).

```
┌─ site público ─────┐ ┌─ área do aluno ────┐ ┌─ painel admin ─────┐ ┌─ tela da sala ───┐
│ modalidades        │ │ agenda + check-in  │ │ visão geral        │ │ aula corrente    │
│ grade de horários  │ │ frequência         │ │ alunos e matrículas│ │ cronômetro       │
│ planos e valores   │ │ mensalidades       │ │ agenda e chamada   │ │ playlist YouTube │
│ equipe             │ │ avisos             │ │ financeiro         │ │ chamada por toque│
│ contato            │ │ meus dados         │ │ renovações         │ │ avisos do dia    │
└────────────────────┘ └────────────────────┘ │ frequência         │ └──────────────────┘
                                              │ comunicação        │
                                              │ tela da sala       │
                                              │ configurações      │
                                              └────────────────────┘
```

**Estado:** funcional de ponta a ponta em desenvolvimento. Backend e front
compilam limpos, todos os fluxos principais foram verificados no navegador.
Não está pronto para produção — veja [Pendências](#pendências).

---

## Sumário

- [Arquitetura](#arquitetura)
- [Modelo de dados](#modelo-de-dados)
- [Perfis e autenticação](#perfis-e-autenticação)
- [Como rodar](#como-rodar)
- [Scripts](#scripts)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [API](#api)
- [Rotinas automáticas](#rotinas-automáticas)
- [Regras de negócio](#regras-de-negócio)
- [Convenção de datas](#convenção-de-datas)
- [Identidade visual](#identidade-visual)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Pendências](#pendências)

---

## Arquitetura

Monorepo com workspaces npm.

| Pacote | Stack |
|---|---|
| `packages/shared` | TypeScript puro — enums, DTOs e utilitários usados pelos dois lados |
| `apps/api` | Node 24 · Express 5 · TypeScript 5.9 · Prisma 7 · Mongoose 9 · Zod 4 |
| `apps/web` | Angular 20.3 · Angular Material 20.2 (standalone, signals, control flow novo) |
| `infra` | `docker-compose` com PostgreSQL 17 e MongoDB 8 |

O pacote `shared` é a única fonte de verdade dos contratos: os enums batem com
os do Prisma e com os valores gravados no Mongo, e os DTOs tipam tanto as
respostas da API quanto os clientes HTTP do Angular.

### Versões

- **Angular 20** foi usado por pedido explícito. O atual é o 22.1 — como o
  código já é standalone + signals + control flow novo, o `ng update` para 21/22
  é direto quando fizer sentido.
- **Prisma 7** exige *driver adapter*: a connection string vive no
  `prisma.config.ts` e no `PrismaPg`, não mais no bloco `datasource` do schema.

---

## Modelo de dados

### Por que dois bancos

**PostgreSQL** guarda o que precisa de integridade referencial e muda pouco.
**MongoDB** guarda o fluxo de eventos, que é volumoso, tem formato variável e
cresce sem parar.

#### PostgreSQL (Prisma) — 15 tabelas

| Tabela | Papel |
|---|---|
| `usuarios` | Credenciais e perfil; no máximo um por aluno |
| `refresh_tokens` | Sessões ativas (hash), com revogação |
| `dispositivos` | TVs/tablets da sala pareados (perfil `AULA`) |
| `modalidades` | Pilates, Jiu-Jitsu, Fisioterapia — com cor e ícone |
| `instrutores` | Equipe, N:N com modalidades |
| `alunos` | Cadastro, endereço, contato de emergência, ficha de saúde |
| `planos` | Valor, periodicidade, aulas/semana, dia de vencimento padrão |
| `matriculas` | Vínculo aluno ↔ plano, com dia de vencimento próprio |
| `turmas` | Horário recorrente na grade semanal |
| `aulas` | Ocorrência concreta de uma turma em uma data |
| `mensalidades` | Cobrança de uma competência (`AAAA-MM`) |
| `pagamentos` | Recebimentos, com estorno |
| `timer_presets` | Presets de cronômetro para a sala |
| `playlists` | Playlists do YouTube para a sala |
| `leads` | Contatos vindos do site público |
| `configuracoes` | Chave-valor com os textos do site |

#### MongoDB (Mongoose) — 6 coleções

| Coleção | Papel |
|---|---|
| `checkins` | Reserva de vaga, com lista de espera ordenada |
| `frequencias` | Confirmação de que o aluno **fez** a aula |
| `notificacoes` | Avisos ao aluno e ao painel, com deduplicação |
| `campanhas` | Campanhas de marketing/retenção segmentadas |
| `eventos_pagamento` | Trilha append-only do financeiro |
| `auditoria` | Log de ações administrativas |

### Check-in ≠ frequência

Decisão de domínio, e é o eixo do sistema:

- **check-in** acontece *antes* da aula e garante a vaga. Quando a turma lota, o
  aluno entra numa fila; se alguém cancela, o primeiro da fila sobe
  automaticamente e é avisado.
- **frequência** acontece *depois* e confirma que o aluno compareceu. É
  registrada na chamada pelo painel ou por toque na tela da sala.

Um aluno pode ter check-in e faltar. Os relatórios usam frequência, a lotação
usa check-in.

---

## Perfis e autenticação

| Perfil | Entra por | Acessa |
|---|---|---|
| `ADMIN` | e-mail e senha | `/admin/**` |
| `ALUNO` | e-mail e senha | `/aluno/**` |
| `AULA` | token de dispositivo em `/tv/parear` | `/tv` |

**Fluxo de sessão:** access token de 15 min + refresh rotativo persistido como
hash SHA-256. Cada refresh revoga o anterior. Trocar a senha derruba as demais
sessões. O interceptor do Angular enfileira as requisições enquanto renova, para
não disparar vários refresh em paralelo.

**Perfil `AULA`:** o admin cadastra a TV em *Configurações → Tela da sala →
Dispositivos* e recebe um token de vida longa (365 dias por padrão). A TV guarda
esse token no `localStorage` e o troca por um access token sozinha quando o
anterior expira — ninguém precisa fazer login na sala.

---

## Como rodar

Pré-requisitos: **Node 22+** e **Docker**.

```bash
npm run setup     # instala, sobe os bancos, migra e popula
npm run dev       # API em :3333 e web em :4200
```

O `setup` equivale a:

```bash
npm install
npm run infra:up        # postgres + mongo (replica set de nó único)
npm run build:shared    # o api e o web dependem do dist do shared
npm run db:migrate
npm run db:seed
```

Copie `apps/api/.env.example` para `apps/api/.env` antes do primeiro
`db:migrate` se quiser mudar credenciais ou segredos.

> O Mongo sobe como replica set de nó único porque é o que habilita transações e
> change streams. O container `mongo-init` faz o `rs.initiate()` na primeira vez.

### Acessos do seed

| Perfil | Credencial |
|---|---|
| Admin | `admin@almativa.com.br` / `almativa123` |
| Aluno | `ana.ramos@exemplo.com` / `almativa123` (todos os 8 alunos usam a mesma senha) |
| TV | token `almativa-tv-demo-token-0001` em `/tv/parear` |

O seed cria 3 modalidades, 3 instrutores, 6 planos, 12 turmas, 8 alunos com
histórico financeiro de 3 competências, 6 presets de cronômetro, 3 playlists e
6 semanas de aulas materializadas (2 para trás, 4 para frente).

> ⚠️ As playlists do seed usam ids de vídeo de exemplo que podem não tocar.
> Substitua por links reais em *Configurações → Tela da sala → Playlists*.

---

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Sobe API e web juntos |
| `npm run dev:api` / `dev:web` | Sobe um de cada vez |
| `npm run build` | Build de produção dos três pacotes |
| `npm run build:shared` | Só o pacote compartilhado (rode após mexer nos DTOs) |
| `npm run infra:up` / `infra:down` | Sobe/derruba os bancos |
| `npm run infra:reset` | Derruba **com os volumes** e sobe limpo |
| `npm run db:migrate` | Aplica migrações do Prisma |
| `npm run db:seed` | Popula o banco (idempotente) |
| `npm run db:studio` | Abre o Prisma Studio |
| `npm run test` | Testes da API + do front (31 no total) |
| `npm run test:api` | Só a API — Vitest, 18 testes |
| `npm run test:web` | Só o front — Karma headless, 13 testes |

---

## Variáveis de ambiente

Todas validadas com Zod no boot (`apps/api/src/config/env.ts`); a API não sobe
com configuração inválida.

| Variável | Padrão | Para quê |
|---|---|---|
| `PORT` | `3333` | Porta da API |
| `API_PREFIX` | `/api` | Prefixo de todas as rotas |
| `CORS_ORIGINS` | `http://localhost:4200` | Lista separada por vírgula |
| `TIMEZONE` | `America/Sao_Paulo` | Fuso dos jobs |
| `DATABASE_URL` | — | Postgres |
| `MONGO_URL` | — | MongoDB |
| `JWT_ACCESS_SECRET` | — | **Troque em produção** |
| `JWT_REFRESH_SECRET` | — | **Troque em produção** |
| `JWT_ACCESS_TTL` | `15m` | Vida do access token |
| `JWT_REFRESH_TTL` | `30d` | Vida do refresh |
| `JWT_DEVICE_TTL` | `365d` | Vida do token da TV |
| `JOBS_ENABLED` | `true` | Liga/desliga o cron |
| `CRON_*` | ver `.env.example` | Horário de cada job |
| `DIAS_AVISO_VENCIMENTO` | `7,3,1` | Marcos de lembrete antes do vencimento |

Gere segredos com:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## API

Base: `http://localhost:3333/api`. Erros seguem um envelope único:

```json
{ "erro": { "codigo": "PROIBIDO", "mensagem": "Você não tem matrícula ativa em Jiu-Jitsu." } }
```

| Grupo | Rotas | Acesso |
|---|---|---|
| `/publico` | modalidades, planos, instrutores, grade, contato, configurações | aberto |
| `/auth` | login, refresh, logout, me, trocar-senha, dispositivos | misto |
| `/catalogo` | modalidades, instrutores, planos, turmas | leitura autenticada · escrita admin |
| `/alunos` | CRUD, acesso, matrículas, visão 360 | admin |
| `/aulas` | agenda, geração, cancelamento, check-ins, chamada, relatório | admin/TV |
| `/financeiro` | mensalidades, pagamentos, renovações, lembretes, histórico | admin |
| `/comunicacao` | notificações e campanhas | admin |
| `/painel` | indicadores do dashboard | admin |
| `/aluno` | perfil, agenda, check-in, frequência, mensalidades, avisos | aluno |
| `/tv` | painel da sala, timers, playlists | TV/admin |

Rate limit global de 240 req/min em produção; login e formulário de contato têm
limites próprios mais apertados.

---

## Rotinas automáticas

Rodam via `node-cron` no fuso configurado. Todas são **idempotentes** e podem
ser disparadas à mão pelo painel.

| Job | Quando | O que faz |
|---|---|---|
| `marcar-vencidas` | 00:10 | Marca como vencida toda mensalidade aberta cujo vencimento passou |
| `lembretes-vencimento` | 08:00 | Avisa aluno **e** painel nos marcos de 7/3/1 dia antes, no dia, e em 1/3/7/15/30 dias de atraso |
| `gerar-aulas` | segunda, 03:00 | Materializa 4 semanas de aulas a partir da grade de turmas |
| `gerar-mensalidades` | dia 1, 02:00 | Gera as cobranças da competência para as matrículas ativas |

No boot, a API também garante que existam aulas para as próximas duas semanas.

---

## Regras de negócio

Onde o sistema tem opinião:

- **Lista de espera** — cancelar um check-in confirmado promove o primeiro da
  fila, avisa o aluno e reordena as posições restantes.
- **Janela de check-in** — abre 7 dias antes e fecha 15 minutos após o início.
- **Matrícula obrigatória** — o aluno só faz check-in em modalidade em que tem
  matrícula ativa. O admin pode furar essa regra para aula experimental.
- **Deduplicação de lembrete** — a chave `venc:aluno:<id>:d-7` garante um aviso
  por mensalidade por marco. O job pode rodar quantas vezes for.
- **Pagamento parcial** — a mensalidade só vira `PAGA` quando a soma dos
  pagamentos alcança o valor. Excedente é recusado.
- **Planos não mensais** — trimestral/semestral/anual só geram cobrança no mês
  de aniversário do ciclo.
- **Vencimento em mês curto** — dia 31 em fevereiro cai no último dia do mês.
- **Conflito de sala** — duas turmas ativas não podem se sobrepor na mesma sala
  e dia.
- **Exclusão x inativação** — aluno com histórico de pagamento é inativado, não
  excluído. Planos, turmas e instrutores são sempre desativados.
- **Cancelar aula** — libera todos os check-ins e avisa quem tinha vaga.

---

## Convenção de datas

Colunas `@db.Date` do Postgres voltam do driver como **meia-noite UTC**. Comparar
com meia-noite local faz o dia escorregar em fusos negativos como o do Brasil —
uma mensalidade que vence hoje aparece como vencida ontem, e "em 5 dias" vira
"em 4".

Por isso `apps/api/src/utils/datas.ts` separa dois mundos:

| Tipo | Helpers | Regra |
|---|---|---|
| **Data pura** (vencimento, nascimento, matrícula) | `dataPura`, `deIsoData`, `hojeComoData`, `diferencaEmDias`, `vencimentoDaCompetencia` | construída e lida em **UTC** |
| **Timestamp** (início de aula, pagamento) | `inicioDoDiaLocal`, `fimDoDiaLocal`, `comHora`, `inicioDoMesLocal` | fuso **local** do servidor |

No front, `QuandoPipe` faz a mesma distinção: `"AAAA-MM-DD"` é montada como data
local em vez de passar pelo parser UTC do JavaScript.

**Se você mexer em qualquer comparação de data, releia esta seção.** Foi a fonte
de todos os bugs de fuso encontrados até aqui.

---

## Identidade visual

O tema Material 3 é gerado a partir das cores da logo, em
`apps/web/src/styles/_paleta.scss`:

| Papel | Cor | Origem na logo |
|---|---|---|
| Primary | `#1E4D3B` | verde escuro das folhas e do logotipo |
| Secondary | verde acinzentado | folhagem clara |
| Tertiary | `#5C9A98` | teal da onda sob o lobo |
| Superfície | `#F7F4EC` | creme do fundo |

Tipografia: **Outfit** nos títulos (próxima do logotipo) e **Inter** no corpo.
Ícones: Material Symbols Outlined.

A tela da sala inverte para fundo escuro — é feita para ser lida de longe, com
o cronômetro em `clamp(4rem, 2rem + 11vw, 11rem)` e cor que muda conforme o tipo
do intervalo (trabalho, descanso, preparo, transição).

---

## Estrutura de pastas

```
apps/api/src/
├── config/        env validado com Zod, logger (pino)
├── db/            Prisma, Mongoose e os models de evento
├── middleware/    autenticação, validação, tratamento de erro
├── modules/
│   ├── auth/          login, refresh rotativo, dispositivos da TV
│   ├── catalogo/      modalidades, instrutores, planos, turmas
│   ├── alunos/        cadastro, acesso, matrículas
│   ├── aulas/         agenda e geração de ocorrências
│   ├── presenca/      check-in (com fila) e frequência
│   ├── financeiro/    mensalidades, pagamentos, renovações, lembretes
│   ├── comunicacao/   notificações e campanhas
│   ├── painel/        indicadores do dashboard
│   ├── aluno-area/    endpoints do próprio aluno
│   ├── tv/            painel da sala, timers, playlists
│   ├── publico/       site aberto
│   └── comum/         mapeadores Prisma→DTO e Mongo→DTO
├── jobs/          agendamentos
└── utils/         datas, erros, segurança, helpers HTTP

apps/web/src/app/
├── core/          auth (service, guards, interceptor), clientes de API,
│                  pipes de formato, rótulos de status, snackbar
├── shared/        logo, selo de status, cartão de KPI, estado vazio
├── layouts/       casca pública e casca das áreas logadas (compartilhada)
├── publico/       home, modalidades, horários, planos, contato
├── auth/          login e pareamento da TV
├── admin/         dashboard, alunos, agenda, financeiro, renovações,
│                  frequência, comunicação, sala, configurações
├── aluno/         início, agenda, frequência, mensalidades, avisos, perfil
└── tv/            painel da sala, cronômetro, player do YouTube
```

### Notas de implementação

- **Cronômetro** conta pelo relógio do sistema (não acumula erro de
  `setInterval`) e sintetiza o bipe via Web Audio, sem arquivo externo. O áudio
  só é liberado após o primeiro clique — exigência do navegador.
- **Player do YouTube** carrega a IFrame API uma única vez por página; em
  `somenteAudio` o iframe fica oculto e serve só como fonte de som.
- **Tela da sala** faz polling a cada 20 s e marca presença de forma otimista,
  revertendo se a API recusar.
- **`MapaRotulos<T>`** existe porque linhas de `mat-table` chegam ao template
  como `any`; o tipo aceita índice string sem perder a checagem de que todas as
  chaves do enum estão presentes.

---

## Pendências

Levantadas por inspeção do código, não por suposição. Ordenadas por impacto.

### Bloqueadores para produção

- [ ] **Cobertura de teste ainda rasa.** Existem 31 testes, todos sobre lógica
      pura: `utils/datas` na API (18) e os pipes de formato no front (13) — o
      suficiente para travar a convenção de fuso contra regressão. Falta o que
      depende de banco: lista de espera do check-in, geração de mensalidades,
      pagamento parcial, deduplicação de lembrete e os guards de autenticação.
      Não há teste de integração nem end-to-end.
- [ ] **Sem ESLint.** Não há configuração em nenhum pacote do monorepo. O
      script `lint` do root foi removido por apontar para um script inexistente
      — melhor não ter do que ter um que sempre falha.
- [ ] **Sem Dockerfile e sem CI.** Só os bancos estão containerizados; não há
      imagem da API nem do front, nem pipeline de build/deploy.
- [ ] **Segredos JWT com valor de exemplo** no `.env.example`. Precisam ser
      trocados e injetados pelo ambiente antes de qualquer deploy.
- [ ] **Rate limit em memória.** `express-rate-limit` sem store externo não
      funciona com mais de uma instância; precisa de Redis para escalar.
- [ ] **Refresh tokens expirados nunca são expurgados.** A tabela cresce
      indefinidamente; falta um job de limpeza.

### Funcionalidades declaradas mas não entregues

- [ ] **Canais de notificação além do app.** `CanalNotificacao` tem `EMAIL`,
      `WHATSAPP` e `SMS`, e eles são persistidos na notificação — mas nada os
      entrega. Só o canal `APP` funciona de fato.
- [ ] **Campanhas agendadas não disparam.** O campo `agendadaPara` é salvo e o
      status vira `AGENDADA`, mas não existe job que varra e envie. Hoje só o
      envio manual funciona.
- [ ] **Log de auditoria nunca é gravado.** `AuditoriaModel` está definido, com
      índices, e não é chamado em lugar nenhum.
- [ ] **Aulas nunca entram em `EM_ANDAMENTO`.** O status existe no enum e é
      considerado nas consultas, mas nada faz a transição automática quando a
      aula começa.
- [ ] **Sem "esqueci minha senha".** O aluno depende do admin redefinir e
      repassar a senha provisória.
- [ ] **Sem upload de arquivo.** `fotoUrl` (aluno e instrutor) aceita apenas
      URL externa; não há multipart nem storage.
- [ ] **Sem integração de pagamento.** Pix, cartão e boleto são apenas rótulos
      de lançamento manual — não há gateway nem conciliação.

### Telas e ações faltando

- [ ] **Leads do site não têm tela.** O formulário de contato grava na tabela
      `leads`, mas não há nenhuma tela no admin para lê-los. Hoje só via banco.
- [ ] **Textos do site não são editáveis.** A tabela `configuracoes` alimenta a
      home e a página de contato, mas só o seed escreve nela.
- [ ] **Playlists não podem ser editadas.** Só criar e excluir — o endpoint
      `PATCH /tv/playlists/:id` existe na API e no cliente, mas não há UI. Os
      timers têm edição completa.
- [ ] **Estorno escolhe sempre o primeiro pagamento.** Em mensalidade com
      pagamento parcial, a tela de financeiro estorna `pagamentos[0]` sem deixar
      escolher qual.
- [ ] **Trancamento de matrícula sem fluxo.** `StatusAluno.TRANCADO` e
      `StatusMatricula.SUSPENSA` existem e são exibidos, mas não há ação
      dedicada com data de início/fim.
- [ ] **Reposição de aula.** Citada no FAQ da página de planos, sem
      implementação.
- [ ] **Financeiro sem exportação.** O relatório de frequência exporta CSV; o
      financeiro não.

### Qualidade e robustez

- [ ] **Transações do Mongo não são usadas.** O replica set está configurado
      justamente para isso, mas operações que tocam Postgres e Mongo (ex.:
      cancelar aula) não são atômicas entre os dois bancos.
- [ ] **Sem paginação em algumas listas.** Campanhas (limite fixo de 200),
      histórico financeiro do aluno (100) e frequência do aluno (60) truncam sem
      avisar.
- [ ] **Acessibilidade não auditada.** Há `aria-label` e `role` nos pontos
      óbvios, mas não houve verificação com leitor de tela nem de contraste.
- [ ] **Sem i18n.** Textos em pt-BR direto no template.
- [ ] **Sem PWA/offline.** Relevante para a área do aluno no celular dentro da
      academia.
- [ ] **Angular 20 está 2 majors atrás.** Ver [Versões](#versões).
