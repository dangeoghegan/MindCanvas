import { useEffect, useRef, useState } from 'react';

// The hook returns this state
interface SwipeState {
  isActive: boolean;
  progress: number;
}

// The hook accepts a callback
type SwipeCallback = () => void;

export function useSwipeNavigation(onSwipeRight: SwipeCallback) {
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const [swipeState, setSwipeState] = useState<SwipeState>({
    isActive: false,
    progress: 0
  });

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      touchStartX.current = touch.clientX;
      touchStartY.current = touch.clientY;
      
      if (touch.clientX < 50) {
        setSwipeState({ isActive: true, progress: 0 });
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (touchStartX.current >= 50) return;
      
      const touch = e.touches[0];
      if (!touch) return;
      const deltaX = touch.clientX - touchStartX.current;
      const deltaY = Math.abs(touch.clientY - touchStartY.current);
      
      if (deltaX > 0 && deltaX > deltaY) {
        const progress = Math.min(deltaX / 120, 1);
        setSwipeState({ isActive: true, progress });
        
        // Prevent browser navigation
        if (e.cancelable) {
            e.preventDefault();
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (touchStartX.current >= 50) {
        setSwipeState({ isActive: false, progress: 0 });
        return;
      }
      
      const touch = e.changedTouches[0];
      if (!touch) return;
      const deltaX = touch.clientX - touchStartX.current;
      const deltaY = Math.abs(touch.clientY - touchStartY.current);
      
      if (deltaX > 120 && deltaX > deltaY) {
        onSwipeRight();
      }

      setSwipeState({ isActive: false, progress: 0 });
    };

    document.addEventListener('touchstart', handleTouchStart, { 
      passive: true,
      capture: true 
    });
    
    document.addEventListener('touchmove', handleTouchMove, { 
      passive: false,
      capture: true 
    });
    
    document.addEventListener('touchend', handleTouchEnd, { 
      passive: true,
      capture: true 
    });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart, { capture: true });
      document.removeEventListener('touchmove', handleTouchMove, { capture: true });
      document.removeEventListener('touchend', handleTouchEnd, { capture: true });
    };
  }, [onSwipeRight]);

  return swipeState;
}