import { useState, useEffect, useRef } from 'react';
import { MapPin, Package, Navigation, Clock, X, Check, Zap } from 'lucide-react';

const TIMER_SECONDS = 10;

interface Delivery {
  id: string;
  pickup_address: string;
  delivery_address: string;
  distance_km: number | string;
  price: number | string;
  price_adjusted?: number | string | null;
  product_type?: string | null;
  requires_return?: boolean;
}

interface Props {
  delivery: Delivery;
  onAccept: () => void;
  onDecline: () => void;
  accepting?: boolean;
}

// ── Web Audio notification sound ───────────────────────────────────────────
function playNotificationSound() {
  try {
    const ctx = new AudioContext();
    const notes = [880, 1100, 1320];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = ctx.currentTime + i * 0.12;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
      osc.start(start);
      osc.stop(start + 0.18);
    });
  } catch {
    // silently fail if AudioContext blocked
  }
}

function vibrate() {
  try {
    if ('vibrate' in navigator) navigator.vibrate([150, 80, 150, 80, 200]);
  } catch { /* noop */ }
}

// ── Component ──────────────────────────────────────────────────────────────
export function DeliveryNotificationCard({ delivery, onAccept, onDecline, accepting }: Props) {
  const [visible, setVisible] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartX = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dismissedRef = useRef(false);

  const price = Number(delivery.price_adjusted || delivery.price);
  const distanceKm = Number(delivery.distance_km);
  const estMin = Math.ceil(distanceKm * 3);
  const progress = (timeLeft / TIMER_SECONDS) * 100;

  // Slide in + sound + vibrate on mount
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    playNotificationSound();
    vibrate();
    return () => cancelAnimationFrame(raf);
  }, []);

  // Countdown
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleDismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, []);

  const handleDismiss = () => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    clearInterval(timerRef.current!);
    setVisible(false);
    setTimeout(onDecline, 380);
  };

  const handleAccept = () => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    clearInterval(timerRef.current!);
    setVisible(false);
    setDragX(0);
    setTimeout(onAccept, 200);
  };

  // ── Swipe to accept ────────────────────────────────────────────────────
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    setIsDragging(true);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const delta = e.touches[0].clientX - touchStartX.current;
    setDragX(Math.max(0, Math.min(delta, 160)));
  };

  const onTouchEnd = () => {
    setIsDragging(false);
    if (dragX > 90) {
      handleAccept();
    } else {
      setDragX(0);
    }
  };

  // Timer color: green → amber → red
  const timerColor =
    timeLeft > 6 ? '#22c55e' : timeLeft > 3 ? '#f59e0b' : '#ef4444';

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-300 pointer-events-auto ${
          visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(3px)' }}
        onClick={handleDismiss}
      />

      {/* Card */}
      <div
        className="fixed left-0 right-0 z-50 pointer-events-auto"
        style={{
          bottom: 'calc(env(safe-area-inset-bottom) + 72px)',
          transform: visible
            ? `translateY(0) translateX(${dragX}px)`
            : 'translateY(110%)',
          transition: isDragging
            ? 'none'
            : `transform ${visible ? '380ms' : '320ms'} cubic-bezier(0.34,1.56,0.64,1)`,
          opacity: visible ? 1 : 0,
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="mx-3 bg-white rounded-3xl overflow-hidden shadow-2xl border border-gray-100">

          {/* Timer bar */}
          <div className="h-1.5 bg-gray-100">
            <div
              style={{
                height: '100%',
                width: `${progress}%`,
                background: timerColor,
                transition: 'width 1s linear, background 0.5s ease',
                borderRadius: '0 4px 4px 0',
              }}
            />
          </div>

          {/* Header: tipo + valor + timer */}
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Zap className="h-5 w-5 text-primary fill-primary" />
              </div>
              <div>
                <p className="text-[11px] text-primary font-bold uppercase tracking-wide">
                  Nova entrega!
                </p>
                <p className="text-sm font-semibold text-gray-800 leading-tight">
                  {delivery.product_type || 'Entrega'}
                  {delivery.requires_return && (
                    <span className="ml-1.5 text-[10px] font-semibold text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded-full">
                      ↩ retorno
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-primary leading-none">
                R$ {price.toFixed(2)}
              </p>
              <p
                className="text-xs font-semibold mt-0.5 transition-colors"
                style={{ color: timerColor }}
              >
                {timeLeft}s restantes
              </p>
            </div>
          </div>

          {/* Pills */}
          <div className="flex gap-2 px-5 pb-2">
            <div className="flex items-center gap-1.5 bg-gray-100 rounded-full px-3 py-1.5">
              <Navigation className="h-3 w-3 text-gray-500" />
              <span className="text-xs text-gray-600 font-semibold">
                {distanceKm.toFixed(1)} km
              </span>
            </div>
            <div className="flex items-center gap-1.5 bg-gray-100 rounded-full px-3 py-1.5">
              <Clock className="h-3 w-3 text-gray-500" />
              <span className="text-xs text-gray-600 font-semibold">~{estMin} min</span>
            </div>
          </div>

          {/* Addresses */}
          <div className="px-5 pb-3 space-y-2.5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <Package className="h-4 w-4 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">Coleta</p>
                <p className="text-sm text-gray-800 truncate">{delivery.pickup_address}</p>
              </div>
            </div>
            <div className="ml-4 w-px h-3 bg-gray-200 ml-[15px]" />
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <MapPin className="h-4 w-4 text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">Entrega</p>
                <p className="text-sm text-gray-800 truncate">{delivery.delivery_address}</p>
              </div>
            </div>
          </div>

          {/* Swipe hint */}
          {dragX === 0 && (
            <p className="text-center text-[11px] text-gray-400 pb-1">
              ← deslize para aceitar →
            </p>
          )}
          {dragX > 0 && (
            <p className="text-center text-[11px] text-primary font-semibold pb-1">
              {dragX > 70 ? '✓ Solte para aceitar!' : 'Continue deslizando →'}
            </p>
          )}

          {/* Buttons */}
          <div className="flex gap-3 px-4 pb-5 pt-1">
            <button
              onClick={handleDismiss}
              className="flex-1 h-12 rounded-2xl border-2 border-gray-200 text-gray-500 font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              <X className="h-4 w-4" />
              Recusar
            </button>
            <button
              onClick={handleAccept}
              disabled={accepting}
              style={{ flex: 2 }}
              className="h-12 rounded-2xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60 shadow-lg shadow-primary/30"
            >
              <Check className="h-4 w-4" />
              {accepting ? 'Aceitando...' : 'Aceitar'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
