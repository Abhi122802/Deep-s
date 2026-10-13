import React from 'react';

interface EggBadgeProps {
  isEggless: boolean;
  showText?: boolean;
  size?: 'sm' | 'md';
}

export const EggBadge: React.FC<EggBadgeProps> = ({
  isEggless,
  showText = true,
  size = 'md',
}) => {
  const isSm = size === 'sm';

  return (
    <div
      className={`inline-flex items-center gap-1.5 ${
        isSm ? 'text-xs' : 'text-xs md:text-sm'
      } font-medium`}
      title={isEggless ? '100% Pure Eggless (Vegetarian)' : 'Contains Egg'}
    >
      {/* Indian veg/non-veg standard square symbol */}
      <span
        className={`inline-flex items-center justify-center shrink-0 rounded-xs border p-0.5 ${
          isSm ? 'w-3.5 h-3.5' : 'w-4 h-4'
        } ${
          isEggless
            ? 'border-emerald-600 bg-emerald-50/50'
            : 'border-amber-800 bg-amber-50/50'
        }`}
      >
        <span
          className={`rounded-full ${isSm ? 'w-1.5 h-1.5' : 'w-2 h-2'} ${
            isEggless ? 'bg-emerald-600' : 'bg-amber-800'
          }`}
        />
      </span>

      {showText && (
        <span
          className={
            isEggless
              ? 'text-emerald-700 font-semibold'
              : 'text-amber-900 font-medium'
          }
        >
          {isEggless ? 'Eggless' : 'Contains Egg'}
        </span>
      )}
    </div>
  );
};
