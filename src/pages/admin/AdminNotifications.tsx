import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/AdminSidebar';
import { AdminPageHeader } from '@/components/AdminPageHeader';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Bell, Send, History, Users, X, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DriverRow      { user_id: string; name: string | null }
interface RestaurantRow  { user_id: string; name: string | null }
interface UserOption     { id: string; name: string; role: 'driver' | 'restaurant' }
interface Campaign {
  id: string;
  recipient_type: string;
  title: string;
  message: string;
  type: string;
  priority: string;
  recipients_count: number;
  created_at: string;
}

const TARGET_LABELS: Record<string, string> = {
  all:              'Todos (entregadores + estabelecimentos)',
  all_drivers:      'Todos os entregadores',
  all_restaurants:  'Todos os estabelecimentos',
  user:             'Usuários específicos',
};

const TYPE_META: Record<string, { label: string; color: string }> = {
  info:     { label: 'Informação', color: 'bg-blue-100 text-blue-700' },
  success:  { label: 'Sucesso',    color: 'bg-green-100 text-green-700' },
  warning:  { label: 'Aviso',      color: 'bg-amber-100 text-amber-700' },
  error:    { label: 'Erro',       color: 'bg-red-100 text-red-700' },
  system:   { label: 'Sistema',    color: 'bg-purple-100 text-purple-700' },
  security: { label: 'Segurança',  color: 'bg-gray-100 text-gray-700' },
};

const PRIORITY_META: Record<string, { label: string; color: string }> = {
  normal:    { label: 'Normal',     color: '' },
  important: { label: 'Importante', color: 'bg-amber-100 text-amber-700' },
  urgent:    { label: 'Urgente',    color: 'bg-red-100 text-red-600' },
};

export default function AdminNotifications() {
  const queryClient = useQueryClient();

  // Form state
  const [targetType, setTargetType]       = useState('all_drivers');
  const [selectedUsers, setSelectedUsers] = useState<UserOption[]>([]);
  const [userSearch, setUserSearch]       = useState('');
  const [title, setTitle]                 = useState('');
  const [message, setMessage]             = useState('');
  const [notifType, setNotifType]         = useState('info');
  const [priority, setPriority]           = useState('normal');
  const [expiresAt, setExpiresAt]         = useState('');
  const [showConfirm, setShowConfirm]     = useState(false);

  // Fetch drivers for user picker
  const { data: drivers = [] } = useQuery<DriverRow[]>({
    queryKey: ['admin-drivers-picker'],
    queryFn: async () => {
      const { data } = await supabase.from('drivers').select('user_id, name');
      return (data ?? []) as DriverRow[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch restaurants for user picker
  const { data: restaurants = [] } = useQuery<RestaurantRow[]>({
    queryKey: ['admin-restaurants-picker'],
    queryFn: async () => {
      const { data } = await supabase.from('restaurants').select('user_id, name');
      return (data ?? []) as RestaurantRow[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const allUsers: UserOption[] = useMemo(() => [
    ...drivers.map(d => ({ id: d.user_id, name: d.name ?? d.user_id.slice(0, 8), role: 'driver' as const })),
    ...restaurants.map(r => ({ id: r.user_id, name: r.name ?? r.user_id.slice(0, 8), role: 'restaurant' as const })),
  ], [drivers, restaurants]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.toLowerCase();
    return allUsers.filter(
      u => !selectedUsers.some(s => s.id === u.id) &&
           (u.name.toLowerCase().includes(q) || u.id.toLowerCase().includes(q))
    );
  }, [allUsers, selectedUsers, userSearch]);

  const estimatedCount = useMemo(() => {
    if (targetType === 'user') return selectedUsers.length;
    if (targetType === 'all_drivers') return drivers.length;
    if (targetType === 'all_restaurants') return restaurants.length;
    if (targetType === 'all')
      return new Set([...drivers.map(d => d.user_id), ...restaurants.map(r => r.user_id)]).size;
    return 0;
  }, [targetType, selectedUsers, drivers, restaurants]);

  // Fetch campaign history
  const { data: campaigns = [], isLoading: loadingCampaigns } = useQuery<Campaign[]>({
    queryKey: ['admin-notification-campaigns'],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('notification_campaigns')
        .select('id, recipient_type, title, message, type, priority, recipients_count, created_at')
        .order('created_at', { ascending: false })
        .limit(100);
      return (data ?? []) as Campaign[];
    },
    staleTime: 30 * 1000,
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada. Faça login novamente.');

      const body: Record<string, unknown> = {
        target_type: targetType,
        title: title.trim(),
        message: message.trim(),
        type: notifType,
        priority,
      };
      if (targetType === 'user') body.target_ids = selectedUsers.map(u => u.id);
      if (expiresAt) body.expires_at = new Date(expiresAt).toISOString();

      const { data, error } = await supabase.functions.invoke('send-notification', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body,
      });
      if (error) throw new Error('Erro ao chamar a função de envio');
      if (!data?.success) throw new Error(data?.message ?? 'Erro ao enviar notificação');
      return data;
    },
    onSuccess: (data) => {
      const count      = data.data?.recipients_count ?? 0;
      const idempotent = data.data?.idempotent ?? false;
      toast.success(
        idempotent
          ? 'Notificação já enviada recentemente (sem duplicata)'
          : `Notificação enviada para ${count} destinatário${count !== 1 ? 's' : ''}`
      );
      setShowConfirm(false);
      setTitle(''); setMessage(''); setNotifType('info');
      setPriority('normal'); setExpiresAt('');
      setSelectedUsers([]); setTargetType('all_drivers');
      queryClient.invalidateQueries({ queryKey: ['admin-notification-campaigns'] });
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Erro ao enviar notificação');
      setShowConfirm(false);
    },
  });

  const isFormValid =
    title.trim().length >= 1 && title.trim().length <= 100 &&
    message.trim().length >= 1 && message.trim().length <= 1000 &&
    (targetType !== 'user' || selectedUsers.length > 0);

  const MAX_SPECIFIC_USERS = 100; // mirrors Edge Function MAX_SPECIFIC_RECIPIENTS
  const addUser = (u: UserOption) => {
    if (selectedUsers.length >= MAX_SPECIFIC_USERS) {
      toast.error(`Máximo de ${MAX_SPECIFIC_USERS} usuários por envio`);
      return;
    }
    setSelectedUsers(p => [...p, u]);
    setUserSearch('');
  };
  const removeUser = (id: string) => setSelectedUsers(p => p.filter(u => u.id !== id));

  const minExpires = new Date(Date.now() + 60_000).toISOString().slice(0, 16);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-gray-50 w-full">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <AdminPageHeader
            title="Notificações"
            subtitle="Envie comunicações para entregadores e estabelecimentos"
          />

          <div className="flex-1 p-6">
            <Tabs defaultValue="send">
              <TabsList className="mb-6">
                <TabsTrigger value="send" className="gap-2">
                  <Send className="h-4 w-4" />
                  Enviar Notificação
                </TabsTrigger>
                <TabsTrigger value="history" className="gap-2">
                  <History className="h-4 w-4" />
                  Histórico de Campanhas
                </TabsTrigger>
              </TabsList>

              {/* ── Enviar ─────────────────────────────────────────── */}
              <TabsContent value="send">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                  {/* Form */}
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-5">
                    <h2 className="text-base font-semibold text-gray-900">Compor notificação</h2>

                    {/* Público-alvo */}
                    <div className="space-y-1.5">
                      <Label>Público-alvo</Label>
                      <Select
                        value={targetType}
                        onValueChange={v => { setTargetType(v); setSelectedUsers([]); }}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all_drivers">Todos os entregadores</SelectItem>
                          <SelectItem value="all_restaurants">Todos os estabelecimentos</SelectItem>
                          <SelectItem value="all">Todos (entregadores + estabelecimentos)</SelectItem>
                          <SelectItem value="user">Usuários específicos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* User picker */}
                    {targetType === 'user' && (
                      <div className="space-y-2">
                        <Label>Buscar usuários</Label>

                        {/* Chips de selecionados */}
                        {selectedUsers.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-1">
                            {selectedUsers.map(u => (
                              <span
                                key={u.id}
                                className="flex items-center gap-1 bg-primary/10 text-primary text-xs font-medium px-2 py-1 rounded-full"
                              >
                                {u.name}
                                <span className="text-[9px] text-gray-400 ml-0.5">
                                  {u.role === 'driver' ? 'E' : 'R'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeUser(u.id)}
                                  className="ml-0.5 hover:text-red-500 transition-colors"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}

                        <Input
                          placeholder="Nome ou ID do usuário..."
                          value={userSearch}
                          onChange={e => setUserSearch(e.target.value)}
                        />

                        {userSearch && filteredUsers.length > 0 && (
                          <div className="border border-gray-200 rounded-lg max-h-36 overflow-y-auto divide-y divide-gray-100">
                            {filteredUsers.slice(0, 20).map(u => (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() => addUser(u)}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between transition-colors"
                              >
                                <span className="font-medium truncate">{u.name}</span>
                                <span className="text-[10px] text-gray-400 ml-2 shrink-0">
                                  {u.role === 'driver' ? 'Entregador' : 'Estabelecimento'}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                        {userSearch && filteredUsers.length === 0 && (
                          <p className="text-xs text-gray-400 px-1">Nenhum usuário encontrado</p>
                        )}
                      </div>
                    )}

                    {/* Título */}
                    <div className="space-y-1.5">
                      <Label>
                        Título
                        <span className="ml-1 text-xs text-gray-400">({title.trim().length}/100)</span>
                      </Label>
                      <Input
                        placeholder="Ex: Atualização do sistema"
                        value={title}
                        onChange={e => setTitle(e.target.value.slice(0, 100))}
                        maxLength={100}
                      />
                    </div>

                    {/* Mensagem */}
                    <div className="space-y-1.5">
                      <Label>
                        Mensagem
                        <span className="ml-1 text-xs text-gray-400">({message.trim().length}/1000)</span>
                      </Label>
                      <Textarea
                        placeholder="Ex: Realizamos melhorias na plataforma para facilitar suas entregas."
                        value={message}
                        onChange={e => setMessage(e.target.value.slice(0, 1000))}
                        maxLength={1000}
                        rows={4}
                        className="resize-none"
                      />
                    </div>

                    {/* Tipo + Prioridade */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>Tipo</Label>
                        <Select value={notifType} onValueChange={setNotifType}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="info">Informação</SelectItem>
                            <SelectItem value="success">Sucesso</SelectItem>
                            <SelectItem value="warning">Aviso</SelectItem>
                            <SelectItem value="error">Erro</SelectItem>
                            <SelectItem value="system">Sistema</SelectItem>
                            <SelectItem value="security">Segurança</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Prioridade</Label>
                        <Select value={priority} onValueChange={setPriority}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="important">Importante</SelectItem>
                            <SelectItem value="urgent">Urgente</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Expiração */}
                    <div className="space-y-1.5">
                      <Label>
                        Expiração
                        <span className="ml-1 text-gray-400 font-normal">(opcional)</span>
                      </Label>
                      <Input
                        type="datetime-local"
                        value={expiresAt}
                        onChange={e => setExpiresAt(e.target.value)}
                        min={minExpires}
                      />
                      <p className="text-[11px] text-gray-400">
                        A notificação não aparecerá para usuários após essa data.
                      </p>
                    </div>

                    {/* Submit */}
                    <div className="pt-1">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-gray-500">
                          Destinatários estimados:{' '}
                          <strong className="text-gray-900">{estimatedCount}</strong>
                        </span>
                        {targetType === 'user' && selectedUsers.length === 0 && (
                          <span className="text-xs text-amber-600">Selecione ao menos 1 usuário</span>
                        )}
                      </div>
                      <Button
                        className="w-full gap-2"
                        disabled={!isFormValid || sendMutation.isPending}
                        onClick={() => setShowConfirm(true)}
                      >
                        <Bell className="h-4 w-4" />
                        Visualizar e confirmar
                      </Button>
                    </div>
                  </div>

                  {/* Prévia + Resumo */}
                  <div className="space-y-4">

                    {/* Preview card */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                      <h2 className="text-base font-semibold text-gray-900 mb-4">Prévia</h2>
                      {title || message ? (
                        <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                              <Bell className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-semibold text-gray-900">
                                  {title.trim() || 'Título da notificação'}
                                </p>
                                {TYPE_META[notifType] && (
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${TYPE_META[notifType].color}`}>
                                    {TYPE_META[notifType].label}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-600 mt-0.5 line-clamp-4">
                                {message.trim() || 'Mensagem da notificação'}
                              </p>
                              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                <span className="text-[10px] text-gray-400">agora mesmo</span>
                                {(priority === 'important' || priority === 'urgent') && (
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${PRIORITY_META[priority].color}`}>
                                    {PRIORITY_META[priority].label}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="border border-dashed border-gray-200 rounded-xl p-8 text-center">
                          <Bell className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                          <p className="text-sm text-gray-400">
                            Preencha o título e a mensagem para ver a prévia
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Resumo */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                      <h2 className="text-base font-semibold text-gray-900 mb-4">Resumo</h2>
                      <dl className="space-y-2 text-sm">
                        <div className="flex justify-between gap-4">
                          <dt className="text-gray-500 shrink-0">Público-alvo</dt>
                          <dd className="text-gray-900 font-medium text-right">{TARGET_LABELS[targetType]}</dd>
                        </div>
                        {targetType === 'user' && (
                          <div className="flex justify-between">
                            <dt className="text-gray-500">Usuários selecionados</dt>
                            <dd className="text-gray-900 font-medium">{selectedUsers.length}</dd>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <dt className="text-gray-500">Tipo</dt>
                          <dd className="text-gray-900 font-medium">{TYPE_META[notifType]?.label}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-gray-500">Prioridade</dt>
                          <dd className="text-gray-900 font-medium">{PRIORITY_META[priority]?.label}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-gray-500">Expiração</dt>
                          <dd className="text-gray-900 font-medium">
                            {expiresAt
                              ? format(new Date(expiresAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })
                              : '—'}
                          </dd>
                        </div>
                        <div className="flex justify-between border-t border-gray-100 pt-3 mt-1">
                          <dt className="text-gray-700 font-semibold">Destinatários (estimado)</dt>
                          <dd className="text-primary font-bold text-base">{estimatedCount}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* ── Histórico ──────────────────────────────────────── */}
              <TabsContent value="history">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
                  <div className="px-6 py-5 border-b border-gray-100">
                    <h2 className="text-base font-semibold text-gray-900">Campanhas enviadas</h2>
                    <p className="text-sm text-gray-500 mt-0.5">Últimas 100 campanhas</p>
                  </div>

                  {loadingCampaigns ? (
                    <div className="p-12 text-center text-sm text-gray-400">Carregando...</div>
                  ) : campaigns.length === 0 ? (
                    <div className="p-12 text-center">
                      <History className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                      <p className="text-sm text-gray-400">Nenhuma campanha enviada ainda</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {campaigns.map(c => (
                        <div
                          key={c.id}
                          className="px-6 py-4 flex items-start gap-4 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-gray-900 truncate">{c.title}</p>
                              {TYPE_META[c.type] && (
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${TYPE_META[c.type].color}`}>
                                  {TYPE_META[c.type].label}
                                </span>
                              )}
                              {(c.priority === 'important' || c.priority === 'urgent') && (
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${PRIORITY_META[c.priority].color}`}>
                                  {PRIORITY_META[c.priority].label}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{c.message}</p>
                            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                              <span className="text-[10px] text-gray-400">
                                {TARGET_LABELS[c.recipient_type] ?? c.recipient_type}
                              </span>
                              <span className="text-[10px] text-gray-300">·</span>
                              <span className="flex items-center gap-1 text-[10px] text-gray-400">
                                <Users className="h-3 w-3" />
                                {c.recipients_count} destinatário{c.recipients_count !== 1 ? 's' : ''}
                              </span>
                              <span className="text-[10px] text-gray-300">·</span>
                              <span className="text-[10px] text-gray-400">
                                {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: ptBR })}
                              </span>
                            </div>
                          </div>
                          <div className="text-[10px] text-gray-400 shrink-0 text-right tabular-nums">
                            {format(new Date(c.created_at), 'dd/MM/yy HH:mm')}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* ── Diálogo de confirmação ──────────────────────────── */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar envio</DialogTitle>
            <DialogDescription>
              Revise os detalhes antes de enviar. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <div className="flex justify-between gap-4">
                <span className="text-gray-500 shrink-0">Público-alvo</span>
                <span className="font-medium text-right">{TARGET_LABELS[targetType]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Destinatários estimados</span>
                <span className="font-bold text-primary">{estimatedCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Tipo</span>
                <span className="font-medium">{TYPE_META[notifType]?.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Prioridade</span>
                <span className="font-medium">{PRIORITY_META[priority]?.label}</span>
              </div>
              {expiresAt && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Expiração</span>
                  <span className="font-medium">
                    {format(new Date(expiresAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                  </span>
                </div>
              )}
            </div>

            <div className="border border-gray-200 rounded-xl p-4 space-y-1">
              <p className="font-semibold text-gray-900">{title.trim()}</p>
              <p className="text-gray-600 text-xs whitespace-pre-wrap leading-relaxed">{message.trim()}</p>
            </div>

            {priority === 'urgent' && (
              <div className="flex items-center gap-2 bg-red-50 rounded-lg px-3 py-2 text-red-700 text-xs">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Prioridade urgente — aparecerá em destaque para os usuários.
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirm(false)}
              disabled={sendMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => sendMutation.mutate()}
              disabled={sendMutation.isPending}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              {sendMutation.isPending ? 'Enviando...' : 'Confirmar envio'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
