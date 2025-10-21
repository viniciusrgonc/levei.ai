import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Bike, Store } from "lucide-react";
import heroImage from "@/assets/hero-delivery.jpg";

const Hero = () => {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.1),transparent_50%),radial-gradient(circle_at_70%_80%,hsl(var(--secondary)/0.1),transparent_50%)]" />
      
      <div className="container mx-auto px-4 py-32 relative z-10">
        <div className="max-w-5xl mx-auto text-center space-y-10 animate-fade-in">
          <div className="inline-flex items-center gap-2 bg-card border border-border rounded-full px-6 py-3 shadow-lg backdrop-blur-sm">
            <Bike className="w-5 h-5 text-primary" />
            <span className="text-sm font-semibold text-foreground">Plataforma de Entregas Autônomas</span>
          </div>
          
          <h1 className="text-6xl md:text-8xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-primary via-primary to-secondary bg-clip-text text-transparent">
              Movvi
            </span>
          </h1>
          
          <p className="text-2xl md:text-3xl text-foreground/80 max-w-3xl mx-auto font-medium leading-relaxed">
            Conectando motoboys autônomos com restaurantes e lojas para entregas mais rápidas e eficientes
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
            <Button 
              size="lg" 
              className="h-14 px-8 text-lg font-semibold shadow-elevated hover:shadow-glow transition-all"
              onClick={() => navigate('/auth')}
            >
              Cadastrar como Motoboy
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              className="h-14 px-8 text-lg font-semibold border-2 hover:bg-accent hover:border-accent hover:text-accent-foreground transition-all"
              onClick={() => navigate('/auth')}
            >
              <Store className="w-5 h-5 mr-2" />
              Sou Estabelecimento
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
