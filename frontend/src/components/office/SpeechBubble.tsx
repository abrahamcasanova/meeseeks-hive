import { useState, useEffect } from 'react';
import { Html } from '@react-three/drei';
import { stressColor } from '@/utils/stressUtils';
import type { Vector3Tuple } from 'three';

const PHRASES = [
  "Look at me! I'm Mr. Meeseeks!",
  "Existence is pain but I can help!",
  "Can do!",
  "I'm Mr. Meeseeks, look at me!",
  "Just tell me what to do!",
];

interface SpeechBubbleProps {
  stress: number;
  position: Vector3Tuple;
  duration?: number;
}

export function SpeechBubble({ stress, position, duration = 2500 }: SpeechBubbleProps) {
  const [visible, setVisible] = useState(true);
  const [opacity, setOpacity] = useState(0);
  const [phrase] = useState(() => PHRASES[Math.floor(Math.random() * PHRASES.length)]!);

  useEffect(() => {
    // Fade in
    const fadeIn = setTimeout(() => setOpacity(1), 50);
    // Fade out
    const fadeOut = setTimeout(() => setOpacity(0), duration - 400);
    // Remove
    const remove = setTimeout(() => setVisible(false), duration);
    return () => { clearTimeout(fadeIn); clearTimeout(fadeOut); clearTimeout(remove); };
  }, [duration]);

  if (!visible) return null;

  const color = stressColor(stress);

  return (
    <Html position={position} center zIndexRange={[10, 0]}>
      <div
        className="pointer-events-none select-none text-center transition-opacity duration-300"
        style={{ opacity, width: '120px' }}
      >
        {/* Bubble */}
        <div
          className="text-[10px] font-bold px-2 py-1.5 rounded-lg shadow-lg text-center leading-snug"
          style={{
            background: 'rgba(10,10,20,0.92)',
            border: `1.5px solid ${color}`,
            color,
            textShadow: `0 0 8px ${color}66`,
          }}
        >
          {phrase}
        </div>
        {/* Tail */}
        <div
          className="w-2 h-2 mx-auto"
          style={{
            width: 0,
            height: 0,
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            borderTop: `6px solid ${color}`,
          }}
        />
      </div>
    </Html>
  );
}
