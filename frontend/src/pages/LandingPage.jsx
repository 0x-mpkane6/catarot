import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";

import HeroSection from "../features/landing/HeroSection/HeroSection.jsx";
import AboutSection from "../features/landing/AboutSection/AboutSection";
import HowItWorksSection from "../features/landing/HowItWorksSection/HowItWorksSection";
import FeaturesSection from "../features/landing/FeaturesSection/FeaturesSection"; 
import ScrollTopBtn from "../components/common/ScrollTopBtn";

export default function LandingPage() {
  return (
    <>
      <Navbar variant="dark" />
      <HeroSection />
      <AboutSection />
      <HowItWorksSection />
      <FeaturesSection />
      <Footer />
      <ScrollTopBtn />
    </>
  );
}