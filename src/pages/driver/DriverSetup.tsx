import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import {
  ArrowLeft, ChevronRight, CheckCircle2, Loader2, Camera, Upload,
  Gift, Bike, Car, Truck, User, MapPin, FileText, ShoppingBag, ClipboardCheck,
} from 'lucide-react';
import leveiLogo from '@/assets/levei-logo.png';
import { PRODUCT_TYPES } from '@/lib/productTypes';

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatCPF(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function formatPhone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
}

function formatCEP(v: string) {
  return v.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d{1,3})/, '$1-$2');
}

function validateCPF(cpf: string): boolean {
  const s = cpf.replace(/\D/g, '');
  if (s.length !== 11 || /^(\d)\1+$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += +s[i] * (10 - i);
  let rem = (sum * 10) % 11;
  if (rem === 10 || rem === 11) rem = 0;
  if (rem !== +s[9]) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += +s[i] * (11 - i);
  rem = (sum * 10) % 11;
  if (rem === 10 || rem === 11) rem = 0;
  return rem === +s[10];
}

function isOver18(dateStr: string): boolean {
  if (!dateStr) return false;
  const birth = new Date(dateStr);
  const limit = new Date();
  limit.setFullYear(limit.getFullYear() - 18);
  return birth <= limit;
}

async function compressImage(file: File, maxPx = 1200, quality = 0.82): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const ratio = Math.min(maxPx / Math.max(img.width, img.height), 1);
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => resolve(new File([blob!], 'img.jpg', { type: 'image/jpeg' })),
        'image/jpeg', quality,
      );
    };
    img.src = url;
  });
}

async function uploadFile(userId: string, file: File, name: string): Promise<string> {
  const compressed = await compressImage(file);
  const path = `driver-docs/${userId}/${name}.jpg`;
  const { error } = await supabase.storage
    .from('avatars').upload(path, compressed, { upsert: true, contentType: 'image/jpeg' });
  if (error) throw error;
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}

async function fetchCEP(cep: string) {
  const clean = cep.replace(/\D/g, '');
  if (clean.length !== 8) throw new Error('CEP inválido');
  const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
  const data = await res.json();
  if (data.erro) throw new Error('CEP não encontrado');
  return data as { logradouro: string; bairro: string; localidade: string; uf: string };
}

// ── Config ─────────────────────────────────────────────────────────────────────

const VEHICLE_OPTIONS = [
  { value: 'motorcycle', label: 'Moto',       emoji: '🛵' },
  { value: 'car',        label: 'Carro',      emoji: '🚗' },
  { value: 'van',        label: 'Utilitário', emoji: '🚐' },
  { value: 'bicycle',   label: 'Bicicleta',  emoji: '🚲' },
];

const BAG_TYPES = ['Bag traseira', 'Baú', 'Mochila', 'Caçamba'];

const STEP_LABELS = [
  { label: 'Dados pessoais', icon: User     },
  { label: 'Endereço',       icon: MapPin   },
  { label: 'Veículo',        icon: Bike     },
  { label: 'Documentos',     icon: FileText },
  { label: 'Categorias',     icon: ShoppingBag },
  { label: 'Termos',         icon: ClipboardCheck },
];
const TOTAL_STEPS = STEP_LABELS.length;

type DocKey = 'cnhFront' | 'cnhBack' | 'selfie' | 'vehiclePhoto';

interface DocState { file: File | null; preview: string | null }
const emptyDoc = (): DocState => ({ file: null, preview: null });

// ── Component ──────────────────────────────────────────────────────────────────

export default function DriverSetup() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep]     = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1 — Dados pessoais
  const [fullName,   setFullName]   = useState('');
  const [cpf,        setCpf]        = useState('');
  const [birthDate,  setBirthDate]  = useState('');
  const [phone,      setPhone]      = useState('');

  // Step 2 — Endereço
  const [cep,          setCep]          = useState('');
  const [street,       setStreet]       = useState('');
  const [number,       setNumber]       = useState('');
  const [complement,   setComplement]   = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city,         setCity]         = useState('');
  const [state,        setState]        = useState('');
  const [cepLoading,   setCepLoading]   = useState(false);

  // Step 3 — Veículo
  const [vehicleType,  setVehicleType]  = useState('motorcycle');
  const [plate,        setPlate]        = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [vehicleYear,  setVehicleYear]  = useState('');
  const [hasBag,       setHasBag]       = useState<boolean | null>(null);
  const [bagType,      setBagType]      = useState('');

  // Step 4 — Documentos
  const [docs, setDocs] = useState<Record<DocKey, DocState>>({
    cnhFront:    emptyDoc(),
    cnhBack:     emptyDoc(),
    selfie:      emptyDoc(),
    vehiclePhoto: emptyDoc(),
  });
  const inputRefs: Record<DocKey, React.RefObject<HTMLInputElement>> = {
    cnhFront:    useRef<HTMLInputElement>(null),
    cnhBack:     useRef<HTMLInputElement>(null),
    selfie:      useRef<HTMLInputElement>(null),
    vehiclePhoto: useRef<HTMLInputElement>(null),
  };

  // Step 5 — Categorias
  const [categories, setCategories] = useState<string[]>([]);

  // Step 6 — Termos
  const [termsAccepted,    setTermsAccepted]    = useState(false);
  const [privacyAccepted,  setPrivacyAccepted]  = useState(false);
  const [declareCNH,       setDeclareCNH]       = useState(false);
  const [declareVehicle,   setDeclareVehicle]   = useState(false);
  const [referralCode,     setReferralCode]     = useState('');

  // ── Validation per step ────────────────────────────────────────────────────

  const canProceed = (s: number): boolean => {
    switch (s) {
      case 1: {
        if (!fullName.trim()) return false;
        if (!validateCPF(cpf)) return false;
        if (!isOver18(birthDate)) return false;
        if (phone.replace(/\D/g, '').length < 10) return false;
        return true;
      }
      case 2:
        return !!(street && number && neighborhood && city && state);
      case 3:
        return !!(vehicleType && hasBag !== null);
      case 4:
        return !!(docs.cnhFront.file && docs.cnhBack.file && docs.selfie.file);
      case 5:
        return categories.length > 0;
      case 6:
        return termsAccepted && privacyAccepted && declareCNH && declareVehicle;
      default:
        return true;
    }
  };

  // ── CEP fetch ──────────────────────────────────────────────────────────────

  const handleCEP = async (raw: string) => {
    const formatted = formatCEP(raw);
    setCep(formatted);
    if (formatted.replace(/\D/g, '').length === 8) {
      setCepLoading(true);
      try {
        const data = await fetchCEP(formatted);
        setStreet(data.logradouro);
        setNeighborhood(data.bairro);
        setCity(data.localidade);
        setState(data.uf);
      } catch {
        toast({ variant: 'destructive', title: 'CEP não encontrado', description: 'Preencha o endereço manualmente.' });
      } finally {
        setCepLoading(false);
      }
    }
  };

  // ── Document picker ────────────────────────────────────────────────────────

  const pickDoc = (key: DocKey, file: File) => {
    if (file.size > 15 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'Arquivo muito grande', description: 'Máximo 15 MB.' });
      return;
    }
    const preview = URL.createObjectURL(file);
    setDocs((prev) => ({ ...prev, [key]: { file, preview } }));
  };

  // ── Category toggle ────────────────────────────────────────────────────────

  const toggleCat = (key: string) =>
    setCategories((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Atualiza nome no perfil
      await supabase.from('profiles').update({ full_name: fullName.trim(), phone }).eq('id', user.id);

      // 2. Upload docs (com compressão automática)
      const [cnhFrontUrl, cnhBackUrl, selfieUrl, vehiclePhotoUrl] = await Promise.all([
        uploadFile(user.id, docs.cnhFront.file!, 'cnh-front'),
        uploadFile(user.id, docs.cnhBack.file!, 'cnh-back'),
        uploadFile(user.id, docs.selfie.file!, 'selfie'),
        docs.vehiclePhoto.file ? uploadFile(user.id, docs.vehiclePhoto.file, 'vehicle') : Promise.resolve(null),
      ]);

      // 3. Insere driver com todos os dados
      const { data: newDriver, error } = await supabase
        .from('drivers')
        .insert([{
          user_id:    user.id,
          cpf:        cpf.replace(/\D/g, ''),
          birth_date: birthDate,
          phone,
          address_cep:          cep.replace(/\D/g, ''),
          address_street:       street,
          address_number:       number,
          address_complement:   complement || null,
          address_neighborhood: neighborhood,
          address_city:         city,
          address_state:        state,
          vehicle_type:   vehicleType as any,
          license_plate:  plate.trim().toUpperCase() || null,
          vehicle_model:  vehicleModel.trim() || null,
          vehicle_color:  vehicleColor.trim() || null,
          vehicle_year:   vehicleYear ? parseInt(vehicleYear) : null,
          has_bag:        hasBag!,
          bag_type:       hasBag && bagType ? bagType : null,
          drivers_license_url: cnhFrontUrl,
          cnh_back_url:   cnhBackUrl,
          selfie_url:     selfieUrl,
          vehicle_photo_url: vehiclePhotoUrl,
          accepted_product_types: categories,
          accepted_terms:    true,
          terms_accepted_at: new Date().toISOString(),
          is_approved:    false,
          is_available:   false,
          driver_status:  'pending',
        }])
        .select('id')
        .single();

      if (error || !newDriver) throw error ?? new Error('Erro ao criar cadastro');

      // 4. Indicação fire-and-forget
      const code = referralCode.trim().toUpperCase();
      if (code) {
        supabase.rpc('register_referral', { p_referral_code: code, p_new_driver_id: newDriver.id }).catch(() => {});
      }

      navigate('/driver/pending-approval', { replace: true });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro no cadastro', description: e?.message ?? 'Tente novamente.' });
    } finally {
      setLoading(false);
    }
  };

  const goNext = () => {
    if (!canProceed(step)) {
      toast({ variant: 'destructive', title: 'Campos obrigatórios', description: 'Preencha todos os campos destacados.' });
      return;
    }
    if (step === TOTAL_STEPS) { handleSubmit(); return; }
    setStep((s) => s + 1);
  };

  const stepInfo = STEP_LABELS[step - 1];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>

      {/* ── Header ── */}
      <div className="bg-primary px-4 pb-5 pt-4">
        <div className="flex items-center gap-3 mb-4">
          {step > 1 ? (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center active:scale-90 transition-transform"
            >
              <ArrowLeft className="h-5 w-5 text-white" />
            </button>
          ) : (
            <img src={leveiLogo} alt="Levei" className="h-8 w-8 rounded-lg" />
          )}
          <div className="flex-1">
            <p className="text-white/60 text-xs font-medium">Passo {step} de {TOTAL_STEPS}</p>
            <h1 className="text-white font-bold text-lg leading-tight">{stepInfo.label}</h1>
          </div>
          <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center">
            <stepInfo.icon className="h-4.5 w-4.5 text-white" size={18} />
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex gap-1">
          {STEP_LABELS.map((_, i) => (
            <div
              key={i}
              className="flex-1 h-1 rounded-full transition-all duration-400"
              style={{ background: i < step ? 'white' : 'rgba(255,255,255,0.25)' }}
            />
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 px-4 py-5 space-y-4 overflow-y-auto">

        {/* ═══════════════ STEP 1 — Dados pessoais ═══════════════ */}
        {step === 1 && (
          <>
            <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Informações básicas</p>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">E-mail</label>
                <div className="h-11 px-4 rounded-xl border border-gray-100 bg-gray-50 flex items-center text-sm text-gray-400">
                  {user?.email}
                </div>
                <p className="text-[10px] text-gray-400">Não pode ser alterado</p>
              </div>

              <Field label="Nome completo *">
                <input
                  type="text"
                  placeholder="Seu nome completo"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={inputCls(!!fullName.trim())}
                />
              </Field>

              <Field label="CPF *">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(e) => setCpf(formatCPF(e.target.value))}
                  maxLength={14}
                  className={inputCls(validateCPF(cpf))}
                />
                {cpf.length === 14 && !validateCPF(cpf) && (
                  <p className="text-[10px] text-red-500 mt-1">CPF inválido</p>
                )}
              </Field>

              <Field label="Data de nascimento *">
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  max={(() => { const d = new Date(); d.setFullYear(d.getFullYear() - 18); return d.toISOString().split('T')[0]; })()}
                  className={inputCls(isOver18(birthDate))}
                />
                {birthDate && !isOver18(birthDate) && (
                  <p className="text-[10px] text-red-500 mt-1">Você precisa ter 18 anos ou mais</p>
                )}
              </Field>

              <Field label="Telefone / WhatsApp *">
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="(00) 00000-0000"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  maxLength={15}
                  className={inputCls(phone.replace(/\D/g, '').length >= 10)}
                />
              </Field>
            </div>
          </>
        )}

        {/* ═══════════════ STEP 2 — Endereço ═══════════════ */}
        {step === 2 && (
          <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Onde você opera?</p>

            <Field label="CEP *">
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="00000-000"
                  value={cep}
                  onChange={(e) => handleCEP(e.target.value)}
                  maxLength={9}
                  className={inputCls(cep.replace(/\D/g, '').length === 8)}
                />
                {cepLoading && (
                  <Loader2 className="absolute right-3 top-3 h-5 w-5 animate-spin text-primary" />
                )}
              </div>
            </Field>

            <Field label="Rua / Logradouro *">
              <input type="text" placeholder="Rua das Flores" value={street}
                onChange={(e) => setStreet(e.target.value)} className={inputCls(!!street)} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Número *">
                <input type="text" inputMode="numeric" placeholder="123" value={number}
                  onChange={(e) => setNumber(e.target.value)} className={inputCls(!!number)} />
              </Field>
              <Field label="Complemento">
                <input type="text" placeholder="Apto 4" value={complement}
                  onChange={(e) => setComplement(e.target.value)} className={inputCls(true)} />
              </Field>
            </div>

            <Field label="Bairro *">
              <input type="text" placeholder="Centro" value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)} className={inputCls(!!neighborhood)} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Cidade *">
                <input type="text" placeholder="Belo Horizonte" value={city}
                  onChange={(e) => setCity(e.target.value)} className={inputCls(!!city)} />
              </Field>
              <Field label="Estado *">
                <input type="text" placeholder="MG" value={state}
                  onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))}
                  maxLength={2} className={inputCls(!!state)} />
              </Field>
            </div>
          </div>
        )}

        {/* ═══════════════ STEP 3 — Veículo ═══════════════ */}
        {step === 3 && (
          <>
            <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Tipo de veículo *</p>
              <div className="grid grid-cols-2 gap-3">
                {VEHICLE_OPTIONS.map((opt) => {
                  const active = vehicleType === opt.value;
                  return (
                    <button key={opt.value} onClick={() => setVehicleType(opt.value)}
                      className={`flex flex-col items-center py-4 rounded-2xl border-2 transition-all gap-2 ${
                        active ? 'border-primary bg-primary/5' : 'border-gray-100 bg-gray-50'
                      }`}>
                      <span className="text-3xl">{opt.emoji}</span>
                      <span className={`text-sm font-bold ${active ? 'text-primary' : 'text-gray-600'}`}>{opt.label}</span>
                      {active && <CheckCircle2 className="h-4 w-4 text-primary" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Dados do veículo</p>
              <Field label="Placa">
                <input type="text" placeholder="ABC1D23" value={plate}
                  onChange={(e) => setPlate(e.target.value.toUpperCase())} maxLength={8}
                  className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm font-mono uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Modelo">
                  <input type="text" placeholder="Honda CG 160" value={vehicleModel}
                    onChange={(e) => setVehicleModel(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
                </Field>
                <Field label="Cor">
                  <input type="text" placeholder="Vermelha" value={vehicleColor}
                    onChange={(e) => setVehicleColor(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
                </Field>
              </div>
              <Field label="Ano">
                <input type="number" inputMode="numeric" placeholder="2021" value={vehicleYear}
                  onChange={(e) => setVehicleYear(e.target.value)} min="1990" max={new Date().getFullYear() + 1}
                  className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
              </Field>
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Possui bag/compartimento? *</p>
              <div className="grid grid-cols-2 gap-3">
                {([true, false] as const).map((v) => (
                  <button key={String(v)} onClick={() => setHasBag(v)}
                    className={`py-3 rounded-2xl border-2 font-bold text-sm transition-all ${
                      hasBag === v ? 'border-primary bg-primary/5 text-primary' : 'border-gray-100 text-gray-500'
                    }`}>
                    {v ? '✅ Sim' : '❌ Não'}
                  </button>
                ))}
              </div>

              {hasBag && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 font-semibold">Tipo de bag</p>
                  <div className="grid grid-cols-2 gap-2">
                    {BAG_TYPES.map((bt) => (
                      <button key={bt} onClick={() => setBagType(bt)}
                        className={`py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                          bagType === bt ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 text-gray-500'
                        }`}>
                        {bt}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ═══════════════ STEP 4 — Documentos ═══════════════ */}
        {step === 4 && (
          <>
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
              <p className="text-xs text-amber-800 font-semibold">📋 Documentos obrigatórios</p>
              <p className="text-xs text-amber-700 mt-0.5">
                As imagens são comprimidas automaticamente. Envie fotos nítidas — o admin vai analisá-las.
              </p>
            </div>

            <DocUploadCard
              label="CNH — Frente *"
              subtitle="Foto nítida da frente da carteira"
              docKey="cnhFront"
              state={docs.cnhFront}
              required
              inputRef={inputRefs.cnhFront}
              onPick={pickDoc}
            />
            <DocUploadCard
              label="CNH — Verso *"
              subtitle="Foto nítida do verso da carteira"
              docKey="cnhBack"
              state={docs.cnhBack}
              required
              inputRef={inputRefs.cnhBack}
              onPick={pickDoc}
            />
            <DocUploadCard
              label="Selfie com o rosto *"
              subtitle="Selfie clara mostrando seu rosto"
              docKey="selfie"
              state={docs.selfie}
              required
              inputRef={inputRefs.selfie}
              onPick={pickDoc}
            />
            <DocUploadCard
              label="Foto do veículo"
              subtitle="Foto frontal ou lateral do veículo (opcional)"
              docKey="vehiclePhoto"
              state={docs.vehiclePhoto}
              required={false}
              inputRef={inputRefs.vehiclePhoto}
              onPick={pickDoc}
            />
          </>
        )}

        {/* ═══════════════ STEP 5 — Categorias ═══════════════ */}
        {step === 5 && (
          <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">O que você pode entregar? *</p>
              <p className="text-xs text-gray-400">Marque todas as categorias que aceita. Você pode mudar depois.</p>
            </div>
            <div className="space-y-2">
              {PRODUCT_TYPES.map((pt) => {
                const selected = categories.includes(pt.key);
                return (
                  <button
                    key={pt.key}
                    onClick={() => toggleCat(pt.key)}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl border-2 transition-all text-left ${
                      selected ? 'border-primary bg-primary/5' : 'border-gray-100 bg-gray-50'
                    }`}
                  >
                    <span className="text-xl w-7 text-center">{pt.icon}</span>
                    <span className={`flex-1 text-sm font-semibold ${selected ? 'text-primary' : 'text-gray-700'}`}>
                      {pt.label}
                    </span>
                    {selected && <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setCategories(PRODUCT_TYPES.map((p) => p.key))}
                className="flex-1 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600">
                Selecionar todas
              </button>
              <button onClick={() => setCategories([])}
                className="flex-1 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600">
                Limpar
              </button>
            </div>
            {categories.length > 0 && (
              <p className="text-xs text-primary font-semibold text-center">{categories.length} categoria{categories.length > 1 ? 's' : ''} selecionada{categories.length > 1 ? 's' : ''}</p>
            )}
          </div>
        )}

        {/* ═══════════════ STEP 6 — Termos ═══════════════ */}
        {step === 6 && (
          <>
            <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Aceite obrigatório</p>
              {[
                { key: 'terms',   state: termsAccepted,   set: setTermsAccepted,   label: 'Aceito os termos de uso da plataforma Levei.ai' },
                { key: 'privacy', state: privacyAccepted,  set: setPrivacyAccepted, label: 'Aceito a política de privacidade e uso de dados' },
                { key: 'cnh',     state: declareCNH,       set: setDeclareCNH,      label: 'Declaro possuir CNH válida e vigente' },
                { key: 'vehicle', state: declareVehicle,   set: setDeclareVehicle,  label: 'Declaro ser responsável pelo veículo utilizado nas entregas' },
              ].map(({ key, state: s, set, label }) => (
                <button
                  key={key}
                  onClick={() => set((v) => !v)}
                  className={`w-full flex items-start gap-3 p-3 rounded-2xl border-2 text-left transition-all ${
                    s ? 'border-green-500 bg-green-50' : 'border-gray-100'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-md border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-all ${
                    s ? 'bg-green-500 border-green-500' : 'border-gray-300'
                  }`}>
                    {s && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{label}</p>
                </button>
              ))}
            </div>

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
              <p className="text-xs text-gray-400">Quem te indicou ganha 100 pontos quando você completar 5 entregas</p>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
              <p className="text-sm font-semibold text-blue-800">⏳ O que acontece depois?</p>
              <p className="text-xs text-blue-600 mt-1">
                Seu cadastro será analisado por um admin em até 24h. Você receberá uma notificação quando aprovado.
              </p>
            </div>
          </>
        )}
      </div>

      {/* ── Footer CTA ── */}
      <div
        className="bg-white border-t border-gray-100 px-4 py-3"
        style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}
      >
        <button
          onClick={goNext}
          disabled={loading || !canProceed(step)}
          className={`w-full flex items-center justify-center gap-2 rounded-2xl font-bold text-base transition-all active:scale-98 disabled:opacity-40 ${
            step === TOTAL_STEPS
              ? 'bg-green-600 text-white'
              : 'bg-primary text-white'
          }`}
          style={{ height: 52 }}
        >
          {loading ? (
            <><Loader2 className="h-5 w-5 animate-spin" /> Enviando cadastro...</>
          ) : step === TOTAL_STEPS ? (
            <><CheckCircle2 className="h-5 w-5" /> Enviar cadastro</>
          ) : (
            <>Continuar <ChevronRight className="h-5 w-5" /></>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-gray-600">{label}</label>
      {children}
    </div>
  );
}

function inputCls(valid: boolean) {
  return `w-full h-11 px-4 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary ${
    valid ? 'border-gray-200' : 'border-gray-200'
  }`;
}

interface DocUploadCardProps {
  label: string;
  subtitle: string;
  docKey: DocKey;
  state: DocState;
  required: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
  onPick: (key: DocKey, file: File) => void;
}

function DocUploadCard({ label, subtitle, docKey, state, required, inputRef, onPick }: DocUploadCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-primary" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-800">{label}</p>
          <p className="text-[11px] text-gray-400">{subtitle}</p>
        </div>
        {state.file
          ? <CheckCircle2 className="h-4 w-4 text-green-500" />
          : required
            ? <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-semibold">Obrigatório</span>
            : <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Opcional</span>
        }
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => { if (e.target.files?.[0]) onPick(docKey, e.target.files[0]); e.target.value = ''; }}
      />

      {state.preview ? (
        <div className="relative">
          <img src={state.preview} alt={label} className="w-full h-40 object-cover rounded-xl" />
          <button
            onClick={() => inputRef.current?.click()}
            className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2.5 py-1.5 rounded-xl flex items-center gap-1 backdrop-blur-sm"
          >
            <Camera className="h-3 w-3" /> Trocar
          </button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full h-32 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-primary/40 transition-colors active:scale-98"
        >
          <Upload className="h-6 w-6" />
          <span className="text-sm">Toque para enviar foto</span>
          <span className="text-[10px]">Comprimida automaticamente</span>
        </button>
      )}
    </div>
  );
}
