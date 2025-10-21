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
      description: "Garantir a melhor experiência para motoboys e estabelecimentos"
    }
  ];

  return (
    <section className="py-20 px-4">
      <div className="container mx-auto">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold">Nossos Objetivos</h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Construindo o futuro das entregas com foco em pessoas e tecnologia
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {objectives.map((objective, index) => (
            <Card 
              key={index} 
              className="p-6 space-y-4 bg-card/50 backdrop-blur border-border hover:border-primary/50 transition-all hover:shadow-xl hover:-translate-y-1"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                <objective.icon className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">{objective.title}</h3>
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
