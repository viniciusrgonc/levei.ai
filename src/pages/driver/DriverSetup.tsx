import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import {
  ArrowLeft, ChevronRight, CheckCircle2, Loader2, Camera, Upload,
  Gift, Bike, User, MapPin, FileText, ShoppingBag, ClipboardCheck, X,
} from 'lucide-react';
import leveiLogo from '@/assets/levei-logo.png';
import { PRODUCT_TYPES } from '@/lib/productTypes';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Safely trims: returns '' for any non-string value (prevents TypeError on null/undefined) */
function safeStr(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

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

function isValidEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
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
  const path = `${userId}/${name}.jpg`;
  const { error } = await supabase.storage
    .from('driver-documents').upload(path, compressed, { upsert: true, contentType: 'image/jpeg' });
  if (error) throw new Error('Erro ao enviar documento: ' + error.message);
  return supabase.storage.from('driver-documents').getPublicUrl(path).data.publicUrl;
}

async function fetchCEP(cep: string) {
  const clean = cep.replace(/\D/g, '');
  if (clean.length !== 8) throw new Error('CEP inválido');
  const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
  const data = await res.json();
  if (data.erro) throw new Error('CEP não encontrado');
  return data as { logradouro: string; bairro: string; localidade: string; uf: string };
}

// ── Draft key ─────────────────────────────────────────────────────────────────
const draftKey = (userId: string) => `levei-driver-setup-${userId}`;

// ── Config ────────────────────────────────────────────────────────────────────

const VEHICLE_OPTIONS = [
  { value: 'motorcycle', label: 'Moto',       emoji: '🛵' },
  { value: 'car',        label: 'Carro',      emoji: '🚗' },
  { value: 'van',        label: 'Utilitário', emoji: '🚐' },
  { value: 'bicycle',   label: 'Bicicleta',  emoji: '🚲' },
];

const BAG_TYPES = ['Bag traseira', 'Baú', 'Mochila', 'Caçamba'];

const STEP_LABELS = [
  { label: 'Dados pessoais', icon: User         },
  { label: 'Endereço',       icon: MapPin        },
  { label: 'Veículo',        icon: Bike          },
  { label: 'Documentos',     icon: FileText      },
  { label: 'Categorias',     icon: ShoppingBag   },
  { label: 'Termos',         icon: ClipboardCheck },
];
const TOTAL_STEPS = STEP_LABELS.length;

type DocKey = 'cnhFront' | 'cnhBack' | 'selfie' | 'vehiclePhoto';
interface DocState { file: File | null; preview: string | null }
const emptyDoc = (): DocState => ({ file: null, preview: null });

// ── Exit Modal ────────────────────────────────────────────────────────────────

function ExitModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-t-3xl w-full max-w-md px-6 pt-4 pb-10 space-y-3"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: 'calc(32px + env(safe-area-inset-bottom))' }}
      >
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
        <div className="text-center space-y-1.5 mb-5">
          <h2 className="text-lg font-bold text-gray-900">Sair do cadastro?</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            Seu progresso foi salvo localmente.<br />
            Você pode continuar de onde parou depois.
          </p>
        </div>
        <button
          onClick={onConfirm}
          className="w-full h-12 rounded-2xl bg-red-50 border border-red-100 text-red-600 font-bold text-sm"
        >
          Sair
        </button>
        <button
          onClick={onCancel}
          className="w-full h-12 rounded-2xl bg-primary text-white font-bold text-sm shadow-sm"
        >
          Continuar cadastro
        </button>
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

/** Credenciais pendentes de cadastro — preenchidas em Auth.tsx e usadas no submit final */
const REGISTER_KEY = 'levei-register';

export default function DriverSetup() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const contentRef = useRef<HTMLDivElement>(null);

  /** Dados do pré-cadastro (modo registro: usuário ainda não tem conta auth) */
  const [pendingReg] = useState<{ role: string } | null>(() => {
    try {
      const s = sessionStorage.getItem(REGISTER_KEY);
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  });

  /** true quando usuário ainda não tem conta — fluxo vindo de /register */
  const isRegistrationMode = !user && !!pendingReg;

  const [step, setStep]         = useState(1);
  const [loading, setLoading]   = useState(false);
  const [showExit, setShowExit] = useState(false);
  const [restored, setRestored] = useState(false);

  // Step 1 — Dados pessoais
  const [email,           setEmail]           = useState(user?.email ?? '');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword,    setShowPassword]    = useState(false);
  const [fullName,  setFullName]  = useState('');
  const [cpf,       setCpf]       = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [phone,     setPhone]     = useState('');

  // Step 2 — Endereço
  const [cep,          setCep]          = useState('');
  const [street,       setStreet]       = useState('');
  const [number,       setNumber]       = useState('');
  const [complement,   setComplement]   = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city,         setCity]         = useState('');
  const [stateUF,      setStateUF]      = useState('');
  const [cepLoading,   setCepLoading]   = useState(false);

  // Step 3 — Veículo
  const [vehicleType,  setVehicleType]  = useState('motorcycle');
  const [plate,        setPlate]        = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [vehicleYear,  setVehicleYear]  = useState('');
  const [hasBag,       setHasBag]       = useState<boolean | null>(null);
  const [bagType,      setBagType]      = useState('');

  // Step 4 — Documentos (local files only — never persisted to DB until final submit)
  const [docs, setDocs] = useState<Record<DocKey, DocState>>({
    cnhFront:     emptyDoc(),
    cnhBack:      emptyDoc(),
    selfie:       emptyDoc(),
    vehiclePhoto: emptyDoc(),
  });
  const inputRefs: Record<DocKey, React.RefObject<HTMLInputElement>> = {
    cnhFront:     useRef<HTMLInputElement>(null),
    cnhBack:      useRef<HTMLInputElement>(null),
    selfie:       useRef<HTMLInputElement>(null),
    vehiclePhoto: useRef<HTMLInputElement>(null),
  };

  // Doc URLs from DB — used as fallback when user already uploaded docs in a previous session
  const [docUrls, setDocUrls] = useState<{
    cnhFront:     string | null;
    cnhBack:      string | null;
    selfie:       string | null;
    vehiclePhoto: string | null;
  }>({ cnhFront: null, cnhBack: null, selfie: null, vehiclePhoto: null });

  // Step 5 — Categorias
  const [categories, setCategories] = useState<string[]>([]);

  // Step 6 — Termos
  const [termsAccepted,   setTermsAccepted]   = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [declareCNH,      setDeclareCNH]      = useState(false);
  const [declareVehicle,  setDeclareVehicle]  = useState(false);
  const [referralCode,    setReferralCode]    = useState('');

  // DRAFT_KEY: usa user.id em modo autenticado; usa chave fixa em modo registro
  const DRAFT_KEY = user?.id
    ? draftKey(user.id)
    : pendingReg
      ? 'levei-driver-reg-draft'
      : null;

  // ── Guard: redireciona para /auth se não há sessão nem pré-cadastro ────────
  useEffect(() => {
    if (authLoading || restored) return;
    if (!user && !pendingReg) {
      navigate('/auth', { replace: true });
    }
  }, [authLoading, user, pendingReg, restored, navigate]);

  // ── Restore on mount: localStorage (primary), DB read-only for docUrls ──────
  useEffect(() => {
    // Aguarda auth carregar; em modo registro (pendingReg) o user será null — tudo bem
    if (authLoading) return;
    if (!user?.id && !pendingReg) return; // guard acima já cuida do redirect
    if (restored) return;

    (async () => {
      try {
        // 1. Restore text fields from localStorage
        if (DRAFT_KEY) {
          const saved = localStorage.getItem(DRAFT_KEY);
          if (saved) {
            try {
              const d = JSON.parse(saved);
              if (d.step)         setStep(Math.min(Number(d.step) || 1, TOTAL_STEPS));
              if (d.email)        setEmail(d.email);
              if (d.fullName)     setFullName(d.fullName);
              if (d.cpf)          setCpf(d.cpf);
              if (d.birthDate)    setBirthDate(d.birthDate);
              if (d.phone)        setPhone(d.phone);
              if (d.cep)          setCep(d.cep);
              if (d.street)       setStreet(d.street);
              if (d.number)       setNumber(d.number);
              if (d.complement)   setComplement(d.complement);
              if (d.neighborhood) setNeighborhood(d.neighborhood);
              if (d.city)         setCity(d.city);
              if (d.stateUF)      setStateUF(d.stateUF);
              if (d.vehicleType)  setVehicleType(d.vehicleType);
              if (d.plate)        setPlate(d.plate);
              if (d.vehicleModel) setVehicleModel(d.vehicleModel);
              if (d.vehicleColor) setVehicleColor(d.vehicleColor);
              if (d.vehicleYear)  setVehicleYear(d.vehicleYear);
              if (d.hasBag !== undefined && d.hasBag !== null) setHasBag(d.hasBag);
              if (d.bagType)      setBagType(d.bagType);
              if (Array.isArray(d.categories) && d.categories.length) setCategories(d.categories);
              if (d.referralCode) setReferralCode(d.referralCode);
            } catch {
              // corrupt localStorage — ignore
            }
          }
        }

        // 2. Pre-fill name/phone from profile (authenticated mode only)
        if (user?.id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name,phone')
            .eq('id', user.id)
            .maybeSingle();
          if (profile?.full_name) setFullName((prev) => prev || profile.full_name);
          if (profile?.phone)     setPhone((prev) => prev || profile.phone);
        }

        // 4. Check DB for existing driver record — READ ONLY (authenticated mode only)
        //    We never write to DB during steps. Only read doc URLs for backwards compat.
        if (!user?.id) { setRestored(true); return; }

        const { data: existing } = await supabase
          .from('drivers')
          .select(
            'driver_status,submitted_at,drivers_license_url,cnh_back_url,selfie_url,vehicle_photo_url,' +
            'onboarding_step,cpf,birth_date,phone,address_cep,address_street,address_number,' +
            'address_complement,address_neighborhood,address_city,address_state,' +
            'vehicle_type,license_plate,vehicle_model,vehicle_color,vehicle_year,' +
            'has_bag,bag_type,accepted_product_types'
          )
          .eq('user_id', user.id)
          .maybeSingle();

        if (existing) {
          // If this is a previously submitted record that came back (e.g. rejected),
          // useUserSetup handles the redirect — we just grab doc URLs here.
          setDocUrls({
            cnhFront:    existing.drivers_license_url || null,
            cnhBack:     existing.cnh_back_url        || null,
            selfie:      existing.selfie_url           || null,
            vehiclePhoto: existing.vehicle_photo_url  || null,
          });

          // If no localStorage draft was found, also restore text fields from DB
          if (!localStorage.getItem(DRAFT_KEY ?? '') && !existing.submitted_at) {
            if (existing.onboarding_step) setStep(Math.min(existing.onboarding_step, TOTAL_STEPS));
            if (existing.cpf)             setCpf(existing.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4'));
            if (existing.birth_date)      setBirthDate(existing.birth_date);
            if (existing.phone)           setPhone(existing.phone);
            if (existing.address_cep)     setCep(existing.address_cep.replace(/(\d{5})(\d{3})/, '$1-$2'));
            if (existing.address_street)  setStreet(existing.address_street);
            if (existing.address_number)  setNumber(existing.address_number);
            if (existing.address_complement)   setComplement(existing.address_complement);
            if (existing.address_neighborhood) setNeighborhood(existing.address_neighborhood);
            if (existing.address_city)    setCity(existing.address_city);
            if (existing.address_state)   setStateUF(existing.address_state);
            if (existing.vehicle_type)    setVehicleType(existing.vehicle_type);
            if (existing.license_plate)   setPlate(existing.license_plate);
            if (existing.vehicle_model)   setVehicleModel(existing.vehicle_model || '');
            if (existing.vehicle_color)   setVehicleColor(existing.vehicle_color || '');
            if (existing.vehicle_year)    setVehicleYear(String(existing.vehicle_year));
            if (existing.has_bag !== null && existing.has_bag !== undefined) setHasBag(existing.has_bag);
            if (existing.bag_type)        setBagType(existing.bag_type);
            if (Array.isArray(existing.accepted_product_types) && existing.accepted_product_types.length)
              setCategories(existing.accepted_product_types);
          }
        }
      } catch (e) {
        console.error('[restore] error:', e);
      }

      setRestored(true);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id]);

  // ── Auto-save to localStorage on every change ─────────────────────────────
  useEffect(() => {
    if (!DRAFT_KEY || !restored) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        step, email, fullName, cpf, birthDate, phone,
        cep, street, number, complement, neighborhood, city, stateUF,
        vehicleType, plate, vehicleModel, vehicleColor, vehicleYear, hasBag, bagType,
        categories, referralCode,
      }));
    } catch { /* storage full — ignore */ }
  }, [
    DRAFT_KEY, restored, step, email, fullName, cpf, birthDate, phone,
    cep, street, number, complement, neighborhood, city, stateUF,
    vehicleType, plate, vehicleModel, vehicleColor, vehicleYear, hasBag, bagType,
    categories, referralCode,
  ]);

  // ── Scroll to top on step change ──────────────────────────────────────────
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  // ── Validation per step ───────────────────────────────────────────────────
  const canProceed = (s: number): boolean => {
    switch (s) {
      case 1: {
        const baseOk =
          isValidEmail(email) &&
          !!safeStr(fullName) &&
          validateCPF(cpf) &&
          isOver18(birthDate) &&
          phone.replace(/\D/g, '').length >= 10;
        if (isRegistrationMode) {
          return baseOk && password.length >= 8 && password === confirmPassword;
        }
        return baseOk;
      }
      case 2:
        return !!(safeStr(street) && safeStr(number) && safeStr(neighborhood) && safeStr(city) && safeStr(stateUF));
      case 3:
        return !!(vehicleType && hasBag !== null);
      case 4:
        return !!(
          (docs.cnhFront.file  || docUrls.cnhFront) &&
          (docs.cnhBack.file   || docUrls.cnhBack)  &&
          (docs.selfie.file    || docUrls.selfie)
        );
      case 5:
        return categories.length > 0;
      case 6:
        return termsAccepted && privacyAccepted && declareCNH && declareVehicle;
      default:
        return true;
    }
  };

  // ── CEP lookup ────────────────────────────────────────────────────────────
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
        setStateUF(data.uf);
      } catch {
        toast({ variant: 'destructive', title: 'CEP não encontrado', description: 'Preencha o endereço manualmente.' });
      } finally {
        setCepLoading(false);
      }
    }
  };

  // ── Document picker ───────────────────────────────────────────────────────
  const pickDoc = (key: DocKey, file: File) => {
    if (file.size > 15 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'Arquivo muito grande', description: 'Máximo 15 MB.' });
      return;
    }
    const preview = URL.createObjectURL(file);
    setDocs((prev) => ({ ...prev, [key]: { file, preview } }));
  };

  // ── Category toggle ───────────────────────────────────────────────────────
  const toggleCat = (key: string) =>
    setCategories((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const goBack = () => {
    if (step === 1) setShowExit(true);
    else setStep((s) => s - 1);
  };

  const handleExit = async () => {
    setShowExit(false);
    if (isRegistrationMode) {
      // Usuário ainda não tem conta — volta para a seleção de perfil
      sessionStorage.removeItem(REGISTER_KEY);
      navigate('/register');
    } else {
      await supabase.auth.signOut();
      navigate('/auth');
    }
  };

  // ── Advance step (no DB writes — only localStorage via the auto-save effect)
  const goNext = async () => {
    if (!canProceed(step)) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios',
        description: 'Preencha todos os campos antes de continuar.',
      });
      return;
    }
    if (step === TOTAL_STEPS) {
      handleSubmit();
      return;
    }
    setStep((s) => s + 1);
  };

  // ── Final submit: single atomic write to Supabase ─────────────────────────
  const handleSubmit = async () => {
    // Precisa de auth existente OU pendingReg para criar a conta no submit
    if (!user && !pendingReg) {
      toast({ variant: 'destructive', title: 'Sessão inválida', description: 'Inicie o cadastro novamente.' });
      navigate('/auth');
      return;
    }
    setLoading(true);
    console.log('[submit] starting — mode:', user ? 'authenticated' : 'registration');

    try {
      // ── 1. Sanitize all string fields ──────────────────────────────────────
      const safeName    = safeStr(fullName);
      const safeCPF     = safeStr(cpf).replace(/\D/g, '');
      const safePhone   = safeStr(phone);
      const safePlate   = safeStr(plate).toUpperCase() || null;
      const safeModel   = safeStr(vehicleModel) || null;
      const safeColor   = safeStr(vehicleColor) || null;
      const safeCEP     = safeStr(cep).replace(/\D/g, '');
      const safeStreet  = safeStr(street);
      const safeNum     = safeStr(number);
      const safeComp    = safeStr(complement) || null;
      const safeNeigh   = safeStr(neighborhood);
      const safeCity    = safeStr(city);
      const safeState   = safeStr(stateUF);
      const safeBagType = (hasBag && bagType) ? (safeStr(bagType) || null) : null;
      const safeRef     = safeStr(referralCode).toUpperCase() || null;

      // ── 2. Full validation before any network call ─────────────────────────
      const missing: string[] = [];
      if (!safeName)                              missing.push('Nome completo');
      if (safeCPF.length !== 11)                  missing.push('CPF válido');
      if (!birthDate)                             missing.push('Data de nascimento');
      if (safePhone.replace(/\D/g, '').length < 10) missing.push('Telefone');
      if (!safeStreet)                            missing.push('Rua/Logradouro');
      if (!safeNum)                               missing.push('Número');
      if (!safeNeigh)                             missing.push('Bairro');
      if (!safeCity)                              missing.push('Cidade');
      if (!safeState)                             missing.push('Estado');
      if (!vehicleType)                           missing.push('Tipo de veículo');
      if (hasBag === null)                        missing.push('Informação sobre bag');
      if (!docs.cnhFront.file && !docUrls.cnhFront) missing.push('CNH frente');
      if (!docs.cnhBack.file  && !docUrls.cnhBack)  missing.push('CNH verso');
      if (!docs.selfie.file   && !docUrls.selfie)   missing.push('Selfie');
      if (categories.length === 0)                missing.push('Categorias de entrega');
      if (!termsAccepted || !privacyAccepted || !declareCNH || !declareVehicle)
                                                  missing.push('Aceite dos termos');

      if (missing.length > 0) {
        throw new Error('Campos obrigatórios faltando: ' + missing.join(', '));
      }

      // ── 3. Obter userId — criar conta se for modo registro ────────────────
      let userId: string;

      if (user) {
        // Modo autenticado: usuário já tem conta
        userId = user.id;
        // Atualiza email se foi alterado (fire-and-forget)
        if (email && email !== user.email) {
          supabase.auth.updateUser({ email }).catch(() => {});
        }
      } else {
        // Modo registro: cria auth.users agora (somente no submit final)
        console.log('[submit] creating auth account for:', email);
        const { data: authData, error: signUpErr } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: safeName, phone: safePhone },
          },
        });
        if (signUpErr) throw new Error('Erro ao criar conta: ' + signUpErr.message);
        if (!authData.user) throw new Error('Erro ao criar conta. Tente novamente.');

        userId = authData.user.id;
        console.log('[submit] account created, userId:', userId);

        // Insere papel (role) do usuário
        const { error: roleErr } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role: 'driver' });
        if (roleErr) console.warn('[submit] role insert warning:', roleErr.message);
      }

      // ── 4. Upload documents ────────────────────────────────────────────────
      console.log('[submit] uploading documents...');
      const [cnhFrontUrl, cnhBackUrl, selfieUrl, vehiclePhotoUrl] = await Promise.all([
        docs.cnhFront.file
          ? uploadFile(userId, docs.cnhFront.file, 'cnh-front')
          : Promise.resolve(docUrls.cnhFront!),
        docs.cnhBack.file
          ? uploadFile(userId, docs.cnhBack.file, 'cnh-back')
          : Promise.resolve(docUrls.cnhBack!),
        docs.selfie.file
          ? uploadFile(userId, docs.selfie.file, 'selfie')
          : Promise.resolve(docUrls.selfie!),
        docs.vehiclePhoto.file
          ? uploadFile(userId, docs.vehiclePhoto.file, 'vehicle')
          : Promise.resolve(docUrls.vehiclePhoto),
      ]);
      console.log('[submit] documents uploaded');

      // ── 5. Update profile ──────────────────────────────────────────────────
      console.log('[submit] updating profile...');
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ full_name: safeName, phone: safePhone })
        .eq('id', userId);
      if (profileErr) {
        console.warn('[submit] profile update warning:', profileErr.message);
      }

      // ── 6. Build final driver payload ─────────────────────────────────────
      const finalPayload = {
        cpf:                    safeCPF,
        birth_date:             birthDate,
        phone:                  safePhone,
        address_cep:            safeCEP,
        address_street:         safeStreet,
        address_number:         safeNum,
        address_complement:     safeComp,
        address_neighborhood:   safeNeigh,
        address_city:           safeCity,
        address_state:          safeState,
        vehicle_type:           vehicleType as any,
        license_plate:          safePlate,
        vehicle_model:          safeModel,
        vehicle_color:          safeColor,
        vehicle_year:           vehicleYear ? parseInt(vehicleYear) : null,
        has_bag:                hasBag!,
        bag_type:               safeBagType,
        drivers_license_url:    cnhFrontUrl,
        cnh_back_url:           cnhBackUrl,
        selfie_url:             selfieUrl,
        vehicle_photo_url:      vehiclePhotoUrl,
        accepted_product_types: categories.length > 0 ? categories : [],
        accepted_terms:         true,
        terms_accepted_at:      new Date().toISOString(),
        is_approved:            false,
        is_available:           false,
        driver_status:          'pending' as any,
        submitted_at:           new Date().toISOString(),
        onboarding_completed:   true,
        onboarding_step:        TOTAL_STEPS,
      };

      // ── 7. Check for existing driver record and upsert ────────────────────
      console.log('[submit] upserting driver record...');
      const { data: existingDriver } = await supabase
        .from('drivers')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      let newDriverId: string;

      if (existingDriver?.id) {
        const { error } = await supabase
          .from('drivers')
          .update(finalPayload)
          .eq('id', existingDriver.id);
        if (error) throw new Error('Erro ao salvar cadastro: ' + error.message);
        newDriverId = existingDriver.id;
      } else {
        const { data: newDriver, error } = await supabase
          .from('drivers')
          .insert({ user_id: userId, ...finalPayload })
          .select('id')
          .single();
        if (error || !newDriver) throw new Error('Erro ao criar cadastro: ' + (error?.message ?? 'Tente novamente'));
        newDriverId = newDriver.id;
      }

      console.log('[submit] driver saved, id:', newDriverId);

      // ── 8. Referral (fire-and-forget) ─────────────────────────────────────
      if (safeRef) {
        supabase
          .rpc('register_referral', { p_referral_code: safeRef, p_new_driver_id: newDriverId })
          .catch(() => {});
      }

      // ── 9. Clear local draft e credenciais pendentes ───────────────────────
      sessionStorage.removeItem(REGISTER_KEY);
      if (DRAFT_KEY) localStorage.removeItem(DRAFT_KEY);

      console.log('[submit] success! Redirecting to pending-approval...');
      navigate('/driver/pending-approval', { replace: true });

    } catch (e: any) {
      console.error('[submit] error:', e);
      const msg = safeStr(e?.message) || safeStr(e?.error_description) || 'Erro desconhecido. Tente novamente.';
      toast({
        variant:     'destructive',
        title:       'Erro no cadastro',
        description: msg,
      });
    } finally {
      setLoading(false);
    }
  };

  const stepInfo = STEP_LABELS[step - 1];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>

      {/* ── Header ── */}
      <div className="bg-primary px-4 pb-5 pt-4 flex-shrink-0">
        <div className="flex items-center gap-2 mb-4">

          {/* ← Voltar */}
          <button
            onClick={goBack}
            className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center active:scale-90 transition-transform flex-shrink-0"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>

          {/* Progresso central */}
          <div className="flex-1 text-center min-w-0 px-1">
            <p className="text-white/60 text-[11px] font-medium">
              Passo {step} de {TOTAL_STEPS}
            </p>
            <h1 className="text-white font-bold text-base leading-tight truncate">
              {stepInfo.label}
            </h1>
          </div>

          {/* × Fechar */}
          <button
            onClick={() => setShowExit(true)}
            className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center active:scale-90 transition-transform flex-shrink-0"
            aria-label="Fechar cadastro"
          >
            <X className="h-5 w-5 text-white" />
          </button>
        </div>

        {/* Barra de progresso */}
        <div className="flex gap-1">
          {STEP_LABELS.map((_, i) => (
            <div
              key={i}
              className="flex-1 h-1 rounded-full transition-all duration-300"
              style={{ background: i < step ? 'white' : 'rgba(255,255,255,0.25)' }}
            />
          ))}
        </div>
      </div>

      {/* ── Content (scrollável) ── */}
      <div
        ref={contentRef}
        className="flex-1 px-4 py-5 space-y-4 overflow-y-auto"
        style={{ paddingBottom: '100px' }}
      >

        {/* ═══════════════ STEP 1 — Dados pessoais ═══════════════ */}
        {step === 1 && (
          <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Informações básicas</p>

            <Field label="E-mail *">
              <input
                type="email"
                inputMode="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                className={inputCls(isValidEmail(email))}
              />
              {email && !isValidEmail(email) && (
                <p className="text-[10px] text-red-500 mt-1">E-mail inválido</p>
              )}
            </Field>

            {/* Senha — somente no fluxo de registro (/driver/register) */}
            {isRegistrationMode && (
              <>
                <Field label="Senha *">
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Mínimo 8 caracteres"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                      className={inputCls(password.length >= 8)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    >
                      {showPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                  {password && password.length < 8 && (
                    <p className="text-[10px] text-red-500 mt-1">Mínimo 8 caracteres</p>
                  )}
                </Field>

                <Field label="Confirmar senha *">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Repita a senha"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                    className={inputCls(confirmPassword.length >= 8 && confirmPassword === password)}
                  />
                  {confirmPassword && confirmPassword !== password && (
                    <p className="text-[10px] text-red-500 mt-1">As senhas não coincidem</p>
                  )}
                </Field>
              </>
            )}

            <Field label="Nome completo *">
              <input
                type="text"
                placeholder="Seu nome completo"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                className={inputCls(!!safeStr(fullName))}
              />
            </Field>

            <Field label="CPF *">
              <input
                type="text"
                inputMode="numeric"
                placeholder="000.000.000-00"
                value={cpf}
                onChange={(e) => setCpf(formatCPF(e.target.value))}
                onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })}
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
                onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                max={(() => {
                  const d = new Date();
                  d.setFullYear(d.getFullYear() - 18);
                  return d.toISOString().split('T')[0];
                })()}
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
                onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                maxLength={15}
                className={inputCls(phone.replace(/\D/g, '').length >= 10)}
              />
            </Field>
          </div>
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
                  onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                  maxLength={9}
                  className={inputCls(cep.replace(/\D/g, '').length === 8)}
                />
                {cepLoading && (
                  <Loader2 className="absolute right-3 top-3 h-5 w-5 animate-spin text-primary" />
                )}
              </div>
            </Field>

            <Field label="Rua / Logradouro *">
              <input
                type="text"
                placeholder="Rua das Flores"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                className={inputCls(!!safeStr(street))}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Número *">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="123"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                  className={inputCls(!!safeStr(number))}
                />
              </Field>
              <Field label="Complemento">
                <input
                  type="text"
                  placeholder="Apto 4"
                  value={complement}
                  onChange={(e) => setComplement(e.target.value)}
                  onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                  className={inputCls(true)}
                />
              </Field>
            </div>

            <Field label="Bairro *">
              <input
                type="text"
                placeholder="Centro"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                className={inputCls(!!safeStr(neighborhood))}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Cidade *">
                <input
                  type="text"
                  placeholder="Belo Horizonte"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                  className={inputCls(!!safeStr(city))}
                />
              </Field>
              <Field label="Estado *">
                <input
                  type="text"
                  placeholder="MG"
                  value={stateUF}
                  onChange={(e) => setStateUF(e.target.value.toUpperCase().slice(0, 2))}
                  onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                  maxLength={2}
                  className={inputCls(!!safeStr(stateUF))}
                />
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
                    <button
                      key={opt.value}
                      onClick={() => setVehicleType(opt.value)}
                      className={`flex flex-col items-center py-4 rounded-2xl border-2 transition-all gap-2 ${
                        active ? 'border-primary bg-primary/5' : 'border-gray-100 bg-gray-50'
                      }`}
                    >
                      <span className="text-3xl">{opt.emoji}</span>
                      <span className={`text-sm font-bold ${active ? 'text-primary' : 'text-gray-600'}`}>
                        {opt.label}
                      </span>
                      {active && <CheckCircle2 className="h-4 w-4 text-primary" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Dados do veículo</p>
              <Field label="Placa">
                <input
                  type="text"
                  placeholder="ABC1D23"
                  value={plate}
                  onChange={(e) => setPlate(e.target.value.toUpperCase())}
                  onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                  maxLength={8}
                  className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm font-mono uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Modelo">
                  <input
                    type="text"
                    placeholder="Honda CG 160"
                    value={vehicleModel}
                    onChange={(e) => setVehicleModel(e.target.value)}
                    onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                    className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </Field>
                <Field label="Cor">
                  <input
                    type="text"
                    placeholder="Vermelha"
                    value={vehicleColor}
                    onChange={(e) => setVehicleColor(e.target.value)}
                    onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                    className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </Field>
              </div>
              <Field label="Ano">
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="2021"
                  value={vehicleYear}
                  onChange={(e) => setVehicleYear(e.target.value)}
                  onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                  min="1990"
                  max={new Date().getFullYear() + 1}
                  className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </Field>
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Possui bag/compartimento? *</p>
              <div className="grid grid-cols-2 gap-3">
                {([true, false] as const).map((v) => (
                  <button
                    key={String(v)}
                    onClick={() => setHasBag(v)}
                    className={`py-3 rounded-2xl border-2 font-bold text-sm transition-all ${
                      hasBag === v
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-gray-100 text-gray-500'
                    }`}
                  >
                    {v ? '✅ Sim' : '❌ Não'}
                  </button>
                ))}
              </div>

              {hasBag && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 font-semibold">Tipo de bag</p>
                  <div className="grid grid-cols-2 gap-2">
                    {BAG_TYPES.map((bt) => (
                      <button
                        key={bt}
                        onClick={() => setBagType(bt)}
                        className={`py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                          bagType === bt
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-gray-200 text-gray-500'
                        }`}
                      >
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
              existingUrl={docUrls.cnhFront}
              required
              inputRef={inputRefs.cnhFront}
              onPick={pickDoc}
            />
            <DocUploadCard
              label="CNH — Verso *"
              subtitle="Foto nítida do verso da carteira"
              docKey="cnhBack"
              state={docs.cnhBack}
              existingUrl={docUrls.cnhBack}
              required
              inputRef={inputRefs.cnhBack}
              onPick={pickDoc}
            />
            <DocUploadCard
              label="Selfie com o rosto *"
              subtitle="Selfie clara mostrando seu rosto"
              docKey="selfie"
              state={docs.selfie}
              existingUrl={docUrls.selfie}
              required
              inputRef={inputRefs.selfie}
              onPick={pickDoc}
            />
            <DocUploadCard
              label="Foto do veículo"
              subtitle="Foto frontal ou lateral do veículo (opcional)"
              docKey="vehiclePhoto"
              state={docs.vehiclePhoto}
              existingUrl={docUrls.vehiclePhoto}
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
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">
                O que você pode entregar? *
              </p>
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
              <button
                onClick={() => setCategories(PRODUCT_TYPES.map((p) => p.key))}
                className="flex-1 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 active:bg-gray-50"
              >
                Selecionar todas
              </button>
              <button
                onClick={() => setCategories([])}
                className="flex-1 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 active:bg-gray-50"
              >
                Limpar
              </button>
            </div>
            {categories.length > 0 && (
              <p className="text-xs text-primary font-semibold text-center">
                {categories.length} categoria{categories.length > 1 ? 's' : ''} selecionada{categories.length > 1 ? 's' : ''}
              </p>
            )}
          </div>
        )}

        {/* ═══════════════ STEP 6 — Termos ═══════════════ */}
        {step === 6 && (
          <>
            <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Aceite obrigatório</p>
              {[
                { key: 'terms',   s: termsAccepted,   set: setTermsAccepted,   label: 'Aceito os termos de uso da plataforma Levei.ai' },
                { key: 'privacy', s: privacyAccepted,  set: setPrivacyAccepted, label: 'Aceito a política de privacidade e uso de dados' },
                { key: 'cnh',     s: declareCNH,       set: setDeclareCNH,      label: 'Declaro possuir CNH válida e vigente' },
                { key: 'vehicle', s: declareVehicle,   set: setDeclareVehicle,  label: 'Declaro ser responsável pelo veículo utilizado nas entregas' },
              ].map(({ key, s, set, label }) => (
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
                onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })}
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
        className="bg-white border-t border-gray-100 px-4 py-3 flex-shrink-0"
        style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}
      >
        <button
          onClick={goNext}
          disabled={loading || !canProceed(step)}
          className={`w-full flex items-center justify-center gap-2 rounded-2xl font-bold text-base transition-all active:scale-[0.98] disabled:opacity-40 ${
            step === TOTAL_STEPS ? 'bg-green-600 text-white' : 'bg-primary text-white'
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

      {/* ── Exit Modal ── */}
      {showExit && (
        <ExitModal
          onConfirm={handleExit}
          onCancel={() => setShowExit(false)}
        />
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

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
    valid ? 'border-gray-200 bg-white' : 'border-gray-200 bg-white'
  }`;
}

interface DocUploadCardProps {
  label:       string;
  subtitle:    string;
  docKey:      DocKey;
  state:       DocState;
  existingUrl?: string | null;
  required:    boolean;
  inputRef:    React.RefObject<HTMLInputElement>;
  onPick:      (key: DocKey, file: File) => void;
}

function DocUploadCard({ label, subtitle, docKey, state, existingUrl, required, inputRef, onPick }: DocUploadCardProps) {
  // Show local preview first; fall back to the URL already saved in DB
  const previewSrc = state.preview ?? existingUrl ?? null;
  const hasDoc = !!previewSrc;

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-primary" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-800">{label}</p>
          <p className="text-[11px] text-gray-400">{subtitle}</p>
        </div>
        {hasDoc
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

      {previewSrc ? (
        <div className="relative">
          <img src={previewSrc} alt={label} className="w-full h-40 object-cover rounded-xl" />
          {existingUrl && !state.preview && (
            <div className="absolute top-2 left-2 bg-green-600/90 text-white text-[10px] px-2 py-0.5 rounded-full font-semibold backdrop-blur-sm">
              ✓ Já enviado
            </div>
          )}
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
          className="w-full h-32 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-primary/40 transition-colors active:scale-[0.98]"
        >
          <Upload className="h-6 w-6" />
          <span className="text-sm">Toque para enviar foto</span>
          <span className="text-[10px]">Comprimida automaticamente</span>
        </button>
      )}
    </div>
  );
}
