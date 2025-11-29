# Sistema de Design Movvi

## Visão Geral

Design minimalista, profissional e objetivo, inspirado em plataformas como Stripe, Uber e Linear.

## Paleta de Cores

### Cores Primárias

```css
--primary: 221 83% 48%        /* #1D4ED8 - Azul principal */
--primary-light: 217 91% 60%  /* #3B82F6 - Azul claro */
--primary-dark: 210 79% 15%   /* #0A2540 - Azul escuro */
```

**Uso:**
- Botões principais e CTAs
- Links e elementos interativos
- Destaques e estados ativos

### Cores Neutras

```css
--background: 0 0% 100%       /* #FFFFFF - Branco */
--foreground: 217 33% 12%     /* #111827 - Cinza muito escuro */
--secondary: 210 40% 98%      /* #F5F7FA - Cinza muito claro */
--border: 220 14% 91%         /* #E5E7EB - Cinza claro */
--muted-foreground: 217 19% 27% /* #374151 - Cinza escuro */
```

**Uso:**
- Backgrounds e superfícies
- Textos e títulos
- Bordas e divisores
- Estados desativados

### Cores de Status

```css
--success: 142 76% 36%   /* #16A34A - Verde */
--warning: 38 92% 50%    /* #F59E0B - Amarelo/Laranja */
--destructive: 0 72% 51% /* #DC2626 - Vermelho */
```

**Uso:**
- Feedbacks de sucesso
- Alertas e avisos
- Erros e ações destrutivas

### Status de Entregas

```css
--status-pending: 217 19% 27%     /* Aguardando - Cinza escuro */
--status-accepted: 217 91% 60%    /* Aceito - Azul */
--status-in-progress: 38 92% 50%  /* Em andamento - Laranja */
--status-delivered: 142 76% 36%   /* Entregue - Verde */
--status-cancelled: 0 72% 51%     /* Cancelado - Vermelho */
```

## Tipografia

### Fonte Principal
**Inter** - Moderna, legível e profissional

```css
font-family: 'Inter', system-ui, sans-serif;
```

### Tamanhos

```css
/* Corpo de texto */
font-size: 14px (0.875rem)   /* Padrão mobile */
font-size: 16px (1rem)       /* Padrão desktop */

/* Títulos */
h1: 24px - 32px (font-semibold)
h2: 20px - 24px (font-semibold)
h3: 18px - 20px (font-medium)
h4: 16px - 18px (font-medium)

/* Auxiliares */
small: 12px - 14px
caption: 11px - 12px
```

### Pesos

- **Regular (400)**: Texto comum
- **Medium (500)**: Labels, subtítulos
- **Semibold (600)**: Títulos, destaque
- **Bold (700)**: Títulos principais

## Componentes

### Botões

**Altura padrão:** 46px
**Border radius:** 8px
**Padding horizontal:** 24px
**Font weight:** medium (500)

```tsx
// Primário
<Button>Ação Principal</Button>

// Secundário
<Button variant="secondary">Ação Secundária</Button>

// Outline
<Button variant="outline">Ação Terciária</Button>

// Destrutivo
<Button variant="destructive">Excluir</Button>

// Tamanhos
<Button size="sm">Pequeno</Button>    // h-9
<Button size="default">Padrão</Button> // h-[46px]
<Button size="lg">Grande</Button>      // h-[52px]
```

**Estados:**
- Default: `shadow-[var(--shadow-button)]`
- Hover: `bg-primary/90`
- Focus: `ring-2 ring-ring ring-offset-1`
- Disabled: `opacity-50 pointer-events-none`

### Inputs

**Altura:** 46px
**Border radius:** 8px
**Padding:** 16px horizontal, 12px vertical
**Border:** 1px sólida

```tsx
<Input 
  placeholder="Digite aqui..." 
  className="h-[46px]"
/>
```

**Estados:**
- Default: `border-input`
- Focus: `border-primary ring-2 ring-primary/20`
- Error: `border-destructive`
- Disabled: `opacity-50 cursor-not-allowed`

### Cards

**Border radius:** 8px
**Padding:** 20px
**Border:** 1px sólida `--border`
**Shadow:** `var(--shadow-card)` - sutil

```tsx
<Card>
  <CardHeader>
    <CardTitle>Título do Card</CardTitle>
    <CardDescription>Descrição opcional</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Conteúdo */}
  </CardContent>
</Card>
```

**Variações:**
- Default: sombra suave
- Hover: pode ter `shadow-[var(--shadow-elevated)]`
- Interativo: adicionar transition

## Layout

### Dashboard

**Estrutura:**
```
┌─────────────┬──────────────────────┐
│             │                      │
│   Sidebar   │   Conteúdo Central   │
│   (fixa)    │    (responsivo)      │
│             │                      │
└─────────────┴──────────────────────┘
```

**Sidebar:**
- Largura: 240px (expandida) / 56px (collapsed)
- Background: `--sidebar-background`
- Border right: 1px `--sidebar-border`
- Ícones: Lucide React
- Padding interno: 16px

**Conteúdo:**
- Max-width: 1200px (centralizado)
- Padding: 24px (mobile) / 32px (desktop)
- Background: `--background`

### Grid System

```css
/* Cards em grid */
grid-cols-1           /* Mobile */
md:grid-cols-2        /* Tablet */
lg:grid-cols-3        /* Desktop */
xl:grid-cols-4        /* Large desktop */

/* Gap padrão */
gap-4 (16px)          /* Elementos próximos */
gap-6 (24px)          /* Seções */
gap-8 (32px)          /* Áreas distintas */
```

## Sombras

```css
/* Sutil - Cards, inputs */
--shadow-card: 0 1px 3px 0 hsl(217 33% 12% / 0.04), 
               0 1px 2px -1px hsl(217 33% 12% / 0.02);

/* Elevada - Modals, dropdowns */
--shadow-elevated: 0 4px 6px -1px hsl(217 33% 12% / 0.06), 
                   0 2px 4px -2px hsl(217 33% 12% / 0.04);

/* Botões */
--shadow-button: 0 1px 2px 0 hsl(217 33% 12% / 0.06);
```

## Espaçamentos

```css
/* Padrões recomendados */
p-2: 8px      /* Mínimo */
p-3: 12px     /* Pequeno */
p-4: 16px     /* Padrão */
p-5: 20px     /* Cards */
p-6: 24px     /* Seções */
p-8: 32px     /* Grandes */
```

## Bordas

```css
/* Border radius */
--radius: 0.5rem     /* 8px - padrão */
rounded-lg: 8px      /* Cards, buttons, inputs */
rounded-md: 6px      /* Elementos menores */
rounded-sm: 4px      /* Badges, tags */

/* Border width */
border: 1px          /* Padrão */
border-2: 2px        /* Destaque */
```

## Transições

```css
--transition-smooth: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

/* Uso */
transition-all duration-200 ease-out
```

**Tempos recomendados:**
- Hover states: 150ms - 200ms
- Modals/Dialogs: 200ms - 300ms
- Page transitions: 300ms - 400ms

## Microinterações

### Hover Effects
```tsx
// Botões
className="hover:scale-[1.02] active:scale-[0.98]"

// Cards
className="hover:shadow-elevated transition-shadow"

// Links
className="hover:text-primary transition-colors"
```

### Focus States
```tsx
// Sempre incluir ring para acessibilidade
className="focus-visible:ring-2 focus-visible:ring-primary"
```

### Loading States
```tsx
// Skeleton
<div className="animate-pulse bg-muted h-10 rounded-lg" />

// Spinner
<div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
```

## Ícones

**Biblioteca:** Lucide React
**Tamanho padrão:** 20px (h-5 w-5)
**Cor:** Herdar do texto ou `text-muted-foreground`

```tsx
import { User, Settings, Package } from 'lucide-react';

<User className="h-5 w-5 text-muted-foreground" />
```

## Acessibilidade

### Contraste
- Textos normais: mínimo 4.5:1
- Textos grandes: mínimo 3:1
- Elementos interativos: mínimo 3:1

### Focus Visible
Sempre incluir indicadores de foco:
```css
focus-visible:ring-2 
focus-visible:ring-primary 
focus-visible:ring-offset-1
```

### Semântica HTML
- Usar tags apropriadas (`button`, `nav`, `main`, `aside`)
- Labels em inputs
- Atributos ARIA quando necessário

## Responsividade

### Breakpoints
```css
sm: 640px    /* Tablet pequeno */
md: 768px    /* Tablet */
lg: 1024px   /* Desktop */
xl: 1280px   /* Desktop grande */
2xl: 1536px  /* Ultra wide */
```

### Mobile First
Sempre começar com mobile e adicionar complexidade:
```tsx
className="text-sm md:text-base lg:text-lg"
className="grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
```

## Boas Práticas

### ✅ Fazer
- Usar semantic tokens do design system
- Manter consistência visual
- Priorizar legibilidade
- Testar em diferentes dispositivos
- Usar sombras sutis
- Espaçamento generoso entre elementos

### ❌ Evitar
- Cores diretas (usar variáveis CSS)
- Muitas animações
- Sombras pesadas
- Bordas muito grossas
- Texto muito pequeno (<12px)
- Baixo contraste

## Exemplos de Uso

### Card de Entrega
```tsx
<Card className="hover:shadow-elevated transition-shadow">
  <CardHeader className="pb-3">
    <div className="flex items-start justify-between">
      <CardTitle className="text-lg">Entrega #12345</CardTitle>
      <Badge variant="success">Entregue</Badge>
    </div>
    <CardDescription>R$ 25,00 • 5.2 km</CardDescription>
  </CardHeader>
  <CardContent>
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <MapPin className="h-4 w-4 text-muted-foreground" />
        <span>Rua Exemplo, 123</span>
      </div>
    </div>
  </CardContent>
</Card>
```

### Formulário
```tsx
<form className="space-y-4">
  <div className="space-y-2">
    <Label htmlFor="name">Nome</Label>
    <Input 
      id="name" 
      placeholder="Digite seu nome"
      className="h-[46px]"
    />
  </div>
  
  <Button className="w-full h-[46px]">
    Salvar
  </Button>
</form>
```
