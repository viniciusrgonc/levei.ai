import { Card } from "@/components/ui/card";
import { Target, Rocket, Globe, Heart } from "lucide-react";

const Objectives = () => {
  const objectives = [
    {
      icon: Target,
      title: "Eficiência no Delivery",
      description: "Otimizar o processo de entregas para todos os envolvidos"
    },
    {
      icon: Rocket,
      title: "Escalabilidade",
      description: "Crescer de forma sustentável em diferentes regiões"
    },
    {
      icon: Globe,
      title: "Impacto Social",
      description: "Gerar oportunidades de trabalho autônomo e flexível"
    },
    {
      icon: Heart,
      title: "Satisfação Total",
      description: "Garantir a melhor experiência para entregadores e solicitantes"
    }
  ];

  return (
    <section className="py-24 px-4 bg-muted/30">
      <div className="container mx-auto">
        <div className="text-center mb-20 space-y-4">
          <h2 className="text-5xl md:text-6xl font-bold tracking-tight">Nossos Objetivos</h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Construindo o futuro das entregas com foco em pessoas e tecnologia
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
          {objectives.map((objective, index) => (
            <Card 
              key={index} 
              className="p-8 space-y-5 bg-card shadow-card hover:shadow-elevated border-2 hover:border-primary/40 transition-all duration-300 hover:-translate-y-2 group"
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <objective.icon className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-bold mb-3">{objective.title}</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {objective.description}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Objectives;
