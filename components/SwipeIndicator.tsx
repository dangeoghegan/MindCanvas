import React from 'react';

interface SwipeIndicatorProps {
  isActive: boolean;
  progress: number;
}

export function SwipeIndicator({ isActive, progress }: SwipeIndicatorProps) {
  if (!isActive) return null;

  const opacity = Math.min(progress * 1.5, 1);
  const translateX = -20 + (progress * 30); // Moves from -20px to 10px

  return (
    <div
      className="fixed left-0 top-0 bottom-0 pointer-events-none z-50 flex items-center"
      style={{
        opacity,
        transform: `translateX(${translateX}px)`,
        transition: 'none'
      }}
    >
      {/* Gradient overlay */}
      <div
        className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent"
        style={{ width: `${Math.min(progress * 200, 100)}px` }}
      />
      
      {/* Arrow icon */}
      <div className="relative ml-4 bg-primary rounded-full p-3 shadow-lg">
        <svg
          className="w-6 h-6 text-primary-foreground"
          fill="none"
          strokeWidth={2.5}
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 19.5L8.25 12l7.5-7.5"
          />
        </svg>
      </div>

      {/* Completion pulse effect */}
      {progress >= 1 && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2">
          <div className="animate-ping absolute inline-flex h-12 w-12 rounded-full bg-primary/80 opacity-75" />
        </div>
      )}
    </div>
  );
}