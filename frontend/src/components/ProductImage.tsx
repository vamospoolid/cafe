import React, { useState, useEffect } from 'react';
import { Coffee, Utensils, Cookie, Package, RefreshCw } from 'lucide-react';

interface ProductImageProps {
  src?: string | null;
  alt: string;
  categoryName?: string;
  className?: string;
  containerClassName?: string;
  iconSize?: number;
}

export const ProductImage: React.FC<ProductImageProps> = ({
  src,
  alt,
  categoryName = '',
  className = 'w-full h-full object-cover',
  containerClassName = 'w-full h-full relative overflow-hidden bg-slate-100 flex items-center justify-center',
  iconSize = 28
}) => {
  const [currentSrc, setCurrentSrc] = useState<string | null>(src || null);
  const [hasError, setHasError] = useState<boolean>(false);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);
  const [retryCount, setRetryCount] = useState<number>(0);

  useEffect(() => {
    setCurrentSrc(src || null);
    setHasError(false);
    setIsRetrying(false);
    setRetryCount(0);
  }, [src]);

  const handleError = () => {
    if (retryCount === 0 && currentSrc && currentSrc.startsWith('http')) {
      setIsRetrying(true);
      setRetryCount(1);
      setTimeout(() => {
        const separator = currentSrc.includes('?') ? '&' : '?';
        setCurrentSrc(`${currentSrc}${separator}_retry=${Date.now()}`);
        setIsRetrying(false);
      }, 1500);
    } else {
      setHasError(true);
      setIsRetrying(false);
    }
  };

  // Determine Category Style & Icon for Fallback Card
  const catLower = (categoryName || alt).toLowerCase();
  let gradientBg = 'from-slate-700 to-slate-900';
  let IconComponent = Package;
  let themeBadge = 'Menu';

  if (catLower.includes('coffe') || catLower.includes('kopi') || catLower.includes('drink') || catLower.includes('tea') || catLower.includes('latte') || catLower.includes('mocktail')) {
    gradientBg = 'from-amber-700 via-amber-900 to-stone-950';
    IconComponent = Coffee;
    themeBadge = 'Beverage';
  } else if (catLower.includes('pastry') || catLower.includes('croissant') || catLower.includes('snack') || catLower.includes('roti') || catLower.includes('churros') || catLower.includes('fries') || catLower.includes('cireng')) {
    gradientBg = 'from-orange-600 via-amber-800 to-amber-950';
    IconComponent = Cookie;
    themeBadge = 'Snack & Pastry';
  } else if (catLower.includes('main') || catLower.includes('nasi') || catLower.includes('rice') || catLower.includes('spaghetti') || catLower.includes('ayam') || catLower.includes('beef') || catLower.includes('mie')) {
    gradientBg = 'from-rose-700 via-red-900 to-stone-950';
    IconComponent = Utensils;
    themeBadge = 'Main Course';
  }

  if (!currentSrc || hasError) {
    return (
      <div className={`${containerClassName} bg-gradient-to-br ${gradientBg} p-3 text-white flex flex-col items-center justify-center select-none`}>
        <div className="p-2.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-inner mb-1 flex items-center justify-center">
          <IconComponent size={iconSize} className="text-white/90 drop-shadow-sm" />
        </div>
        <span className="text-[9px] font-black tracking-widest uppercase text-white/70 truncate max-w-[90%] text-center">
          {themeBadge}
        </span>
        <span className="text-xs font-bold text-white/90 text-center leading-tight truncate max-w-[95%] mt-0.5">
          {alt}
        </span>
      </div>
    );
  }

  return (
    <div className={containerClassName}>
      {isRetrying && (
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] z-10 flex items-center justify-center text-white">
          <RefreshCw size={20} className="animate-spin text-amber-400" />
        </div>
      )}
      <img
        src={currentSrc}
        alt={alt}
        onError={handleError}
        className={className}
        loading="lazy"
      />
    </div>
  );
};
