# Hexora App

Frontend da plataforma HEXORA — escritorio pixel art com orquestracao visual de agentes de IA.

## Stack

- **React 19** + Vite + TypeScript
- **Zustand** (state management)
- **Tailwind CSS v4**
- **Canvas 2D** (renderizacao isometrica)

## Setup local

```bash
# 1. Instalar dependencias
npm install

# 2. Copiar .env
cp .env.example .env
# Editar .env com suas configuracoes

# 3. Rodar em dev
npm run dev
```

Acesse `http://localhost:5173`.

## Variaveis de ambiente (.env)

```bash
# Backend API URL (obrigatorio)
VITE_API_URL=http://localhost:8000

# Firebase (OPCIONAL — deixe vazio pra auth local)
# So necessario se quiser login com Google OAuth
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

### Auth local (sem Firebase)

Se as variaveis `VITE_FIREBASE_*` estiverem vazias, o app usa autenticacao local:
- Cadastro e login por email/senha direto no backend
- Sem dependencia de servicos externos
- Ideal para deploy corporativo

## Docker

```dockerfile
# Dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

```nginx
# nginx.conf
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://api:8000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_buffering off;
    }
}
```

```bash
docker build -t hexora-app .
docker run -p 80:80 hexora-app
```

### Docker Compose completo

```yaml
services:
  app:
    build: ./hexora-app
    ports:
      - "80:80"
    depends_on:
      - api
    restart: unless-stopped

  api:
    build: ./hexora-api
    ports:
      - "8000:8000"
    volumes:
      - ./uploads:/app/uploads
    environment:
      - SECRET_KEY=gere-uma-chave-segura
    restart: unless-stopped

  ollama:
    image: ollama/ollama
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    restart: unless-stopped

volumes:
  ollama_data:
```

## Build de producao

```bash
npm run build
# Output em ./dist — servir com nginx, caddy ou qualquer servidor estatico
```

## Features

- Escritorio pixel art isometrico com 9 agentes de IA
- Metodologia SDD (Spec-Driven Development) com PO interativo
- Suporte a 6 providers LLM (Claude, GPT-4o, Gemini, Mistral, Llama, Local)
- Modelo configuravel por agente
- Custom system prompt por agente
- Knowledge Base com upload de arquivos e injecao no contexto LLM
- Workspaces por produto com stack, repo e KB proprios
- Integracao GitHub (commits + PR automatico)
- Suporte a GitHub Enterprise (URL configuravel)
- Proxy corporativo com autenticacao e skip SSL
- Auth local (email/senha) ou Firebase (Google OAuth)
- Token tracking por agente (input/output)
- Rastreabilidade completa de chamadas LLM
- Fontes servidas localmente (zero CDN externo)
- Zero chamadas externas do browser — tudo via backend proxy
