# Cadastro de organizador — Backend ↔ Front Angular

Endpoint para **criar conta de organizador** com e-mail e senha na tela de login/cadastro.

> Login: `integracao-login-email-senha.md`  
> Google: `integracao-login-google.md`

---

## Endpoint

```http
POST /api/auth/register/organizer
Content-Type: application/json
```

### Request

```json
{
  "name": "Flávio Camellosi",
  "email": "organizador@exemplo.com",
  "password": "SenhaForte@123",
  "confirmPassword": "SenhaForte@123"
}
```

| Campo | Obrigatório | Regras |
|-------|-------------|--------|
| `name` | Sim | Nome completo |
| `email` | Sim | E-mail válido, único na plataforma |
| `password` | Sim | Mínimo 8 caracteres |
| `confirmPassword` | Sim | Deve ser igual a `password` |

### Response `201 Created`

Mesmo formato do login — o front pode fazer **login automático**:

```json
{
  "accessToken": "<jwt-da-plataforma>"
}
```

Fluxo recomendado no front após `201`:

1. `localStorage.setItem('access_token', accessToken)`
2. `GET /api/me` com Bearer
3. Redirecionar para `/organizador` (ou `returnUrl`)

### Erros

| Status | Situação | `detail` (exemplo) |
|--------|----------|-------------------|
| `400` | Validação | `Nome é obrigatório.`, `E-mail inválido.`, `Senha e confirmação...` |
| `409` | E-mail já existe | `E-mail já cadastrado.` |
| `429` | Rate limit | Muitas tentativas (5/min) |

---

## Roles do usuário criado

- `Organizer` — acesso `/organizador`
- `Athlete` — inscrição em eventos (futuro)

---

## Configuração no Angular

```typescript
// environment.development.ts
registerOrganizerPath: '/api/auth/register/organizer',
```

```typescript
registerOrganizer(data: {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}) {
  const url = `${environment.apiUrl}${environment.registerOrganizerPath}`;
  return this.http.post<{ accessToken: string }>(url, {
    name: data.name.trim(),
    email: data.email.trim(),
    password: data.password,
    confirmPassword: data.confirmPassword
  });
}
```

---

## Teste manual (PowerShell)

```powershell
$body = @{
  name = "Organizador Teste"
  email = "org.teste@exemplo.com"
  password = "SenhaForte@123"
  confirmPassword = "SenhaForte@123"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5080/api/auth/register/organizer" `
  -Method Post -Body $body -ContentType "application/json"
```

---

**Versão:** 1.0 — maio/2026
