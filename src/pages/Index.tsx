import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { LogIn, UserPlus } from 'lucide-react';
import Hero from "@/components/Hero";

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">
            Levei
          </h2>
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/auth')}
              className="h-10"
            >
              <LogIn className="w-4 h-4 mr-2" />
              Entrar
            </Button>
            <Button 
              onClick={() => navigate('/auth')}
              className="h-10"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Cadastrar
            </Button>
          </div>
        </div>
      </header>
      <Hero />
    </div>
  );
};

export default Index;
