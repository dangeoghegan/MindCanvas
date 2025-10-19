import { useState, useEffect, SetStateAction } from 'react';

// FIX: Removed trailing comma from generic parameter list.
// FIX: Corrected the setter function's type signature and implementation to properly support functional updates, resolving the TypeScript error in `App.tsx`.
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: SetStateAction<T>) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    // FIX: Added opening brace for catch block to fix syntax error.
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  useEffect(() => {
    // State is now saved to localStorage immediately on any change,
    // ensuring background task state is persisted reliably.
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch (error) {
      console.error(error);
    }
  }, [storedValue, key]);

  const setValue = (value: SetStateAction<T>) => {
    try {
      // The `useState` setter `setStoredValue` already handles functional updates (i.e., when you pass a function).
      // The original implementation was attempting to replicate this but was incorrectly typed and implemented.
      // Delegating directly to `setStoredValue` is safer and more correct.
      setStoredValue(value);
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue];
}