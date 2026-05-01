# API Endpoints - Movvi MVP

## Índice
- [Autenticação](#autenticação)
- [Entregas](#entregas)
- [Motoristas](#motoristas)
- [Restaurantes](#restaurantes)
- [Localização](#localização)
- [Avaliações](#avaliações)
- [Transações](#transações)
- [Admin](#admin)
- [Notificações](#notificações)

---

## Autenticação

### 1. Registro de Usuário
**POST** `/auth/signup`

Registra novo usuário (restaurante ou motorista).

**Body:**
```json
{
  "email": "usuario@email.com",
  "password": "senha123",
  "user_type": "restaurant | driver",
  "profile_data": {
    "name": "Nome do Usuário",
    "phone": "+5511999999999",
    // Campos específicos por tipo
  }
}
```

**Response 200:**
```json
{
  "user": {
    "id": "uuid",
    "email": "usuario@email.com",
    "user_type": "restaurant"
  },
  "session": {
    "access_token": "token",
    "refresh_token": "token"
  }
}
```

**Permissões:** Público

---

### 2. Login
**POST** `/auth/login`

Autentica usuário existente.

**Body:**
```json
{
  "email": "usuario@email.com",
  "password": "senha123"
}
```

**Response 200:**
```json
{
  "user": {
    "id": "uuid",
    "email": "usuario@email.com",
    "user_type": "driver"
  },
  "session": {
    "access_token": "token",
    "refresh_token": "token"
  }
}
```

**Permissões:** Público

---

### 3. Logout
**POST** `/auth/logout`

Encerra sessão do usuário.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Response 200:**
```json
{
  "message": "Logout successful"
}
```

**Permissões:** Autenticado

---

### 4. Refresh Token
**POST** `/auth/refresh`

Renova token de acesso.

**Body:**
```json
{
  "refresh_token": "token"
}
```

**Response 200:**
```json
{
  "access_token": "novo_token",
  "refresh_token": "novo_refresh_token"
}
```

**Permissões:** Público

---

## Entregas

### 5. Criar Entrega
**POST** `/deliveries`

Restaurante cria nova solicitação de entrega.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Body:**
```json
{
  "pickup_address": {
    "street": "Rua Exemplo, 123",
    "neighborhood": "Bairro",
    "city": "São Paulo",
    "state": "SP",
    "zip_code": "01234-567",
    "latitude": -23.5505,
    "longitude": -46.6333,
    "complement": "Apto 10"
  },
  "delivery_address": {
    "street": "Av. Paulista, 1000",
    "neighborhood": "Bela Vista",
    "city": "São Paulo",
    "state": "SP",
    "zip_code": "01310-100",
    "latitude": -23.5629,
    "longitude": -46.6544,
    "complement": "Bloco B"
  },
  "customer_name": "João Silva",
  "customer_phone": "+5511988887777",
  "notes": "Campainha não funciona, ligar ao chegar",
  "estimated_value": 1500, // centavos
  "package_size": "small | medium | large"
}
```

**Response 201:**
```json
{
  "delivery": {
    "id": "uuid",
    "restaurant_id": "uuid",
    "status": "pending",
    "delivery_fee": 850,
    "distance_km": 3.5,
    "estimated_time_minutes": 25,
    "pickup_address": {...},
    "delivery_address": {...},
    "customer_name": "João Silva",
    "customer_phone": "+5511988887777",
    "created_at": "2025-10-21T10:30:00Z"
  }
}
```

**Edge Function:** `calculate-delivery-price`

**Permissões:** Restaurante autenticado

---

### 6. Listar Entregas Disponíveis
**GET** `/deliveries/available`

Motorista visualiza entregas disponíveis próximas.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Query Params:**
```
?latitude=-23.5505
&longitude=-46.6333
&radius_km=5
&limit=20
```

**Response 200:**
```json
{
  "deliveries": [
    {
      "id": "uuid",
      "restaurant_name": "Restaurante ABC",
      "pickup_address": {...},
      "delivery_address": {...},
      "delivery_fee": 850,
      "distance_km": 2.3,
      "estimated_time_minutes": 15,
      "package_size": "small",
      "created_at": "2025-10-21T10:30:00Z"
    }
  ],
  "total": 5
}
```

**Permissões:** Motorista autenticado e disponível

---

### 7. Aceitar Entrega
**POST** `/deliveries/{delivery_id}/accept`

Motorista aceita uma entrega disponível.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Response 200:**
```json
{
  "delivery": {
    "id": "uuid",
    "driver_id": "uuid",
    "status": "accepted",
    "accepted_at": "2025-10-21T10:35:00Z",
    "estimated_pickup_time": "2025-10-21T10:50:00Z"
  }
}
```

**Edge Function:** `notify-restaurant`

**Permissões:** Motorista autenticado

---

### 8. Atualizar Status da Entrega
**PATCH** `/deliveries/{delivery_id}/status`

Atualiza status da entrega conforme o fluxo.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Body:**
```json
{
  "status": "on_way_to_pickup | picked_up | on_way_to_delivery | delivered",
  "location": {
    "latitude": -23.5505,
    "longitude": -46.6333
  },
  "photo_url": "url_da_foto_comprovacao" // apenas para 'delivered'
}
```

**Response 200:**
```json
{
  "delivery": {
    "id": "uuid",
    "status": "picked_up",
    "picked_up_at": "2025-10-21T10:55:00Z",
    "updated_at": "2025-10-21T10:55:00Z"
  }
}
```

**Edge Function:** `send-notification` (notifica restaurante e cliente)

**Permissões:** Motorista responsável pela entrega

---

### 9. Obter Detalhes da Entrega
**GET** `/deliveries/{delivery_id}`

Obtém detalhes completos de uma entrega específica.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Response 200:**
```json
{
  "delivery": {
    "id": "uuid",
    "restaurant_id": "uuid",
    "restaurant_name": "Restaurante ABC",
    "driver_id": "uuid",
    "driver_name": "Carlos Motorista",
    "driver_phone": "+5511977776666",
    "driver_photo": "url",
    "vehicle_plate": "ABC-1234",
    "status": "on_way_to_delivery",
    "pickup_address": {...},
    "delivery_address": {...},
    "customer_name": "João Silva",
    "customer_phone": "+5511988887777",
    "delivery_fee": 850,
    "distance_km": 3.5,
    "estimated_time_minutes": 25,
    "package_size": "small",
    "notes": "Campainha não funciona",
    "created_at": "2025-10-21T10:30:00Z",
    "accepted_at": "2025-10-21T10:35:00Z",
    "picked_up_at": "2025-10-21T10:55:00Z",
    "delivered_at": null,
    "current_location": {
      "latitude": -23.5580,
      "longitude": -46.6400,
      "updated_at": "2025-10-21T11:05:00Z"
    }
  }
}
```

**Permissões:** Restaurante (própria entrega) ou Motorista (entrega aceita)

---

### 10. Listar Minhas Entregas (Restaurante)
**GET** `/restaurants/deliveries`

Restaurante visualiza histórico de suas entregas.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Query Params:**
```
?status=all | pending | in_progress | completed | cancelled
&page=1
&limit=20
&date_from=2025-10-01
&date_to=2025-10-21
```

**Response 200:**
```json
{
  "deliveries": [
    {
      "id": "uuid",
      "driver_name": "Carlos Motorista",
      "status": "delivered",
      "customer_name": "João Silva",
      "delivery_address": {...},
      "delivery_fee": 850,
      "created_at": "2025-10-21T10:30:00Z",
      "delivered_at": "2025-10-21T11:15:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  }
}
```

**Permissões:** Restaurante autenticado

---

### 11. Listar Minhas Entregas (Motorista)
**GET** `/drivers/deliveries`

Motorista visualiza histórico de entregas.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Query Params:**
```
?status=active | completed
&page=1
&limit=20
```

**Response 200:**
```json
{
  "deliveries": [
    {
      "id": "uuid",
      "restaurant_name": "Restaurante ABC",
      "status": "on_way_to_delivery",
      "pickup_address": {...},
      "delivery_address": {...},
      "delivery_fee": 850,
      "distance_km": 3.5,
      "accepted_at": "2025-10-21T10:35:00Z"
    }
  ],
  "statistics": {
    "total_completed": 45,
    "total_earnings": 38250, // centavos
    "average_rating": 4.8
  }
}
```

**Permissões:** Motorista autenticado

---

### 12. Cancelar Entrega
**POST** `/deliveries/{delivery_id}/cancel`

Cancela uma entrega (restaurante antes de aceitar, motorista com justificativa).

**Headers:**
```
Authorization: Bearer {access_token}
```

**Body:**
```json
{
  "reason": "Cliente cancelou pedido" // obrigatório
}
```

**Response 200:**
```json
{
  "delivery": {
    "id": "uuid",
    "status": "cancelled",
    "cancelled_at": "2025-10-21T10:40:00Z",
    "cancelled_by": "restaurant | driver",
    "cancellation_reason": "Cliente cancelou pedido"
  }
}
```

**Edge Function:** `handle-cancellation` (notifica partes envolvidas)

**Permissões:** 
- Restaurante: apenas status "pending"
- Motorista: após aceitar, com justificativa

---

## Motoristas

### 13. Atualizar Status de Disponibilidade
**PATCH** `/drivers/status`

Motorista alterna entre disponível/indisponível.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Body:**
```json
{
  "is_available": true,
  "location": {
    "latitude": -23.5505,
    "longitude": -46.6333
  }
}
```

**Response 200:**
```json
{
  "driver": {
    "id": "uuid",
    "is_available": true,
    "location": {
      "latitude": -23.5505,
      "longitude": -46.6333,
      "updated_at": "2025-10-21T10:30:00Z"
    }
  }
}
```

**Permissões:** Motorista autenticado

---

### 14. Atualizar Perfil do Motorista
**PATCH** `/drivers/profile`

Motorista atualiza informações de perfil.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Body:**
```json
{
  "name": "Carlos Silva",
  "phone": "+5511977776666",
  "vehicle_type": "motorcycle | bicycle | car",
  "vehicle_plate": "ABC-1234",
  "vehicle_color": "Vermelha",
  "vehicle_model": "Honda CG 160"
}
```

**Response 200:**
```json
{
  "driver": {
    "id": "uuid",
    "name": "Carlos Silva",
    "phone": "+5511977776666",
    "vehicle_type": "motorcycle",
    "vehicle_plate": "ABC-1234",
    "vehicle_color": "Vermelha",
    "vehicle_model": "Honda CG 160",
    "rating": 4.8,
    "total_deliveries": 45,
    "updated_at": "2025-10-21T10:30:00Z"
  }
}
```

**Permissões:** Motorista autenticado

---

### 15. Obter Perfil do Motorista
**GET** `/drivers/profile`

Obtém dados completos do perfil do motorista.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Response 200:**
```json
{
  "driver": {
    "id": "uuid",
    "name": "Carlos Silva",
    "phone": "+5511977776666",
    "email": "carlos@email.com",
    "photo_url": "url",
    "vehicle_type": "motorcycle",
    "vehicle_plate": "ABC-1234",
    "vehicle_color": "Vermelha",
    "vehicle_model": "Honda CG 160",
    "is_available": true,
    "rating": 4.8,
    "total_deliveries": 45,
    "total_earnings": 38250,
    "created_at": "2025-09-01T08:00:00Z"
  }
}
```

**Permissões:** Motorista autenticado

---

## Restaurantes

### 16. Atualizar Perfil do Restaurante
**PATCH** `/restaurants/profile`

Restaurante atualiza informações de perfil.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Body:**
```json
{
  "name": "Restaurante ABC",
  "phone": "+5511966665555",
  "address": {
    "street": "Rua Exemplo, 123",
    "neighborhood": "Centro",
    "city": "São Paulo",
    "state": "SP",
    "zip_code": "01234-567",
    "latitude": -23.5505,
    "longitude": -46.6333
  },
  "business_hours": {
    "monday": {"open": "11:00", "close": "23:00"},
    "tuesday": {"open": "11:00", "close": "23:00"},
    "wednesday": {"open": "11:00", "close": "23:00"},
    "thursday": {"open": "11:00", "close": "23:00"},
    "friday": {"open": "11:00", "close": "00:00"},
    "saturday": {"open": "11:00", "close": "00:00"},
    "sunday": {"open": "11:00", "close": "22:00"}
  }
}
```

**Response 200:**
```json
{
  "restaurant": {
    "id": "uuid",
    "name": "Restaurante ABC",
    "phone": "+5511966665555",
    "address": {...},
    "business_hours": {...},
    "rating": 4.6,
    "total_deliveries": 120,
    "updated_at": "2025-10-21T10:30:00Z"
  }
}
```

**Permissões:** Restaurante autenticado

---

### 17. Obter Perfil do Restaurante
**GET** `/restaurants/profile`

Obtém dados completos do perfil do restaurante.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Response 200:**
```json
{
  "restaurant": {
    "id": "uuid",
    "name": "Restaurante ABC",
    "phone": "+5511966665555",
    "email": "contato@restauranteabc.com",
    "logo_url": "url",
    "address": {...},
    "business_hours": {...},
    "rating": 4.6,
    "total_deliveries": 120,
    "created_at": "2025-08-15T09:00:00Z"
  }
}
```

**Permissões:** Restaurante autenticado

---

## Localização

### 18. Atualizar Localização em Tempo Real
**POST** `/location/update`

Motorista envia atualização de localização durante entrega.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Body:**
```json
{
  "delivery_id": "uuid",
  "latitude": -23.5580,
  "longitude": -46.6400,
  "heading": 90, // opcional, direção em graus
  "speed": 30 // opcional, km/h
}
```

**Response 200:**
```json
{
  "location": {
    "latitude": -23.5580,
    "longitude": -46.6400,
    "heading": 90,
    "speed": 30,
    "updated_at": "2025-10-21T11:05:00Z"
  }
}
```

**Permissões:** Motorista em entrega ativa

**Real-time:** Publica atualização via Supabase Realtime para o restaurante acompanhar

---

### 19. Rastrear Entrega em Tempo Real
**GET** `/deliveries/{delivery_id}/track`

Restaurante acompanha localização do motorista em tempo real.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Response 200:**
```json
{
  "tracking": {
    "delivery_id": "uuid",
    "driver_location": {
      "latitude": -23.5580,
      "longitude": -46.6400,
      "heading": 90,
      "speed": 30,
      "updated_at": "2025-10-21T11:05:00Z"
    },
    "estimated_arrival": "2025-10-21T11:15:00Z",
    "distance_remaining_km": 1.2
  }
}
```

**Permissões:** Restaurante (própria entrega)

---

## Avaliações

### 20. Avaliar Motorista (Restaurante)
**POST** `/deliveries/{delivery_id}/rate-driver`

Restaurante avalia motorista após entrega concluída.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Body:**
```json
{
  "rating": 5, // 1 a 5
  "comment": "Entrega rápida e cuidadosa!" // opcional
}
```

**Response 201:**
```json
{
  "rating": {
    "id": "uuid",
    "delivery_id": "uuid",
    "driver_id": "uuid",
    "rated_by": "restaurant",
    "rating": 5,
    "comment": "Entrega rápida e cuidadosa!",
    "created_at": "2025-10-21T11:20:00Z"
  }
}
```

**Permissões:** Restaurante que criou a entrega

---

### 21. Avaliar Restaurante (Motorista)
**POST** `/deliveries/{delivery_id}/rate-restaurant`

Motorista avalia restaurante após entrega concluída.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Body:**
```json
{
  "rating": 4, // 1 a 5
  "comment": "Pedido demorou um pouco para ficar pronto" // opcional
}
```

**Response 201:**
```json
{
  "rating": {
    "id": "uuid",
    "delivery_id": "uuid",
    "restaurant_id": "uuid",
    "rated_by": "driver",
    "rating": 4,
    "comment": "Pedido demorou um pouco para ficar pronto",
    "created_at": "2025-10-21T11:20:00Z"
  }
}
```

**Permissões:** Motorista que realizou a entrega

---

## Transações

### 22. Listar Transações (Motorista)
**GET** `/drivers/transactions`

Motorista visualiza histórico financeiro.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Query Params:**
```
?page=1
&limit=20
&date_from=2025-10-01
&date_to=2025-10-21
```

**Response 200:**
```json
{
  "transactions": [
    {
      "id": "uuid",
      "delivery_id": "uuid",
      "type": "earning",
      "amount": 850, // centavos
      "status": "completed",
      "description": "Entrega #12345",
      "created_at": "2025-10-21T11:15:00Z"
    }
  ],
  "summary": {
    "total_earnings": 38250,
    "pending_amount": 0,
    "completed_amount": 38250
  },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45
  }
}
```

**Permissões:** Motorista autenticado

---

### 23. Solicitar Saque
**POST** `/drivers/withdraw`

Motorista solicita saque do saldo disponível.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Body:**
```json
{
  "amount": 10000, // centavos (mínimo R$ 20,00)
  "pix_key": "email@exemplo.com"
}
```

**Response 201:**
```json
{
  "withdrawal": {
    "id": "uuid",
    "amount": 10000,
    "status": "pending",
    "pix_key": "email@exemplo.com",
    "requested_at": "2025-10-21T15:00:00Z",
    "estimated_completion": "2025-10-22T15:00:00Z"
  }
}
```

**Edge Function:** `process-withdrawal`

**Permissões:** Motorista autenticado com saldo suficiente

---

## Admin

### 24. Dashboard de Estatísticas
**GET** `/admin/dashboard`

Administrador visualiza estatísticas gerais da plataforma.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Query Params:**
```
?period=today | week | month | custom
&date_from=2025-10-01
&date_to=2025-10-21
```

**Response 200:**
```json
{
  "statistics": {
    "deliveries": {
      "total": 1250,
      "completed": 1180,
      "cancelled": 50,
      "in_progress": 20,
      "completion_rate": 94.4
    },
    "revenue": {
      "total": 106250, // centavos
      "platform_fee": 21250, // 20% do total
      "drivers_earnings": 85000
    },
    "users": {
      "total_restaurants": 45,
      "total_drivers": 120,
      "active_drivers": 75
    },
    "performance": {
      "average_delivery_time": 28, // minutos
      "average_rating_drivers": 4.7,
      "average_rating_restaurants": 4.5
    }
  },
  "charts": {
    "deliveries_by_hour": [...],
    "revenue_by_day": [...]
  }
}
```

**Permissões:** Admin autenticado

---

### 25. Listar Todos os Usuários
**GET** `/admin/users`

Administrador lista usuários cadastrados.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Query Params:**
```
?type=all | restaurant | driver
&status=all | active | inactive
&page=1
&limit=50
&search=nome ou email
```

**Response 200:**
```json
{
  "users": [
    {
      "id": "uuid",
      "type": "driver",
      "name": "Carlos Silva",
      "email": "carlos@email.com",
      "phone": "+5511977776666",
      "status": "active",
      "total_deliveries": 45,
      "rating": 4.8,
      "created_at": "2025-09-01T08:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 165
  }
}
```

**Permissões:** Admin autenticado

---

### 26. Gerenciar Status de Usuário
**PATCH** `/admin/users/{user_id}/status`

Administrador ativa/desativa usuário.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Body:**
```json
{
  "status": "active | inactive",
  "reason": "Motivo da ação" // obrigatório para desativar
}
```

**Response 200:**
```json
{
  "user": {
    "id": "uuid",
    "status": "inactive",
    "updated_at": "2025-10-21T15:30:00Z"
  }
}
```

**Permissões:** Admin autenticado

---

### 27. Listar Todas as Entregas (Admin)
**GET** `/admin/deliveries`

Administrador visualiza todas as entregas da plataforma.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Query Params:**
```
?status=all | pending | in_progress | completed | cancelled
&page=1
&limit=50
&date_from=2025-10-01
&date_to=2025-10-21
&restaurant_id=uuid
&driver_id=uuid
```

**Response 200:**
```json
{
  "deliveries": [
    {
      "id": "uuid",
      "restaurant_name": "Restaurante ABC",
      "driver_name": "Carlos Silva",
      "status": "delivered",
      "delivery_fee": 850,
      "platform_fee": 170,
      "customer_name": "João Silva",
      "created_at": "2025-10-21T10:30:00Z",
      "delivered_at": "2025-10-21T11:15:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1250
  }
}
```

**Permissões:** Admin autenticado

---

## Notificações

### 28. Registrar Token de Push Notification
**POST** `/notifications/register-token`

Registra token FCM para receber notificações push.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Body:**
```json
{
  "token": "fcm_device_token",
  "platform": "android | ios"
}
```

**Response 200:**
```json
{
  "message": "Token registered successfully"
}
```

**Permissões:** Autenticado

---

### 29. Listar Notificações
**GET** `/notifications`

Usuário visualiza histórico de notificações.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Query Params:**
```
?page=1
&limit=20
&read=all | true | false
```

**Response 200:**
```json
{
  "notifications": [
    {
      "id": "uuid",
      "type": "delivery_accepted",
      "title": "Entrega Aceita!",
      "message": "Carlos Silva aceitou sua entrega",
      "data": {
        "delivery_id": "uuid"
      },
      "read": false,
      "created_at": "2025-10-21T10:35:00Z"
    }
  ],
  "unread_count": 3,
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 25
  }
}
```

**Permissões:** Autenticado

---

### 30. Marcar Notificação como Lida
**PATCH** `/notifications/{notification_id}/read`

Marca notificação específica como lida.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Response 200:**
```json
{
  "notification": {
    "id": "uuid",
    "read": true,
    "read_at": "2025-10-21T15:45:00Z"
  }
}
```

**Permissões:** Proprietário da notificação

---

## Edge Functions Necessárias

### Lista de Edge Functions para o MVP:

1. **`calculate-delivery-price`**
   - Calcula preço da entrega baseado em distância, horário e demanda
   - Chamado ao criar entrega

2. **`notify-drivers`**
   - Notifica motoristas próximos sobre nova entrega
   - Envia push notifications via FCM
   - Chamado quando entrega é criada

3. **`send-notification`**
   - Envia notificações push genéricas
   - Usado em diversos pontos do fluxo

4. **`process-payment`**
   - Processa pagamento da taxa de entrega
   - Integração com gateway de pagamento
   - Chamado ao concluir entrega

5. **`process-withdrawal`**
   - Processa solicitação de saque do motorista
   - Integração com sistema de pagamentos (PIX)
   - Chamado ao solicitar saque

6. **`handle-cancellation`**
   - Processa cancelamento de entrega
   - Aplica regras de penalidade se necessário
   - Notifica partes envolvidas

7. **`update-ratings`**
   - Recalcula médias de avaliações
   - Atualiza perfis de motoristas e restaurantes
   - Chamado após nova avaliação

8. **`generate-reports`**
   - Gera relatórios para admin
   - Processa dados agregados
   - Chamado pelo painel admin

---

## Segurança e Autenticação

### Headers Obrigatórios:
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

### Row Level Security (RLS):
Todas as tabelas possuem políticas RLS:
- Motoristas só veem suas próprias entregas ativas
- Restaurantes só veem suas próprias entregas
- Admin tem acesso total via função `has_role()`

### Rate Limiting:
- 100 requisições/minuto por usuário
- 1000 requisições/minuto para admin
- 10 requisições/minuto para endpoints de criação

---

## Códigos de Status HTTP

| Código | Descrição |
|--------|-----------|
| 200 | Sucesso |
| 201 | Criado com sucesso |
| 400 | Requisição inválida |
| 401 | Não autenticado |
| 403 | Sem permissão |
| 404 | Não encontrado |
| 409 | Conflito (ex: entrega já aceita) |
| 422 | Validação falhou |
| 429 | Muitas requisições (rate limit) |
| 500 | Erro interno do servidor |

---

## Formato de Erro Padrão

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Descrição amigável do erro",
    "details": {
      "field": "email",
      "issue": "Email já cadastrado"
    }
  }
}
```

---

## WebSockets / Real-time

### Canais Supabase Realtime:

1. **`deliveries:delivery_id`**
   - Restaurante se inscreve para acompanhar status
   - Recebe atualizações de localização do motorista

2. **`drivers:available`**
   - Sistema monitora motoristas disponíveis
   - Usado para notificação de novas entregas

3. **`locations:delivery_id`**
   - Atualização de localização em tempo real
   - Frequência: a cada 5 segundos durante entrega ativa

---

## Versionamento da API

Versão atual: **v1**

Base URL: `https://{project-ref}.supabase.co/functions/v1/`

Todas as rotas começam com o prefixo de versão quando necessário.

---

## Próximos Passos

Com esta documentação completa, você pode:

1. ✅ **Implementar o Backend** - Habilitar Lovable Cloud e criar tabelas
2. ✅ **Criar Edge Functions** - Implementar as 8 funções listadas
3. ✅ **Configurar RLS** - Aplicar políticas de segurança
4. ✅ **Desenvolver Frontend** - Consumir estes endpoints
5. ✅ **Testar Integração** - Validar todos os fluxos

Pronto para começar a implementação! 🚀
