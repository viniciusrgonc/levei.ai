import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import Hero from "@/components/Hero";
import leveiLogo from '@/assets/levei-logo.png';

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
      <div className="min-h-screen flex items-center justify-center bg-primary">
        <img src={leveiLogo} alt="Levei.ai" className="h-16 w-16 rounded-2xl object-cover animate-pulse" />
      </div>
    );
  }

  return <Hero />;
};

export default Index;