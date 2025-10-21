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
      description: "Acesso a uma rede de motoboys em toda cidade"
    },
    {
      icon: Shield,
      title: "Confiabilidade",
      description: "Entregas rastreadas e motoboys verificados"
    },
    {
      icon: Smartphone,
      title: "Gestão Fácil",
      description: "Plataforma intuitiva para gerenciar todas entregas"
    }
  ];

  return (
    <section className="py-20 px-4 bg-gradient-to-b from-background to-card/30">
      <div className="container mx-auto">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold">Benefícios para Todos</h2>
          <p className="text-xl text-muted-foreground">
            Uma plataforma pensada para atender ambos os lados
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 max-w-6xl mx-auto">
          <div className="space-y-6">
            <h3 className="text-3xl font-bold text-primary">Para Motoboys</h3>
            <div className="space-y-4">
              {driverBenefits.map((benefit, index) => (
                <Card key={index} className="p-6 bg-card/80 backdrop-blur border-primary/20 hover:border-primary/40 transition-all">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <benefit.icon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-bold text-lg mb-1">{benefit.title}</h4>
                      <p className="text-muted-foreground">{benefit.description}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-3xl font-bold text-secondary">Para Estabelecimentos</h3>
            <div className="space-y-4">
              {storeBenefits.map((benefit, index) => (
                <Card key={index} className="p-6 bg-card/80 backdrop-blur border-secondary/20 hover:border-secondary/40 transition-all">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center flex-shrink-0">
                      <benefit.icon className="w-6 h-6 text-secondary" />
                    </div>
                    <div>
                      <h4 className="font-bold text-lg mb-1">{benefit.title}</h4>
                      <p className="text-muted-foreground">{benefit.description}</p>
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
