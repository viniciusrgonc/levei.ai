import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { LogIn, UserPlus } from 'lucide-react';
import Hero from "@/components/Hero";
import leveiLogo from '@/assets/levei-logo.png';

const Index = () => {
  const { user, loading, roleLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !roleLoading && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, loading, roleLoading, navigate]);

  if (loading || (user && roleLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <img src={leveiLogo} alt="Levei.ai" className="h-16 w-auto animate-pulse-soft" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={leveiLogo} alt="Levei.ai" className="h-10 w-auto" />
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/auth')}
            >
              <LogIn className="w-4 h-4" />
              <span className="hidden sm:inline">Entrar</span>
            </Button>
            <Button 
              size="sm"
              onClick={() => navigate('/auth')}
            >
              <UserPlus className="w-4 h-4" />
              <span className="hidden sm:inline">Cadastrar</span>
            </Button>
          </div>
        </div>
      </header>
      <Hero />
    </div>
  );
};

export default Index;