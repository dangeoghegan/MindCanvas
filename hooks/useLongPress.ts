// FIX: Imported the 'React' namespace to resolve errors where types like 'React.MouseEvent' were used without 'React' being in scope.
import React, { useCallback, useRef, useState } from 'react';

interface LongPressOptions {
  shouldPreventDefault?: boolean;
  delay?: number;
}

const isTouchEvent = (event: Event): event is TouchEvent => {
    return "touches" in event;
};

const preventDefault = (event: Event) => {
    if (!isTouchEvent(event) || event.touches.length < 2) {
        if (event.cancelable) {
            event.preventDefault();
        }
    }
};

export const useLongPress = (
  onLongPress: (event: React.MouseEvent | React.TouchEvent) => void,
  onClick: (event: React.MouseEvent | React.TouchEvent) => void,
  { shouldPreventDefault = true, delay = 500 }: LongPressOptions = {}
) => {
  const [longPressTriggered, setLongPressTriggered] = useState(false);
  // FIX: Explicitly initialize useRef with null. This resolves a TypeScript error where the compiler expects an argument for useRef when a generic type is provided.
  const timeout = useRef<number | null>(null);
  const target = useRef<EventTarget | null>(null);

  const start = useCallback(
    (event: React.MouseEvent | React.TouchEvent) => {
      // stop long press on right click
      if ('button' in event && event.button !== 0) {
        return;
      }

      if (shouldPreventDefault && event.target) {
        (event.target as EventTarget).addEventListener('touchend', preventDefault, { passive: false });
        target.current = event.target;
      }
      timeout.current = window.setTimeout(() => {
        onLongPress(event);
        setLongPressTriggered(true);
      }, delay);
    },
    [onLongPress, delay, shouldPreventDefault]
  );

  const clear = useCallback(
    (event: React.MouseEvent | React.TouchEvent, shouldTriggerClick = true) => {
      timeout.current && clearTimeout(timeout.current);
      if (shouldTriggerClick && !longPressTriggered) {
          onClick(event);
      }
      setLongPressTriggered(false);
      if (shouldPreventDefault && target.current) {
        (target.current as EventTarget).removeEventListener('touchend', preventDefault);
      }
    },
    [shouldPreventDefault, onClick, longPressTriggered]
  );

  return {
    onMouseDown: (e: React.MouseEvent) => start(e),
    onTouchStart: (e: React.TouchEvent) => start(e),
    onMouseUp: (e: React.MouseEvent) => clear(e),
    onMouseLeave: (e: React.MouseEvent) => clear(e, false),
    onTouchEnd: (e: React.TouchEvent) => clear(e),
  };
};
