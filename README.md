# Hexora App (Frontend)

Escritorio pixel art interativo com orquestracao de agentes IA seguindo metodologia SDD (Spec-Driven Development).

## Tech Stack

- **React 19** + TypeScript 5.9
- **Vite 8** (build + dev server)
- **Zustand** (state management com persistencia)
- **Tailwind CSS 4**
- **Firebase** (autenticacao)
- **Canvas 2D** (renderizacao top-down do escritorio pixel art)

## Pre-requisitos

- Node.js >= 18
- npm ou yarn

## Setup

```bash
# Clonar e entrar no diretorio
cd hexora-app

# Instalar dependencias
npm install

# Rodar em desenvolvimento
npm run dev
```

O app abre em `http://localhost:5173`

## Variaveis de ambiente

Crie um `.env` na raiz com as credenciais do Firebase:

```env
VITE_FIREBASE_API_KEY=sua-api-key
VITE_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=seu-projeto
VITE_FIREBASE_STORAGE_BUCKET=seu-projeto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

## Build para producao

```bash
npm run build
npm run preview  # testar o build localmente
```

Arquivos gerados em `dist/`.

## Estrutura de pastas

```
src/
  components/
    auth/           # Tela de login (Firebase Auth)
    hud/            # Barra superior (HUD)
    panels/         # Paineis: Story, Profile, Team, Workspace, AgentCanvas
    world/          # WorldCanvas (escritorio), StatePanel (fluxos), Log
  engine/
    iso.ts          # Projecao ortogonal (tile grid 26x14)
    sprites.ts      # Sprites procedurais (fallback)
    spritesheets.ts # Spritesheets PNG dos personagens
    office-layout.ts # Tilemap do escritorio (piso, paredes)
    furniture.ts    # Layout de moveis (mesas, PCs, cadeiras, decoracao)
    llm.ts          # Engine LLM multi-provider (Claude, GPT, Gemini, Mistral, Groq, Ollama)
    orchestration.ts # Analise de historias e montagem de fluxos
    github.ts       # Integracao GitHub (branches, commits, PRs)
  store/            # Zustand stores (UI, Profile, Workspace, Flow, LLMTrace)
  constants/        # Providers, Team, Grid, posicoes
  types/            # TypeScript interfaces
public/
  assets/
    floors/         # Texturas de piso (pixel-agents)
    walls/          # Texturas de parede
    furniture/      # Sprites de moveis (mesas, PCs, cadeiras, plantas, etc.)
  sprites/          # Spritesheets dos personagens (char_0 a char_5)
```

## LLM Local (Ollama)

Para usar modelos locais sem API key:

```bash
# Subir Ollama via Docker
docker run -d -p 11434:11434 ollama/ollama
docker exec -it <container_id> ollama pull llama3.1

# No app: selecionar provider "Local (Ollama)" no perfil do agente
# Campo de API key = URL base (default: http://localhost:11434)
```
