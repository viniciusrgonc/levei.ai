import leveiLogo from '@/assets/levei-logo.png';

const Footer = () => {
  return (
    <footer className="border-t border-border bg-card/50">
      <div className="container mx-auto px-6 py-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <img src={leveiLogo} alt="Levei.ai" className="h-10 w-auto" />
          
          <p className="text-sm text-muted-foreground max-w-md">
            Entregas sob demanda
          </p>
          
          <div className="text-xs text-muted-foreground">
            © 2025 Levei. Todos os direitos reservados.
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;