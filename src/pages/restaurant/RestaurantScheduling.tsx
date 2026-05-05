import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/integrations/supabase/client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/hooks/use-toast'
import NotificationBell from '@/components/NotificationBell'
import { BottomNav } from '@/components/BottomNav'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft, CalendarClock, Plus, Zap, Clock, MapPin,
  ChevronRight, Loader2, CalendarDays, AlertCircle, Package,
} from 'lucide-react'
import { formatAddress } from '@/lib/utils'

type ScheduledDelivery = {
  id: string
  scheduled_at: string
  pickup_address: string
  delivery_address: string
  price_adjusted: number
  price: number
  distance_km: number
  vehicle_category: string | null
  product_type: string | null
  recipient_name: string | null
  status: string
}

async function fetchScheduled(restaurantId: string): Promise<ScheduledDelivery[]> {
  const { data, error } = await supabase
    .from('deliveries')
    .select('id, scheduled_at, pickup_address, delivery_address, price_adjusted, price, distance_km, vehicle_category, product_type, recipient_name, status')
    .eq('restaurant_id', restaurantId)
    .eq('status', 'scheduled')
    .order('scheduled_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as ScheduledDelivery[]
}

// ── helpers ───────────────────────────────────────────────────────────────

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function formatDateLong(date: Date) {
  return date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

// ── Component ─────────────────────────────────────────────────────────────

export default function RestaurantScheduling() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [publishing, setPublishing] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState<string | null>(null)

  // ── resolve restaurantId ──────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    supabase.from('restaurants').select('id').eq('user_id', user.id).single()
      .then(({ data }) => {
        if (data) setRestaurantId(data.id)
      })
  }, [user])

  // ── fetch scheduled deliveries ────────────────────────────────────────
  const { data: deliveries = [], isLoading } = useQuery<ScheduledDelivery[]>({
    queryKey: ['scheduled-deliveries', restaurantId],
    queryFn: () => fetchScheduled(restaurantId!),
    enabled: !!restaurantId,
    staleTime: 30 * 1000,
  })

  // ── realtime ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!restaurantId) return
    const channel = supabase
      .channel(`scheduled-rt-${restaurantId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'deliveries',
        filter: `restaurant_id=eq.${restaurantId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['scheduled-deliveries', restaurantId] })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [restaurantId, queryClient])

  // ── Datas com entregas agendadas (para dots no calendário) ────────────
  const datesWithDeliveries = new Set(
    deliveries.map(d => {
      const dt = new Date(d.scheduled_at)
      return `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`
    })
  )

  // ── Entregas do dia selecionado ───────────────────────────────────────
  const deliveriesForDay = deliveries.filter(d =>
    isSameDay(new Date(d.scheduled_at), selectedDate)
  )

  // ── Publicar agora ────────────────────────────────────────────────────
  const handlePublish = async (delivery: ScheduledDelivery) => {
    setPublishing(delivery.id)
    try {
      const { error } = await supabase
        .from('deliveries')
        .update({ status: 'pending' as any, scheduled_at: null })
        .eq('id', delivery.id)
      if (error) throw error
      toast({ title: '🚀 Entrega publicada!', description: 'Motoboys já podem ver e aceitar.' })
      queryClient.invalidateQueries({ queryKey: ['scheduled-deliveries', restaurantId] })
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro ao publicar', description: err?.message })
    } finally {
      setPublishing(null)
    }
  }

  // ── Cancelar ─────────────────────────────────────────────────────────
  const handleCancel = async (delivery: ScheduledDelivery) => {
    if (!confirm('Cancelar esta entrega agendada? O saldo será devolvido.')) return
    setCancelling(delivery.id)
    try {
      // Tenta estornar os fundos bloqueados
      await supabase.rpc('refund_delivery_funds', { p_delivery_id: delivery.id })
      toast({ title: 'Entrega cancelada', description: 'Saldo estornado à sua carteira.' })
      queryClient.invalidateQueries({ queryKey: ['scheduled-deliveries', restaurantId] })
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro ao cancelar', description: err?.message })
    } finally {
      setCancelling(null)
    }
  }

  // ── Calendar helpers ──────────────────────────────────────────────────
  const { year, month } = calendarMonth
  const firstDayOfMonth = new Date(year, month, 1).getDay() // 0=dom
  const totalDays = daysInMonth(year, month)
  const today = new Date()

  const prevMonth = () => setCalendarMonth(({ year, month }) =>
    month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 }
  )
  const nextMonth = () => setCalendarMonth(({ year, month }) =>
    month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 }
  )

  const monthLabel = new Date(year, month).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  // ── counts ────────────────────────────────────────────────────────────
  const totalCount = deliveries.length
  const nearestDelivery = deliveries[0] // já ordenado por scheduled_at

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">

      {/* Header */}
      <header className="sticky top-0 z-10 bg-primary text-white flex items-center gap-3 px-4 shadow-sm"
        style={{ minHeight: 56, paddingTop: 'env(safe-area-inset-top)' }}>
        <button onClick={() => navigate('/restaurant/dashboard')}
          className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
          <ArrowLeft className="h-5 w-5 text-white" />
        </button>
        <div className="flex-1">
          <h1 className="font-bold text-base">Agendamentos</h1>
          {totalCount > 0 && (
            <p className="text-xs text-white/70">{totalCount} entrega{totalCount !== 1 ? 's' : ''} agendada{totalCount !== 1 ? 's' : ''}</p>
          )}
        </div>
        <NotificationBell />
      </header>

      <main className="flex-1 overflow-auto pb-28">

        {/* ── KPI banner ─────────────────────────────────────────────── */}
        {nearestDelivery && (
          <div className="mx-4 mt-4 bg-indigo-600 rounded-2xl p-4 text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <Clock className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white/70">Próxima entrega</p>
              <p className="font-bold text-sm">
                {new Date(nearestDelivery.scheduled_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
              </p>
              <p className="text-xs text-white/70 truncate">{formatAddress(nearestDelivery.delivery_address)}</p>
            </div>
          </div>
        )}

        {/* ── Calendário ─────────────────────────────────────────────── */}
        <div className="mx-4 mt-4 bg-white rounded-2xl shadow-sm p-4">
          {/* Navegação de mês */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center">
              <ChevronRight className="h-4 w-4 text-gray-600 rotate-180" />
            </button>
            <span className="text-sm font-semibold text-gray-800 capitalize">{monthLabel}</span>
            <button onClick={nextMonth} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center">
              <ChevronRight className="h-4 w-4 text-gray-600" />
            </button>
          </div>

          {/* Cabeçalho dias da semana */}
          <div className="grid grid-cols-7 mb-1">
            {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
              <div key={i} className="text-center text-xs text-gray-400 font-medium py-1">{d}</div>
            ))}
          </div>

          {/* Grid de dias */}
          <div className="grid grid-cols-7 gap-y-1">
            {/* Células vazias antes do primeiro dia */}
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {/* Dias do mês */}
            {Array.from({ length: totalDays }).map((_, i) => {
              const day = i + 1
              const date = new Date(year, month, day)
              const key = `${year}-${month}-${day}`
              const hasDot = datesWithDeliveries.has(key)
              const isToday = isSameDay(date, today)
              const isSelected = isSameDay(date, selectedDate)
              const isPast = date < new Date(today.getFullYear(), today.getMonth(), today.getDate())

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDate(date)}
                  className={`relative flex flex-col items-center justify-center h-9 rounded-xl text-sm font-medium transition-all ${
                    isSelected
                      ? 'bg-indigo-600 text-white'
                      : isToday
                        ? 'bg-indigo-50 text-indigo-700 font-bold'
                        : isPast
                          ? 'text-gray-300'
                          : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {day}
                  {hasDot && (
                    <span className={`absolute bottom-1 w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-indigo-500'}`} />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Lista de entregas do dia selecionado ───────────────────── */}
        <div className="mx-4 mt-4">
          <h2 className="text-sm font-semibold text-gray-500 mb-3 capitalize">
            {formatDateLong(selectedDate)}
          </h2>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map(i => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
            </div>
          ) : deliveriesForDay.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
              <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
                <CalendarDays className="h-7 w-7 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-500">Nenhuma entrega agendada para este dia</p>
              <button
                onClick={() => navigate('/restaurant/new-delivery')}
                className="flex items-center gap-1.5 text-sm text-indigo-600 font-semibold"
              >
                <Plus className="h-4 w-4" />Agendar entrega
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {deliveriesForDay.map(d => {
                const price = d.price_adjusted || d.price
                const isPublishing = publishing === d.id
                const isCancelling = cancelling === d.id

                return (
                  <div key={d.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    {/* Hora + badge */}
                    <div className="flex items-center justify-between px-4 pt-4 pb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                          <Clock className="h-4 w-4 text-indigo-600" />
                        </div>
                        <span className="font-bold text-gray-900 text-base">
                          {formatTime(d.scheduled_at)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {d.product_type && (
                          <span className="text-xs text-gray-400">{d.product_type}</span>
                        )}
                        <Badge className="bg-indigo-100 text-indigo-700 border-none text-xs font-semibold">
                          Agendada
                        </Badge>
                      </div>
                    </div>

                    {/* Rota */}
                    <div className="px-4 pb-3 space-y-1.5">
                      <div className="flex items-start gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-400">Coleta</p>
                          <p className="text-sm text-gray-700 truncate">{formatAddress(d.pickup_address)}</p>
                        </div>
                      </div>
                      <div className="ml-1 border-l-2 border-dashed border-gray-200 h-3" />
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-400">Entrega</p>
                          <p className="text-sm text-gray-700 truncate">{formatAddress(d.delivery_address)}</p>
                          {d.recipient_name && (
                            <p className="text-xs text-gray-400">Para: {d.recipient_name}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Infos + ações */}
                    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-50">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-gray-900">R$ {price.toFixed(2)}</span>
                        <span className="text-xs text-gray-400">{Number(d.distance_km).toFixed(1)} km</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCancel(d)}
                          disabled={isCancelling || isPublishing}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-40 transition-colors"
                        >
                          {isCancelling ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Cancelar'}
                        </button>
                        <button
                          onClick={() => handlePublish(d)}
                          disabled={isPublishing || isCancelling}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                        >
                          {isPublishing ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <><Zap className="h-3 w-3" />Publicar agora</>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Todas as agendadas (fora do dia selecionado) ───────────── */}
        {deliveries.length > 0 && (
          <div className="mx-4 mt-6">
            <h2 className="text-sm font-semibold text-gray-500 mb-3">Todas as agendadas</h2>
            <div className="space-y-2">
              {deliveries.map(d => {
                const dt = new Date(d.scheduled_at)
                const isSelected = isSameDay(dt, selectedDate)
                if (isSelected) return null // já aparecem acima
                return (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDate(dt)}
                    className="w-full flex items-center gap-3 bg-white rounded-xl px-4 py-3 shadow-sm text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                      <Package className="h-4 w-4 text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">
                        {dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} · {formatTime(d.scheduled_at)}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{formatAddress(d.delivery_address)}</p>
                    </div>
                    <span className="text-sm font-bold text-gray-700 flex-shrink-0">
                      R$ {(d.price_adjusted || d.price).toFixed(2)}
                    </span>
                    <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Aviso sobre ativação manual ────────────────────────────── */}
        {deliveries.length > 0 && (
          <div className="mx-4 mt-4 flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
            <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              <strong>Ativação manual:</strong> No horário agendado, use "Publicar agora" para disponibilizar a entrega aos motoboys.
            </p>
          </div>
        )}
      </main>

      {/* FAB — nova entrega agendada */}
      <button
        onClick={() => navigate('/restaurant/new-delivery')}
        className="fixed bottom-24 right-4 w-14 h-14 rounded-full bg-indigo-600 text-white shadow-lg flex items-center justify-center z-10 hover:bg-indigo-700 active:scale-95 transition-all"
        style={{ bottom: 'calc(80px + env(safe-area-inset-bottom))' }}
      >
        <Plus className="h-6 w-6" />
      </button>

      <BottomNav />
    </div>
  )
}
