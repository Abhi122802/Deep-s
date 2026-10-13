import React from 'react';
import { HeroBanner } from '../components/home/HeroBanner';
import { CategoryPills } from '../components/home/CategoryPills';
import { FeaturedSection } from '../components/home/FeaturedSection';
import { WhyChooseUs } from '../components/home/WhyChooseUs';
import { CustomCakeCTA } from '../components/home/CustomCakeCTA';

export const HomePage: React.FC = () => {
  return (
    <div className="space-y-0">
      <HeroBanner />
      <CategoryPills />
      <FeaturedSection />
      <WhyChooseUs />
      <CustomCakeCTA />
    </div>
  );
};
