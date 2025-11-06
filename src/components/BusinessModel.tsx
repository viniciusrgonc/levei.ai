import { Card } from "@/components/ui/card";
import { TrendingUp, Users, Zap } from "lucide-react";

const BusinessModel = () => {
  return (
    <section className="py-24 px-4">
      <div className="container mx-auto">
        <div className="text-center mb-20 space-y-4">
          <h2 className="text-5xl md:text-6xl font-bold tracking-tight">Modelo de Negócio</h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Uma plataforma que revoluciona o mercado de entregas conectando os dois lados do ecossistema
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8 max-w-7xl mx-auto">
          <Card className="p-10 space-y-6 bg-card shadow-elevated hover:shadow-glow border-2 hover:border-primary/30 transition-all duration-300 hover:-translate-y-2 group">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <Users className="w-8 h-8 text-primary-foreground" />
            </div>
            <div>
              <h3 className="text-2xl font-bold mb-4">Marketplace Bilateral</h3>
              <p className="text-muted-foreground leading-relaxed text-lg">
                Conectamos entregadores autônomos com estabelecimentos comerciais, criando um ecossistema eficiente e escalável
              </p>
            </div>
          </Card>
          
          <Card className="p-10 space-y-6 bg-card shadow-elevated hover:shadow-glow border-2 hover:border-secondary/30 transition-all duration-300 hover:-translate-y-2 group">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-secondary to-secondary/70 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <TrendingUp className="w-8 h-8 text-secondary-foreground" />
            </div>
            <div>
              <h3 className="text-2xl font-bold mb-4">Comissão por Entrega</h3>
              <p className="text-muted-foreground leading-relaxed text-lg">
                Modelo de receita baseado em percentual sobre cada entrega realizada através da plataforma
              </p>
            </div>
          </Card>
          
          <Card className="p-10 space-y-6 bg-card shadow-elevated hover:shadow-glow border-2 hover:border-accent/30 transition-all duration-300 hover:-translate-y-2 group">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-accent/70 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <Zap className="w-8 h-8 text-accent-foreground" />
            </div>
            <div>
              <h3 className="text-2xl font-bold mb-4">Autonomia Total</h3>
              <p className="text-muted-foreground leading-relaxed text-lg">
                Entregadores trabalham de forma independente, escolhendo horários e entregas conforme disponibilidade
              </p>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default BusinessModel;
