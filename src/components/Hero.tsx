import { useNavigate } from "react-router-dom";
import { ArrowRight, Bike, Store, Zap, Shield, Clock, MapPin, Star } from "lucide-react";
import leveiLogo from "@/assets/levei-logo.png";

const Hero = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-white">

      {/* ── Hero principal ── */}
      <div className="relative flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-primary via-primary/95 to-primary/80 px-6 pt-24 pb-16 overflow-hidden">
        {/* Background dots */}
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '28px 28px' }}
        />

        {/* Floating pills */}
        <div className="absolute top-28 left-4 flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5 hidden sm:flex">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-white/90 text-xs font-medium">12 motoboys online</span>
        </div>
        <div className="absolute top-28 right-4 flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5 hidden sm:flex">
          <Star className="h-3 w-3 text-yellow-300 fill-yellow-300" />
          <span className="text-white/90 text-xs font-medium">4.9 avaliação</span>
        </div>

        {/* Logo */}
        <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-xl mb-6 relative z-10">
          <img src={leveiLogo} alt="Levei.ai" className="w-full h-full object-cover" />
        </div>

        {/* Badge */}
        <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/25 rounded-full px-4 py-1.5 mb-5 relative z-10">
          <Zap className="w-3.5 h-3.5 text-yellow-300" />
          <span className="text-white text-xs font-semibold">Entregas sob demanda · BH e região</span>
        </div>

        {/* Heading */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white text-center leading-tight max-w-lg relative z-10">
          Sua entrega,<br />
          <span className="text-yellow-300">no tempo certo.</span>
        </h1>

        <p className="text-white/70 text-sm sm:text-base text-center mt-4 max-w-sm leading-relaxed relative z-10">
          Conectamos motoboys verificados a quem precisa entregar. Rastreamento em tempo real, pagamento seguro.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs mt-8 relative z-10">
          <button
            onClick={() => navigate('/auth')}
            className="flex-1 flex items-center justify-center gap-2 bg-white text-primary font-bold py-3.5 px-6 rounded-2xl shadow-lg active:scale-95 transition-transform text-sm"
          >
            <Store className="w-4 h-4" />
            Quero enviar
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate('/auth')}
            className="flex-1 flex items-center justify-center gap-2 bg-white/15 border border-white/30 text-white font-bold py-3.5 px-6 rounded-2xl active:scale-95 transition-transform text-sm"
          >
            <Bike className="w-4 h-4" />
            Sou motoboy
          </button>
        </div>

        {/* Social proof */}
        <div className="flex items-center gap-4 mt-8 relative z-10">
          <div className="flex -space-x-2">
            {['#6366f1','#22c55e','#f59e0b','#ef4444'].map((c, i) => (
              <div key={i} className="w-7 h-7 rounded-full border-2 border-primary/80 flex items-center justify-center text-white text-[10px] font-bold" style={{ background: c }}>
                {['A','M','R','J'][i]}
              </div>
            ))}
          </div>
          <div>
            <div className="flex items-center gap-1">
              {[1,2,3,4,5].map(i => <Star key={i} className="h-3 w-3 text-yellow-300 fill-yellow-300" />)}
            </div>
            <p className="text-white/60 text-[10px] mt-0.5">+200 entregas realizadas</p>
          </div>
        </div>
      </div>

      {/* ── Features strip ── */}
      <div className="bg-white px-6 py-8">
        <div className="max-w-lg mx-auto">
          <p className="text-center text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-6">
            Por que usar o Levei
          </p>
          <div className="grid grid-cols-3 gap-4">
            {[
              { icon: Zap,    bg: 'bg-primary/10',  color: 'text-primary',  title: 'Rápido',   sub: 'Motoboy em minutos' },
              { icon: Shield, bg: 'bg-green-100',   color: 'text-green-600', title: 'Seguro',  sub: 'Entregadores verificados' },
              { icon: MapPin, bg: 'bg-amber-100',   color: 'text-amber-600', title: 'Rastreio',sub: 'Veja em tempo real' },
            ].map(({ icon: Icon, bg, color, title, sub }) => (
              <div key={title} className="flex flex-col items-center text-center gap-2">
                <div className={`w-11 h-11 rounded-xl ${bg} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <p className="text-xs font-bold text-gray-900">{title}</p>
                <p className="text-[10px] text-gray-500 leading-tight">{sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom CTA ── */}
      <div className="bg-gray-50 border-t border-gray-100 px-6 py-6">
        <div className="max-w-sm mx-auto text-center">
          <p className="text-xs text-gray-400 mb-3">
            Já tem uma conta?{' '}
            <button
              onClick={() => navigate('/auth')}
              className="text-primary font-semibold"
            >
              Entrar agora
            </button>
          </p>
          <div className="flex items-center justify-center gap-4 text-[10px] text-gray-400">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Disponível 24h</span>
            <span>·</span>
            <span className="flex items-center gap-1"><Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />4.9 de satisfação</span>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Hero;
