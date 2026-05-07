import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/AdminSidebar';
import { AdminPageHeader } from '@/components/AdminPageHeader';
import {
  Gift, Search, Users, Award, Clock, CheckCircle2,
  Loader2, TrendingUp,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Referral {
  id: string;
  referral_code: string;
  status: 'pending' | 'validated' | 'rewarded';
  referred_deliveries: number;
  created_at: string;
  validated_at: string | null;
  rewarded_at:  string | null;
  referrer_name: string;
  referred_name: string;
}

const STATUS_NEEDED = 5; // deliveries needed to validate

// ── Status config ─────────────────────────────────────────────────────────────
const statusCfg: Record<string, { label: string; color: string; icon: any }> = {
  pending:   { label: 'Pendente',   color: 'bg-amber-100 text-amber-700',  icon: Clock },
  validated: { label: 'Validada',   color: 'bg-blue-100 text-blue-700',    icon: CheckCircle2 },
  rewarded:  { label: 'Premiada',   color: 'bg-green-100 text-green-700',  icon: Award },
};

// ── Query ─────────────────────────────────────────────────────────────────────
async function fetchReferrals(): Promise<Referral[]> {
  const { data, error } = await supabase
    .from('referrals')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;

  // enrich names from drivers -> profiles
  const enriched = await Promise.all(
    (data || []).map(async (r) => {
      // Referrer driver name
      const { data: refr } = await supabase
        .from('drivers')
        .select('profiles!drivers_user_id_fkey(full_name)')
        .eq('id', r.referrer_driver_id)
        .single();

      // Referred driver name
      const { data: refd } = await supabase
        .from('drivers')
        .select('profiles!drivers_user_id_fkey(full_name)')
        .eq('id', r.referred_driver_id)
        .single();

      return {
        ...r,
        referrer_name: (refr as any)?.profiles?.full_name ?? 'Desconhecido',
        referred_name: (refd as any)?.profiles?.full_name ?? 'Desconhecido',
      };
    })
  );
  return enriched as Referral[];
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function AdminReferrals() {
  const [search, setSearch]       = useState('');
  const [filterStatus, setFilter] = useState<'all' | 'pending' | 'validated' | 'rewarded'>('all');

  const { data: referrals = [], isLoading } = useQuery<Referral[]>({
    queryKey: ['admin-referrals'],
    queryFn:  fetchReferrals,
    staleTime: 60 * 1000,
  });

  // KPIs
  const total     = referrals.length;
  const pending   = referrals.filter(r => r.status === 'pending').length;
  const validated = referrals.filter(r => r.status === 'validated').length;
  const rewarded  = referrals.filter(r => r.status === 'rewarded').length;

  // Filter
  const filtered = referrals.filter((r) => {
    const matchStatus = filterStatus === 'all' || r.status === filterStatus;
    const q = search.toLowerCase();
    const matchSearch = !q
      || r.referrer_name.toLowerCase().includes(q)
      || r.referred_name.toLowerCase().includes(q)
      || r.referral_code.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gray-50">
        <AdminSidebar />

        <div className="flex-1 flex flex-col min-w-0">
          <AdminPageHeader title="Indicações" showBack showLogout />

          <main className="flex-1 p-6 overflow-auto">
            <div className="max-w-5xl mx-auto space-y-5">

              {/* ── KPI row ── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Total',      count: total,     color: 'primary', icon: Users,      status: 'all'       },
                  { label: 'Pendentes',  count: pending,   color: 'amber',   icon: Clock,      status: 'pending'   },
                  { label: 'Validadas',  count: validated, color: 'blue',    icon: TrendingUp, status: 'validated' },
                  { label: 'Premiadas',  count: rewarded,  color: 'green',   icon: Award,      status: 'rewarded'  },
                ].map(({ label, count, color, icon: Icon, status }) => (
                  <button
                    key={status}
                    onClick={() => setFilter(filterStatus === status ? 'all' : status as any)}
                    className={`bg-white rounded-2xl p-4 shadow-sm border-2 text-left transition-all ${
                      filterStatus === status ? `border-${color}-300` : 'border-transparent'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg bg-${color === 'primary' ? 'primary' : color}-100 flex items-center justify-center mb-2`}>
                      <Icon className={`h-4 w-4 text-${color === 'primary' ? 'primary' : `${color}-600`}`} />
                    </div>
                    <p className={`text-2xl font-bold text-${color === 'primary' ? 'primary' : `${color}-600`}`}>{count}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                  </button>
                ))}
              </div>

              {/* ── Search ── */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nome ou código..."
                  className="w-full h-11 pl-10 pr-4 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* ── Table ── */}
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">

                {/* Header */}
                <div className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-4 px-5 py-3 border-b border-gray-100">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Indicador</span>
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Indicado</span>
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Código</span>
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide text-center">Progresso</span>
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide text-center">Status</span>
                </div>

                {isLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="py-16 text-center">
                    <Gift className="h-10 w-10 mx-auto mb-3 text-gray-200" />
                    <p className="text-sm text-gray-400">Nenhuma indicação encontrada</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {filtered.map((r) => {
                      const cfg  = statusCfg[r.status] ?? statusCfg.pending;
                      const Icon = cfg.icon;
                      const pct  = Math.min((r.referred_deliveries / STATUS_NEEDED) * 100, 100);

                      return (
                        <div key={r.id} className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-4 px-5 py-4 items-center hover:bg-gray-50 transition-colors">

                          {/* Referrer */}
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{r.referrer_name}</p>
                            <p className="text-[11px] text-gray-400">
                              {new Date(r.created_at).toLocaleDateString('pt-BR')}
                            </p>
                          </div>

                          {/* Referred */}
                          <p className="text-sm text-gray-700 truncate">{r.referred_name}</p>

                          {/* Code */}
                          <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-lg whitespace-nowrap">
                            {r.referral_code}
                          </span>

                          {/* Progress */}
                          <div className="flex flex-col items-center gap-1 min-w-[72px]">
                            <div className="w-full h-1.5 rounded-full bg-gray-100">
                              <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <p className="text-[11px] text-gray-500">
                              {r.referred_deliveries}/{STATUS_NEEDED}
                            </p>
                          </div>

                          {/* Status */}
                          <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap ${cfg.color}`}>
                            <Icon className="h-3 w-3" />
                            {cfg.label}
                          </div>

                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
