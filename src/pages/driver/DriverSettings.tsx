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
import { Loader2, Bike, Shield, ArrowLeft, ChevronRight } from 'lucide-react';
import { DriverBottomNav } from '@/components/DriverBottomNav';
import leveiLogo from '@/assets/levei-logo.png';
import NotificationBell from '@/components/NotificationBell';

export default function DriverSettings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [vehicleType, setVehicleType] = useState('motorcycle');
  const [licensePlate, setLicensePlate] = useState('');
  const [driverId, setDriverId] = useState<string | null>(null);

  useEffect(() => { if (user) fetchSettings(); }, [user]);

  const fetchSettings = async () => {
    const { data } = await supabase
      .from('drivers').select('id, is_available, vehicle_type, license_plate')
      .eq('user_id', user?.id).single();
    if (data) {
      setDriverId(data.id);
      setIsAvailable(data.is_available);
      setVehicleType(data.vehicle_type as string);
      setLicensePlate(data.license_plate || '');
    }
    setLoading(false);
  };

  const handleToggleAvailability = async (checked: boolean) => {
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
        </div>
      </div>
    );
  }

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
