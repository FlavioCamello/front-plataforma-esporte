# Decisões de arquitetura — Front Angular (plataforma de eventos esportivos)

Documento de referência para evolução do projeto. Backend previsto: **.NET**. Front: **Angular 18** (`front-plataforma-esporte`).

Última atualização: maio/2026.

---

## 1. Visão do produto

Plataforma de **inscrição em eventos esportivos** (corrida, natação, etc.) com dois perfis principais:

| Perfil | Fluxo (resumo) |
|--------|----------------|
| **Atleta** | Página do evento → formulário de inscrição → pagamento (Mercado Pago) → confirmação |
| **Organizador** | Criar evento → lotes → distâncias/provas → lista de inscritos → financeiro simples |

Detalhamento das telas: ver `Ideia da plataforma` nesta pasta.

---

## 2. Decisões fechadas

### 2.1 Autenticação

| Item | Decisão |
|------|---------|
| Quem autentica | **Organizador e atleta** — ambos precisam de conta |
| Provedor (MVP) | **E-mail e senha** + **Google** (OAuth 2.0 / OpenID Connect) |
| Outros provedores | Fora do escopo inicial; arquitetura deve permitir adicionar depois |
| Onde validar token | **Backend .NET** (JWT emitido após callback Google); front envia Bearer no HTTP |
| Rotas públicas | Página do evento pode ser **visualizada sem login**; **inscrição exige login** |

**Implicações no Angular**

- `core/auth`: sessão, login e-mail/senha (`POST /api/auth/login`), login Google (redirect), logout.
- **Dev (`useAuthMock: true`)**: contas em `auth-mock.data.ts` — não chama API nem Google.
- `core/guards`: `authGuard` (usuário logado), `organizerGuard` (papel organizador), eventualmente `athleteGuard` se regras divergirem.
- Interceptor HTTP: anexar `Authorization: Bearer <token>`.
- Papéis/claims vindos do token ou endpoint `GET /me` após login.

### 2.2 Ciclo de vida do evento (rascunho)

| Item | Decisão |
|------|---------|
| Dados obrigatórios no create | **Não exigir conjunto completo** na primeira gravação |
| Comportamento | Organizador pode **salvar e sair**; completar lotes, provas e demais etapas depois |
| Modelo sugerido no backend | Campo `status` (ex.: `Draft`, `Published`, `Closed`) + validação por etapa na publicação |
| UX | Botões distintos quando fizer sentido: **Salvar rascunho** vs **Publicar evento** (publicar pode vir em fase posterior) |

**Implicações no Angular**

- Formulário “Criar evento” com validação **mínima** no save (ex.: nome); validação forte na publicação.
- Rotas encadeadas por `eventId`: `/organizador/eventos/:id/lotes`, `.../provas`, etc., sem wizard monolítico.
- Após `POST` ou `PATCH` de rascunho, redirecionar para próxima etapa (ex.: lotes) **ou** listagem de eventos — conforme UX definida na feature.

### 2.3 UI e performance

| Item | Decisão |
|------|---------|
| Biblioteca de componentes | **Angular Material** (+ CDK) |
| Motivo | Integração oficial com Angular, bundle razoável com tree-shaking, acessibilidade, tabelas/formulários/dialogs alinhados às telas de organizador |
| Estilos | SCSS global + tema Material customizado (cores da marca); `style=scss` já no projeto |
| Alternativas descartadas no MVP | PrimeNG (bundle maior), UI 100% custom (mais tempo) |

**Implicações**

- Instalar `@angular/material` quando iniciar features com formulários/tabelas.
- Componentes de domínio em `shared/ui` apenas quando Material não bastar (ex.: card de evento público).

### 2.4 Estrutura de pastas (feature-first)

```text
src/app/
├── core/                 # Singletons: HTTP, auth, interceptors, guards
├── shared/               # UI reutilizável, pipes, directives (sem regra de negócio)
├── layout/
│   ├── organizer-shell/  # Menu área organizador
│   └── public-shell/     # Layout páginas atleta / evento público
└── features/
    ├── organizer/
    │   └── events/
    │       ├── create-event/
    │       ├── event-batches/      # lotes
    │       ├── event-distances/    # provas/distâncias
    │       ├── registrations-list/
    │       └── event-finance/
    └── athlete/
        ├── event-page/             # página pública do evento
        ├── registration/           # formulário inscrição
        └── payment/                # redirect/embed MP via backend
```

- **Standalone components** (padrão Angular 18).
- **Lazy loading** por feature/rota.
- Estado: **Reactive Forms + services + Signals**; sem NgRx no MVP.

### 2.5 Integração com API (.NET)

| Item | Decisão |
|------|---------|
| Estilo | REST, recursos por agregado |
| Erros | **Problem Details** (`application/problem+json`) |
| Contratos | DTOs TypeScript espelhando DTOs C#; mapper form → DTO quando necessário |
| Documentação API | Swagger/OpenAPI no .NET → considerar geração de cliente TS quando API estabilizar |
| Base URL | `environment.apiUrl` (dev/prod) |
| Datas | API em **ISO 8601 (UTC)**; exibição com `DatePipe` / timezone local |

**Endpoints orientativos** (ajustar com o time backend):

```text
POST   /api/auth/login           # { email, password } → { accessToken }
POST   /api/auth/google          # ou callback server-side; front redireciona
GET    /api/me
POST   /api/events               # criar rascunho
PATCH  /api/events/{id}          # atualizar rascunho
POST   /api/events/{id}/publish  # opcional: publicar
GET    /api/events/{id}
POST   /api/events/{id}/batches
POST   /api/events/{id}/distances
GET    /api/events/{id}/registrations
GET    /api/events/{id}/finance-summary
GET    /api/public/events/{slug} # página pública
POST   /api/registrations        # inscrição atleta
POST   /api/registrations/{id}/checkout  # iniciar pagamento MP (backend)
```

### 2.6 Pagamento (Mercado Pago)

| Item | Decisão |
|------|---------|
| Onde integrar MP | **Backend .NET** (credenciais, webhook, confirmação) |
| Front atleta | Redirecionar para checkout MP **ou** embed conforme URL retornada pela API |
| Organizador | Sem integração MP direta no front; apenas visão financeiro agregada |

---

## 3. Rotas (mapa alvo)

```text
/                                    # landing ou redirect pós-login
/auth/login                          # inicia fluxo Google (se necessário rota dedicada)

/eventos/:slug                       # página pública (leitura sem login)
/eventos/:slug/inscricao             # inscrição (auth atleta)
/eventos/:slug/pagamento             # checkout (auth atleta)

/organizador                         # layout organizador (auth + papel)
  /organizador/eventos/novo          # criar evento (rascunho)
  /organizador/eventos/:id           # editar evento / resumo
  /organizador/eventos/:id/lotes
  /organizador/eventos/:id/provas
  /organizador/eventos/:id/inscritos
  /organizador/eventos/:id/financeiro
```

Guards:

- `authGuard`: qualquer usuário logado.
- `organizerGuard`: rotas sob `/organizador`.
- Inscrição/pagamento: `authGuard` (atleta autenticado; papel pode ser claim genérico `User`).

---

## 4. Contrato mínimo — Event (criar rascunho)

Alinhamento inicial front ↔ .NET (ajustar nomes com o backend).

**CreateEventRequest (POST)**

```json
{
  "name": "string",
  "date": "2026-06-15T00:00:00Z",
  "location": "string",
  "description": "string | null",
  "participantLimit": "number | null"
}
```

**EventResponse**

```json
{
  "id": "guid",
  "slug": "string",
  "name": "string",
  "date": "ISO-8601",
  "location": "string",
  "description": "string | null",
  "participantLimit": "number | null",
  "status": "Draft | Published | Closed",
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601"
}
```

**Validação front (rascunho)**

| Campo | Rascunho | Publicação (futuro) |
|-------|----------|---------------------|
| name | obrigatório, min 3 | obrigatório |
| date | opcional | obrigatório, data futura |
| location | opcional | obrigatório |
| description | opcional | opcional |
| participantLimit | opcional, > 0 se informado | opcional |

Erros de validação: HTTP 400 com Problem Details e, se possível, `errors` por campo.

---

## 5. Roadmap de implementação (ordem acordada)

### Fase 1 — Core

- [x] `environments` com `apiUrl` (+ `useAuthMock` em dev)
- [x] Configuração HTTP (`provideHttpClient`, interceptors)
- [x] Interceptor: Bearer token
- [ ] Interceptor: erros HTTP → mensagem usuário
- [x] `AuthService` (Google redirect + callback + mock dev)
- [x] Login e-mail/senha contra API (`useAuthMock: false`, `apiUrl` :5080)
- [x] Login Google OAuth (redirect + `/auth/callback` + `GET /api/auth/google/status`)
- [x] `authGuard`, `organizerGuard`, `guestGuard`
- [x] Layout `/organizador` (shell com navegação)
- [x] Rotas lazy área organizador
- [x] Telas: login, callback, home, dashboard organizador

### Fase 2 — Criar evento

- [ ] Feature `create-event`: Reactive Form
- [ ] `OrganizerEventService`: `POST /api/events`, `PATCH` se editar
- [ ] Salvar rascunho com validação mínima
- [ ] Redirect para `/organizador/eventos/:id/lotes` (stub aceitável)

### Fase 3 — Contrato Event estável

- [ ] Interfaces TS alinhadas ao Swagger/DTOs .NET
- [ ] Tratamento 400 por campo no formulário
- [ ] Testes unitários: service + validadores

### Fase 4 — Lotes e distâncias

- [ ] Features irmãs: `event-batches`, `event-distances`
- [ ] Rotas sob `:eventId`
- [ ] Serviços e DTOs correspondentes

### Fase 5 — Área atleta

- [ ] `event-page` (pública, SEO-friendly)
- [ ] `registration` (form simples: nome, email, telefone, nascimento, distância, termo)
- [ ] `authGuard` na inscrição

### Fase 6 — Pagamento

- [ ] `payment`: chamar backend para URL de checkout MP
- [ ] Tela de confirmação pós-retorno/webhook (estado vindo da API)

---

## 6. O que evitar no MVP

- Micro-frontends ou monorepo Nx prematuro
- NgRx sem necessidade real de estado global complexo
- Wizard único com todos os passos do organizador em um componente
- Credenciais Mercado Pago no front
- Múltiplos provedores de login antes de Google estável

---

## 7. Referências internas

- `contexto/Ideia da plataforma` — fluxos e campos por tela
- `contexto/integracao-auth-backend.md` — contrato geral de auth (JWT, roles, endpoints)
- `contexto/integracao-login-email-senha.md` — login e-mail/senha + seed
- `contexto/integracao-login-google.md` — **OAuth Google** (v1.1: callback absoluto, status, OrganizerEmails em dev)
- `contexto/integracao-cadastro-organizador.md` — **POST /api/auth/register/organizer**
- Repositório front: `front-plataforma-esporte` (Angular 18, standalone, SCSS)

---

## 8. Histórico de decisões

| Data | Decisão |
|------|---------|
| 2026-05 | Auth: organizador + atleta; e-mail/senha + Google |
| 2026-05 | Mock dev: organizador@dev.local / atleta@dev.local (ver `auth-mock.data.ts`) |
| 2026-05 | Eventos podem ser salvos incompletos (rascunho) |
| 2026-05 | UI: Angular Material; arquitetura feature-first; MP só via backend |
| 2026-05 | Roadmap em 6 fases conforme seção 5 |
