import React, { useState, useEffect, useRef, useCallback } from 'react';
import { XMarkIcon } from './icons';

const ImageModal: React.FC<{
  imageUrl: string;
  altText: string;
  onClose: () => void;
}> = ({ imageUrl, altText, onClose }) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement>(null);
  const isDraggingRef = useRef(false);
  const lastPointerPositionRef = useRef({ x: 0, y: 0 });
  const initialPinchDistanceRef = useRef(0);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const newScale = Math.max(0.5, Math.min(scale - e.deltaY * 0.001, 10));
    setScale(newScale);
  }, [scale]);

  const handlePointerDown = (clientX: number, clientY: number) => {
    isDraggingRef.current = true;
    lastPointerPositionRef.current = { x: clientX, y: clientY };
  };

  const handlePointerMove = (clientX: number, clientY: number) => {
    if (!isDraggingRef.current || scale <= 1) return;
    const deltaX = clientX - lastPointerPositionRef.current.x;
    const deltaY = clientY - lastPointerPositionRef.current.y;
    setPosition(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
    lastPointerPositionRef.current = { x: clientX, y: clientY };
  };
  
  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  const getPinchDistance = (touches: React.TouchList) => {
    return Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
  };
  
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      initialPinchDistanceRef.current = getPinchDistance(e.touches);
    } else if (e.touches.length === 1) {
      handlePointerDown(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const newPinchDistance = getPinchDistance(e.touches);
      const pinchRatio = newPinchDistance / (initialPinchDistanceRef.current || 1);
      const newScale = Math.max(0.5, Math.min(scale * pinchRatio, 10));
      setScale(newScale);
      initialPinchDistanceRef.current = newPinchDistance;
    } else if (e.touches.length === 1) {
      handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  };
  
  const handleTouchEnd = () => {
    initialPinchDistanceRef.current = 0;
    handlePointerUp();
  };

  useEffect(() => {
    if (scale <= 1) {
      setPosition({ x: 0, y: 0 });
    }
  }, [scale]);
  
  useEffect(() => {
    const imgElement = imageRef.current;
    if (imgElement) {
      imgElement.addEventListener('wheel', handleWheel, { passive: false });
      return () => {
        imgElement.removeEventListener('wheel', handleWheel);
      };
    }
  }, [handleWheel]);

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
      onMouseMove={(e) => handlePointerMove(e.clientX, e.clientY)}
      onMouseUp={handlePointerUp}
      onMouseLeave={handlePointerUp}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-4 right-4 text-white/70 hover:text-white p-2 rounded-full bg-black/30 hover:bg-black/50 transition-colors"
        aria-label="Close image view"
      >
        <XMarkIcon className="w-6 h-6" />
      </button>

      <div 
        className="w-full h-full flex items-center justify-center overflow-hidden"
        onClick={(e) => e.stopPropagation()} 
      >
        <img
          ref={imageRef}
          src={imageUrl}
          alt={altText}
          className="max-w-full max-h-full object-contain transition-transform duration-100 ease-out touch-none"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            cursor: scale > 1 ? (isDraggingRef.current ? 'grabbing' : 'grab') : 'zoom-in',
          }}
          onMouseDown={(e) => handlePointerDown(e.clientX, e.clientY)}
          onTouchStart={handleTouchStart}
          draggable="false"
        />
      </div>
    </div>
  );
};

export default ImageModal;
