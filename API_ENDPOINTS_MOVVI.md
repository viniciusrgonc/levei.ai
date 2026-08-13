# API Endpoints - Movvi MVP

## Ãndice
- [AutenticaÃ§Ã£o](#autenticaÃ§Ã£o)
- [Entregas](#entregas)
- [Motoristas](#motoristas)
- [Restaurantes](#restaurantes)
- [LocalizaÃ§Ã£o](#localizaÃ§Ã£o)
- [AvaliaÃ§Ãµes](#avaliaÃ§Ãµes)
- [TransaÃ§Ãµes](#transaÃ§Ãµes)
- [Admin](#admin)
- [NotificaÃ§Ãµes](#notificaÃ§Ãµes)

---

## AutenticaÃ§Ã£o

### 1. Registro de UsuÃ¡rio
**POST** `/auth/signup`

Registra novo usuÃ¡rio (restaurante ou motorista).

**Body:**
```json
{
  "email": "usuario@email.com",
  "password": "senha123",
  "user_type": "restaurant | driver",
  "profile_data": {
    "name": "Nome do UsuÃ¡rio",
    "phone": "+5511999999999",
    // Campos especÃ­ficos por tipo
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

**PermissÃµes:** PÃºblico

---

### 2. Login
**POST** `/auth/login`

Autentica usuÃ¡rio existente.

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

**PermissÃµes:** PÃºblico

---

### 3. Logout
**POST** `/auth/logout`

Encerra sessÃ£o do usuÃ¡rio.

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

**PermissÃµes:** Autenticado

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

**PermissÃµes:** PÃºblico

---

## Entregas

### 5. Criar Entrega
**POST** `/deliveries`

Restaurante cria nova solicitaÃ§Ã£o de entrega.

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
    "city": "SÃ£o Paulo",
    "state": "SP",
    "zip_code": "01234-567",
    "latitude": -23.5505,
    "longitude": -46.6333,
    "complement": "Apto 10"
  },
  "delivery_address": {
    "street": "Av. Paulista, 1000",
    "neighborhood": "Bela Vista",
    "city": "SÃ£o Paulo",
    "state": "SP",
    "zip_code": "01310-100",
    "latitude": -23.5629,
    "longitude": -46.6544,
    "complement": "Bloco B"
  },
  "customer_name": "JoÃ£o Silva",
  "customer_phone": "+5511988887777",
  "notes": "Campainha nÃ£o funciona, ligar ao chegar",
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
    "customer_name": "JoÃ£o Silva",
    "customer_phone": "+5511988887777",
    "created_at": "2025-10-21T10:30:00Z"
  }
}
```

**Edge Function:** `calculate-delivery-price`

**PermissÃµes:** Restaurante autenticado

---

### 6. Listar Entregas DisponÃ­veis
**GET** `/deliveries/available`

Motorista visualiza entregas disponÃ­veis prÃ³ximas.

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

**PermissÃµes:** Motorista autenticado e disponÃ­vel

---

### 7. Aceitar Entrega
**POST** `/deliveries/{delivery_id}/accept`

Motorista aceita uma entrega disponÃ­vel.

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

**PermissÃµes:** Motorista autenticado

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

**PermissÃµes:** Motorista responsÃ¡vel pela entrega

---

### 9. Obter Detalhes da Entrega
**GET** `/deliveries/{delivery_id}`

ObtÃ©m detalhes completos de uma entrega especÃ­fica.

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
    "customer_name": "JoÃ£o Silva",
    "customer_phone": "+5511988887777",
    "delivery_fee": 850,
    "distance_km": 3.5,
    "estimated_time_minutes": 25,
    "package_size": "small",
    "notes": "Campainha nÃ£o funciona",
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

**PermissÃµes:** Restaurante (prÃ³pria entrega) ou Motorista (entrega aceita)

---

### 10. Listar Minhas Entregas (Restaurante)
**GET** `/restaurants/deliveries`

Restaurante visualiza histÃ³rico de suas entregas.

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
      "customer_name": "JoÃ£o Silva",
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

**PermissÃµes:** Restaurante autenticado

---

### 11. Listar Minhas Entregas (Motorista)
**GET** `/drivers/deliveries`

Motorista visualiza histÃ³rico de entregas.

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

**PermissÃµes:** Motorista autenticado

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
  "reason": "Cliente cancelou pedido" // obrigatÃ³rio
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

**PermissÃµes:** 
- Restaurante: apenas status "pending"
- Motorista: apÃ³s aceitar, com justificativa

---

## Motoristas

### 13. Atualizar Status de Disponibilidade
**PATCH** `/drivers/status`

Motorista alterna entre disponÃ­vel/indisponÃ­vel.

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

**PermissÃµes:** Motorista autenticado

---

### 14. Atualizar Perfil do Motorista
**PATCH** `/drivers/profile`

Motorista atualiza informaÃ§Ãµes de perfil.

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

**PermissÃµes:** Motorista autenticado

---

### 15. Obter Perfil do Motorista
**GET** `/drivers/profile`

ObtÃ©m dados completos do perfil do motorista.

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

**PermissÃµes:** Motorista autenticado

---

## Restaurantes

### 16. Atualizar Perfil do Restaurante
**PATCH** `/restaurants/profile`

Restaurante atualiza informaÃ§Ãµes de perfil.

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
    "city": "SÃ£o Paulo",
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

**PermissÃµes:** Restaurante autenticado

---

### 17. Obter Perfil do Restaurante
**GET** `/restaurants/profile`

ObtÃ©m dados completos do perfil do restaurante.

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

**PermissÃµes:** Restaurante autenticado

---

## LocalizaÃ§Ã£o

### 18. Atualizar LocalizaÃ§Ã£o em Tempo Real
**POST** `/location/update`

Motorista envia atualizaÃ§Ã£o de localizaÃ§Ã£o durante entrega.

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
  "heading": 90, // opcional, direÃ§Ã£o em graus
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

**PermissÃµes:** Motorista em entrega ativa

**Real-time:** Publica atualizaÃ§Ã£o via Supabase Realtime para o restaurante acompanhar

---

### 19. Rastrear Entrega em Tempo Real
**GET** `/deliveries/{delivery_id}/track`

Restaurante acompanha localizaÃ§Ã£o do motorista em tempo real.

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

**PermissÃµes:** Restaurante (prÃ³pria entrega)

---

## AvaliaÃ§Ãµes

### 20. Avaliar Motorista (Restaurante)
**POST** `/deliveries/{delivery_id}/rate-driver`

Restaurante avalia motorista apÃ³s entrega concluÃ­da.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Body:**
```json
{
  "rating": 5, // 1 a 5
  "comment": "Entrega rÃ¡pida e cuidadosa!" // opcional
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
    "comment": "Entrega rÃ¡pida e cuidadosa!",
    "created_at": "2025-10-21T11:20:00Z"
  }
}
```

**PermissÃµes:** Restaurante que criou a entrega

---

### 21. Avaliar Restaurante (Motorista)
**POST** `/deliveries/{delivery_id}/rate-restaurant`

Motorista avalia restaurante apÃ³s entrega concluÃ­da.

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

**PermissÃµes:** Motorista que realizou a entrega

---

## TransaÃ§Ãµes

### 22. Listar TransaÃ§Ãµes (Motorista)
**GET** `/drivers/transactions`

Motorista visualiza histÃ³rico financeiro.

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

**PermissÃµes:** Motorista autenticado

---

### 23. Solicitar Saque
**POST** `/drivers/withdraw`

Motorista solicita saque do saldo disponÃ­vel.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Body:**
```json
{
  "amount": 10000, // centavos (mÃ­nimo R$ 20,00)
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

**PermissÃµes:** Motorista autenticado com saldo suficiente

---

## Admin

### 24. Dashboard de EstatÃ­sticas
**GET** `/admin/dashboard`

Administrador visualiza estatÃ­sticas gerais da plataforma.

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

**PermissÃµes:** Admin autenticado

---

### 25. Listar Todos os UsuÃ¡rios
**GET** `/admin/users`

Administrador lista usuÃ¡rios cadastrados.

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

**PermissÃµes:** Admin autenticado

---

### 26. Gerenciar Status de UsuÃ¡rio
**PATCH** `/admin/users/{user_id}/status`

Administrador ativa/desativa usuÃ¡rio.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Body:**
```json
{
  "status": "active | inactive",
  "reason": "Motivo da aÃ§Ã£o" // obrigatÃ³rio para desativar
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

**PermissÃµes:** Admin autenticado

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
      "customer_name": "JoÃ£o Silva",
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

**PermissÃµes:** Admin autenticado

---

## NotificaÃ§Ãµes

### 28. Registrar Token de Push Notification
**POST** `/notifications/register-token`

Registra token FCM para receber notificaÃ§Ãµes push.

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

**PermissÃµes:** Autenticado

---

### 29. Listar NotificaÃ§Ãµes
**GET** `/notifications`

UsuÃ¡rio visualiza histÃ³rico de notificaÃ§Ãµes.

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

**PermissÃµes:** Autenticado

---

### 30. Marcar NotificaÃ§Ã£o como Lida
**PATCH** `/notifications/{notification_id}/read`

Marca notificaÃ§Ã£o especÃ­fica como lida.

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

**PermissÃµes:** ProprietÃ¡rio da notificaÃ§Ã£o

---

## Edge Functions NecessÃ¡rias

### Lista de Edge Functions para o MVP:

1. **`calculate-delivery-price`**
   - Calcula preÃ§o da entrega baseado em distÃ¢ncia, horÃ¡rio e demanda
   - Chamado ao criar entrega

2. **`notify-drivers`**
   - Notifica motoristas prÃ³ximos sobre nova entrega
   - Envia push notifications via FCM
   - Chamado quando entrega Ã© criada

3. **`send-notification`**
   - Envia notificaÃ§Ãµes push genÃ©ricas
   - Usado em diversos pontos do fluxo

4. **`process-payment`**
   - Processa pagamento da taxa de entrega
   - IntegraÃ§Ã£o com gateway de pagamento
   - Chamado ao concluir entrega

5. **`process-withdrawal`**
   - Processa solicitaÃ§Ã£o de saque do motorista
   - IntegraÃ§Ã£o com sistema de pagamentos (PIX)
   - Chamado ao solicitar saque

6. **`handle-cancellation`**
   - Processa cancelamento de entrega
   - Aplica regras de penalidade se necessÃ¡rio
   - Notifica partes envolvidas

7. **`update-ratings`**
   - Recalcula mÃ©dias de avaliaÃ§Ãµes
   - Atualiza perfis de motoristas e restaurantes
   - Chamado apÃ³s nova avaliaÃ§Ã£o

8. **`generate-reports`**
   - Gera relatÃ³rios para admin
   - Processa dados agregados
   - Chamado pelo painel admin

---

## SeguranÃ§a e AutenticaÃ§Ã£o

### Headers ObrigatÃ³rios:
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

### Row Level Security (RLS):
Todas as tabelas possuem polÃ­ticas RLS:
- Motoristas sÃ³ veem suas prÃ³prias entregas ativas
- Restaurantes sÃ³ veem suas prÃ³prias entregas
- Admin tem acesso total via funÃ§Ã£o `has_role()`

### Rate Limiting:
- 100 requisiÃ§Ãµes/minuto por usuÃ¡rio
- 1000 requisiÃ§Ãµes/minuto para admin
- 10 requisiÃ§Ãµes/minuto para endpoints de criaÃ§Ã£o

---

## CÃ³digos de Status HTTP

| CÃ³digo | DescriÃ§Ã£o |
|--------|-----------|
| 200 | Sucesso |
| 201 | Criado com sucesso |
| 400 | RequisiÃ§Ã£o invÃ¡lida |
| 401 | NÃ£o autenticado |
| 403 | Sem permissÃ£o |
| 404 | NÃ£o encontrado |
| 409 | Conflito (ex: entrega jÃ¡ aceita) |
| 422 | ValidaÃ§Ã£o falhou |
| 429 | Muitas requisiÃ§Ãµes (rate limit) |
| 500 | Erro interno do servidor |

---

## Formato de Erro PadrÃ£o

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "DescriÃ§Ã£o amigÃ¡vel do erro",
    "details": {
      "field": "email",
      "issue": "Email jÃ¡ cadastrado"
    }
  }
}
```

---

## WebSockets / Real-time

### Canais Supabase Realtime:

1. **`deliveries:delivery_id`**
   - Restaurante se inscreve para acompanhar status
   - Recebe atualizaÃ§Ãµes de localizaÃ§Ã£o do motorista

2. **`drivers:available`**
   - Sistema monitora motoristas disponÃ­veis
   - Usado para notificaÃ§Ã£o de novas entregas

3. **`locations:delivery_id`**
   - AtualizaÃ§Ã£o de localizaÃ§Ã£o em tempo real
   - FrequÃªncia: a cada 5 segundos durante entrega ativa

---

## Versionamento da API

VersÃ£o atual: **v1**

Base URL: `https://{project-ref}.supabase.co/functions/v1/`

Todas as rotas comeÃ§am com o prefixo de versÃ£o quando necessÃ¡rio.

---

## PrÃ³ximos Passos

Com esta documentaÃ§Ã£o completa, vocÃª pode:

1. âœ… **Implementar o Backend** - Configurar Supabase e criar tabelas
2. âœ… **Criar Edge Functions** - Implementar as 8 funÃ§Ãµes listadas
3. âœ… **Configurar RLS** - Aplicar polÃ­ticas de seguranÃ§a
4. âœ… **Desenvolver Frontend** - Consumir estes endpoints
5. âœ… **Testar IntegraÃ§Ã£o** - Validar todos os fluxos

Pronto para comeÃ§ar a implementaÃ§Ã£o! ðŸš€

