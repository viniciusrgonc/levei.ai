# Levei.ai

Plataforma inteligente de entregas sob demanda — conecta solicitantes e entregadores autônomos em tempo real.

## Stack

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend:** Supabase (Auth, Database, Realtime, Storage, Edge Functions)
- **Mapas:** Google Maps JS SDK + Leaflet (fallback)
- **PWA:** vite-plugin-pwa
- **Deploy:** Vercel (autodeploy via GitHub)

## Perfis do sistema

| Perfil | Acesso |
|--------|--------|
| Solicitante | Cria e acompanha entregas |
| Entregador | Recebe, aceita e executa entregas |
| Administrador | Gestão completa da plataforma |

## Variáveis de ambiente

Crie um arquivo `.env` na raiz com:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_GOOGLE_MAPS_API_KEY=
```

## Desenvolvimento local

```bash
npm install
npm run dev
```

## Build de produção

```bash
npm run build
```

## Estrutura principal

```
src/
  pages/
    driver/       # Telas do entregador
    restaurant/   # Telas do solicitante
    admin/        # Telas administrativas
  components/     # Componentes reutilizáveis
  hooks/          # Custom hooks
  lib/            # Utilitários e configurações
  integrations/   # Integração Supabase
supabase/
  migrations/     # Migrations SQL
  functions/      # Edge Functions
```
