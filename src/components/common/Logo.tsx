import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  /** Show the name next to the emblem. When false only the SD emblem is shown. */
  showText?: boolean;
  /** Use on dark backgrounds: the wordmark's dark lettering would not be readable there. */
  onDark?: boolean;
}

const wordmarkHeight = { sm: 'h-7', md: 'h-9', lg: 'h-12' } as const;
const emblemSize = { sm: 'w-7 h-7', md: 'w-9 h-9', lg: 'w-11 h-11' } as const;

export const Logo: React.FC<LogoProps> = ({ className = '', size = 'md', showText = true, onDark = false }) => {
  if (showText && !onDark) {
    return (
      <img
        src="/brand/sd-commercial-logo.png"
        alt="SD Commercial"
        className={`${wordmarkHeight[size]} w-auto select-none ${className}`}
        draggable={false}
      />
    );
  }
  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      <img src="/brand/sd-icon.png" alt={showText ? '' : 'SD Commercial'} className={`${emblemSize[size]} rounded-sm`} draggable={false} />
      {showText && (
        <span className="font-semibold tracking-wide text-white text-base leading-none">
          SD <span className="text-[#14b8a6]">COMMERCIAL</span>
        </span>
      )}
    </div>
  );
};
