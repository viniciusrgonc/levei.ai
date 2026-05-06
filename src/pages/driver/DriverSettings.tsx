import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Loader2, ArrowLeft, CheckCircle2, AlertCircle,
  Shield, Bike, Car, Truck, ChevronRight, Settings2,
} from 'lucide-react';
import { DriverBottomNav } from '@/components/DriverBottomNav';
import { PRODUCT_TYPES } from '@/lib/productTypes';
import { useState } from 'react';

// ── Vehicle options ───────────────────────────────────────────────────────────
const VEHICLE_OPTIONS = [
  { value: 'motorcycle', label: 'Moto',          icon: '🏍️' },
  { value: 'bicycle',    label: 'Bicicleta',      icon: '🚲' },
  { value: 'car',        label: 'Carro',          icon: '🚗' },
  { value: 'van',        label: 'Van',            icon: '🚐' },
  { value: 'truck',      label: 'Caminhão',       icon: '🚚' },
  { value: 'hourly_service', label: 'Por hora',   icon: '⏱️' },
];

// ── Query ─────────────────────────────────────────────────────────────────────
async function fetchSettings(userId: string) {
  const { data, error } = await supabase
    .from('drivers')
    .select('id, is_available, vehicle_type, license_plate, accepted_product_types')
    .eq('user_id', userId)
    .single();
  if (error) throw error;
  return {
    id: data.id as string,
    isAvailable: data.is_available,
    vehicleType: (data.vehicle_type as string) ?? 'motorcycle',
    licensePlate: data.license_plate ?? '',
    acceptedProductTypes: Array.isArray(data.accepted_product_types)
      ? (data.accepted_product_types as string[])
      : [],
  };
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function DriverSettings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Local state for editable fields
  const [licensePlate, setLicensePlate] = useState('');
  const [vehicleType, setVehicleType] = useState('motorcycle');
  const [acceptedProductTypes, setAcceptedProductTypes] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // ── Query ──────────────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['driver-settings', user?.id],
    queryFn: () => fetchSettings(user!.id),
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000,
    onSuccess: (d) => {
      if (!hydrated) {
        setLicensePlate(d.licensePlate);
        setVehicleType(d.vehicleType);
        setAcceptedProductTypes(d.acceptedProductTypes);
        setHydrated(true);
      }
    },
  } as any);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const toggleAvailability = useMutation({
    mutationFn: async (checked: boolean) => {
      if (checked && acceptedProductTypes.length === 0) {
        throw new Error('NO_CATEGORIES');
      }
      const { error } = await supabase
        .from('drivers').update({ is_available: checked }).eq('user_id', user?.id);
      if (error) throw error;
      return checked;
    },
    onSuccess: (checked) => {
      queryClient.setQueryData(['driver-settings', user?.id], (old: any) =>
        old ? { ...old, isAvailable: checked } : old
      );
      queryClient.invalidateQueries({ queryKey: ['driver-profile'] });
      toast({ title: checked ? '✅ Você está disponível!' : 'Você está offline' });
    },
    onError: (err: any) => {
      if (err.message === 'NO_CATEGORIES') {
        toast({
          title: '⚠️ Configure suas categorias',
          description: 'Selecione ao menos um tipo de entrega antes de ficar disponível.',
          variant: 'destructive',
        });
        document.getElementById('categories-section')?.scrollIntoView({ behavior: 'smooth' });
      } else {
        toast({ title: 'Erro ao atualizar disponibilidade', variant: 'destructive' });
      }
    },
  });

  const saveCategories = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('drivers')
        .update({ accepted_product_types: acceptedProductTypes })
        .eq('user_id', user?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver-settings', user?.id] });
      toast({ title: '✅ Categorias salvas!' });
    },
    onError: () => toast({ title: 'Erro ao salvar categorias', variant: 'destructive' }),
  });

  const saveVehicle = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('drivers')
        .update({ vehicle_type: vehicleType as any, license_plate: licensePlate || null })
        .eq('user_id', user?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver-settings', user?.id] });
      toast({ title: '✅ Veículo atualizado!' });
    },
    onError: () => toast({ title: 'Erro ao salvar veículo', variant: 'destructive' }),
  });

  // ── Helpers ────────────────────────────────────────────────────────────────
  const toggleProductType = (key: string) =>
    setAcceptedProductTypes(prev =>
      prev.includes(key) ? prev.filter(t => t !== key) : [...prev, key]
    );

  const allSelected = acceptedProductTypes.length === PRODUCT_TYPES.length;
  const noneSelected = acceptedProductTypes.length === 0;
  const isAvailable = data?.isAvailable ?? false;

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="bg-primary h-36" />
        <div className="px-4 pt-4 space-y-3">
          {[80, 300, 220, 100].map((h, i) => (
            <div key={i} className={`bg-white rounded-2xl animate-pulse`} style={{ height: h }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ── HERO ── */}
      <div className="bg-gradient-to-br from-primary to-primary/80">
        <div
          className="flex items-center gap-3 px-4 pb-2"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}
        >
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center active:scale-90 transition-transform flex-shrink-0"
          >
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>
          <div className="flex-1">
            <h1 className="text-white font-bold text-xl leading-tight">Configurações</h1>
            <p className="text-white/60 text-xs">Veículo, disponibilidade e categorias</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
            <Settings2 className="h-4.5 w-4.5 text-white/70" style={{ width: 18, height: 18 }} />
          </div>
        </div>

        {/* Status strip */}
        <div className="flex items-center gap-3 px-4 pb-4 pt-2">
          <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 ${
            isAvailable ? 'bg-green-500/20' : 'bg-white/10'
          }`}>
            <div className={`w-2 h-2 rounded-full ${isAvailable ? 'bg-green-400' : 'bg-white/40'}`} />
            <span className="text-white text-xs font-semibold">
              {isAvailable ? 'Online' : 'Offline'}
            </span>
          </div>
          <div className="bg-white/10 rounded-full px-3 py-1">
            <span className="text-white/70 text-xs">
              {acceptedProductTypes.length}/{PRODUCT_TYPES.length} categorias
            </span>
          </div>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <main className="flex-1 overflow-y-auto pb-28 px-4 pt-4 space-y-4">

        {/* ── Disponibilidade ── */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Disponibilidade</p>
          </div>

          <div className="px-4 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                isAvailable ? 'bg-green-100' : 'bg-gray-100'
              }`}>
                <Bike className={`h-5 w-5 transition-colors ${isAvailable ? 'text-green-600' : 'text-gray-400'}`} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {isAvailable ? 'Disponível para entregas' : 'Offline'}
                </p>
                <p className="text-xs text-gray-400">
                  {isAvailable ? 'Recebendo novas solicitações' : 'Ative para receber entregas'}
                </p>
              </div>
            </div>
            <Switch
              checked={isAvailable}
              onCheckedChange={(v) => toggleAvailability.mutate(v)}
              disabled={toggleAvailability.isPending}
              className="flex-shrink-0 data-[state=checked]:bg-green-500"
            />
          </div>

          {noneSelected && (
            <div className="mx-4 mb-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
              <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 leading-relaxed">
                Configure as categorias abaixo antes de ficar disponível.
              </p>
            </div>
          )}
        </div>

        {/* ── Tipo de veículo ── */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Tipo de veículo</p>
          </div>

          <div className="px-4 pt-3 pb-1 grid grid-cols-3 gap-2">
            {VEHICLE_OPTIONS.map((v) => {
              const selected = vehicleType === v.value;
              return (
                <button
                  key={v.value}
                  onClick={() => setVehicleType(v.value)}
                  className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 transition-all ${
                    selected
                      ? 'border-primary bg-primary/5'
                      : 'border-transparent bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <span className="text-2xl leading-none">{v.icon}</span>
                  <span className={`text-[11px] font-semibold leading-tight text-center ${
                    selected ? 'text-primary' : 'text-gray-600'
                  }`}>{v.label}</span>
                </button>
              );
            })}
          </div>

          <div className="px-4 pt-2 pb-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="licensePlate" className="text-xs text-gray-500">
                Placa do veículo <span className="text-gray-400">(opcional)</span>
              </Label>
              <Input
                id="licensePlate"
                value={licensePlate}
                onChange={(e) => setLicensePlate(e.target.value.toUpperCase())}
                placeholder="ABC-1234"
                className="rounded-xl border-gray-200 uppercase font-mono"
                maxLength={8}
              />
            </div>

            <button
              onClick={() => saveVehicle.mutate()}
              disabled={saveVehicle.isPending}
              className="w-full h-11 rounded-xl bg-primary text-white font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-2 transition-opacity"
            >
              {saveVehicle.isPending
                ? <><Loader2 className="h-4 w-4 animate-spin" />Salvando...</>
                : <><CheckCircle2 className="h-4 w-4" />Salvar veículo</>
              }
            </button>
          </div>
        </div>

        {/* ── Categorias aceitas ── */}
        <div id="categories-section" className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                Categorias que aceito
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Tipos de entrega que você consegue fazer</p>
            </div>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              noneSelected
                ? 'bg-red-100 text-red-600'
                : 'bg-primary/10 text-primary'
            }`}>
              {noneSelected ? 'Nenhuma' : `${acceptedProductTypes.length}/${PRODUCT_TYPES.length}`}
            </span>
          </div>

          <div className="px-4 pt-3 pb-2 flex items-center justify-between">
            <button
              onClick={() => allSelected
                ? setAcceptedProductTypes([])
                : setAcceptedProductTypes(PRODUCT_TYPES.map(t => t.key))
              }
              className="text-xs font-semibold text-primary"
            >
              {allSelected ? 'Desmarcar todas' : 'Selecionar todas'}
            </button>
            <span className="text-xs text-gray-400">
              {acceptedProductTypes.length} selecionada{acceptedProductTypes.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="px-4 pb-2 space-y-1.5">
            {PRODUCT_TYPES.map((type) => {
              const selected = acceptedProductTypes.includes(type.key);
              return (
                <button
                  key={type.key}
                  onClick={() => toggleProductType(type.key)}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl border-2 transition-all text-left ${
                    selected
                      ? 'border-primary bg-primary/5'
                      : 'border-transparent bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <span className="text-xl flex-shrink-0 leading-none">{type.icon}</span>
                  <span className={`flex-1 text-sm font-medium ${selected ? 'text-primary' : 'text-gray-700'}`}>
                    {type.label}
                  </span>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    selected ? 'bg-primary border-primary' : 'border-gray-300 bg-white'
                  }`}>
                    {selected && (
                      <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="px-4 pb-4 pt-2">
            <button
              onClick={() => saveCategories.mutate()}
              disabled={saveCategories.isPending}
              className="w-full h-11 rounded-xl bg-primary text-white font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-2 transition-opacity"
            >
              {saveCategories.isPending
                ? <><Loader2 className="h-4 w-4 animate-spin" />Salvando...</>
                : <><CheckCircle2 className="h-4 w-4" />Salvar categorias</>
              }
            </button>
          </div>
        </div>

        {/* ── Segurança ── */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              Privacidade e segurança
            </p>
          </div>
          {[
            { label: 'Alterar senha' },
            { label: 'Gerenciar privacidade' },
          ].map((item, i, arr) => (
            <button
              key={item.label}
              onClick={() => toast({ title: '🚀 Em breve!' })}
              className={`w-full flex items-center justify-between px-4 py-4 hover:bg-gray-50 transition-colors ${
                i < arr.length - 1 ? 'border-b border-gray-50' : ''
              }`}
              style={{ minHeight: 44 }}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
                  <Shield className="h-4 w-4 text-gray-500" />
                </div>
                <span className="text-sm font-medium text-gray-900">{item.label}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-300" />
            </button>
          ))}
        </div>

      </main>

      <DriverBottomNav />
    </div>
  );
}
