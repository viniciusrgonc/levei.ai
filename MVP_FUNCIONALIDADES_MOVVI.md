# MVP Movvi - Funcionalidades por Perfil

## 🎯 Objetivo do MVP

Validar a hipótese central: **Restaurantes conseguem encontrar motoboys autônomos de forma rápida e eficiente para realizar entregas.**

**Critérios de Sucesso:**
- Tempo médio de aceite < 3 minutos
- Taxa de conclusão > 85%
- Pelo menos 10 entregas completadas/dia
- Rating médio > 4.0 estrelas

---

## 🏍️ Perfil: MOTOBOY

### **Autenticação & Perfil** 🔐
| Funcionalidade | Prioridade | Descrição |
|----------------|-----------|-----------|
| Cadastro | 🔴 Crítica | Email, senha, nome completo, telefone |
| Login | 🔴 Crítica | Email e senha |
| Perfil básico | 🔴 Crítica | Foto, dados do veículo (tipo, placa) |
| Upload de CNH | 🟡 Alta | Foto da CNH para verificação |
| Status online/offline | 🔴 Crítica | Toggle para ficar disponível |

### **Descoberta de Entregas** 📍
| Funcionalidade | Prioridade | Descrição |
|----------------|-----------|-----------|
| Lista de entregas disponíveis | 🔴 Crítica | Cards com valor, distância, restaurante |
| Filtro por distância | 🟡 Alta | Mostrar apenas entregas até X km |
| Detalhes da entrega | 🔴 Crítica | Endereços, valor, descrição |
| Aceitar entrega | 🔴 Crítica | Botão para vincular entrega ao motoboy |
| Recusar entrega | 🟡 Alta | Botão para passar a oportunidade |
| Notificação de nova entrega | 🟡 Alta | Push notification quando entrega disponível |

### **Execução da Entrega** 🚚
| Funcionalidade | Prioridade | Descrição |
|----------------|-----------|-----------|
| Ver entrega ativa | 🔴 Crítica | Tela com detalhes da entrega aceita |
| Navegação GPS | 🔴 Crítica | Abrir Google Maps com endereço |
| Botão "Cheguei para coletar" | 🔴 Crítica | Marca início da coleta |
| Botão "Coletei o pedido" | 🔴 Crítica | Marca fim da coleta e início da entrega |
| Foto do pedido (opcional) | 🟢 Média | Tirar foto após coleta |
| Botão "Entrega concluída" | 🔴 Crítica | Marca conclusão da entrega |
| Código de confirmação | 🟡 Alta | Cliente fornece código para confirmar |
| Foto de comprovação | 🟢 Média | Foto da entrega concluída |

### **Histórico & Ganhos** 💰
| Funcionalidade | Prioridade | Descrição |
|----------------|-----------|-----------|
| Lista de entregas realizadas | 🔴 Crítica | Histórico com status e valores |
| Resumo de ganhos do dia | 🔴 Crítica | Total ganho no dia atual |
| Resumo semanal | 🟡 Alta | Total da semana |
| Detalhes de entrega passada | 🟡 Alta | Ver informações completas |

### **Avaliação** ⭐
| Funcionalidade | Prioridade | Descrição |
|----------------|-----------|-----------|
| Avaliar restaurante | 🟡 Alta | Estrelas (1-5) após entrega |
| Ver minhas avaliações | 🟢 Média | Feedback recebido |
| Rating médio no perfil | 🟡 Alta | Mostrar média de avaliações |

### **Fora do MVP** ❌
- ❌ Chat com restaurante
- ❌ Múltiplas entregas simultâneas
- ❌ Saque de valores
- ❌ Agendamento de disponibilidade
- ❌ Estatísticas avançadas
- ❌ Programa de fidelidade

---

## 🍽️ Perfil: RESTAURANTE

### **Autenticação & Perfil** 🔐
| Funcionalidade | Prioridade | Descrição |
|----------------|-----------|-----------|
| Cadastro | 🔴 Crítica | Email, senha, nome do restaurante, telefone |
| Login | 🔴 Crítica | Email e senha |
| Perfil do estabelecimento | 🔴 Crítica | Nome, endereço, foto |
| Upload CNPJ (opcional MVP) | 🟢 Média | Documento para verificação |

### **Criar Entrega** 📦
| Funcionalidade | Prioridade | Descrição |
|----------------|-----------|-----------|
| Formulário de nova entrega | 🔴 Crítica | Endereço coleta, entrega, descrição |
| Cálculo automático de distância | 🔴 Crítica | Baseado nos endereços |
| Sugestão de valor | 🔴 Crítica | Sistema sugere preço baseado em distância |
| Ajustar valor manualmente | 🟡 Alta | Restaurante pode alterar valor sugerido |
| Instruções especiais | 🟡 Alta | Campo de texto livre |
| Confirmar criação | 🔴 Crítica | Botão para publicar entrega |

### **Gerenciar Entregas** 📊
| Funcionalidade | Prioridade | Descrição |
|----------------|-----------|-----------|
| Ver entregas aguardando motoboy | 🔴 Crítica | Lista de pendentes |
| Ver entregas em andamento | 🔴 Crítica | Entregas aceitas/em execução |
| Rastreamento no mapa | 🔴 Crítica | Ver localização do motoboy em tempo real |
| Status da entrega | 🔴 Crítica | Aguardando/Aceito/Coletando/Em entrega/Concluído |
| Cancelar entrega | 🟡 Alta | Antes de ser aceita |
| Ver histórico completo | 🔴 Crítica | Todas as entregas (filtros por data/status) |
| Detalhes de entrega | 🔴 Crítica | Informações completas + comprovantes |

### **Notificações** 🔔
| Funcionalidade | Prioridade | Descrição |
|----------------|-----------|-----------|
| Entrega aceita | 🔴 Crítica | Push quando motoboy aceita |
| Motoboy chegou | 🟡 Alta | Push quando motoboy marca chegada |
| Entrega concluída | 🔴 Crítica | Push quando finaliza |

### **Avaliação** ⭐
| Funcionalidade | Prioridade | Descrição |
|----------------|-----------|-----------|
| Avaliar motoboy | 🟡 Alta | Estrelas (1-5) após conclusão |
| Ver avaliações recebidas | 🟢 Média | Feedback de motoboys |
| Rating médio no perfil | 🟡 Alta | Mostrar média |

### **Financeiro Básico** 💳
| Funcionalidade | Prioridade | Descrição |
|----------------|-----------|-----------|
| Ver custos do dia | 🔴 Crítica | Total gasto em entregas |
| Ver custos do mês | 🟡 Alta | Total mensal |
| Histórico de gastos | 🟡 Alta | Lista de todas as cobranças |

### **Fora do MVP** ❌
- ❌ Chat com motoboy
- ❌ Múltiplos endereços de coleta salvos
- ❌ Integração com sistema próprio
- ❌ API para automação
- ❌ Relatórios avançados
- ❌ Agendamento de entregas
- ❌ Entregas recorrentes

---

## 👨‍💼 Perfil: ADMINISTRADOR

### **Autenticação & Acesso** 🔐
| Funcionalidade | Prioridade | Descrição |
|----------------|-----------|-----------|
| Login admin | 🔴 Crítica | Email e senha (role-based) |
| Dashboard home | 🔴 Crítica | Visão geral do sistema |

### **Monitoramento em Tempo Real** 📡
| Funcionalidade | Prioridade | Descrição |
|----------------|-----------|-----------|
| Mapa com entregas ativas | 🔴 Crítica | Ver todas as entregas em andamento |
| Lista de entregas do dia | 🔴 Crítica | Todas as entregas (filtros) |
| Status de cada entrega | 🔴 Crítica | Ver detalhes completos |
| Métricas básicas | 🔴 Crítica | Total entregas, taxa conclusão, tempo médio |

### **Gestão de Usuários** 👥
| Funcionalidade | Prioridade | Descrição |
|----------------|-----------|-----------|
| Lista de motoboys | 🔴 Crítica | Todos os motoboys cadastrados |
| Detalhes do motoboy | 🔴 Crítica | Perfil completo + estatísticas |
| Aprovar/rejeitar cadastro | 🟡 Alta | Verificação de documentos |
| Suspender motoboy | 🟡 Alta | Bloquear temporariamente |
| Lista de restaurantes | 🔴 Crítica | Todos os estabelecimentos |
| Detalhes do restaurante | 🔴 Crítica | Perfil + estatísticas |
| Suspender restaurante | 🟡 Alta | Bloquear temporariamente |

### **Suporte & Disputas** 🎫
| Funcionalidade | Prioridade | Descrição |
|----------------|-----------|-----------|
| Ver entregas problemáticas | 🟡 Alta | Filtro de canceladas/com problemas |
| Detalhes de problemas | 🟡 Alta | Ver razão de cancelamento |
| Contato direto (email/telefone) | 🟡 Alta | Dados para entrar em contato |
| Reembolso manual | 🟢 Média | Processar reembolso excepcional |

### **Relatórios Básicos** 📊
| Funcionalidade | Prioridade | Descrição |
|----------------|-----------|-----------|
| Entregas por dia | 🔴 Crítica | Gráfico simples |
| Taxa de conclusão | 🔴 Crítica | % de entregas concluídas |
| Tempo médio de entrega | 🔴 Crítica | Duração média total |
| Motoboys mais ativos | 🟡 Alta | Top 10 por número de entregas |
| Restaurantes mais ativos | 🟡 Alta | Top 10 por número de pedidos |
| Receita total da plataforma | 🔴 Crítica | Soma das taxas cobradas |

### **Configurações** ⚙️
| Funcionalidade | Prioridade | Descrição |
|----------------|-----------|-----------|
| Taxa da plataforma | 🔴 Crítica | % ou valor fixo cobrado |
| Raio de busca de motoboys | 🟡 Alta | Distância padrão (ex: 5km) |
| Valor mínimo por km | 🟡 Alta | Para cálculo automático de preço |

### **Fora do MVP** ❌
- ❌ Analytics avançado
- ❌ Sistema de tickets
- ❌ Chat interno
- ❌ Gestão de pagamentos automática
- ❌ Múltiplos níveis de admin
- ❌ Auditoria detalhada
- ❌ Exportação de relatórios
- ❌ Integrações externas

---

## 🗂️ Funcionalidades Técnicas (Backend)

### **Essenciais para MVP** 🔴

| Funcionalidade | Descrição |
|----------------|-----------|
| Autenticação | Supabase Auth (email/password) |
| Banco de dados | PostgreSQL com tabelas principais |
| RLS Policies | Segurança de acesso aos dados |
| Real-time subscriptions | Atualização de status em tempo real |
| Storage | Upload de fotos (CNH, entregas) |
| Geolocation | Cálculo de distâncias e rastreamento |
| Notificações push | Firebase Cloud Messaging básico |

### **Edge Functions MVP**

| Função | Prioridade | Descrição |
|--------|-----------|-----------|
| notify-drivers | 🔴 Crítica | Notifica motoboys sobre nova entrega |
| calculate-price | 🔴 Crítica | Calcula valor baseado em distância |
| send-notification | 🟡 Alta | Envia push notifications |

### **Fora do MVP** ❌
- ❌ Sistema de pagamentos integrado
- ❌ Verificação automática de documentos
- ❌ IA/ML para otimização
- ❌ Webhooks
- ❌ API pública

---

## 📱 Interfaces MVP

### **App Mobile Motoboy**
**Telas Essenciais:**
1. ✅ Login/Cadastro
2. ✅ Home (Status + Resumo do dia)
3. ✅ Lista de Entregas Disponíveis
4. ✅ Detalhes da Entrega
5. ✅ Entrega Ativa (Navegação)
6. ✅ Histórico
7. ✅ Perfil

### **Web App Restaurante**
**Telas Essenciais:**
1. ✅ Login/Cadastro
2. ✅ Dashboard (Resumo)
3. ✅ Nova Entrega (Formulário)
4. ✅ Entregas Ativas (Lista + Mapa)
5. ✅ Histórico
6. ✅ Perfil

### **Painel Admin**
**Telas Essenciais:**
1. ✅ Login
2. ✅ Dashboard (Métricas + Mapa)
3. ✅ Lista de Entregas
4. ✅ Detalhes de Entrega
5. ✅ Lista de Motoboys
6. ✅ Detalhes do Motoboy
7. ✅ Lista de Restaurantes
8. ✅ Detalhes do Restaurante
9. ✅ Configurações

---

## 🎯 Matriz de Priorização

### **Prioridade 🔴 CRÍTICA (Fase 1 - Semana 1-2)**
Sem essas funcionalidades, o produto não funciona.

**Motoboy:**
- Login/Cadastro
- Ver entregas disponíveis
- Aceitar entrega
- Marcar status (coletei, entreguei)
- Ver entrega ativa

**Restaurante:**
- Login/Cadastro
- Criar entrega
- Ver entregas em andamento
- Rastreamento básico no mapa
- Ver histórico

**Admin:**
- Login
- Ver todas as entregas
- Gerenciar usuários básico
- Dashboard com métricas

**Backend:**
- Autenticação
- CRUD entregas
- Real-time status
- Geolocation básica

---

### **Prioridade 🟡 ALTA (Fase 2 - Semana 3-4)**
Importantes para uma boa experiência, mas não bloqueiam o funcionamento.

**Geral:**
- Notificações push
- Sistema de avaliações
- Upload de fotos
- Filtros e buscas
- Cancelamento de entregas

---

### **Prioridade 🟢 MÉDIA (Fase 3 - Pós-MVP)**
Melhoram a experiência mas podem esperar validação inicial.

**Geral:**
- Fotos de comprovação
- Relatórios detalhados
- Verificação de documentos
- Múltiplos endereços salvos

---

## 📊 Métricas de Sucesso do MVP

### **Métricas de Produto**
- ✅ Tempo médio de aceite < 3 minutos
- ✅ Taxa de conclusão > 85%
- ✅ Pelo menos 10 entregas/dia
- ✅ Rating médio > 4.0
- ✅ Taxa de cancelamento < 10%

### **Métricas de Engajamento**
- ✅ Motoboys ativos/dia: mínimo 5
- ✅ Restaurantes ativos/semana: mínimo 3
- ✅ Retenção motoboys (semana 2): > 60%
- ✅ Retenção restaurantes (semana 2): > 70%

### **Métricas Técnicas**
- ✅ Uptime > 99%
- ✅ Latência API < 500ms (p95)
- ✅ Real-time delay < 2s
- ✅ Zero erros críticos

---

## 🚀 Timeline Estimado do MVP

### **Semana 1-2: Core Features (Crítico)**
- [ ] Setup backend completo (Lovable Cloud)
- [ ] Autenticação e perfis
- [ ] CRUD de entregas
- [ ] Sistema de aceite/recusa
- [ ] Atualização de status
- [ ] Real-time básico

### **Semana 3-4: Polish & High Priority**
- [ ] App mobile nativo (Capacitor)
- [ ] Rastreamento com mapa
- [ ] Notificações push
- [ ] Sistema de avaliações
- [ ] Painel admin completo
- [ ] Upload de fotos

### **Semana 5-6: Testes & Launch**
- [ ] Testes com usuários reais
- [ ] Correções de bugs
- [ ] Ajustes de UX
- [ ] Deploy em produção
- [ ] Onboarding dos primeiros usuários

---

## ✅ Checklist de Pronto para Lançar

### **Funcional**
- [ ] Motoboy consegue se cadastrar e fazer login
- [ ] Restaurante consegue criar entregas
- [ ] Motoboy recebe notificação de nova entrega
- [ ] Motoboy consegue aceitar e executar entrega
- [ ] Restaurante vê status em tempo real
- [ ] Admin consegue monitorar tudo
- [ ] Sistema de avaliações funciona

### **Performance**
- [ ] App mobile carrega em < 3s
- [ ] Mapa atualiza em tempo real
- [ ] Notificações chegam em < 10s
- [ ] Nenhum erro crítico nos últimos 7 dias

### **Segurança**
- [ ] RLS policies ativas em todas as tabelas
- [ ] Dados sensíveis não expostos
- [ ] Uploads validados
- [ ] Rate limiting em edge functions

### **UX**
- [ ] Onboarding claro para ambos perfis
- [ ] Feedback visual em todas as ações
- [ ] Estados de loading
- [ ] Mensagens de erro amigáveis
- [ ] Design responsivo

---

## 🎓 Aprendizados Esperados do MVP

**Perguntas a Responder:**
1. Motoboys aceitam as entregas rapidamente?
2. Restaurantes conseguem encontrar motoboys consistentemente?
3. O preço sugerido é aceito ou sempre ajustado?
4. Qual o raio ideal de busca de motoboys?
5. Qual horário tem mais demanda?
6. Quais funcionalidades são mais solicitadas?
7. Onde estão os principais pontos de fricção?

---

## 🔄 Evolução Pós-MVP

**Próximas Features (após validação):**
1. Sistema de pagamentos integrado
2. Chat em tempo real
3. Múltiplas entregas simultâneas para motoboy
4. Agendamento de entregas
5. Programa de fidelidade
6. API para integrações
7. White-label para parceiros
8. IA para otimização de rotas
