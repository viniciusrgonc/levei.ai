import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
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
      <Hero />
      <BusinessModel />
      <Benefits />
      <Objectives />
      <Footer />
    </div>
  );
};

export default Index;
