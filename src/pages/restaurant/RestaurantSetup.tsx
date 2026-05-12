import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import leveiLogo from '@/assets/levei-logo.png';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2,
  MapPin,
  Clock,
  FileText,
  Building2,
  User,
  LogOut,
} from 'lucide-react';

// ── Validation ────────────────────────────────────────────────────────────────

function validateCPF(cpf: string): boolean {
  const n = cpf.replace(/\D/g, '');
  if (n.length !== 11 || /^(\d)\1+$/.test(n)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += +n[i] * (10 - i);
  let r = (s * 10) % 11; if (r === 10 || r === 11) r = 0;
  if (r !== +n[9]) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += +n[i] * (11 - i);
  r = (s * 10) % 11; if (r === 10 || r === 11) r = 0;
  return r === +n[10];
}

function validateCNPJ(cnpj: string): boolean {
  const n = cnpj.replace(/\D/g, '');
  if (n.length !== 14 || /^(\d)\1+$/.test(n)) return false;
  const calc = (s: number) => {
    let sum = 0, pos = s - 7;
    for (let i = s; i >= 1; i--) { sum += +n[s - i] * pos--; if (pos < 2) pos = 9; }
    return sum % 11 < 2 ? 0 : 11 - (sum % 11);
  };
  return calc(12) === +n[12] && calc(13) === +n[13];
}

// ── Masks ─────────────────────────────────────────────────────────────────────

function maskCPF(v: string) {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function maskCNPJ(v: string) {
  return v.replace(/\D/g, '').slice(0, 14)
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

function maskPhone(v: string) {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d{1,4})$/, '$1-$2');
}

function maskCEP(v: string) {
  return v.replace(/\D/g, '').slice(0, 8)
    .replace(/(\d{5})(\d{1,3})$/, '$1-$2');
}

// ── External fetch ────────────────────────────────────────────────────────────

async function fetchCEP(cep: string) {
  const res = await fetch(`https://viacep.com.br/ws/${cep.replace(/\D/g, '')}/json/`);
  const d = await res.json();
  if (d.erro) throw new Error('CEP não encontrado');
  return { street: d.logradouro, neighborhood: d.bairro, city: d.localidade, state: d.uf };
}

async function geocode(street: string, number: string, city: string, state: string) {
  const q = encodeURIComponent(`${street}, ${number}, ${city}, ${state}, Brasil`);
  const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1&countrycodes=br`);
  const d = await r.json();
  if (d[0]) return { lat: parseFloat(d[0].lat), lng: parseFloat(d[0].lon) };
  return null;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type PersonType = 'pf' | 'pj';

type DayKey = 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab' | 'dom';

const DAY_LABELS: Record<DayKey, string> = {
  seg: 'Seg', ter: 'Ter', qua: 'Qua', qui: 'Qui', sex: 'Sex', sab: 'Sáb', dom: 'Dom',
};

const ALL_DAYS: DayKey[] = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];

type DaySchedule = { enabled: boolean; open: string; close: string };
type Hours = Record<DayKey, DaySchedule>;

function defaultHours(): Hours {
  return ALL_DAYS.reduce((acc, d) => {
    acc[d] = { enabled: true, open: '08:00', close: '22:00' };
    return acc;
  }, {} as Hours);
}

// ── Progress bar ──────────────────────────────────────────────────────────────

const STEP_ICONS = [User, MapPin, Clock, FileText];
const STEP_LABELS = ['Identidade', 'Endereço', 'Horários', 'Termos'];

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mt-4 mb-2">
      {[1, 2, 3, 4].map((s, i) => {
        const done = s < step;
        const active = s === step;
        return (
          <div key={s} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all
                ${done ? 'bg-green-400 text-white' : active ? 'bg-white text-primary' : 'bg-white/30 text-white/60'}`}
            >
              {done ? <Check className="w-4 h-4" /> : s}
            </div>
            {i < 3 && (
              <div className={`h-0.5 w-8 mx-0.5 rounded transition-all ${s < step ? 'bg-green-400' : 'bg-white/30'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Input helpers ─────────────────────────────────────────────────────────────

function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 bg-gray-50 ${props.className ?? ''}`}
    />
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RestaurantSetup() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);

  // Step 1
  const [personType, setPersonType] = useState<PersonType>('pf');
  const [fullName, setFullName] = useState('');
  const [cpf, setCpf] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [fantasyName, setFantasyName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [responsibleName, setResponsibleName] = useState('');
  const [phone, setPhone] = useState('');
  const [docError, setDocError] = useState('');

  // Step 2
  const [cep, setCep] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [addressState, setAddressState] = useState('');
  const [reference, setReference] = useState('');
  const [addressLabel, setAddressLabel] = useState('Principal');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Step 3
  const [configHours, setConfigHours] = useState(false);
  const [hours, setHours] = useState<Hours>(defaultHours());

  // Step 4
  const [term1, setTerm1] = useState(false);
  const [term2, setTerm2] = useState(false);
  const [term3, setTerm3] = useState(false);

  // ── Validation ──────────────────────────────────────────────────────────────

  function canProceed(s: number): boolean {
    if (s === 1) {
      if (personType === 'pf') {
        return fullName.trim().length > 2 && validateCPF(cpf) && phone.replace(/\D/g, '').length >= 10;
      }
      return (
        companyName.trim().length > 1 &&
        validateCNPJ(cnpj) &&
        responsibleName.trim().length > 2 &&
        phone.replace(/\D/g, '').length >= 10
      );
    }
    if (s === 2) {
      return (
        street.trim().length > 0 &&
        number.trim().length > 0 &&
        neighborhood.trim().length > 0 &&
        city.trim().length > 0 &&
        addressState.trim().length === 2
      );
    }
    if (s === 3) return true;
    if (s === 4) return term1 && term2 && term3;
    return false;
  }

  // ── CEP fetch ───────────────────────────────────────────────────────────────

  async function handleFetchCEP() {
    const cleaned = cep.replace(/\D/g, '');
    if (cleaned.length !== 8) {
      toast({ variant: 'destructive', title: 'CEP inválido', description: 'Digite um CEP com 8 dígitos.' });
      return;
    }
    setCepLoading(true);
    try {
      const data = await fetchCEP(cleaned);
      setStreet(data.street);
      setNeighborhood(data.neighborhood);
      setCity(data.city);
      setAddressState(data.state);
    } catch {
      toast({ variant: 'destructive', title: 'CEP não encontrado', description: 'Verifique o CEP e tente novamente.' });
    } finally {
      setCepLoading(false);
    }
  }

  // ── Auto geocode when address fields complete ────────────────────────────────

  async function tryGeocode() {
    if (street && number && city && addressState) {
      const c = await geocode(street, number, city, addressState);
      if (c) setCoords(c);
    }
  }

  // ── Navigation ──────────────────────────────────────────────────────────────

  function handleNext() {
    if (step === 1) {
      if (personType === 'pf' && !validateCPF(cpf)) {
        setDocError('CPF inválido');
        return;
      }
      if (personType === 'pj' && !validateCNPJ(cnpj)) {
        setDocError('CNPJ inválido');
        return;
      }
      setDocError('');
    }
    if (step === 2) {
      tryGeocode();
    }
    if (step < 4) setStep(s => s + 1);
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!user) return;
    setLoading(true);

    const finalFullName = personType === 'pf' ? fullName : responsibleName;

    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ full_name: finalFullName, phone: phone.replace(/\D/g, '') })
        .eq('id', user.id);

      if (profileError) throw profileError;

      const { error: restError } = await supabase.from('restaurants').insert({
        user_id: user.id,
        business_name: personType === 'pj' ? (fantasyName || companyName) : fullName,
        person_type: personType,
        cpf: personType === 'pf' ? cpf.replace(/\D/g, '') : null,
        company_name: personType === 'pj' ? companyName : null,
        fantasy_name: personType === 'pj' ? (fantasyName || null) : null,
        phone: phone.replace(/\D/g, ''),
        address_cep: cep.replace(/\D/g, ''),
        address_street: street,
        address_number: number,
        address_complement: complement || null,
        address_neighborhood: neighborhood,
        address_city: city,
        address_state: addressState,
        address_label: addressLabel || 'Principal',
        address: `${street}, ${number} - ${neighborhood}, ${city}/${addressState}`,
        latitude: coords?.lat ?? -19.87,
        longitude: coords?.lng ?? -44.99,
        business_hours: configHours ? hours : null,
        accepted_terms: true,
        terms_accepted_at: new Date().toISOString(),
        is_approved: true,
      });

      if (restError) throw restError;

      toast({ title: 'Cadastro concluído!', description: 'Bem-vindo ao Levei.ai!' });
      navigate('/restaurant/dashboard');
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro ao cadastrar', description: err.message ?? 'Tente novamente.' });
    } finally {
      setLoading(false);
    }
  }

  // ── Day toggle ──────────────────────────────────────────────────────────────

  function toggleDay(day: DayKey) {
    setHours(h => ({ ...h, [day]: { ...h[day], enabled: !h[day].enabled } }));
  }

  function setDayTime(day: DayKey, field: 'open' | 'close', value: string) {
    setHours(h => ({ ...h, [day]: { ...h[day], [field]: value } }));
  }

  // ── Step title ──────────────────────────────────────────────────────────────

  const stepTitles = ['Tipo e Identidade', 'Endereço Principal', 'Horário de Funcionamento', 'Termos de Uso'];

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Hero header */}
      <div className="bg-primary pt-safe-top pb-6 px-4 flex flex-col items-center relative">
        <div className="w-full max-w-md flex justify-center pt-4">
          <img src={leveiLogo} alt="Levei.ai" className="h-8 rounded-lg" />
        </div>
        {/* Botão sair — sempre visível para evitar armadilha no step 1 */}
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            navigate('/auth');
          }}
          aria-label="Sair"
          className="absolute top-4 right-4 flex items-center gap-1 text-white/70 hover:text-white text-xs font-medium transition-colors"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
        <ProgressBar step={step} />
        <p className="text-white/80 text-xs mt-1 mb-1">{STEP_LABELS[step - 1]}</p>
        <h1 className="text-white font-bold text-lg text-center">{stepTitles[step - 1]}</h1>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-6 max-w-md mx-auto w-full">

        {/* ── Step 1 ── */}
        {step === 1 && (
          <div className="rounded-2xl shadow-sm bg-white p-5 flex flex-col gap-4">
            <p className="text-sm font-semibold text-gray-600">Tipo de pessoa</p>
            <div className="flex gap-3">
              {(['pf', 'pj'] as PersonType[]).map(t => (
                <button
                  key={t}
                  onClick={() => { setPersonType(t); setDocError(''); }}
                  className={`flex-1 py-3 rounded-xl font-semibold text-sm border-2 transition-all
                    ${personType === t ? 'border-primary bg-primary text-white' : 'border-gray-200 bg-gray-50 text-gray-600'}`}
                >
                  {t === 'pf' ? (
                    <span className="flex items-center justify-center gap-2"><User className="w-4 h-4" /> Pessoa Física</span>
                  ) : (
                    <span className="flex items-center justify-center gap-2"><Building2 className="w-4 h-4" /> Pessoa Jurídica</span>
                  )}
                </button>
              ))}
            </div>

            {personType === 'pf' ? (
              <>
                <Field label="Nome completo">
                  <TextInput
                    placeholder="Seu nome completo"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                  />
                </Field>
                <Field label="CPF" error={docError}>
                  <TextInput
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={e => { setCpf(maskCPF(e.target.value)); setDocError(''); }}
                    inputMode="numeric"
                  />
                </Field>
              </>
            ) : (
              <>
                <Field label="Razão Social">
                  <TextInput
                    placeholder="Razão social da empresa"
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                  />
                </Field>
                <Field label="Nome Fantasia (opcional)">
                  <TextInput
                    placeholder="Nome fantasia"
                    value={fantasyName}
                    onChange={e => setFantasyName(e.target.value)}
                  />
                </Field>
                <Field label="CNPJ" error={docError}>
                  <TextInput
                    placeholder="00.000.000/0000-00"
                    value={cnpj}
                    onChange={e => { setCnpj(maskCNPJ(e.target.value)); setDocError(''); }}
                    inputMode="numeric"
                  />
                </Field>
                <Field label="Nome do responsável">
                  <TextInput
                    placeholder="Responsável legal"
                    value={responsibleName}
                    onChange={e => setResponsibleName(e.target.value)}
                  />
                </Field>
              </>
            )}

            <Field label="Telefone">
              <TextInput
                placeholder="(00) 00000-0000"
                value={phone}
                onChange={e => setPhone(maskPhone(e.target.value))}
                inputMode="tel"
              />
            </Field>
          </div>
        )}

        {/* ── Step 2 ── */}
        {step === 2 && (
          <div className="rounded-2xl shadow-sm bg-white p-5 flex flex-col gap-4">
            <Field label="CEP">
              <div className="flex gap-2">
                <TextInput
                  placeholder="00000-000"
                  value={cep}
                  onChange={e => setCep(maskCEP(e.target.value))}
                  inputMode="numeric"
                  className="flex-1"
                />
                <button
                  onClick={handleFetchCEP}
                  disabled={cepLoading}
                  className="px-4 py-3 bg-primary text-white rounded-xl text-sm font-semibold flex items-center gap-1 disabled:opacity-60"
                >
                  {cepLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                  Buscar
                </button>
              </div>
            </Field>

            <Field label="Rua">
              <TextInput
                placeholder="Logradouro"
                value={street}
                onChange={e => setStreet(e.target.value)}
              />
            </Field>

            <div className="flex gap-3">
              <Field label="Número">
                <TextInput
                  placeholder="Nº"
                  value={number}
                  onChange={e => setNumber(e.target.value)}
                  className="w-28"
                />
              </Field>
              <Field label="Complemento (opcional)">
                <TextInput
                  placeholder="Apto, sala..."
                  value={complement}
                  onChange={e => setComplement(e.target.value)}
                />
              </Field>
            </div>

            <Field label="Bairro">
              <TextInput
                placeholder="Bairro"
                value={neighborhood}
                onChange={e => setNeighborhood(e.target.value)}
              />
            </Field>

            <div className="flex gap-3">
              <div className="flex-1">
                <Field label="Cidade">
                  <TextInput
                    placeholder="Cidade"
                    value={city}
                    onChange={e => setCity(e.target.value)}
                  />
                </Field>
              </div>
              <div className="w-20">
                <Field label="UF">
                  <TextInput
                    placeholder="MG"
                    value={addressState}
                    onChange={e => setAddressState(e.target.value.toUpperCase().slice(0, 2))}
                    maxLength={2}
                  />
                </Field>
              </div>
            </div>

            <Field label="Ponto de referência (opcional)">
              <TextInput
                placeholder="Ex: próximo ao mercado"
                value={reference}
                onChange={e => setReference(e.target.value)}
              />
            </Field>

            <Field label="Label do endereço">
              <TextInput
                placeholder="Ex: Loja Centro"
                value={addressLabel}
                onChange={e => setAddressLabel(e.target.value)}
              />
            </Field>
          </div>
        )}

        {/* ── Step 3 ── */}
        {step === 3 && (
          <div className="rounded-2xl shadow-sm bg-white p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-700 text-sm">Configurar horários de funcionamento</span>
              <button
                onClick={() => setConfigHours(v => !v)}
                className={`relative w-12 h-6 rounded-full transition-colors ${configHours ? 'bg-primary' : 'bg-gray-300'}`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${configHours ? 'translate-x-6' : 'translate-x-0.5'}`}
                />
              </button>
            </div>

            {!configHours && (
              <p className="text-sm text-gray-400">Você pode configurar os horários depois no perfil do estabelecimento.</p>
            )}

            {configHours && (
              <div className="flex flex-col gap-3 mt-1">
                {ALL_DAYS.map(day => (
                  <div key={day} className={`rounded-xl border p-3 flex flex-col gap-2 transition-all ${hours[day].enabled ? 'border-primary/30 bg-primary/5' : 'border-gray-100 bg-gray-50'}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-gray-700">{DAY_LABELS[day]}</span>
                      <button
                        onClick={() => toggleDay(day)}
                        className={`relative w-10 h-5 rounded-full transition-colors ${hours[day].enabled ? 'bg-primary' : 'bg-gray-300'}`}
                      >
                        <span
                          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${hours[day].enabled ? 'translate-x-5' : 'translate-x-0.5'}`}
                        />
                      </button>
                    </div>
                    {hours[day].enabled && (
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-primary" />
                        <input
                          type="time"
                          value={hours[day].open}
                          onChange={e => setDayTime(day, 'open', e.target.value)}
                          className="border border-gray-200 rounded-lg px-2 py-1 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-primary/40"
                        />
                        <span className="text-gray-400 text-sm">até</span>
                        <input
                          type="time"
                          value={hours[day].close}
                          onChange={e => setDayTime(day, 'close', e.target.value)}
                          className="border border-gray-200 rounded-lg px-2 py-1 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-primary/40"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Step 4 ── */}
        {step === 4 && (
          <div className="rounded-2xl shadow-sm bg-white p-5 flex flex-col gap-5">
            <p className="text-sm text-gray-500">Leia e aceite os termos abaixo para concluir seu cadastro.</p>

            {[
              { value: term1, set: setTerm1, label: 'Aceito os Termos de Uso da plataforma Levei.ai' },
              { value: term2, set: setTerm2, label: 'Aceito a Política de Privacidade e tratamento de dados' },
              { value: term3, set: setTerm3, label: 'Declaro responsabilidade pelos itens enviados nas entregas' },
            ].map((t, i) => (
              <button
                key={i}
                onClick={() => t.set(v => !v)}
                className="flex items-start gap-3 text-left"
              >
                <div className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all
                  ${t.value ? 'bg-primary border-primary' : 'border-gray-300 bg-white'}`}>
                  {t.value && <Check className="w-3 h-3 text-white" />}
                </div>
                <span className="text-sm text-gray-700 leading-snug">{t.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* ── Navigation buttons ── */}
        <div className="flex gap-3 mt-6">
          {step > 1 && (
            <button
              onClick={() => setStep(s => s - 1)}
              disabled={loading}
              className="flex items-center gap-1 px-5 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold text-sm bg-white"
            >
              <ChevronLeft className="w-4 h-4" /> Voltar
            </button>
          )}

          {step < 4 ? (
            <button
              onClick={handleNext}
              disabled={!canProceed(step)}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-white font-semibold text-sm disabled:opacity-50"
            >
              Continuar <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!canProceed(4) || loading}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-white font-semibold text-sm disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {loading ? 'Salvando...' : 'Concluir cadastro'}
            </button>
          )}
        </div>
      </div>

      {/* Safe area bottom spacer */}
      <div className="pb-safe-bottom" />
    </div>
  );
}
