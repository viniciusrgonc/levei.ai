import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Bike, Shield, ArrowLeft, ChevronRight, Package, AlertCircle, CheckCircle2 } from 'lucide-react';
import { DriverBottomNav } from '@/components/DriverBottomNav';
import leveiLogo from '@/assets/levei-logo.png';
import NotificationBell from '@/components/NotificationBell';
import { PRODUCT_TYPES } from '@/lib/productTypes';

export default function DriverSettings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingCategories, setSavingCategories] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [vehicleType, setVehicleType] = useState('motorcycle');
  const [licensePlate, setLicensePlate] = useState('');
  const [driverId, setDriverId] = useState<string | null>(null);
  const [acceptedProductTypes, setAcceptedProductTypes] = useState<string[]>([]);

  useEffect(() => { if (user) fetchSettings(); }, [user]);

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from('drivers')
      .select('id, is_available, vehicle_type, license_plate, accepted_product_types')
      .eq('user_id', user?.id)
      .single();

    console.log('[DriverSettings] fetchSettings result:', data, error);

    if (data) {
      setDriverId(data.id);
      setIsAvailable(data.is_available);
      setVehicleType(data.vehicle_type as string);
      setLicensePlate(data.license_plate || '');
      const tipos = Array.isArray(data.accepted_product_types)
        ? (data.accepted_product_types as string[])
        : [];
      console.log('[DriverSettings] Categorias do motoboy:', tipos);
      setAcceptedProductTypes(tipos);
    }
    setLoading(false);
  };

  const handleToggleAvailability = async (checked: boolean) => {
    // Bloqueia ficar online se não tiver categorias configuradas
    if (checked && acceptedProductTypes.length === 0) {
      toast({
        title: '⚠️ Configure suas categorias',
        description: 'Selecione ao menos um tipo de entrega que você aceita antes de ficar disponível.',
        variant: 'destructive',
      });
      // Rola para a seção de categorias
      document.getElementById('categories-section')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    setIsAvailable(checked);
    const { error } = await supabase
      .from('drivers').update({ is_available: checked }).eq('user_id', user?.id);
    if (error) {
      setIsAvailable(!checked);
      toast({ title: 'Erro ao atualizar disponibilidade', variant: 'destructive' });
    } else {
      toast({ title: checked ? 'Você está disponível!' : 'Você está offline' });
    }
  };

  const handleToggleProductType = (key: string) => {
    setAcceptedProductTypes(prev =>
      prev.includes(key) ? prev.filter(t => t !== key) : [...prev, key]
    );
  };

  const handleSelectAll = () => {
    setAcceptedProductTypes(PRODUCT_TYPES.map(t => t.key));
  };

  const handleClearAll = () => {
    setAcceptedProductTypes([]);
  };

  const handleSaveCategories = async () => {
    setSavingCategories(true);
    console.log('[DriverSettings] Salvando categorias:', acceptedProductTypes);
    const { error } = await supabase
      .from('drivers')
      .update({ accepted_product_types: acceptedProductTypes })
      .eq('user_id', user?.id);

    if (error) {
      console.error('[DriverSettings] Erro ao salvar categorias:', error);
      toast({ title: 'Erro ao salvar categorias', variant: 'destructive' });
    } else {
      toast({ title: '✅ Categorias salvas!' });
    }
    setSavingCategories(false);
  };

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase
      .from('drivers')
      .update({ vehicle_type: vehicleType as any, license_plate: licensePlate || null })
      .eq('user_id', user?.id);
    if (error) {
      toast({ title: 'Erro ao salvar veículo', variant: 'destructive' });
    } else {
      toast({ title: 'Dados do veículo atualizados!' });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="bg-primary h-40" />
        <div className="px-4 space-y-3 mt-4">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  const allSelected = acceptedProductTypes.length === PRODUCT_TYPES.length;
  const noneSelected = acceptedProductTypes.length === 0;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ── HERO ── */}
      <div className="bg-primary">
        <div
          className="flex items-center justify-between px-4 pb-2"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/driver/profile')}
              className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center"
            >
              <ArrowLeft className="h-5 w-5 text-white" />
            </button>
            <img src={leveiLogo} alt="Levei" className="h-8 w-8 rounded-lg object-cover" />
          </div>
          <NotificationBell />
        </div>
        <div className="px-4 pt-2 pb-5">
          <h1 className="text-2xl font-bold text-white">Configurações</h1>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <main className="flex-1 overflow-y-auto pb-24 px-4 pt-4 space-y-4">

        {/* Disponibilidade */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Disponibilidade
            </p>
          </div>
          <div className="px-4 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                isAvailable ? 'bg-green-100' : 'bg-gray-100'
              }`}>
                <Bike className={`h-5 w-5 ${isAvailable ? 'text-green-600' : 'text-gray-400'}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {isAvailable ? 'Disponível para entregas' : 'Offline'}
                </p>
                <p className="text-xs text-gray-400">
                  {isAvailable ? 'Recebendo novas entregas' : 'Ative para receber entregas'}
                </p>
              </div>
            </div>
            <Switch
              checked={isAvailable}
              onCheckedChange={handleToggleAvailability}
              className="flex-shrink-0 data-[state=checked]:bg-green-500"
            />
          </div>

          {/* Aviso se sem categorias */}
          {noneSelected && (
            <div className="mx-4 mb-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
              <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                Configure as categorias abaixo antes de ficar disponível.
              </p>
            </div>
          )}
        </div>

        {/* Categorias aceitas */}
        <div id="categories-section" className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Categorias que aceito entregar
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Selecione os tipos de entrega que você consegue fazer
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Badge de contagem */}
              {acceptedProductTypes.length > 0 ? (
                <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  {acceptedProductTypes.length}/{PRODUCT_TYPES.length}
                </span>
              ) : (
                <span className="text-xs font-semibold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                  Nenhuma
                </span>
              )}
            </div>
          </div>

          <div className="px-4 pt-3 pb-2 flex items-center justify-between">
            <button
              onClick={allSelected ? handleClearAll : handleSelectAll}
              className="text-xs font-medium text-primary underline underline-offset-2"
            >
              {allSelected ? 'Desmarcar todas' : 'Selecionar todas'}
            </button>
            <span className="text-xs text-gray-400">
              {acceptedProductTypes.length} selecionada{acceptedProductTypes.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="px-4 pb-4 space-y-1">
            {PRODUCT_TYPES.map((type) => {
              const selected = acceptedProductTypes.includes(type.key);
              return (
                <button
                  key={type.key}
                  onClick={() => handleToggleProductType(type.key)}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl border-2 transition-all text-left ${
                    selected
                      ? 'border-primary bg-primary/5'
                      : 'border-transparent bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  {/* Ícone */}
                  <span className="text-xl flex-shrink-0">{type.icon}</span>

                  {/* Label */}
                  <span className={`flex-1 text-sm font-medium ${
                    selected ? 'text-primary' : 'text-gray-700'
                  }`}>
                    {type.label}
                  </span>

                  {/* Check indicator */}
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    selected
                      ? 'bg-primary border-primary'
                      : 'border-gray-300 bg-white'
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

          {/* Save button */}
          <div className="px-4 pb-4">
            <button
              onClick={handleSaveCategories}
              disabled={savingCategories}
              className="w-full h-11 rounded-xl bg-primary text-white font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {savingCategories
                ? <><Loader2 className="h-4 w-4 animate-spin" />Salvando...</>
                : <><CheckCircle2 className="h-4 w-4" />Salvar categorias</>
              }
            </button>
          </div>
        </div>

        {/* Veículo */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Dados do veículo
            </p>
          </div>
          <form onSubmit={handleSaveVehicle} className="px-4 py-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="vehicleType" className="text-xs text-gray-500">Tipo de veículo</Label>
              <Select value={vehicleType} onValueChange={setVehicleType}>
                <SelectTrigger className="rounded-xl border-gray-200">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="motorcycle">Motocicleta</SelectItem>
                  <SelectItem value="car">Carro</SelectItem>
                  <SelectItem value="bicycle">Bicicleta</SelectItem>
                  <SelectItem value="van">Van</SelectItem>
                  <SelectItem value="truck">Caminhão</SelectItem>
                  <SelectItem value="hourly_service">Serviço por hora</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="licensePlate" className="text-xs text-gray-500">
                Placa do veículo (opcional)
              </Label>
              <Input
                id="licensePlate"
                value={licensePlate}
                onChange={(e) => setLicensePlate(e.target.value)}
                placeholder="ABC-1234"
                disabled={saving}
                className="rounded-xl border-gray-200"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full h-11 rounded-xl bg-primary text-white font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar alterações
            </button>
          </form>
        </div>

        {/* Segurança */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Privacidade e segurança
            </p>
          </div>
          {[
            { label: 'Alterar senha' },
            { label: 'Gerenciar privacidade' },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => toast({ title: 'Em breve!' })}
              className="w-full flex items-center justify-between px-4 py-4 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-none"
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
