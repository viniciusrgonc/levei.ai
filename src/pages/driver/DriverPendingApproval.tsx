import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Clock, CheckCircle2, XCircle, Loader2, LogOut, ShieldX,
  FileText, Camera, Upload, RefreshCw,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import leveiLogo from '@/assets/levei-logo.png';

type DriverStatus = 'pending' | 'approved' | 'rejected' | 'blocked';

interface DriverInfo {
  id: string;
  driver_status: DriverStatus;
  is_approved: boolean;
  rejection_reason: string | null;
  drivers_license_url: string | null;
  cnh_back_url: string | null;
  selfie_url: string | null;
  vehicle_photo_url: string | null;
}

async function fetchDriverStatus(userId: string): Promise<DriverInfo | null> {
  const { data, error } = await supabase
    .from('drivers')
    .select('id, driver_status, is_approved, rejection_reason, drivers_license_url, cnh_back_url, selfie_url, vehicle_photo_url')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as DriverInfo | null;
}

async function compressImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const ratio = Math.min(1200 / Math.max(img.width, img.height), 1);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => resolve(new File([blob!], 'img.jpg', { type: 'image/jpeg' })),
        'image/jpeg', 0.82,
      );
    };
    img.src = url;
  });
}

type UploadField = 'cnhFront' | 'cnhBack' | 'selfie' | 'vehicle';

export default function DriverPendingApproval() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState<UploadField | null>(null);

  const inputRefs: Record<UploadField, React.RefObject<HTMLInputElement>> = {
    cnhFront: useRef<HTMLInputElement>(null),
    cnhBack:  useRef<HTMLInputElement>(null),
    selfie:   useRef<HTMLInputElement>(null),
    vehicle:  useRef<HTMLInputElement>(null),
  };

  const { data: driver, isLoading } = useQuery({
    queryKey: ['driver-pending', user?.id],
    queryFn:  () => fetchDriverStatus(user!.id),
    enabled:  !!user?.id,
    refetchInterval: 15_000,
  });

  // Redirect when approved
  useEffect(() => {
    const status = driver?.driver_status ?? (driver?.is_approved ? 'approved' : undefined);
    if (status === 'approved') {
      toast({ title: '🎉 Cadastro aprovado!', description: 'Bem-vindo à plataforma Levei.ai!' });
      queryClient.invalidateQueries({ queryKey: ['user-setup', user?.id] });
      navigate('/driver/dashboard', { replace: true });
    }
  }, [driver?.driver_status, driver?.is_approved]);

  // Realtime
  useEffect(() => {
    if (!driver?.id) return;
    const ch = supabase
      .channel(`driver-approval-${driver.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'drivers', filter: `id=eq.${driver.id}` },
        () => queryClient.invalidateQueries({ queryKey: ['driver-pending', user?.id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [driver?.id]);

  const uploadDoc = async (file: File, field: UploadField) => {
    if (!user || !driver) return;
    if (file.size > 20 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'Arquivo muito grande', description: 'Máximo 20 MB.' });
      return;
    }
    setUploading(field);
    try {
      const compressed = await compressImage(file);
      const nameMap: Record<UploadField, string> = {
        cnhFront: 'cnh-front', cnhBack: 'cnh-back', selfie: 'selfie', vehicle: 'vehicle',
      };
      const path = `${user.id}/${nameMap[field]}.jpg`;
      const { error: upErr } = await supabase.storage.from('driver-documents').upload(path, compressed, { upsert: true, contentType: 'image/jpeg' });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('driver-documents').getPublicUrl(path);
      const colMap: Record<UploadField, string> = {
        cnhFront: 'drivers_license_url', cnhBack: 'cnh_back_url', selfie: 'selfie_url', vehicle: 'vehicle_photo_url',
      };
      await supabase.from('drivers').update({ [colMap[field]]: urlData.publicUrl }).eq('id', driver.id);
      queryClient.invalidateQueries({ queryKey: ['driver-pending', user?.id] });
      toast({ title: '✅ Documento enviado!' });
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

  const status: DriverStatus = driver?.driver_status ?? (driver?.is_approved ? 'approved' : driver?.rejection_reason ? 'rejected' : 'pending');

  // ── Blocked state ──────────────────────────────────────────────────────────
  if (status === 'blocked') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="bg-red-600 px-4 pb-8 pt-4">
          <div className="flex items-center justify-between mb-8">
            <img src={leveiLogo} alt="Levei.ai" className="h-8 rounded-lg" />
            <button onClick={handleLogout} className="flex items-center gap-1.5 text-white/70 text-xs">
              <LogOut className="h-3.5 w-3.5" /> Sair
            </button>
          </div>
          <div className="text-center space-y-3">
            <div className="w-20 h-20 rounded-full bg-white/10 mx-auto flex items-center justify-center">
              <ShieldX className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-white font-bold text-xl">Conta bloqueada</h1>
            <p className="text-white/70 text-sm">Sua conta foi bloqueada pelo administrador</p>
          </div>
        </div>
        <div className="flex-1 px-4 py-6 space-y-4">
          {driver?.rejection_reason && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
              <p className="text-sm font-bold text-red-700 mb-1">Motivo do bloqueio</p>
              <p className="text-sm text-red-600">{driver.rejection_reason}</p>
            </div>
          )}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-sm text-gray-600">
              Para contestar ou obter mais informações, entre em contato com nosso suporte.
            </p>
            <a href="mailto:suporte@leveiai.com"
              className="mt-3 flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-primary text-white font-bold text-sm">
              📧 suporte@leveiai.com
            </a>
          </div>
          <button onClick={handleLogout} className="w-full py-3 rounded-2xl border border-red-200 text-red-500 font-semibold text-sm">
            Sair da conta
          </button>
        </div>
      </div>
    );
  }

  const isRejected = status === 'rejected';

  // ── Pending / Rejected state ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>

      {/* Header */}
      <div className={`px-4 pb-6 pt-4 ${isRejected ? 'bg-orange-600' : 'bg-primary'}`}>
        <div className="flex items-center justify-between mb-6">
          <img src={leveiLogo} alt="Levei.ai" className="h-8 rounded-lg" />
          <button onClick={handleLogout} className="flex items-center gap-1.5 text-white/70 text-xs">
            <LogOut className="h-3.5 w-3.5" /> Sair
          </button>
        </div>
        <div className="text-center space-y-3">
          <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center ${isRejected ? 'bg-white/20' : 'bg-white/10'}`}>
            {isRejected
              ? <XCircle className="h-10 w-10 text-white" />
              : <Clock className="h-10 w-10 text-white/90" />
            }
          </div>
          <div>
            <h1 className="text-white font-bold text-xl">
              {isRejected ? 'Pendências no cadastro' : 'Cadastro em análise'}
            </h1>
            <p className="text-white/70 text-sm mt-1">
              {isRejected
                ? 'Reenvie os documentos corrigidos'
                : 'Um administrador analisará em até 24h'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-5 space-y-4 overflow-y-auto pb-8">

        {/* Motivo da rejeição */}
        {isRejected && driver?.rejection_reason && (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
            <p className="text-sm font-bold text-orange-800 mb-1">⚠️ Motivo da reprovação</p>
            <p className="text-sm text-orange-700">{driver.rejection_reason}</p>
          </div>
        )}

        {/* Documentos */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800 text-sm">Seus documentos</h2>
            <button
              onClick={() => queryClient.invalidateQueries({ queryKey: ['driver-pending', user?.id] })}
              className="text-primary/60 text-xs flex items-center gap-1"
            >
              <RefreshCw className="h-3 w-3" /> Atualizar
            </button>
          </div>

          {[
            { key: 'cnhFront' as UploadField, label: 'CNH — Frente',    url: driver?.drivers_license_url, required: true },
            { key: 'cnhBack'  as UploadField, label: 'CNH — Verso',     url: driver?.cnh_back_url,        required: true },
            { key: 'selfie'   as UploadField, label: 'Selfie',          url: driver?.selfie_url,          required: true },
            { key: 'vehicle'  as UploadField, label: 'Foto do veículo', url: driver?.vehicle_photo_url,   required: false },
          ].map(({ key, label, url, required }) => (
            <div key={key} className="space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-gray-700 flex-1">{label}</span>
                {url
                  ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                  : required
                    ? <span className="text-[10px] text-red-500 font-semibold bg-red-50 px-2 py-0.5 rounded-full">Pendente</span>
                    : <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Opcional</span>
                }
              </div>
              {url ? (
                <div className="relative">
                  <img src={url} alt={label} className="w-full h-32 object-cover rounded-xl" />
                  <button
                    onClick={() => inputRefs[key].current?.click()}
                    className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg flex items-center gap-1 backdrop-blur-sm"
                  >
                    <Camera className="h-3 w-3" /> Atualizar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => inputRefs[key].current?.click()}
                  disabled={uploading === key}
                  className="w-full h-24 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-primary/40 transition-colors disabled:opacity-60"
                >
                  {uploading === key
                    ? <Loader2 className="h-5 w-5 animate-spin" />
                    : <><Upload className="h-5 w-5" /><span className="text-sm">Enviar {label}</span></>
                  }
                </button>
              )}
              <input
                ref={inputRefs[key]}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => { if (e.target.files?.[0]) uploadDoc(e.target.files[0], key); e.target.value = ''; }}
              />
              {key !== 'vehicle' && <div className="h-px bg-gray-100" />}
            </div>
          ))}
        </div>

        {/* Steps info */}
        {!isRejected && (
          <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 space-y-2">
            <p className="text-sm font-semibold text-blue-800">O que acontece agora?</p>
            {[
              'Admin recebe seus documentos para análise',
              'CNH e selfie são verificados manualmente',
              'Você recebe notificação de aprovação',
              'Pronto — pode começar a trabalhar!',
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="w-4 h-4 rounded-full bg-blue-200 text-blue-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</div>
                <p className="text-xs text-blue-700">{item}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
