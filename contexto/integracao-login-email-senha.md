# Integração login e-mail/senha — Backend ↔ Front Angular

Guia prático do que foi implementado no **back-plataforma-esporte** e como o **front-plataforma-esporte** (Angular) deve consumir a API para autenticar usuários com **e-mail e senha**.

> Contrato completo (Google OAuth, segurança, roles): ver `integracao-auth-backend.md`.

---

## 1. O que foi desenvolvido no backend

### Autenticação JWT

- A API emite um **JWT da plataforma** (não token do Google).
- Algoritmo: **HS256**.
- Expiração padrão: **60 minutos**.
- Audience: `front-plataforma-esporte`.

### Endpoints usados no login e-mail/senha

| Método | Rota | Autenticação | Descrição |
|--------|------|--------------|-----------|
| `POST` | `/api/auth/login` | Não | Valida e-mail/senha e retorna JWT |
| `GET` | `/api/me` | Bearer JWT | Retorna dados do usuário logado |

### Persistência (MongoDB)

Coleção `users` com:

| Campo | Descrição |
|-------|-----------|
| `Id` | `Guid` — claim `sub` do JWT |
| `Email` | Único, normalizado (minúsculas) |
| `Name` | Nome exibido |
| `PasswordHash` | Hash ASP.NET Identity (`PasswordHasher`) |
| `Roles` | `Organizer`, `Athlete` |
| `GoogleSubjectId` | Opcional (login Google) |
| `PictureUrl` | Opcional |

### Segurança aplicada

- Senha nunca trafega armazenada — apenas hash.
- Mensagem genérica em credenciais inválidas: *"E-mail ou senha inválidos."*
- Rate limit no login: **10 tentativas/minuto** por política `auth-login`.
- Erros em **Problem Details** (`application/problem+json`).
- CORS liberado para `http://localhost:4200` (configurável).

### Usuários de desenvolvimento (seed automático)

Criados na primeira subida em ambiente **Development**:

| E-mail | Senha | Roles |
|--------|-------|-------|
| `organizador@plataforma.local` | `SenhaForte@123` | `Organizer`, `Athlete` |
| `atleta@plataforma.local` | `SenhaForte@123` | `Athlete` |

### Arquitetura (hexagonal)

```
Angular → AuthController → LoginUseCase → UserRepository → MongoDB
                ↓
         JwtTokenService (gera JWT)

Angular → MeController → GetCurrentUserUseCase → UserRepository
         (header Bearer)
```

---

## 2. URLs da API (escolha uma)

| Ambiente | Comando | `apiUrl` no Angular |
|----------|---------|---------------------|
| **Docker** (recomendado p/ integração rápida) | `docker compose up -d` | `http://localhost:5080` |
| **Local dotnet HTTP** | `dotnet run --launch-profile http` | `http://localhost:5080` |
| **Local dotnet HTTPS** | `dotnet run --launch-profile https` | `https://localhost:5001` |

Swagger (Development): `{apiUrl}/swagger`

Health check: `{apiUrl}/health`

---

## 3. Configuração do front Angular

### `environment.development.ts`

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:5080',           // sem barra no final
  credentialsLoginPath: '/api/auth/login',
  googleAuthPath: '/api/auth/google',          // não usado neste fluxo
  useAuthMock: false                             // OBRIGATÓRIO para API real
};
```

### Pré-requisitos

1. Backend rodando (Docker ou `dotnet run`).
2. MongoDB acessível (incluso no `docker compose`).
3. Front em `http://localhost:4200` (origin permitido no CORS).
4. `useAuthMock: false` — com `true`, o front **não chama** a API.

---

## 4. Fluxo completo (e-mail/senha)

```mermaid
sequenceDiagram
  participant U as Usuário
  participant F as Angular :4200
  participant A as API

  U->>F: Preenche e-mail e senha
  F->>A: POST /api/auth/login
  A-->>F: 200 { accessToken }
  F->>F: localStorage.setItem('access_token', token)
  F->>A: GET /api/me (Authorization: Bearer)
  A-->>F: 200 { id, email, name, roles, ... }
  F->>F: Atualiza sessão e redireciona returnUrl
```

### Passo a passo no front

1. Usuário envia formulário em `/auth/login`.
2. Front faz `POST {apiUrl}/api/auth/login` com JSON `{ email, password }`.
3. E-mail deve ir com `.trim()` antes de enviar.
4. Em **200**, salvar `accessToken` em `localStorage` (chave usada pelo front: `access_token`).
5. Chamar `GET {apiUrl}/api/me` com header `Authorization: Bearer {accessToken}`.
6. Montar objeto de sessão (`AuthUser`) com a resposta.
7. Redirecionar para `returnUrl` (ex.: `/organizador`).
8. Se `returnUrl` exige role `Organizer` e o usuário não tem, redirecionar para `/` com `?accessDenied=organizer`.

### Interceptor (já previsto no front)

Todas as requisições autenticadas devem enviar:

```http
Authorization: Bearer <accessToken>
```

O interceptor **não** envia o header se o token começar com `dev-mock.` (modo mock local).

---

## 5. Contrato HTTP

### `POST /api/auth/login`

**Request**

```http
POST /api/auth/login HTTP/1.1
Host: localhost:5080
Content-Type: application/json

{
  "email": "organizador@plataforma.local",
  "password": "SenhaForte@123"
}
```

**Response 200**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response 400** — validação (campos vazios, e-mail inválido)

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  "title": "One or more validation errors occurred.",
  "status": 400,
  "detail": "E-mail e senha são obrigatórios."
}
```

**Response 401** — credenciais incorretas

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.2",
  "title": "Unauthorized",
  "status": 401,
  "detail": "E-mail ou senha inválidos."
}
```

**Response 429** — rate limit excedido (muitas tentativas)

---

### `GET /api/me`

**Request**

```http
GET /api/me HTTP/1.1
Host: localhost:5080
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response 200**

```json
{
  "id": "fb949eb5-f337-4566-8854-226cff1032b0",
  "email": "organizador@plataforma.local",
  "name": "Organizador Dev",
  "pictureUrl": null,
  "roles": ["Organizer", "Athlete"]
}
```

**Response 401** — token ausente, expirado ou inválido → front deve limpar sessão (`access_token` + estado do usuário).

---

## 6. Mapeamento front ↔ API

| Campo API (`/api/me`) | Campo front (`AuthUser`) | Observação |
|-----------------------|--------------------------|------------|
| `id` | `id` | string (GUID) |
| `email` | `email` | |
| `name` | `name` | |
| `pictureUrl` | `pictureUrl` | pode ser `null` |
| `roles` | `roles` | valores exatos: `Organizer`, `Athlete` |

### Roles e guards

| Role | Acesso |
|------|--------|
| `Organizer` | Rotas `/organizador/**` |
| `Athlete` | Inscrição em eventos (futuro) |

O guard `organizer.guard.ts` verifica se `roles` contém `"Organizer"`.

---

## 7. Claims do JWT (fallback)

Se `GET /api/me` falhar logo após o login, o front pode decodificar o JWT como fallback. Claims emitidas pela API:

| Claim | Exemplo |
|-------|---------|
| `sub` | GUID do usuário |
| `email` | `organizador@plataforma.local` |
| `name` | `Organizador Dev` |
| `picture` | URL (opcional) |
| `roles` | `"Organizer"`, `"Athlete"` (pode repetir por role) |

---

## 8. Exemplo de código TypeScript (referência)

### Login (`auth-api.service.ts`)

```typescript
login(credentials: { email: string; password: string }) {
  const url = `${environment.apiUrl}${environment.credentialsLoginPath}`;
  return this.http.post<{ accessToken: string }>(url, {
    email: credentials.email.trim(),
    password: credentials.password
  });
}
```

### Buscar usuário logado

```typescript
getMe(token: string) {
  return this.http.get<AuthUser>(`${environment.apiUrl}/api/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}
```

### Orquestração (`auth.service.ts`)

```typescript
async loginWithCredentials(email: string, password: string, returnUrl: string) {
  const { accessToken } = await firstValueFrom(
    this.authApi.login({ email, password })
  );

  localStorage.setItem('access_token', accessToken);

  const user = await firstValueFrom(this.authApi.getMe(accessToken));
  this.setCurrentUser(user);

  this.router.navigateByUrl(returnUrl || '/');
}
```

---

## 9. Teste manual (sem front)

### Com Docker rodando

```powershell
# Login
$body = '{"email":"organizador@plataforma.local","password":"SenhaForte@123"}'
$login = Invoke-RestMethod -Uri "http://localhost:5080/api/auth/login" `
  -Method Post -Body $body -ContentType "application/json"

# Me
$headers = @{ Authorization = "Bearer $($login.accessToken)" }
Invoke-RestMethod -Uri "http://localhost:5080/api/me" -Headers $headers
```

### Com curl

```bash
curl -X POST http://localhost:5080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"organizador@plataforma.local","password":"SenhaForte@123"}'

curl http://localhost:5080/api/me \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```

---

## 10. Checklist de integração

### Backend

- [ ] `docker compose up -d` ou `dotnet run` executando
- [ ] `GET /health` retorna `Healthy`
- [ ] `POST /api/auth/login` retorna `accessToken`
- [ ] `GET /api/me` com Bearer retorna `roles`

### Front

- [ ] `useAuthMock: false`
- [ ] `apiUrl` aponta para a API correta (5080 ou 5001)
- [ ] `credentialsLoginPath: '/api/auth/login'`
- [ ] Token salvo em `localStorage` como `access_token`
- [ ] Interceptor envia `Authorization: Bearer`
- [ ] Após login, chama `/api/me` antes de redirecionar
- [ ] Guard de organizador valida role `Organizer`

---

## 11. Problemas comuns

| Sintoma | Causa provável | Solução |
|---------|----------------|---------|
| Erro CORS no browser | Origin não permitido | Confirmar front em `http://localhost:4200`; reiniciar API |
| `401` no login | E-mail/senha errados ou usuário inexistente | Usar contas seed da seção 1 |
| `401` no `/api/me` | Token expirado ou `apiUrl`/`Issuer` inconsistentes | Fazer login de novo; no Docker usar `http://localhost:5080` |
| Front não chama API | `useAuthMock: true` | Alterar para `false` |
| `429 Too Many Requests` | Rate limit (10/min) | Aguardar 1 minuto |
| Network Error | API parada | `docker compose ps` ou subir com `dotnet run` |

---

## 12. O que ainda não existe

| Item | Status |
|------|--------|
| `POST /api/auth/register` | Não implementado — cadastro e-mail/senha virá depois |
| Refresh token | Não implementado — relogar após 60 min |
| Logout server-side | Não necessário — front apaga `access_token` |

---

## 13. Arquivos relevantes no backend

```
src/BackPlataformaEsporte.Api/
  Controllers/AuthController.cs      # POST /api/auth/login
  Controllers/MeController.cs        # GET /api/me
  Extensions/AuthServiceExtensions.cs
  Program.cs                         # CORS, JWT, rate limit

src/BackPlataformaEsporte.Application/
  Auth/Login/LoginUseCase.cs
  Auth/GetCurrentUser/GetCurrentUserUseCase.cs
  Auth/Dtos/

src/BackPlataformaEsporte.Infrastructure/
  Auth/JwtTokenService.cs
  Auth/PasswordHasherService.cs
  Persistence/MongoDb/Repositories/UserRepository.cs
  Persistence/MongoDb/DevUserSeeder.cs
```

---

**Versão:** 1.0 — maio/2026 — login e-mail/senha + `/api/me` para integração Angular.
