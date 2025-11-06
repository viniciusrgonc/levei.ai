import { Bike } from "lucide-react";

const Footer = () => {
  return (
    <footer className="border-t border-border bg-card/30 backdrop-blur">
      <div className="container mx-auto px-4 py-12">
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <Bike className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Movvi
            </span>
          </div>
          
          <p className="text-muted-foreground max-w-md">
            Conectando entregadores e solicitantes para entregas mais eficientes
          </p>
          
          <div className="text-sm text-muted-foreground">
            © 2025 Movvi. Todos os direitos reservados.
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
