# Arquitetura do Movvi - Diagrama Completo

## ðŸ—ï¸ VisÃ£o Geral da Arquitetura

<lov-mermaid>
graph TB
    subgraph "Frontend Layer"
        WEB1[Web App Restaurante<br/>React + Vite + TypeScript]
        WEB2[Painel Admin<br/>React + Vite + TypeScript]
        MOBILE[App Mobile Motoboy<br/>React Native + Capacitor]
    end

    subgraph "Backend - Supabase"
        subgraph "Authentication"
            AUTH[Supabase Auth<br/>Email/Password/OAuth]
        end
        
        subgraph "Database Layer"
            POSTGRES[(PostgreSQL<br/>Database)]
            RLS[Row Level Security<br/>Policies]
        end
        
        subgraph "Edge Functions"
            EF1[notify-drivers<br/>Notifica motoboys disponÃ­veis]
            EF2[calculate-price<br/>Calcula valor sugerido]
            EF3[process-payment<br/>Processa pagamentos]
            EF4[send-notification<br/>Push notifications]
            EF5[verify-documents<br/>Valida CNH/CNPJ]
            EF6[calculate-eta<br/>Tempo estimado]
        end
        
        subgraph "Real-time"
            RT[Realtime Subscriptions<br/>WebSocket]
            PRESENCE[Presence<br/>Status online]
        end
        
        subgraph "Storage"
            STORAGE[Supabase Storage<br/>Fotos e documentos]
        end
    end

    subgraph "External Services"
        MAPS[Google Maps API<br/>Rotas e Geocoding]
        PUSH[Firebase/OneSignal<br/>Push Notifications]
        PAYMENT[Stripe/Pagar.me<br/>Pagamentos]
        SMS[Twilio<br/>SMS]
    end

    %% ConexÃµes Frontend -> Backend
    WEB1 -->|REST API| POSTGRES
    WEB1 -->|Auth| AUTH
    WEB1 -->|WebSocket| RT
    WEB1 -->|Upload| STORAGE
    
    WEB2 -->|REST API| POSTGRES
    WEB2 -->|Auth| AUTH
    WEB2 -->|WebSocket| RT
    
    MOBILE -->|REST API| POSTGRES
    MOBILE -->|Auth| AUTH
    MOBILE -->|WebSocket| RT
    MOBILE -->|Location Updates| RT
    MOBILE -->|Upload| STORAGE

    %% Database Security
    POSTGRES -.->|Enforce| RLS
    RLS -.->|Validate| AUTH

    %% Edge Functions conexÃµes
    EF1 -->|Query| POSTGRES
    EF1 -->|Send| PUSH
    
    EF2 -->|Call| MAPS
    EF2 -->|Update| POSTGRES
    
    EF3 -->|Process| PAYMENT
    EF3 -->|Update| POSTGRES
    
    EF4 -->|Send| PUSH
    EF4 -->|Send| SMS
    
    EF5 -->|Validate| POSTGRES
    
    EF6 -->|Calculate| MAPS
    
    %% Triggers automÃ¡ticos
    POSTGRES -->|Trigger| EF1
    POSTGRES -->|Trigger| EF3
    POSTGRES -->|Trigger| EF4

    %% Real-time
    POSTGRES -->|Changes| RT
    RT -->|Broadcast| WEB1
    RT -->|Broadcast| WEB2
    RT -->|Broadcast| MOBILE

    style WEB1 fill:#9333ea
    style WEB2 fill:#3b82f6
    style MOBILE fill:#10b981
    style POSTGRES fill:#2563eb
    style AUTH fill:#f59e0b
    style RT fill:#ef4444
    style STORAGE fill:#8b5cf6
</lov-mermaid>

---

## ðŸ“± Detalhamento por Camada

### **1. Frontend Layer - Camada de ApresentaÃ§Ã£o**

<lov-mermaid>
graph LR
    subgraph "Web App Restaurante"
        R1[Dashboard]
        R2[Nova Entrega]
        R3[Rastreamento]
        R4[HistÃ³rico]
        R5[Financeiro]
    end
    
    subgraph "Painel Admin"
        A1[Monitoramento]
        A2[GestÃ£o UsuÃ¡rios]
        A3[Disputas]
        A4[Analytics]
        A5[ConfiguraÃ§Ãµes]
    end
    
    subgraph "App Mobile"
        M1[Home]
        M2[Entregas DisponÃ­veis]
        M3[NavegaÃ§Ã£o GPS]
        M4[Carteira]
        M5[Perfil]
    end
    
    style R1 fill:#9333ea
    style R2 fill:#9333ea
    style R3 fill:#9333ea
    style R4 fill:#9333ea
    style R5 fill:#9333ea
    
    style A1 fill:#3b82f6
    style A2 fill:#3b82f6
    style A3 fill:#3b82f6
    style A4 fill:#3b82f6
    style A5 fill:#3b82f6
    
    style M1 fill:#10b981
    style M2 fill:#10b981
    style M3 fill:#10b981
    style M4 fill:#10b981
    style M5 fill:#10b981
</lov-mermaid>

---

## ðŸ—„ï¸ Database Architecture - Estrutura de Dados

<lov-mermaid>
erDiagram
    PROFILES ||--o{ DRIVERS : "is"
    PROFILES ||--o{ RESTAURANTS : "is"
    PROFILES ||--o{ USER_ROLES : "has"
    
    DRIVERS ||--o{ DELIVERIES : "performs"
    DRIVERS ||--o{ DRIVER_LOCATIONS : "tracks"
    DRIVERS ||--o{ RATINGS : "receives"
    
    RESTAURANTS ||--o{ DELIVERIES : "creates"
    RESTAURANTS ||--o{ RATINGS : "receives"
    
    DELIVERIES ||--o{ TRANSACTIONS : "generates"
    DELIVERIES ||--o{ RATINGS : "has"
    DELIVERIES ||--o{ DISPUTES : "may_have"
    DELIVERIES ||--o{ NOTIFICATIONS : "triggers"
    
    PROFILES {
        uuid id PK
        text full_name
        text phone
        text avatar_url
        enum user_type
        timestamp created_at
    }
    
    DRIVERS {
        uuid id PK
        text vehicle_type
        text vehicle_plate
        text cnh_number
        enum status
        point current_location
        decimal rating_avg
        int total_deliveries
    }
    
    RESTAURANTS {
        uuid id PK
        text business_name
        text cnpj
        jsonb address
        decimal rating_avg
        int total_orders
    }
    
    DELIVERIES {
        uuid id PK
        uuid restaurant_id FK
        uuid driver_id FK
        jsonb pickup_address
        jsonb delivery_address
        decimal distance_km
        decimal price
        text description
        enum status
        timestamp created_at
    }
    
    DRIVER_LOCATIONS {
        uuid driver_id FK
        uuid delivery_id FK
        decimal latitude
        decimal longitude
        timestamp updated_at
    }
    
    TRANSACTIONS {
        uuid id PK
        uuid delivery_id FK
        decimal amount
        decimal platform_fee
        decimal driver_earning
        enum status
    }
    
    RATINGS {
        uuid id PK
        uuid delivery_id FK
        uuid rater_id FK
        uuid rated_id FK
        int rating
        text comment
    }
    
    NOTIFICATIONS {
        uuid id PK
        uuid user_id FK
        text title
        text body
        enum type
        boolean read
    }
    
    DISPUTES {
        uuid id PK
        uuid delivery_id FK
        uuid reporter_id FK
        enum status
        text description
    }
    
    USER_ROLES {
        uuid user_id FK
        enum role
    }
</lov-mermaid>

---

## ðŸ”„ Fluxo de Dados - Delivery Lifecycle

<lov-mermaid>
sequenceDiagram
    participant R as Restaurante Web
    participant DB as PostgreSQL
    participant EF as Edge Functions
    participant RT as Realtime
    participant M as Motoboy Mobile
    participant GPS as GPS/Maps API
    participant PN as Push Notifications
    
    Note over R,M: 1. CRIAÃ‡ÃƒO DO PEDIDO
    R->>DB: INSERT delivery
    DB->>EF: Trigger notify-drivers
    EF->>DB: Query available drivers (5km radius)
    EF->>PN: Send push to drivers
    PN->>M: Notification received
    
    Note over R,M: 2. ACEITE DO MOTOBOY
    M->>DB: UPDATE delivery (driver_id, status='aceito')
    DB->>RT: Broadcast change
    RT->>R: Update UI (driver accepted)
    
    Note over R,M: 3. RASTREAMENTO
    loop Every 10 seconds
        M->>GPS: Get current location
        GPS->>M: lat, lng
        M->>DB: UPSERT driver_locations
        DB->>RT: Broadcast location
        RT->>R: Update map marker
    end
    
    Note over R,M: 4. COLETA
    M->>DB: UPDATE delivery (status='em_coleta')
    DB->>RT: Broadcast change
    RT->>R: Update status
    M->>DB: Upload pickup photo
    M->>DB: UPDATE delivery (status='em_entrega')
    
    Note over R,M: 5. ENTREGA
    M->>GPS: Navigate to destination
    M->>DB: UPDATE delivery (status='entregue')
    DB->>EF: Trigger process-payment
    EF->>DB: INSERT transaction
    DB->>RT: Broadcast completion
    RT->>R: Show completed
    RT->>M: Payment processed
</lov-mermaid>

---

## ðŸ” Security Layer - Camada de SeguranÃ§a

<lov-mermaid>
graph TB
    subgraph "Client Applications"
        CLIENT[Web/Mobile Apps]
    end
    
    subgraph "Authentication Flow"
        LOGIN[Login Request]
        AUTH[Supabase Auth]
        JWT[JWT Token]
    end
    
    subgraph "Authorization"
        RLS_CHECK{RLS Policy Check}
        ROLE_CHECK{Role Check}
    end
    
    subgraph "Database Access"
        READ[Read Operations]
        WRITE[Write Operations]
        DB[(Database)]
    end
    
    CLIENT -->|1. Credentials| LOGIN
    LOGIN -->|2. Validate| AUTH
    AUTH -->|3. Generate| JWT
    JWT -->|4. Include in requests| RLS_CHECK
    
    RLS_CHECK -->|auth.uid()| ROLE_CHECK
    ROLE_CHECK -->|Authorized| READ
    ROLE_CHECK -->|Authorized| WRITE
    ROLE_CHECK -->|Denied| ERROR[403 Forbidden]
    
    READ --> DB
    WRITE --> DB
    
    style ERROR fill:#ef4444
    style JWT fill:#10b981
    style RLS_CHECK fill:#f59e0b
</lov-mermaid>

### **Exemplos de RLS Policies:**

```sql
-- Motoboys sÃ³ veem entregas disponÃ­veis na sua regiÃ£o
CREATE POLICY "drivers_view_nearby"
ON deliveries FOR SELECT
TO authenticated
USING (
  status = 'aguardando'
  AND ST_DWithin(
    pickup_address::geography,
    (SELECT current_location FROM drivers WHERE id = auth.uid()),
    5000 -- 5km
  )
);

-- Restaurantes sÃ³ veem suas prÃ³prias entregas
CREATE POLICY "restaurants_view_own"
ON deliveries FOR SELECT
TO authenticated
USING (restaurant_id = auth.uid());

-- Motoboys sÃ³ editam entregas que aceitaram
CREATE POLICY "drivers_update_own"
ON deliveries FOR UPDATE
TO authenticated
USING (driver_id = auth.uid());
```

---

## ðŸš€ Edge Functions Architecture

<lov-mermaid>
graph TB
    subgraph "Trigger-based Functions"
        T1[New Delivery Created]
        T2[Delivery Completed]
        T3[User Registered]
    end
    
    subgraph "Edge Functions"
        EF1[notify-drivers]
        EF2[process-payment]
        EF3[verify-documents]
        EF4[calculate-price]
        EF5[send-notification]
    end
    
    subgraph "External APIs"
        API1[Push Service]
        API2[Payment Gateway]
        API3[Document Validator]
        API4[Maps Service]
    end
    
    T1 -->|Trigger| EF1
    T2 -->|Trigger| EF2
    T3 -->|Trigger| EF3
    
    EF1 --> API1
    EF1 --> API4
    
    EF2 --> API2
    
    EF3 --> API3
    
    EF4 --> API4
    
    EF5 --> API1
    
    style EF1 fill:#8b5cf6
    style EF2 fill:#8b5cf6
    style EF3 fill:#8b5cf6
    style EF4 fill:#8b5cf6
    style EF5 fill:#8b5cf6
</lov-mermaid>

---

## ðŸ“¡ Real-time Communication

<lov-mermaid>
graph LR
    subgraph "Database Changes"
        DB[(PostgreSQL)]
        WAL[Write-Ahead Log]
    end
    
    subgraph "Realtime Server"
        RT[Realtime Engine]
        CHANNELS[Channels]
    end
    
    subgraph "Subscriptions"
        SUB1[delivery:123]
        SUB2[driver-location:456]
        SUB3[notifications:user-789]
    end
    
    subgraph "Clients"
        WEB[Web Apps]
        MOBILE[Mobile App]
    end
    
    DB -->|Changes| WAL
    WAL -->|Replicate| RT
    RT -->|Publish| CHANNELS
    
    CHANNELS --> SUB1
    CHANNELS --> SUB2
    CHANNELS --> SUB3
    
    SUB1 -->|WebSocket| WEB
    SUB1 -->|WebSocket| MOBILE
    
    SUB2 -->|WebSocket| WEB
    
    SUB3 -->|WebSocket| MOBILE
    
    style RT fill:#ef4444
    style CHANNELS fill:#f59e0b
</lov-mermaid>

### **Exemplo de Subscription:**

```typescript
// No app do restaurante - rastreia entrega especÃ­fica
const channel = supabase
  .channel(`delivery:${deliveryId}`)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'deliveries',
    filter: `id=eq.${deliveryId}`
  }, (payload) => {
    updateDeliveryStatus(payload.new);
  })
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'driver_locations',
    filter: `delivery_id=eq.${deliveryId}`
  }, (payload) => {
    updateDriverMarker(payload.new);
  })
  .subscribe();
```

---

## ðŸ“¦ File Storage Architecture

<lov-mermaid>
graph TB
    subgraph "Clients"
        MOBILE[Mobile App]
        WEB[Web App]
    end
    
    subgraph "Storage Buckets"
        B1[drivers-documents<br/>CNH, Documentos]
        B2[delivery-photos<br/>Fotos de coleta/entrega]
        B3[restaurant-docs<br/>CNPJ, AlvarÃ¡]
        B4[avatars<br/>Fotos de perfil]
    end
    
    subgraph "Storage Policies"
        P1[RLS: Only owner can upload]
        P2[RLS: Public read on delivery]
        P3[RLS: Admin full access]
    end
    
    MOBILE -->|Upload CNH| B1
    MOBILE -->|Upload delivery photo| B2
    MOBILE -->|Upload avatar| B4
    
    WEB -->|Upload documents| B3
    WEB -->|Upload avatar| B4
    
    B1 -.->|Protected by| P1
    B2 -.->|Protected by| P2
    B3 -.->|Protected by| P1
    B4 -.->|Protected by| P1
    
    P3 -.->|Overrides| P1
    P3 -.->|Overrides| P2
    
    style B1 fill:#8b5cf6
    style B2 fill:#8b5cf6
    style B3 fill:#8b5cf6
    style B4 fill:#8b5cf6
</lov-mermaid>

---

## ðŸŒ API Endpoints Structure

<lov-mermaid>
graph LR
    subgraph "REST API"
        API[Supabase PostgREST]
        
        subgraph "Resources"
            R1[/deliveries]
            R2[/drivers]
            R3[/restaurants]
            R4[/transactions]
        end
        
        subgraph "Methods"
            GET[GET - Read]
            POST[POST - Create]
            PATCH[PATCH - Update]
            DELETE[DELETE - Remove]
        end
    end
    
    subgraph "Edge Functions"
        EF[/functions/v1/]
        
        subgraph "Endpoints"
            E1[/notify-drivers]
            E2[/calculate-price]
            E3[/process-payment]
        end
    end
    
    API --> R1
    API --> R2
    API --> R3
    API --> R4
    
    R1 --> GET
    R1 --> POST
    R1 --> PATCH
    R1 --> DELETE
    
    EF --> E1
    EF --> E2
    EF --> E3
    
    style API fill:#3b82f6
    style EF fill:#8b5cf6
</lov-mermaid>

---

## ðŸ“Š Monitoring & Analytics

<lov-mermaid>
graph TB
    subgraph "Data Collection"
        EVENTS[User Events]
        METRICS[System Metrics]
        LOGS[Application Logs]
    end
    
    subgraph "Processing"
        STREAM[Event Stream]
        AGG[Aggregation]
    end
    
    subgraph "Storage"
        ANALYTICS_DB[(Analytics DB)]
        TIMESERIES[(Time Series DB)]
    end
    
    subgraph "Visualization"
        ADMIN[Admin Dashboard]
        REPORTS[Reports]
    end
    
    EVENTS --> STREAM
    METRICS --> STREAM
    LOGS --> STREAM
    
    STREAM --> AGG
    AGG --> ANALYTICS_DB
    AGG --> TIMESERIES
    
    ANALYTICS_DB --> ADMIN
    TIMESERIES --> ADMIN
    
    ADMIN --> REPORTS
    
    style STREAM fill:#ef4444
    style AGG fill:#f59e0b
    style ADMIN fill:#3b82f6
</lov-mermaid>

---

## ðŸš¦ Performance Optimization

<lov-mermaid>
graph TB
    subgraph "Client Side"
        C1[React Query Cache]
        C2[Optimistic Updates]
        C3[Debounced Inputs]
    end
    
    subgraph "Backend"
        B1[Database Indexes]
        B2[Connection Pooling]
        B3[Query Optimization]
    end
    
    subgraph "Caching Layer"
        CACHE1[Redis Cache]
        CACHE2[CDN for Static]
    end
    
    subgraph "Real-time"
        R1[WebSocket Pooling]
        R2[Message Batching]
    end
    
    C1 -.->|Reduce calls| B1
    C2 -.->|Better UX| B1
    
    B1 --> CACHE1
    B2 --> CACHE1
    
    CACHE2 -.->|Serve static| C1
    
    R1 -.->|Efficient| R2
    
    style CACHE1 fill:#10b981
    style CACHE2 fill:#10b981
</lov-mermaid>

---

## ðŸ”§ Deployment Architecture

<lov-mermaid>
graph TB
    subgraph "Version Control"
        GIT[GitHub Repository]
    end
    
    subgraph "CI/CD"
        CI[GitHub Actions / Vercel]
        BUILD[Build & Test]
    end
    
    subgraph "Production"
        WEB_PROD[Web Apps<br/>Vercel Hosting]
        BACKEND[Supabase Cloud<br/>Backend Services]
        CDN[CDN<br/>Static Assets]
    end
    
    subgraph "Mobile Distribution"
        PLAY[Google Play Store]
        APPLE[Apple App Store]
    end
    
    GIT -->|Push| CI
    CI -->|Trigger| BUILD
    BUILD -->|Deploy| WEB_PROD
    BUILD -->|Deploy| BACKEND
    BUILD -->|Upload| CDN
    
    BUILD -.->|Build APK/IPA| PLAY
    BUILD -.->|Build APK/IPA| APPLE
    
    style CI fill:#10b981
    style BUILD fill:#f59e0b
    style WEB_PROD fill:#3b82f6
    style BACKEND fill:#8b5cf6
</lov-mermaid>

---

## ðŸŽ¯ Tecnologias Utilizadas

### **Frontend**
- **Framework:** React 18 + TypeScript
- **Build Tool:** Vite
- **UI Library:** shadcn/ui + Tailwind CSS
- **State Management:** React Query (TanStack Query)
- **Maps:** Google Maps SDK / Mapbox
- **Mobile:** Capacitor (React Native bridge)

### **Backend (Vercel / Supabase)**
- **Database:** PostgreSQL 15+
- **Auth:** Supabase Auth (JWT-based)
- **Real-time:** Supabase Realtime (WebSocket)
- **Storage:** Supabase Storage (S3-compatible)
- **Functions:** Deno Edge Functions
- **API:** PostgREST (auto-generated REST)

### **External Services**
- **Maps/Routing:** Google Maps API ou Mapbox
- **Push Notifications:** Firebase Cloud Messaging
- **Payments:** Stripe ou Pagar.me
- **SMS:** Twilio
- **Document Validation:** Serpro API (Brasil)

### **DevOps & Monitoring**
- **Hosting:** Vercel (Frontend + Backend)
- **CI/CD:** Vercel autodeploy
- **Monitoring:** Supabase Dashboard + Custom metrics
- **Logs:** Supabase Logs + Edge Function logs

---

## ðŸ”„ Scalability Considerations

### **Database Scaling**
- Indexes em colunas frequentemente consultadas
- Particionamento de tabelas grandes (deliveries por data)
- Read replicas para queries pesadas
- Archive de dados antigos

### **Real-time Scaling**
- Connection pooling para WebSockets
- Message batching
- Regional distribution

### **Edge Functions**
- Auto-scaling baseado em carga
- Timeout otimizado
- Retry logic com backoff

### **Mobile App**
- Background location updates otimizados
- Local caching de dados
- Offline-first approach
- Batching de location updates

---

## ðŸ“ˆ Future Enhancements

1. **Machine Learning**
   - PrevisÃ£o de demanda por regiÃ£o/horÃ¡rio
   - OtimizaÃ§Ã£o automÃ¡tica de rotas
   - DetecÃ§Ã£o de fraudes

2. **Advanced Features**
   - Multi-stop deliveries
   - Scheduled deliveries
   - Delivery pooling (mÃºltiplos pedidos)
   - White-label para parceiros

3. **Performance**
   - GraphQL para queries complexas
   - Service Workers para PWA
   - WebAssembly para cÃ¡lculos pesados

4. **Integrations**
   - ERPs de restaurantes
   - Plataformas de e-commerce
   - Sistemas de CRM
   - Analytics avanÃ§ado

