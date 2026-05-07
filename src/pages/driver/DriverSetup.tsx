import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import {
  Bike, Gift, ChevronRight, ArrowLeft, Camera, CheckCircle2,
  Upload, FileText, Car, Loader2,
} from 'lucide-react';

const VEHICLE_OPTIONS = [
  { value: 'motorcycle', label: 'Moto',      emoji: '🛵' },
  { value: 'bicycle',    label: 'Bicicleta', emoji: '🚲' },
  { value: 'car',        label: 'Carro',     emoji: '🚗' },
  { value: 'van',        label: 'Van',       emoji: '🚐' },
];

type Step = 1 | 2 | 3;

export default function DriverSetup() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep]                   = useState<Step>(1);
  const [loading, setLoading]             = useState(false);

  // Step 1
  const [vehicleType, setVehicleType]     = useState('motorcycle');
  const [licensePlate, setLicensePlate]   = useState('');

  // Step 2
  const [cnhFile, setCnhFile]             = useState<File | null>(null);
  const [cnhPreview, setCnhPreview]       = useState<string | null>(null);
  const [vehicleFile, setVehicleFile]     = useState<File | null>(null);
  const [vehiclePreview, setVehiclePreview] = useState<string | null>(null);

  // Step 3
  const [referralCode, setReferralCode]   = useState('');

  const cnhInputRef     = useRef<HTMLInputElement>(null);
  const vehicleInputRef = useRef<HTMLInputElement>(null);

  const pickFile = (
    file: File,
    setFile: (f: File) => void,
    setPreview: (s: string) => void,
  ) => {
    if (file.size > 8 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'Arquivo muito grande', description: 'Máximo 8 MB.' });
      return;
    }
    setFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const uploadPhoto = async (file: File, path: string): Promise<string | null> => {
    const { error } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type });
    if (error) { console.warn('Upload error:', error.message); return null; }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSubmit = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Upload fotos
      let cnhUrl: string | null = null;
      let vehicleUrl: string | null = null;

      if (cnhFile) {
        cnhUrl = await uploadPhoto(cnhFile, `driver-docs/${user.id}/cnh.${cnhFile.name.split('.').pop()}`);
      }
      if (vehicleFile) {
        vehicleUrl = await uploadPhoto(vehicleFile, `driver-docs/${user.id}/vehicle.${vehicleFile.name.split('.').pop()}`);
      }

      // Cria registro com is_approved: false (aguarda revisão do admin)
      const { data: newDriver, error } = await supabase
        .from('drivers')
        .insert([{
          user_id: user.id,
          vehicle_type: vehicleType as any,
          license_plate: licensePlate.trim().toUpperCase() || null,
          is_available: false,
          is_approved: false,
          drivers_license_url: cnhUrl,
          vehicle_photo_url: vehicleUrl,
        }])
        .select('id')
        .single();

      if (error || !newDriver) {
        toast({ variant: 'destructive', title: 'Erro ao cadastrar', description: error?.message });
        return;
      }

      // Indicação (fire-and-forget)
      const trimmedCode = referralCode.trim().toUpperCase();
      if (trimmedCode) {
        supabase.rpc('register_referral', {
          p_referred_driver_id: newDriver.id,
          p_referral_code: trimmedCode,
        }).catch(() => {});
      }

      navigate('/driver/pending-approval', { replace: true });
    } finally {
      setLoading(false);
    }
  };

  // ── Progress bar ──────────────────────────────────────────────────────────
  const steps = ['Veículo', 'Documentos', 'Finalizar'];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Header */}
      <div
        className="bg-primary px-4 pb-5"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}
      >
        <div className="flex items-center gap-3 mb-5">
          {step > 1 && (
            <button
              onClick={() => setStep((s) => (s - 1) as Step)}
              className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"
            >
              <ArrowLeft className="h-5 w-5 text-white" />
            </button>
          )}
          <div className="flex-1">
            <p className="text-white/60 text-xs">Passo {step} de 3</p>
            <h1 className="text-white font-bold text-lg">{steps[step - 1]}</h1>
          </div>
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
            <Bike className="h-5 w-5 text-white" />
          </div>
        </div>

        {/* Progress */}
        <div className="flex gap-1.5">
          {steps.map((_, i) => (
            <div
              key={i}
              className="flex-1 h-1 rounded-full transition-all duration-300"
              style={{ background: i < step ? 'white' : 'rgba(255,255,255,0.25)' }}
            />
          ))}
        </div>
      </div>

      <div className="flex-1 px-4 py-5 space-y-4 overflow-y-auto">

        {/* ── STEP 1: Veículo ── */}
        {step === 1 && (
          <>
            <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
              <h2 className="font-semibold text-gray-800 text-sm">Tipo de veículo *</h2>
              <div className="grid grid-cols-2 gap-3">
                {VEHICLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setVehicleType(opt.value)}
                    className={`flex flex-col items-center justify-center gap-2 py-4 rounded-2xl border-2 transition-all ${
                      vehicleType === opt.value
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-100 bg-gray-50'
                    }`}
                  >
                    <span className="text-3xl">{opt.emoji}</span>
                    <span className={`text-sm font-semibold ${vehicleType === opt.value ? 'text-primary' : 'text-gray-600'}`}>
                      {opt.label}
                    </span>
                    {vehicleType === opt.value && (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-4 space-y-2">
              <label className="text-sm font-semibold text-gray-700">Placa do veículo (opcional)</label>
              <input
                type="text"
                placeholder="Ex: ABC1D23"
                value={licensePlate}
                onChange={(e) => setLicensePlate(e.target.value.toUpperCase())}
                maxLength={8}
                className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm font-mono uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
          </>
        )}

        {/* ── STEP 2: Documentos ── */}
        {step === 2 && (
          <>
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
              <p className="text-xs text-amber-700 font-medium">
                📋 Envie fotos legíveis. O admin analisará e aprovará seu cadastro em até 24h.
              </p>
            </div>

            {/* CNH */}
            <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <h2 className="font-semibold text-gray-800 text-sm">CNH / Habilitação</h2>
                <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Recomendado</span>
              </div>

              <input
                ref={cnhInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && pickFile(e.target.files[0], setCnhFile, setCnhPreview)}
              />

              {cnhPreview ? (
                <div className="relative">
                  <img src={cnhPreview} alt="CNH" className="w-full h-40 object-cover rounded-xl" />
                  <button
                    onClick={() => cnhInputRef.current?.click()}
                    className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg flex items-center gap-1"
                  >
                    <Camera className="h-3 w-3" /> Trocar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => cnhInputRef.current?.click()}
                  className="w-full h-32 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-primary/40 transition-colors"
                >
                  <Upload className="h-6 w-6" />
                  <span className="text-sm">Toque para enviar foto</span>
                </button>
              )}
            </div>

            {/* Foto do veículo */}
            <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Car className="h-4 w-4 text-primary" />
                <h2 className="font-semibold text-gray-800 text-sm">Foto do veículo</h2>
                <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Recomendado</span>
              </div>

              <input
                ref={vehicleInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && pickFile(e.target.files[0], setVehicleFile, setVehiclePreview)}
              />

              {vehiclePreview ? (
                <div className="relative">
                  <img src={vehiclePreview} alt="Veículo" className="w-full h-40 object-cover rounded-xl" />
                  <button
                    onClick={() => vehicleInputRef.current?.click()}
                    className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg flex items-center gap-1"
                  >
                    <Camera className="h-3 w-3" /> Trocar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => vehicleInputRef.current?.click()}
                  className="w-full h-32 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-primary/40 transition-colors"
                >
                  <Upload className="h-6 w-6" />
                  <span className="text-sm">Toque para enviar foto</span>
                </button>
              )}
            </div>

            <p className="text-center text-xs text-gray-400">
              Você pode pular e enviar os documentos depois pelo seu perfil
            </p>
          </>
        )}

        {/* ── STEP 3: Finalizar ── */}
        {step === 3 && (
          <>
            {/* Resumo */}
            <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
              <h2 className="font-semibold text-gray-800 text-sm">Resumo do cadastro</h2>
              <div className="space-y-2">
                <div className="flex items-center justify-between py-2 border-b border-gray-50">
                  <span className="text-xs text-gray-500">Veículo</span>
                  <span className="text-xs font-semibold text-gray-800 capitalize">
                    {VEHICLE_OPTIONS.find(o => o.value === vehicleType)?.emoji} {VEHICLE_OPTIONS.find(o => o.value === vehicleType)?.label}
                  </span>
                </div>
                {licensePlate && (
                  <div className="flex items-center justify-between py-2 border-b border-gray-50">
                    <span className="text-xs text-gray-500">Placa</span>
                    <span className="text-xs font-mono font-semibold text-gray-800">{licensePlate}</span>
                  </div>
                )}
                <div className="flex items-center justify-between py-2 border-b border-gray-50">
                  <span className="text-xs text-gray-500">CNH</span>
                  <span className={`text-xs font-semibold ${cnhFile ? 'text-green-600' : 'text-amber-500'}`}>
                    {cnhFile ? '✅ Enviada' : '⚠️ Não enviada'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs text-gray-500">Foto do veículo</span>
                  <span className={`text-xs font-semibold ${vehicleFile ? 'text-green-600' : 'text-amber-500'}`}>
                    {vehicleFile ? '✅ Enviada' : '⚠️ Não enviada'}
                  </span>
                </div>
              </div>
            </div>

            {/* Código de indicação */}
            <div className="bg-white rounded-2xl shadow-sm p-4 space-y-2">
              <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                <Gift className="h-3.5 w-3.5 text-blue-500" />
                Código de indicação (opcional)
              </label>
              <input
                type="text"
                placeholder="Ex: VINI1234"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                maxLength={12}
                className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm font-mono uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
              <p className="text-xs text-gray-400">Quem te indicou ganha pontos quando você completar 5 entregas</p>
            </div>

            {/* Info aprovação */}
            <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 space-y-1">
              <p className="text-sm font-semibold text-blue-800">⏳ Aguardando aprovação</p>
              <p className="text-xs text-blue-600">
                Após enviar, um administrador analisará seu cadastro em até 24 horas. Você receberá uma notificação quando for aprovado.
              </p>
            </div>
          </>
        )}
      </div>

      {/* Footer CTA */}
      <div
        className="bg-white border-t border-gray-100 px-4 py-3"
        style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}
      >
        {step < 3 ? (
          <button
            onClick={() => setStep((s) => (s + 1) as Step)}
            className="w-full h-13 rounded-2xl bg-primary text-white font-bold text-base flex items-center justify-center gap-2"
            style={{ height: 52 }}
          >
            Continuar
            <ChevronRight className="h-5 w-5" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full h-13 rounded-2xl bg-primary text-white font-bold text-base flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ height: 52 }}
          >
            {loading ? (
              <><Loader2 className="h-5 w-5 animate-spin" /> Enviando...</>
            ) : (
              <><CheckCircle2 className="h-5 w-5" /> Enviar cadastro</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
