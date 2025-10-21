import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { LogIn, UserPlus } from 'lucide-react';
import Hero from "@/components/Hero";
import BusinessModel from "@/components/BusinessModel";
import Benefits from "@/components/Benefits";
import Objectives from "@/components/Objectives";
import Footer from "@/components/Footer";

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
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Movvi
          </h2>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate('/auth')}>
              <LogIn className="w-4 h-4" />
              Entrar
            </Button>
            <Button variant="default" onClick={() => navigate('/auth')}>
              <UserPlus className="w-4 h-4" />
              Cadastrar
            </Button>
          </div>
        </div>
      </header>
      <Hero />
      <BusinessModel />
      <Benefits />
      <Objectives />
      <Footer />
    </div>
  );
};

export default Index;
