import Hero from "@/components/Hero";
import BusinessModel from "@/components/BusinessModel";
import Benefits from "@/components/Benefits";
import Objectives from "@/components/Objectives";
import Footer from "@/components/Footer";

const Index = () => {
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
