import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ className = '', size = 'md', showText = true }) => {
  const iconSizes = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-12 h-12 text-lg'
  };

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* SD Emblem matching the logo */}
      <div className={`relative flex items-center justify-center font-extrabold rounded-xs shadow-xs ${iconSizes[size]}`}>
        {/* S in bright teal/turquoise */}
        <div className="absolute inset-0 bg-[#0d9488] text-white flex items-center justify-center rounded-xs font-black tracking-tighter" style={{ clipPath: 'polygon(0 0, 70% 0, 40% 100%, 0 100%)' }}>
          S
        </div>
        {/* D in dark teal */}
        <div className="absolute inset-0 bg-[#115e59] text-white flex items-center justify-center rounded-xs font-black tracking-tighter pl-2" style={{ clipPath: 'polygon(70% 0, 100% 0, 100% 100%, 40% 100%)' }}>
          D
        </div>
        <span className="relative z-10 text-white font-black tracking-tighter">SD</span>
      </div>

      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="font-black text-[#115e59] tracking-wider text-sm md:text-base leading-none">
              SD
            </span>
            <span className="font-bold text-[#0d9488] tracking-widest text-xs md:text-sm uppercase leading-none">
              COMMERCIAL
            </span>
          </div>
          <span className="text-[10px] text-neutral-500 font-medium tracking-wide mt-0.5">
            Operations & Compliance Portal
          </span>
        </div>
      )}
    </div>
  );
};
