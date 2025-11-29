import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Bike, Store } from "lucide-react";
import heroImage from "@/assets/hero-delivery.jpg";

const Hero = () => {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-screen flex items-center justify-center pt-20 bg-background">
      <div className="container mx-auto px-6 py-24 relative z-10">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 border border-border rounded-lg px-4 py-2">
            <Bike className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-muted-foreground">Plataforma de Entregas Autônomas</span>
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-foreground">
            Conecte entregadores e solicitantes em uma plataforma simples
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Sistema objetivo e profissional para gestão de entregas. Transparência, eficiência e controle total.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center pt-6">
            <Button 
              size="lg" 
              className="h-[46px] px-6 text-sm font-medium"
              onClick={() => navigate('/auth')}
            >
              Cadastrar como Entregador
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              className="h-[46px] px-6 text-sm font-medium"
              onClick={() => navigate('/auth')}
            >
              <Store className="w-4 h-4 mr-2" />
              Sou Solicitante
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-16 max-w-3xl mx-auto">
            <div className="text-center space-y-2">
              <div className="text-3xl font-bold text-primary">20%</div>
              <div className="text-sm text-muted-foreground">Taxa da plataforma</div>
            </div>
            <div className="text-center space-y-2">
              <div className="text-3xl font-bold text-primary">80%</div>
              <div className="text-sm text-muted-foreground">Para o entregador</div>
            </div>
            <div className="text-center space-y-2">
              <div className="text-3xl font-bold text-primary">100%</div>
              <div className="text-sm text-muted-foreground">Transparente</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
