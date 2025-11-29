# Guia de Navegação GPS

## Visão Geral

O sistema Movvi inclui integração com aplicativos de navegação GPS (Google Maps e Waze) para auxiliar motoristas durante coleta e entrega, e também permitir que restaurantes visualizem as rotas.

## Função Utilitária: `getGoogleMapsLink`

Localizada em `src/lib/utils.ts`, essa função centraliza a lógica de geração de links para navegação GPS.

### Assinatura

```typescript
function getGoogleMapsLink(
  origin: [number, number] | undefined,
  destination: [number, number]
): string
```

### Parâmetros

- **origin**: Coordenadas de origem `[latitude, longitude]` ou `undefined` (usará localização atual do dispositivo)
- **destination**: Coordenadas de destino `[latitude, longitude]` (obrigatório)

### Retorno

URL do Google Maps formatada para navegação, incluindo:
- Modo de viagem: dirigindo (`travelmode=driving`)
- Origem e destino especificados
- Compatível com mobile (abre app nativo se disponível) e desktop

### Exemplos de Uso

```typescript
// Com origem específica
const url = getGoogleMapsLink(
  [-23.5505, -46.6333], // São Paulo
  [-23.9618, -46.3322]  // Santos
);

// Sem origem (usa localização atual)
const url = getGoogleMapsLink(
  undefined,
  [-23.9618, -46.3322]
);

// Abrir em nova janela/app
window.open(url, '_blank');
```

## Função Utilitária: `openNavigation`

Função auxiliar para abrir navegação diretamente, com suporte a Google Maps e Waze.

### Assinatura

```typescript
function openNavigation(
  origin: [number, number] | undefined,
  destination: [number, number],
  app: 'google' | 'waze' = 'google'
): void
```

### Parâmetros

- **origin**: Coordenadas de origem ou `undefined`
- **destination**: Coordenadas de destino
- **app**: Aplicativo de navegação (`'google'` ou `'waze'`, padrão: `'google'`)

### Exemplo

```typescript
// Abrir no Google Maps
openNavigation(undefined, [-23.9618, -46.3322], 'google');

// Abrir no Waze
openNavigation(undefined, [-23.9618, -46.3322], 'waze');
```

## Implementação nas Páginas

### 1. Página de Coleta (`PickupInProgress.tsx`)

**Botão:** "Ver Coleta no GPS"

```typescript
const openRouteInMaps = () => {
  if (!delivery) return;
  const destination: [number, number] = [
    delivery.pickup_latitude, 
    delivery.pickup_longitude
  ];
  const url = getGoogleMapsLink(currentPosition || undefined, destination);
  window.open(url, '_blank');
};
```

- Usa posição atual do motorista (se disponível) como origem
- Destino: coordenadas do local de coleta
- Abre em nova janela/app

### 2. Página de Entrega (`DeliveryInProgress.tsx`)

**Botão:** "Ir para Destino no GPS"

```typescript
const openRouteInMaps = () => {
  if (!delivery) return;
  const destination: [number, number] = [
    delivery.delivery_latitude, 
    delivery.delivery_longitude
  ];
  const url = getGoogleMapsLink(currentPosition || undefined, destination);
  window.open(url, '_blank');
};
```

- Usa posição atual do motorista como origem
- Destino: coordenadas do endereço de entrega
- Abre em nova janela/app

### 3. Página de Rastreamento Restaurante (`DeliveryTracking.tsx`)

**Botões:** "Ver Coleta" e "Ir para Destino"

```typescript
const openPickupInMaps = () => {
  if (!delivery) return;
  const destination: [number, number] = [
    delivery.pickup_latitude, 
    delivery.pickup_longitude
  ];
  const url = getGoogleMapsLink(undefined, destination);
  window.open(url, '_blank');
};

const openDeliveryInMaps = () => {
  if (!delivery) return;
  const destination: [number, number] = [
    delivery.delivery_latitude, 
    delivery.delivery_longitude
  ];
  const url = getGoogleMapsLink(undefined, destination);
  window.open(url, '_blank');
};
```

- Não especifica origem (usará localização atual do dispositivo)
- Permite que restaurante visualize as rotas
- Útil para contexto e suporte

## Comportamento por Plataforma

### Mobile (iOS/Android)

- **Google Maps instalado**: Abre automaticamente no app nativo
- **Google Maps não instalado**: Abre no navegador mobile
- **Deep links**: Suportados nativamente pelos apps

### Desktop

- Abre Google Maps no navegador
- Interface completa de navegação
- Pode ser usada para visualização e planejamento

## Recursos Futuros

### Suporte a Waze

A função `openNavigation` já está preparada para Waze:

```typescript
openNavigation(undefined, destination, 'waze'); // Abre no Waze
```

### Melhorias Possíveis

1. **Seletor de App**: Permitir usuário escolher entre Google Maps e Waze
2. **Outras Opções**: Apple Maps, Here WeGo, etc.
3. **Preferências**: Salvar app preferido do usuário
4. **Instruções Offline**: Download de rotas para uso offline

## Estrutura de URLs

### Google Maps

```
https://www.google.com/maps/dir/?api=1&origin={lat},{lng}&destination={lat},{lng}&travelmode=driving
```

### Waze

```
https://waze.com/ul?ll={lat},{lng}&navigate=yes
```

## Notas Técnicas

- Coordenadas no formato decimal (não DMS)
- Precisão recomendada: 6 casas decimais
- Validação de coordenadas deve ser feita antes de chamar as funções
- `window.open(..., '_blank')` é usado para compatibilidade com deep links
- Mobile browsers detectam automaticamente apps instalados

## Segurança

- Links externos abrem em nova janela/tab (`_blank`)
- Não há exposição de dados sensíveis nos URLs
- Apenas coordenadas geográficas públicas são compartilhadas
