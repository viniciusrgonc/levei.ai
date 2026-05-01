import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Bike, Store, Zap, Shield, Clock } from "lucide-react";

const Hero = () => {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-screen flex items-center justify-center pt-16 bg-background overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.04),transparent_50%),radial-gradient(circle_at_70%_80%,hsl(var(--primary)/0.03),transparent_50%)]" />
      
      <div className="container mx-auto px-6 py-16 md:py-24 relative z-10">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 border border-border bg-card rounded-full px-4 py-2 shadow-xs animate-fade-in">
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Entregas sob demanda</span>
          </div>
          
          {/* Heading */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-foreground animate-fade-in" style={{ animationDelay: '100ms' }}>
            Conecte entregadores e{' '}
            <span className="text-gradient">solicitantes</span>
            {' '}em uma plataforma simples
          </h1>
          
          {/* Description */}
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed animate-fade-in" style={{ animationDelay: '200ms' }}>
            Sistema objetivo e profissional para gestão de entregas. Transparência, eficiência e controle total.
          </p>
          
          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center pt-4 animate-fade-in" style={{ animationDelay: '300ms' }}>
            <Button 
              size="lg" 
              className="w-full sm:w-auto min-w-[200px]"
              onClick={() => navigate('/auth')}
            >
              <Bike className="w-4 h-4" />
              Sou Entregador
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              className="w-full sm:w-auto min-w-[200px]"
              onClick={() => navigate('/auth')}
            >
              <Store className="w-4 h-4" />
              Sou Solicitante
            </Button>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-12 animate-fade-in" style={{ animationDelay: '400ms' }}>
            <div className="flex flex-col items-center gap-3 p-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">Rápido</h3>
              <p className="text-sm text-muted-foreground text-center">Entregas ágeis com rastreamento em tempo real</p>
            </div>
            <div className="flex flex-col items-center gap-3 p-4">
              <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                <Shield className="w-6 h-6 text-success" />
              </div>
              <h3 className="font-semibold text-foreground">Seguro</h3>
              <p className="text-sm text-muted-foreground text-center">Entregadores verificados e pagamento protegido</p>
            </div>
            <div className="flex flex-col items-center gap-3 p-4">
              <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center">
                <Clock className="w-6 h-6 text-warning" />
              </div>
              <h3 className="font-semibold text-foreground">24/7</h3>
              <p className="text-sm text-muted-foreground text-center">Disponível a qualquer hora do dia</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;