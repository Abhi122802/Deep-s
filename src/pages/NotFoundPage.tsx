import React from 'react';
import { Link } from 'react-router-dom';
import { Cake, ArrowLeft } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-[70vh] flex items-center justify-center bg-[#FDFBF7] px-4 py-16">
      <div className="text-center max-w-md bg-white p-8 sm:p-12 rounded-3xl border border-[#E8DDD7] shadow-sm space-y-4">
        <div className="w-20 h-20 rounded-full bg-[#FFF0F3] text-[#D86A7F] mx-auto flex items-center justify-center">
          <Cake className="w-10 h-10" />
        </div>
        <span className="text-xs font-bold uppercase tracking-widest text-[#C5A059]">
          404 • Page Not Found
        </span>
        <h1 className="font-serif text-3xl font-bold text-[#2B1810]">
          Looks like this slice is gone!
        </h1>
        <p className="text-xs text-[#7E6355] leading-relaxed">
          The page you are looking for doesn’t exist or has been moved to another recipe.
        </p>
        <div className="pt-2">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#2B1810] text-[#FFFDF9] text-xs font-bold hover:bg-[#3D2314] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Bakery Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
