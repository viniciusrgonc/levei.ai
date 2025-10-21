import { Card } from "@/components/ui/card";
import { TrendingUp, Users, Zap } from "lucide-react";

const BusinessModel = () => {
  return (
    <section className="py-20 px-4">
      <div className="container mx-auto">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold">Modelo de Negócio</h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Uma plataforma que revoluciona o mercado de entregas conectando os dois lados do ecossistema
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <Card className="p-8 space-y-6 bg-card/50 backdrop-blur border-primary/10 hover:border-primary/30 transition-all hover:shadow-lg hover:shadow-primary/10">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <Users className="w-7 h-7 text-primary-foreground" />
            </div>
            <div>
              <h3 className="text-2xl font-bold mb-3">Marketplace Bilateral</h3>
              <p className="text-muted-foreground leading-relaxed">
                Conectamos motoboys autônomos com estabelecimentos comerciais, criando um ecossistema eficiente e escalável
              </p>
            </div>
          </Card>
          
          <Card className="p-8 space-y-6 bg-card/50 backdrop-blur border-secondary/10 hover:border-secondary/30 transition-all hover:shadow-lg hover:shadow-secondary/10">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-secondary to-primary flex items-center justify-center">
              <TrendingUp className="w-7 h-7 text-secondary-foreground" />
            </div>
            <div>
              <h3 className="text-2xl font-bold mb-3">Comissão por Entrega</h3>
              <p className="text-muted-foreground leading-relaxed">
                Modelo de receita baseado em percentual sobre cada entrega realizada através da plataforma
              </p>
            </div>
          </Card>
          
          <Card className="p-8 space-y-6 bg-card/50 backdrop-blur border-accent/10 hover:border-accent/30 transition-all hover:shadow-lg hover:shadow-accent/10">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent to-primary flex items-center justify-center">
              <Zap className="w-7 h-7 text-accent-foreground" />
            </div>
            <div>
              <h3 className="text-2xl font-bold mb-3">Autonomia Total</h3>
              <p className="text-muted-foreground leading-relaxed">
                Motoboys trabalham de forma independente, escolhendo horários e entregas conforme disponibilidade
              </p>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default BusinessModel;
