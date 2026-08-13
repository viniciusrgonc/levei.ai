# MVP Movvi - Funcionalidades por Perfil

## ðŸŽ¯ Objetivo do MVP

Validar a hipÃ³tese central: **Restaurantes conseguem encontrar motoboys autÃ´nomos de forma rÃ¡pida e eficiente para realizar entregas.**

**CritÃ©rios de Sucesso:**
- Tempo mÃ©dio de aceite < 3 minutos
- Taxa de conclusÃ£o > 85%
- Pelo menos 10 entregas completadas/dia
- Rating mÃ©dio > 4.0 estrelas

---

## ðŸï¸ Perfil: MOTOBOY

### **AutenticaÃ§Ã£o & Perfil** ðŸ”
| Funcionalidade | Prioridade | DescriÃ§Ã£o |
|----------------|-----------|-----------|
| Cadastro | ðŸ”´ CrÃ­tica | Email, senha, nome completo, telefone |
| Login | ðŸ”´ CrÃ­tica | Email e senha |
| Perfil bÃ¡sico | ðŸ”´ CrÃ­tica | Foto, dados do veÃ­culo (tipo, placa) |
| Upload de CNH | ðŸŸ¡ Alta | Foto da CNH para verificaÃ§Ã£o |
| Status online/offline | ðŸ”´ CrÃ­tica | Toggle para ficar disponÃ­vel |

### **Descoberta de Entregas** ðŸ“
| Funcionalidade | Prioridade | DescriÃ§Ã£o |
|----------------|-----------|-----------|
| Lista de entregas disponÃ­veis | ðŸ”´ CrÃ­tica | Cards com valor, distÃ¢ncia, restaurante |
| Filtro por distÃ¢ncia | ðŸŸ¡ Alta | Mostrar apenas entregas atÃ© X km |
| Detalhes da entrega | ðŸ”´ CrÃ­tica | EndereÃ§os, valor, descriÃ§Ã£o |
| Aceitar entrega | ðŸ”´ CrÃ­tica | BotÃ£o para vincular entrega ao motoboy |
| Recusar entrega | ðŸŸ¡ Alta | BotÃ£o para passar a oportunidade |
| NotificaÃ§Ã£o de nova entrega | ðŸŸ¡ Alta | Push notification quando entrega disponÃ­vel |

### **ExecuÃ§Ã£o da Entrega** ðŸšš
| Funcionalidade | Prioridade | DescriÃ§Ã£o |
|----------------|-----------|-----------|
| Ver entrega ativa | ðŸ”´ CrÃ­tica | Tela com detalhes da entrega aceita |
| NavegaÃ§Ã£o GPS | ðŸ”´ CrÃ­tica | Abrir Google Maps com endereÃ§o |
| BotÃ£o "Cheguei para coletar" | ðŸ”´ CrÃ­tica | Marca inÃ­cio da coleta |
| BotÃ£o "Coletei o pedido" | ðŸ”´ CrÃ­tica | Marca fim da coleta e inÃ­cio da entrega |
| Foto do pedido (opcional) | ðŸŸ¢ MÃ©dia | Tirar foto apÃ³s coleta |
| BotÃ£o "Entrega concluÃ­da" | ðŸ”´ CrÃ­tica | Marca conclusÃ£o da entrega |
| CÃ³digo de confirmaÃ§Ã£o | ðŸŸ¡ Alta | Cliente fornece cÃ³digo para confirmar |
| Foto de comprovaÃ§Ã£o | ðŸŸ¢ MÃ©dia | Foto da entrega concluÃ­da |

### **HistÃ³rico & Ganhos** ðŸ’°
| Funcionalidade | Prioridade | DescriÃ§Ã£o |
|----------------|-----------|-----------|
| Lista de entregas realizadas | ðŸ”´ CrÃ­tica | HistÃ³rico com status e valores |
| Resumo de ganhos do dia | ðŸ”´ CrÃ­tica | Total ganho no dia atual |
| Resumo semanal | ðŸŸ¡ Alta | Total da semana |
| Detalhes de entrega passada | ðŸŸ¡ Alta | Ver informaÃ§Ãµes completas |

### **AvaliaÃ§Ã£o** â­
| Funcionalidade | Prioridade | DescriÃ§Ã£o |
|----------------|-----------|-----------|
| Avaliar restaurante | ðŸŸ¡ Alta | Estrelas (1-5) apÃ³s entrega |
| Ver minhas avaliaÃ§Ãµes | ðŸŸ¢ MÃ©dia | Feedback recebido |
| Rating mÃ©dio no perfil | ðŸŸ¡ Alta | Mostrar mÃ©dia de avaliaÃ§Ãµes |

### **Fora do MVP** âŒ
- âŒ Chat com restaurante
- âŒ MÃºltiplas entregas simultÃ¢neas
- âŒ Saque de valores
- âŒ Agendamento de disponibilidade
- âŒ EstatÃ­sticas avanÃ§adas
- âŒ Programa de fidelidade

---

## ðŸ½ï¸ Perfil: RESTAURANTE

### **AutenticaÃ§Ã£o & Perfil** ðŸ”
| Funcionalidade | Prioridade | DescriÃ§Ã£o |
|----------------|-----------|-----------|
| Cadastro | ðŸ”´ CrÃ­tica | Email, senha, nome do restaurante, telefone |
| Login | ðŸ”´ CrÃ­tica | Email e senha |
| Perfil do estabelecimento | ðŸ”´ CrÃ­tica | Nome, endereÃ§o, foto |
| Upload CNPJ (opcional MVP) | ðŸŸ¢ MÃ©dia | Documento para verificaÃ§Ã£o |

### **Criar Entrega** ðŸ“¦
| Funcionalidade | Prioridade | DescriÃ§Ã£o |
|----------------|-----------|-----------|
| FormulÃ¡rio de nova entrega | ðŸ”´ CrÃ­tica | EndereÃ§o coleta, entrega, descriÃ§Ã£o |
| CÃ¡lculo automÃ¡tico de distÃ¢ncia | ðŸ”´ CrÃ­tica | Baseado nos endereÃ§os |
| SugestÃ£o de valor | ðŸ”´ CrÃ­tica | Sistema sugere preÃ§o baseado em distÃ¢ncia |
| Ajustar valor manualmente | ðŸŸ¡ Alta | Restaurante pode alterar valor sugerido |
| InstruÃ§Ãµes especiais | ðŸŸ¡ Alta | Campo de texto livre |
| Confirmar criaÃ§Ã£o | ðŸ”´ CrÃ­tica | BotÃ£o para publicar entrega |

### **Gerenciar Entregas** ðŸ“Š
| Funcionalidade | Prioridade | DescriÃ§Ã£o |
|----------------|-----------|-----------|
| Ver entregas aguardando motoboy | ðŸ”´ CrÃ­tica | Lista de pendentes |
| Ver entregas em andamento | ðŸ”´ CrÃ­tica | Entregas aceitas/em execuÃ§Ã£o |
| Rastreamento no mapa | ðŸ”´ CrÃ­tica | Ver localizaÃ§Ã£o do motoboy em tempo real |
| Status da entrega | ðŸ”´ CrÃ­tica | Aguardando/Aceito/Coletando/Em entrega/ConcluÃ­do |
| Cancelar entrega | ðŸŸ¡ Alta | Antes de ser aceita |
| Ver histÃ³rico completo | ðŸ”´ CrÃ­tica | Todas as entregas (filtros por data/status) |
| Detalhes de entrega | ðŸ”´ CrÃ­tica | InformaÃ§Ãµes completas + comprovantes |

### **NotificaÃ§Ãµes** ðŸ””
| Funcionalidade | Prioridade | DescriÃ§Ã£o |
|----------------|-----------|-----------|
| Entrega aceita | ðŸ”´ CrÃ­tica | Push quando motoboy aceita |
| Motoboy chegou | ðŸŸ¡ Alta | Push quando motoboy marca chegada |
| Entrega concluÃ­da | ðŸ”´ CrÃ­tica | Push quando finaliza |

### **AvaliaÃ§Ã£o** â­
| Funcionalidade | Prioridade | DescriÃ§Ã£o |
|----------------|-----------|-----------|
| Avaliar motoboy | ðŸŸ¡ Alta | Estrelas (1-5) apÃ³s conclusÃ£o |
| Ver avaliaÃ§Ãµes recebidas | ðŸŸ¢ MÃ©dia | Feedback de motoboys |
| Rating mÃ©dio no perfil | ðŸŸ¡ Alta | Mostrar mÃ©dia |

### **Financeiro BÃ¡sico** ðŸ’³
| Funcionalidade | Prioridade | DescriÃ§Ã£o |
|----------------|-----------|-----------|
| Ver custos do dia | ðŸ”´ CrÃ­tica | Total gasto em entregas |
| Ver custos do mÃªs | ðŸŸ¡ Alta | Total mensal |
| HistÃ³rico de gastos | ðŸŸ¡ Alta | Lista de todas as cobranÃ§as |

### **Fora do MVP** âŒ
- âŒ Chat com motoboy
- âŒ MÃºltiplos endereÃ§os de coleta salvos
- âŒ IntegraÃ§Ã£o com sistema prÃ³prio
- âŒ API para automaÃ§Ã£o
- âŒ RelatÃ³rios avanÃ§ados
- âŒ Agendamento de entregas
- âŒ Entregas recorrentes

---

## ðŸ‘¨â€ðŸ’¼ Perfil: ADMINISTRADOR

### **AutenticaÃ§Ã£o & Acesso** ðŸ”
| Funcionalidade | Prioridade | DescriÃ§Ã£o |
|----------------|-----------|-----------|
| Login admin | ðŸ”´ CrÃ­tica | Email e senha (role-based) |
| Dashboard home | ðŸ”´ CrÃ­tica | VisÃ£o geral do sistema |

### **Monitoramento em Tempo Real** ðŸ“¡
| Funcionalidade | Prioridade | DescriÃ§Ã£o |
|----------------|-----------|-----------|
| Mapa com entregas ativas | ðŸ”´ CrÃ­tica | Ver todas as entregas em andamento |
| Lista de entregas do dia | ðŸ”´ CrÃ­tica | Todas as entregas (filtros) |
| Status de cada entrega | ðŸ”´ CrÃ­tica | Ver detalhes completos |
| MÃ©tricas bÃ¡sicas | ðŸ”´ CrÃ­tica | Total entregas, taxa conclusÃ£o, tempo mÃ©dio |

### **GestÃ£o de UsuÃ¡rios** ðŸ‘¥
| Funcionalidade | Prioridade | DescriÃ§Ã£o |
|----------------|-----------|-----------|
| Lista de motoboys | ðŸ”´ CrÃ­tica | Todos os motoboys cadastrados |
| Detalhes do motoboy | ðŸ”´ CrÃ­tica | Perfil completo + estatÃ­sticas |
| Aprovar/rejeitar cadastro | ðŸŸ¡ Alta | VerificaÃ§Ã£o de documentos |
| Suspender motoboy | ðŸŸ¡ Alta | Bloquear temporariamente |
| Lista de restaurantes | ðŸ”´ CrÃ­tica | Todos os estabelecimentos |
| Detalhes do restaurante | ðŸ”´ CrÃ­tica | Perfil + estatÃ­sticas |
| Suspender restaurante | ðŸŸ¡ Alta | Bloquear temporariamente |

### **Suporte & Disputas** ðŸŽ«
| Funcionalidade | Prioridade | DescriÃ§Ã£o |
|----------------|-----------|-----------|
| Ver entregas problemÃ¡ticas | ðŸŸ¡ Alta | Filtro de canceladas/com problemas |
| Detalhes de problemas | ðŸŸ¡ Alta | Ver razÃ£o de cancelamento |
| Contato direto (email/telefone) | ðŸŸ¡ Alta | Dados para entrar em contato |
| Reembolso manual | ðŸŸ¢ MÃ©dia | Processar reembolso excepcional |

### **RelatÃ³rios BÃ¡sicos** ðŸ“Š
| Funcionalidade | Prioridade | DescriÃ§Ã£o |
|----------------|-----------|-----------|
| Entregas por dia | ðŸ”´ CrÃ­tica | GrÃ¡fico simples |
| Taxa de conclusÃ£o | ðŸ”´ CrÃ­tica | % de entregas concluÃ­das |
| Tempo mÃ©dio de entrega | ðŸ”´ CrÃ­tica | DuraÃ§Ã£o mÃ©dia total |
| Motoboys mais ativos | ðŸŸ¡ Alta | Top 10 por nÃºmero de entregas |
| Restaurantes mais ativos | ðŸŸ¡ Alta | Top 10 por nÃºmero de pedidos |
| Receita total da plataforma | ðŸ”´ CrÃ­tica | Soma das taxas cobradas |

### **ConfiguraÃ§Ãµes** âš™ï¸
| Funcionalidade | Prioridade | DescriÃ§Ã£o |
|----------------|-----------|-----------|
| Taxa da plataforma | ðŸ”´ CrÃ­tica | % ou valor fixo cobrado |
| Raio de busca de motoboys | ðŸŸ¡ Alta | DistÃ¢ncia padrÃ£o (ex: 5km) |
| Valor mÃ­nimo por km | ðŸŸ¡ Alta | Para cÃ¡lculo automÃ¡tico de preÃ§o |

### **Fora do MVP** âŒ
- âŒ Analytics avanÃ§ado
- âŒ Sistema de tickets
- âŒ Chat interno
- âŒ GestÃ£o de pagamentos automÃ¡tica
- âŒ MÃºltiplos nÃ­veis de admin
- âŒ Auditoria detalhada
- âŒ ExportaÃ§Ã£o de relatÃ³rios
- âŒ IntegraÃ§Ãµes externas

---

## ðŸ—‚ï¸ Funcionalidades TÃ©cnicas (Backend)

### **Essenciais para MVP** ðŸ”´

| Funcionalidade | DescriÃ§Ã£o |
|----------------|-----------|
| AutenticaÃ§Ã£o | Supabase Auth (email/password) |
| Banco de dados | PostgreSQL com tabelas principais |
| RLS Policies | SeguranÃ§a de acesso aos dados |
| Real-time subscriptions | AtualizaÃ§Ã£o de status em tempo real |
| Storage | Upload de fotos (CNH, entregas) |
| Geolocation | CÃ¡lculo de distÃ¢ncias e rastreamento |
| NotificaÃ§Ãµes push | Firebase Cloud Messaging bÃ¡sico |

### **Edge Functions MVP**

| FunÃ§Ã£o | Prioridade | DescriÃ§Ã£o |
|--------|-----------|-----------|
| notify-drivers | ðŸ”´ CrÃ­tica | Notifica motoboys sobre nova entrega |
| calculate-price | ðŸ”´ CrÃ­tica | Calcula valor baseado em distÃ¢ncia |
| send-notification | ðŸŸ¡ Alta | Envia push notifications |

### **Fora do MVP** âŒ
- âŒ Sistema de pagamentos integrado
- âŒ VerificaÃ§Ã£o automÃ¡tica de documentos
- âŒ IA/ML para otimizaÃ§Ã£o
- âŒ Webhooks
- âŒ API pÃºblica

---

## ðŸ“± Interfaces MVP

### **App Mobile Motoboy**
**Telas Essenciais:**
1. âœ… Login/Cadastro
2. âœ… Home (Status + Resumo do dia)
3. âœ… Lista de Entregas DisponÃ­veis
4. âœ… Detalhes da Entrega
5. âœ… Entrega Ativa (NavegaÃ§Ã£o)
6. âœ… HistÃ³rico
7. âœ… Perfil

### **Web App Restaurante**
**Telas Essenciais:**
1. âœ… Login/Cadastro
2. âœ… Dashboard (Resumo)
3. âœ… Nova Entrega (FormulÃ¡rio)
4. âœ… Entregas Ativas (Lista + Mapa)
5. âœ… HistÃ³rico
6. âœ… Perfil

### **Painel Admin**
**Telas Essenciais:**
1. âœ… Login
2. âœ… Dashboard (MÃ©tricas + Mapa)
3. âœ… Lista de Entregas
4. âœ… Detalhes de Entrega
5. âœ… Lista de Motoboys
6. âœ… Detalhes do Motoboy
7. âœ… Lista de Restaurantes
8. âœ… Detalhes do Restaurante
9. âœ… ConfiguraÃ§Ãµes

---

## ðŸŽ¯ Matriz de PriorizaÃ§Ã£o

### **Prioridade ðŸ”´ CRÃTICA (Fase 1 - Semana 1-2)**
Sem essas funcionalidades, o produto nÃ£o funciona.

**Motoboy:**
- Login/Cadastro
- Ver entregas disponÃ­veis
- Aceitar entrega
- Marcar status (coletei, entreguei)
- Ver entrega ativa

**Restaurante:**
- Login/Cadastro
- Criar entrega
- Ver entregas em andamento
- Rastreamento bÃ¡sico no mapa
- Ver histÃ³rico

**Admin:**
- Login
- Ver todas as entregas
- Gerenciar usuÃ¡rios bÃ¡sico
- Dashboard com mÃ©tricas

**Backend:**
- AutenticaÃ§Ã£o
- CRUD entregas
- Real-time status
- Geolocation bÃ¡sica

---

### **Prioridade ðŸŸ¡ ALTA (Fase 2 - Semana 3-4)**
Importantes para uma boa experiÃªncia, mas nÃ£o bloqueiam o funcionamento.

**Geral:**
- NotificaÃ§Ãµes push
- Sistema de avaliaÃ§Ãµes
- Upload de fotos
- Filtros e buscas
- Cancelamento de entregas

---

### **Prioridade ðŸŸ¢ MÃ‰DIA (Fase 3 - PÃ³s-MVP)**
Melhoram a experiÃªncia mas podem esperar validaÃ§Ã£o inicial.

**Geral:**
- Fotos de comprovaÃ§Ã£o
- RelatÃ³rios detalhados
- VerificaÃ§Ã£o de documentos
- MÃºltiplos endereÃ§os salvos

---

## ðŸ“Š MÃ©tricas de Sucesso do MVP

### **MÃ©tricas de Produto**
- âœ… Tempo mÃ©dio de aceite < 3 minutos
- âœ… Taxa de conclusÃ£o > 85%
- âœ… Pelo menos 10 entregas/dia
- âœ… Rating mÃ©dio > 4.0
- âœ… Taxa de cancelamento < 10%

### **MÃ©tricas de Engajamento**
- âœ… Motoboys ativos/dia: mÃ­nimo 5
- âœ… Restaurantes ativos/semana: mÃ­nimo 3
- âœ… RetenÃ§Ã£o motoboys (semana 2): > 60%
- âœ… RetenÃ§Ã£o restaurantes (semana 2): > 70%

### **MÃ©tricas TÃ©cnicas**
- âœ… Uptime > 99%
- âœ… LatÃªncia API < 500ms (p95)
- âœ… Real-time delay < 2s
- âœ… Zero erros crÃ­ticos

---

## ðŸš€ Timeline Estimado do MVP

### **Semana 1-2: Core Features (CrÃ­tico)**
- [ ] Setup backend completo (Supabase)
- [ ] AutenticaÃ§Ã£o e perfis
- [ ] CRUD de entregas
- [ ] Sistema de aceite/recusa
- [ ] AtualizaÃ§Ã£o de status
- [ ] Real-time bÃ¡sico

### **Semana 3-4: Polish & High Priority**
- [ ] App mobile nativo (Capacitor)
- [ ] Rastreamento com mapa
- [ ] NotificaÃ§Ãµes push
- [ ] Sistema de avaliaÃ§Ãµes
- [ ] Painel admin completo
- [ ] Upload de fotos

### **Semana 5-6: Testes & Launch**
- [ ] Testes com usuÃ¡rios reais
- [ ] CorreÃ§Ãµes de bugs
- [ ] Ajustes de UX
- [ ] Deploy em produÃ§Ã£o
- [ ] Onboarding dos primeiros usuÃ¡rios

---

## âœ… Checklist de Pronto para LanÃ§ar

### **Funcional**
- [ ] Motoboy consegue se cadastrar e fazer login
- [ ] Restaurante consegue criar entregas
- [ ] Motoboy recebe notificaÃ§Ã£o de nova entrega
- [ ] Motoboy consegue aceitar e executar entrega
- [ ] Restaurante vÃª status em tempo real
- [ ] Admin consegue monitorar tudo
- [ ] Sistema de avaliaÃ§Ãµes funciona

### **Performance**
- [ ] App mobile carrega em < 3s
- [ ] Mapa atualiza em tempo real
- [ ] NotificaÃ§Ãµes chegam em < 10s
- [ ] Nenhum erro crÃ­tico nos Ãºltimos 7 dias

### **SeguranÃ§a**
- [ ] RLS policies ativas em todas as tabelas
- [ ] Dados sensÃ­veis nÃ£o expostos
- [ ] Uploads validados
- [ ] Rate limiting em edge functions

### **UX**
- [ ] Onboarding claro para ambos perfis
- [ ] Feedback visual em todas as aÃ§Ãµes
- [ ] Estados de loading
- [ ] Mensagens de erro amigÃ¡veis
- [ ] Design responsivo

---

## ðŸŽ“ Aprendizados Esperados do MVP

**Perguntas a Responder:**
1. Motoboys aceitam as entregas rapidamente?
2. Restaurantes conseguem encontrar motoboys consistentemente?
3. O preÃ§o sugerido Ã© aceito ou sempre ajustado?
4. Qual o raio ideal de busca de motoboys?
5. Qual horÃ¡rio tem mais demanda?
6. Quais funcionalidades sÃ£o mais solicitadas?
7. Onde estÃ£o os principais pontos de fricÃ§Ã£o?

---

## ðŸ”„ EvoluÃ§Ã£o PÃ³s-MVP

**PrÃ³ximas Features (apÃ³s validaÃ§Ã£o):**
1. Sistema de pagamentos integrado
2. Chat em tempo real
3. MÃºltiplas entregas simultÃ¢neas para motoboy
4. Agendamento de entregas
5. Programa de fidelidade
6. API para integraÃ§Ãµes
7. White-label para parceiros
8. IA para otimizaÃ§Ã£o de rotas

