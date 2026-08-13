import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft, User, Phone, Mail, Lock, MapPin, Car,
  Pencil, Check, X, Eye, EyeOff, Loader2, ShieldCheck,
} from 'lucide-react';
import { IS_DEV_MODE } from '@/lib/appConfig';

type ProfileData = {
  full_name?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  email?: string | null;
  cpf?: string | null;
  cnpj?: string | null;
  person_type?: string | null;
  address_cep?: string | null;
  address_street?: string | null;
  address_number?: string | null;
  address_complement?: string | null;
  address_neighborhood?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  vehicle_type?: string | null;
  vehicle_model?: string | null;
  vehicle_color?: string | null;
  vehicle_year?: string | null;
  has_bag?: boolean | null;
  bag_type?: string | null;
};

async function fetchCep(cep: string) {
  const clean = cep.replace(/\D/g, '');
  if (clean.length !== 8) return null;
  try {
    const r = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
    const d = await r.json();
    if (d.erro) return null;
    return d as { logradouro: string; bairro: string; localidade: string; uf: string };
  } catch {
    return null;
  }
}

const maskCpf = (v: string) => {
  const d = v.replace(/\D/g, '');
  if (d.length !== 11) return v;
  return `***.***.${ d.slice(6, 9)}-${d.slice(9)}`;
};
const maskCnpj = (v: string) => {
  const d = v.replace(/\D/g, '');
  if (d.length !== 14) return v;
  return `**.***/0001-${d.slice(12)}`;
};
const maskCep = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};

type EditSection = 'personal' | 'access' | 'address' | null;

export default function MyData() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const isDriver = location.pathname.startsWith('/driver/');

  const [editing, setEditing] = useState<EditSection>(null);

  // Personal
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  // Access
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);
  const [passSaving, setPassSaving] = useState(false);

  // Address
  const [cep, setCep] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [stateUF, setStateUF] = useState('');
  const [cepLoading, setCepLoading] = useState(false);

  const { data: profile, isLoading } = useQuery<ProfileData>({
    queryKey: ['my-data', user?.id, isDriver],
    queryFn: async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error('Not authenticated');

      const driverSelect =
        'cpf, address_cep, address_street, address_number, address_complement, address_neighborhood, address_city, address_state, vehicle_type, vehicle_model, vehicle_color, vehicle_year, has_bag, bag_type';
      const restaurantSelect =
        'cpf, cnpj, person_type, address_cep, address_street, address_number, address_complement, address_neighborhood, address_city, address_state';

      const [{ data: pd }, { data: extra }] = await Promise.all([
        supabase.from('profiles').select('full_name, phone').eq('id', authUser.id).maybeSingle(),
        isDriver
          ? supabase.from('drivers').select(driverSelect).eq('user_id', authUser.id).maybeSingle()
          : supabase.from('restaurants').select(restaurantSelect).eq('user_id', authUser.id).maybeSingle(),
      ]);

      const merged: ProfileData = { ...pd, ...extra, email: authUser.email };

      setFullName(merged.full_name || '');
      setPhone(merged.phone || '');
      setCep(merged.address_cep ? maskCep(merged.address_cep) : '');
      setStreet(merged.address_street || '');
      setNumber(merged.address_number || '');
      setComplement(merged.address_complement || '');
      setNeighborhood(merged.address_neighborhood || '');
      setCity(merged.address_city || '');
      setStateUF(merged.address_state || '');

      return merged;
    },
  });

  const resetFields = (p: ProfileData | undefined) => {
    setFullName(p?.full_name || '');
    setPhone(p?.phone || '');
    setCep(p?.address_cep ? maskCep(p.address_cep) : '');
    setStreet(p?.address_street || '');
    setNumber(p?.address_number || '');
    setComplement(p?.address_complement || '');
    setNeighborhood(p?.address_neighborhood || '');
    setCity(p?.address_city || '');
    setStateUF(p?.address_state || '');
    setNewEmail('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const startEdit = (section: EditSection) => {
    resetFields(profile);
    setEditing(section);
  };

  const cancelEdit = () => {
    resetFields(profile);
    setEditing(null);
  };

  const savePersonal = useMutation({
    mutationFn: async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error('Not authenticated');
      const { error } = await supabase.from('profiles')
        .update({ full_name: fullName.trim(), phone: phone.trim() })
        .eq('id', authUser.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-data'] });
      queryClient.invalidateQueries({ queryKey: ['driver-profile'] });
      queryClient.invalidateQueries({ queryKey: ['restaurant-profile'] });
      toast({ title: '✅ Dados pessoais atualizados!' });
      setEditing(null);
    },
    onError: () => toast({ title: 'Não foi possível salvar', description: 'Tente novamente mais tarde.', variant: 'destructive' }),
  });

  const saveAddress = useMutation({
    mutationFn: async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error('Not authenticated');
      const data = {
        address_cep: cep.replace(/\D/g, ''),
        address_street: street.trim(),
        address_number: number.trim(),
        address_complement: complement.trim() || null,
        address_neighborhood: neighborhood.trim(),
        address_city: city.trim(),
        address_state: stateUF.trim().toUpperCase(),
      };
      const table = isDriver ? 'drivers' : 'restaurants';
      const col = isDriver ? 'user_id' : 'user_id';
      const { error } = await supabase.from(table).update(data).eq(col, authUser.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-data'] });
      toast({ title: '✅ Endereço atualizado!' });
      setEditing(null);
    },
    onError: () => toast({ title: 'Não foi possível salvar o endereço', description: 'Tente novamente mais tarde.', variant: 'destructive' }),
  });

  const handleEmailChange = async () => {
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@') || !trimmed.includes('.')) {
      toast({ title: 'E-mail inválido', description: 'Informe um e-mail válido.', variant: 'destructive' });
      return;
    }
    if (trimmed === profile?.email) {
      toast({ title: 'E-mail igual ao atual', description: 'Informe um e-mail diferente.', variant: 'destructive' });
      return;
    }
    setEmailSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: trimmed });
      if (error) throw error;
      toast({ title: IS_DEV_MODE ? '✅ E-mail atualizado!' : '✅ Confirme o novo e-mail', description: IS_DEV_MODE ? '' : 'Um link foi enviado para o novo endereço.' });
      setNewEmail('');
      queryClient.invalidateQueries({ queryKey: ['my-data'] });
    } catch {
      toast({ title: 'Não foi possível alterar o e-mail', description: 'Tente novamente mais tarde.', variant: 'destructive' });
    } finally {
      setEmailSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (newPassword.length < 6) {
      toast({ title: 'Senha muito curta', description: 'Use pelo menos 6 caracteres.', variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'Senhas não conferem', description: 'A confirmação deve ser igual à nova senha.', variant: 'destructive' });
      return;
    }
    setPassSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast({ title: '✅ Senha alterada com sucesso!' });
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      toast({ title: 'Não foi possível alterar a senha', description: 'Tente novamente mais tarde.', variant: 'destructive' });
    } finally {
      setPassSaving(false);
    }
  };

  const handleCepChange = async (v: string) => {
    const masked = maskCep(v);
    setCep(masked);
    if (masked.replace(/\D/g, '').length === 8) {
      setCepLoading(true);
      const data = await fetchCep(masked);
      if (data) {
        setStreet(data.logradouro);
        setNeighborhood(data.bairro);
        setCity(data.localidade);
        setStateUF(data.uf);
      }
      setCepLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-primary h-16" />
        <div className="px-4 space-y-3 mt-4">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  const isCompany = profile?.person_type === 'pj';
  const docLabel = isDriver ? 'CPF' : (isCompany ? 'CNPJ' : 'CPF');
  const docRaw = isDriver ? profile?.cpf : (isCompany ? profile?.cnpj : profile?.cpf);
  const docMasked = docRaw
    ? (isCompany && !isDriver ? maskCnpj(docRaw) : maskCpf(docRaw))
    : null;

  const vehicleLabels: Record<string, string> = {
    motorcycle: 'Moto', bicycle: 'Bicicleta', car: 'Carro', van: 'Van',
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Header */}
      <div
        className="bg-primary px-4 flex items-center gap-3"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)', paddingBottom: '16px' }}
      >
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold text-white">Meus dados</h1>
        {IS_DEV_MODE && (
          <span className="ml-auto text-[10px] bg-yellow-400/20 text-yellow-200 px-2 py-0.5 rounded-full font-medium">
            Modo teste
          </span>
        )}
      </div>

      <main className="flex-1 overflow-y-auto pb-8 px-4 pt-4 space-y-4">

        {/* DADOS PESSOAIS */}
        <SectionCard
          title="Dados pessoais"
          editing={editing === 'personal'}
          onEdit={() => startEdit('personal')}
          onCancel={cancelEdit}
          onSave={() => savePersonal.mutate()}
          saving={savePersonal.isPending}
        >
          {editing === 'personal' ? (
            <div className="space-y-3 px-4 pb-4">
              <FieldWrap label="Nome completo">
                <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Seu nome" />
              </FieldWrap>
              <FieldWrap label="Telefone">
                <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(37) 99999-9999" type="tel" />
              </FieldWrap>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              <InfoRow icon={<User className="h-4 w-4 text-blue-500" />} bg="bg-blue-50" label="Nome" value={profile?.full_name || '—'} />
              <InfoRow icon={<Phone className="h-4 w-4 text-green-500" />} bg="bg-green-50" label="Telefone" value={profile?.phone || '—'} />
              {docMasked && (
                <InfoRow icon={<ShieldCheck className="h-4 w-4 text-gray-500" />} bg="bg-gray-100" label={docLabel} value={docMasked} locked />
              )}
            </div>
          )}
        </SectionCard>

        {/* DADOS DE ACESSO */}
        <SectionCard
          title="Dados de acesso"
          editing={editing === 'access'}
          onEdit={() => startEdit('access')}
          onCancel={cancelEdit}
          showSaveBtn={false}
        >
          {editing === 'access' ? (
            <div className="px-4 pb-4 space-y-5">

              {/* Email */}
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">Alterar e-mail</p>
                <p className="text-xs text-gray-400 mb-2">
                  E-mail atual: <span className="font-medium text-gray-600">{profile?.email}</span>
                </p>
                <div className="space-y-2">
                  <Input
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    placeholder="Novo e-mail"
                    type="email"
                    autoCapitalize="none"
                  />
                  <button
                    onClick={handleEmailChange}
                    disabled={emailSaving || !newEmail.trim()}
                    className="w-full h-10 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {emailSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar novo e-mail'}
                  </button>
                </div>
              </div>

              {/* Senha */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-semibold text-gray-500 mb-2">Alterar senha</p>
                <div className="space-y-2">
                  <div className="relative">
                    <Input
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Nova senha (mín. 6 caracteres)"
                      type={showPass ? 'text' : 'password'}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    >
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Input
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Confirmar nova senha"
                    type={showPass ? 'text' : 'password'}
                  />
                  <button
                    onClick={handlePasswordChange}
                    disabled={passSaving || !newPassword || !confirmPassword}
                    className="w-full h-10 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {passSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Alterar senha'}
                  </button>
                </div>
              </div>

            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              <InfoRow icon={<Mail className="h-4 w-4 text-purple-500" />} bg="bg-purple-50" label="E-mail" value={profile?.email || '—'} />
              <InfoRow icon={<Lock className="h-4 w-4 text-gray-500" />} bg="bg-gray-100" label="Senha" value="••••••••" />
            </div>
          )}
        </SectionCard>

        {/* ENDEREÇO */}
        <SectionCard
          title="Endereço"
          editing={editing === 'address'}
          onEdit={() => startEdit('address')}
          onCancel={cancelEdit}
          onSave={() => saveAddress.mutate()}
          saving={saveAddress.isPending}
        >
          {editing === 'address' ? (
            <div className="space-y-3 px-4 pb-4">
              <FieldWrap label="CEP">
                <div className="relative">
                  <Input
                    value={cep}
                    onChange={e => handleCepChange(e.target.value)}
                    placeholder="00000-000"
                    maxLength={9}
                    inputMode="numeric"
                  />
                  {cepLoading && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
                  )}
                </div>
              </FieldWrap>
              <FieldWrap label="Rua / Logradouro">
                <Input value={street} onChange={e => setStreet(e.target.value)} placeholder="Rua, Avenida..." />
              </FieldWrap>
              <div className="grid grid-cols-2 gap-2">
                <FieldWrap label="Número">
                  <Input value={number} onChange={e => setNumber(e.target.value)} placeholder="123" />
                </FieldWrap>
                <FieldWrap label="Complemento">
                  <Input value={complement} onChange={e => setComplement(e.target.value)} placeholder="Apto, Sala..." />
                </FieldWrap>
              </div>
              <FieldWrap label="Bairro">
                <Input value={neighborhood} onChange={e => setNeighborhood(e.target.value)} placeholder="Bairro" />
              </FieldWrap>
              <div className="grid grid-cols-2 gap-2">
                <FieldWrap label="Cidade">
                  <Input value={city} onChange={e => setCity(e.target.value)} placeholder="Cidade" />
                </FieldWrap>
                <FieldWrap label="Estado (UF)">
                  <Input
                    value={stateUF}
                    onChange={e => setStateUF(e.target.value.toUpperCase())}
                    placeholder="MG"
                    maxLength={2}
                    className="uppercase"
                  />
                </FieldWrap>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {profile?.address_city ? (
                <div className="flex items-start gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <MapPin className="h-4 w-4 text-orange-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    {profile?.address_street && (
                      <p className="text-sm font-medium text-gray-900">
                        {profile.address_street}{profile?.address_number ? `, ${profile.address_number}` : ''}
                      </p>
                    )}
                    {profile?.address_neighborhood && (
                      <p className="text-xs text-gray-500">{profile.address_neighborhood}</p>
                    )}
                    <p className="text-xs text-gray-400">
                      {profile?.address_city}/{profile?.address_state}
                    </p>
                    {profile?.address_cep && (
                      <p className="text-xs text-gray-400">CEP: {maskCep(profile.address_cep)}</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 px-4 py-3 text-gray-400">
                  <MapPin className="h-4 w-4" />
                  <span className="text-sm">Nenhum endereço cadastrado</span>
                </div>
              )}
            </div>
          )}
        </SectionCard>

        {/* DADOS DO VEÍCULO — driver only, read-only */}
        {isDriver && (profile?.vehicle_type || profile?.vehicle_model) && (
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1 mb-2">Dados do veículo</p>
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-start gap-3 px-4 py-4">
                <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Car className="h-4 w-4 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">
                      {vehicleLabels[profile?.vehicle_type || ''] || profile?.vehicle_type || '—'}
                    </p>
                    {profile?.vehicle_year && (
                      <span className="text-xs text-gray-400">{profile.vehicle_year}</span>
                    )}
                  </div>
                  {profile?.vehicle_model && (
                    <p className="text-sm text-gray-600">
                      {profile.vehicle_model}
                      {profile?.vehicle_color ? ` · ${profile.vehicle_color}` : ''}
                    </p>
                  )}
                  {profile?.has_bag && (
                    <p className="text-xs text-gray-400">
                      Mochila {profile?.bag_type ? `· ${profile.bag_type}` : ''}
                    </p>
                  )}
                  <p className="text-[10px] text-gray-300 pt-1">
                    Para alterar dados do veículo, entre em contato com o suporte.
                  </p>
                </div>
                <Lock className="h-3.5 w-3.5 text-gray-300 flex-shrink-0 mt-1" />
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function SectionCard({
  title, editing, onEdit, onCancel, onSave, saving = false, showSaveBtn = true, children,
}: {
  title: string;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave?: () => void;
  saving?: boolean;
  showSaveBtn?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between px-1 mb-2">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{title}</p>
        {!editing ? (
          <button onClick={onEdit} className="flex items-center gap-1 text-xs text-primary font-medium">
            <Pencil className="h-3 w-3" /> Editar
          </button>
        ) : (
          <div className="flex items-center gap-3">
            {showSaveBtn && onSave && (
              <button
                onClick={onSave}
                disabled={saving}
                className="flex items-center gap-1 text-xs text-primary font-semibold disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                Salvar
              </button>
            )}
            <button onClick={onCancel} className="flex items-center gap-1 text-xs text-gray-400 font-medium">
              <X className="h-3 w-3" /> Cancelar
            </button>
          </div>
        )}
      </div>
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function InfoRow({
  icon, bg, label, value, locked = false,
}: {
  icon: React.ReactNode;
  bg: string;
  label: string;
  value: string | null | undefined;
  locked?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className={`w-8 h-8 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm font-medium text-gray-900 truncate">{value || '—'}</p>
      </div>
      {locked && <Lock className="h-3.5 w-3.5 text-gray-300 flex-shrink-0" />}
    </div>
  );
}

function FieldWrap({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-gray-500">{label}</Label>
      {children}
    </div>
  );
}
