import { Card } from "@/components/ui/card";
import { Clock, DollarSign, MapPin, Shield, Star, Smartphone } from "lucide-react";

const Benefits = () => {
  const driverBenefits = [
    {
      icon: DollarSign,
      title: "Ganhos Justos",
      description: "Receba de forma transparente por cada entrega realizada"
    },
    {
      icon: Clock,
      title: "Flexibilidade Total",
      description: "Escolha seus horários e áreas de atuação"
    },
    {
      icon: Star,
      title: "Avaliações",
      description: "Construa sua reputação e receba mais pedidos"
    }
  ];

  const storeBenefits = [
    {
      icon: MapPin,
      title: "Cobertura Ampla",
      description: "Acesso a uma rede de entregadores em toda cidade"
    },
    {
      icon: Shield,
      title: "Confiabilidade",
      description: "Entregas rastreadas e entregadores verificados"
    },
    {
      icon: Smartphone,
      title: "Gestão Fácil",
      description: "Plataforma intuitiva para gerenciar todas entregas"
    }
  ];

  return (
    <section className="py-24 px-4 bg-muted/30">
      <div className="container mx-auto">
        <div className="text-center mb-20 space-y-4">
          <h2 className="text-5xl md:text-6xl font-bold tracking-tight">Benefícios para Todos</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Uma plataforma pensada para atender ambos os lados
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-16 max-w-7xl mx-auto">
          <div className="space-y-8">
            <div className="inline-block">
              <h3 className="text-4xl font-bold text-primary mb-2">Para Entregadores</h3>
              <div className="h-1 w-20 bg-gradient-to-r from-primary to-primary/50 rounded-full" />
            </div>
            <div className="space-y-5">
              {driverBenefits.map((benefit, index) => (
                <Card 
                  key={index} 
                  className="p-7 bg-card shadow-card hover:shadow-elevated transition-all duration-300 border-l-4 border-l-primary hover:-translate-y-1"
                >
                  <div className="flex gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center flex-shrink-0 shadow-lg">
                      <benefit.icon className="w-7 h-7 text-primary-foreground" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-xl mb-2 text-foreground">{benefit.title}</h4>
                      <p className="text-muted-foreground leading-relaxed">{benefit.description}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          <div className="space-y-8">
            <div className="inline-block">
              <h3 className="text-4xl font-bold text-secondary mb-2">Para Estabelecimentos</h3>
              <div className="h-1 w-20 bg-gradient-to-r from-secondary to-secondary/50 rounded-full" />
            </div>
            <div className="space-y-5">
              {storeBenefits.map((benefit, index) => (
                <Card 
                  key={index} 
                  className="p-7 bg-card shadow-card hover:shadow-elevated transition-all duration-300 border-l-4 border-l-secondary hover:-translate-y-1"
                >
                  <div className="flex gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-secondary to-secondary/70 flex items-center justify-center flex-shrink-0 shadow-lg">
                      <benefit.icon className="w-7 h-7 text-secondary-foreground" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-xl mb-2 text-foreground">{benefit.title}</h4>
                      <p className="text-muted-foreground leading-relaxed">{benefit.description}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Benefits;
