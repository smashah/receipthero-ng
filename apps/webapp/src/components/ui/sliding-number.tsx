import { useEffect, useState, useRef, memo } from 'react';
import { cn } from '@/lib/utils';

export interface SlidingNumberProps extends React.HTMLAttributes<HTMLSpanElement> {
  number: number;
  thousandSeparator?: string;
  duration?: number;
}

/**
 * Animated number that smoothly transitions to new values.
 * Uses CSS transitions for SSR-safe animation.
 */
export const SlidingNumber = memo(function SlidingNumber({
  number,
  thousandSeparator = ',',
  duration = 800,
  className,
  ...props
}: SlidingNumberProps) {
  const [displayNumber, setDisplayNumber] = useState(number);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevNumberRef = useRef(number);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    // Skip animation on initial mount
    if (prevNumberRef.current === number) {
      return;
    }

    const startNumber = prevNumberRef.current;
    const endNumber = number;
    const startTime = performance.now();

    setIsAnimating(true);

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out cubic for smooth deceleration
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      const currentValue = Math.round(startNumber + (endNumber - startNumber) * easeOut);
      setDisplayNumber(currentValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayNumber(endNumber);
        setIsAnimating(false);
        prevNumberRef.current = endNumber;
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [number, duration]);

  // Format number with thousand separators
  const formattedNumber = displayNumber
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, thousandSeparator);

  return (
    <span
      className={cn(
        'tabular-nums transition-opacity',
        isAnimating && 'opacity-90',
        className
      )}
      {...props}
    >
      {formattedNumber}
    </span>
  );
});

export default SlidingNumber;
