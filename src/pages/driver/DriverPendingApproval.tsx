import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, Upload, Camera, CheckCircle2, XCircle, Loader2, FileText, Car, LogOut } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import leveiLogo from '@/assets/levei-logo.png';

async function fetchDriverStatus(userId: string) {
  const { data, error } = await supabase
    .from('drivers')
    .select('id, is_approved, rejection_reason, drivers_license_url, vehicle_photo_url')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export default function DriverPendingApproval() {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const queryClient = useQueryClient();

  const [uploading, setUploading] = useState<'cnh' | 'vehicle' | null>(null);
  const cnhInputRef     = useRef<HTMLInputElement>(null);
  const vehicleInputRef = useRef<HTMLInputElement>(null);

  const { data: driver, isLoading } = useQuery({
    queryKey: ['driver-pending', user?.id],
    queryFn: () => fetchDriverStatus(user!.id),
    enabled: !!user?.id,
    refetchInterval: 15 * 1000, // verifica aprovação a cada 15s
  });

  // Redireciona quando aprovado
  useEffect(() => {
    if (driver?.is_approved) {
      toast({ title: '🎉 Cadastro aprovado!', description: 'Bem-vindo à plataforma!' });
      queryClient.invalidateQueries({ queryKey: ['driver', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['user-setup', user?.id] });
      navigate('/driver/dashboard', { replace: true });
    }
  }, [driver?.is_approved]);

  // Realtime — escuta aprovação em tempo real
  useEffect(() => {
    if (!driver?.id) return;
    const channel = supabase
      .channel(`driver-approval-${driver.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'drivers',
        filter: `id=eq.${driver.id}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['driver-pending', user?.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [driver?.id]);

  const uploadPhoto = async (file: File, type: 'cnh' | 'vehicle') => {
    if (!user || !driver) return;
    if (file.size > 8 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'Arquivo muito grande', description: 'Máximo 8 MB.' });
      return;
    }
    setUploading(type);
    try {
      const ext  = file.name.split('.').pop();
      const path = `driver-docs/${user.id}/${type}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('avatars').upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      const field = type === 'cnh' ? 'drivers_license_url' : 'vehicle_photo_url';
      const { error: dbErr } = await supabase
        .from('drivers').update({ [field]: urlData.publicUrl }).eq('id', driver.id);
      if (dbErr) throw dbErr;

      queryClient.invalidateQueries({ queryKey: ['driver-pending', user?.id] });
      toast({ title: 'Foto enviada!', description: 'O admin será notificado para revisão.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro no upload', description: e.message });
    } finally {
      setUploading(null);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-white animate-spin" />
      </div>
    );
  }

  const isRejected = driver && !driver.is_approved && !!driver.rejection_reason;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Header */}
      <div
        className="bg-primary px-4 pb-6"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}
      >
        <div className="flex items-center justify-between mb-6">
          <img src={leveiLogo} alt="Levei.ai" className="h-8 rounded-lg" />
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-white/70 text-xs"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair
          </button>
        </div>

        {/* Status central */}
        <div className="text-center space-y-3">
          <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center ${
            isRejected ? 'bg-red-100' : 'bg-white/10'
          }`}>
            {isRejected
              ? <XCircle className="h-10 w-10 text-red-400" />
              : <Clock className="h-10 w-10 text-white/90" />
            }
          </div>
          <div>
            <h1 className="text-white font-bold text-xl">
              {isRejected ? 'Cadastro não aprovado' : 'Aguardando aprovação'}
            </h1>
            <p className="text-white/65 text-sm mt-1">
              {isRejected
                ? 'Corrija as pendências e reenvie os documentos'
                : 'Um administrador analisará seu cadastro em até 24h'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-5 space-y-4 overflow-y-auto pb-24">

        {/* Motivo da rejeição */}
        {isRejected && driver.rejection_reason && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-1">
            <p className="text-sm font-bold text-red-700">⚠️ Motivo da reprovação</p>
            <p className="text-sm text-red-600">{driver.rejection_reason}</p>
          </div>
        )}

        {/* Documentos */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
          <h2 className="font-semibold text-gray-800 text-sm">Documentos enviados</h2>

          {/* CNH */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-gray-700">CNH / Habilitação</span>
              {driver?.drivers_license_url
                ? <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto" />
                : <span className="ml-auto text-xs text-amber-600 font-semibold">Pendente</span>
              }
            </div>
            {driver?.drivers_license_url ? (
              <div className="relative">
                <img
                  src={driver.drivers_license_url}
                  alt="CNH"
                  className="w-full h-32 object-cover rounded-xl"
                />
                <button
                  onClick={() => cnhInputRef.current?.click()}
                  className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg flex items-center gap-1"
                >
                  <Camera className="h-3 w-3" /> Atualizar
                </button>
              </div>
            ) : (
              <button
                onClick={() => cnhInputRef.current?.click()}
                disabled={uploading === 'cnh'}
                className="w-full h-24 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-primary/40 transition-colors disabled:opacity-60"
              >
                {uploading === 'cnh'
                  ? <Loader2 className="h-5 w-5 animate-spin" />
                  : <><Upload className="h-5 w-5" /><span className="text-sm">Enviar CNH</span></>
                }
              </button>
            )}
            <input
              ref={cnhInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0], 'cnh')}
            />
          </div>

          <div className="h-px bg-gray-100" />

          {/* Veículo */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Car className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-gray-700">Foto do veículo</span>
              {driver?.vehicle_photo_url
                ? <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto" />
                : <span className="ml-auto text-xs text-amber-600 font-semibold">Pendente</span>
              }
            </div>
            {driver?.vehicle_photo_url ? (
              <div className="relative">
                <img
                  src={driver.vehicle_photo_url}
                  alt="Veículo"
                  className="w-full h-32 object-cover rounded-xl"
                />
                <button
                  onClick={() => vehicleInputRef.current?.click()}
                  className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg flex items-center gap-1"
                >
                  <Camera className="h-3 w-3" /> Atualizar
                </button>
              </div>
            ) : (
              <button
                onClick={() => vehicleInputRef.current?.click()}
                disabled={uploading === 'vehicle'}
                className="w-full h-24 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-primary/40 transition-colors disabled:opacity-60"
              >
                {uploading === 'vehicle'
                  ? <Loader2 className="h-5 w-5 animate-spin" />
                  : <><Upload className="h-5 w-5" /><span className="text-sm">Enviar foto do veículo</span></>
                }
              </button>
            )}
            <input
              ref={vehicleInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0], 'vehicle')}
            />
          </div>
        </div>

        {/* Status informativo */}
        {!isRejected && (
          <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 space-y-2">
            <p className="text-sm font-semibold text-blue-800">O que acontece agora?</p>
            <div className="space-y-1.5">
              {[
                'Um admin recebe seu cadastro para análise',
                'Documentos são verificados (CNH + veículo)',
                'Você recebe uma notificação de aprovação',
                'Pronto — pode começar a trabalhar!',
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="w-4 h-4 rounded-full bg-blue-200 text-blue-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <p className="text-xs text-blue-700">{item}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
