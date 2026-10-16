# FrontPlataformaEsporte

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 18.2.21.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## SSR (Server-Side Rendering)

O projeto usa **Angular SSR** (`@angular/ssr`) para renderizar as páginas no servidor —
essencial para o SEO/Open Graph das páginas públicas de evento (`/e/:slug`), pois os
crawlers de preview (WhatsApp, redes sociais) não executam JavaScript.

```bash
# Build (produção) — gera browser + server em dist/
npm run build

# Sobe o servidor SSR (Express) em http://localhost:4000
npm run serve:ssr:front-plataforma-esporte

# Build apontando para a API local (http://localhost:5080)
ng build --configuration development
```

Verificar as tags OG no HTML inicial:

```bash
curl http://localhost:4000/e/corrida-friboi-ibirapuera-10k | grep -i "og:"
```

### Docker

```bash
docker compose up -d --build   # expõe o SSR em http://localhost:4000
```

> **SSR-friendly:** nunca acesse `window`/`document`/`localStorage` diretamente.
> Use `isPlatformBrowser(PLATFORM_ID)` ou o token `DOCUMENT` (ver `TokenStorageService`).

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
