// components/Navigation/AutoScaleText.tsx
"use client";

import { useRef, useEffect, useState, ReactNode } from "react";

interface AutoScaleTextProps {
  children: ReactNode;
  className?: string;
  minScale?: number;
}

/**
 * Text component that automatically scales down to fit within its container.
 * The text will shrink (down to minScale) rather than overflow or truncate.
 */
export default function AutoScaleText({
  children,
  className = "",
  minScale = 0.5,
}: AutoScaleTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const calculateScale = () => {
      const container = containerRef.current;
      const text = textRef.current;
      if (!container || !text) return;

      // Reset scale to measure natural width
      setScale(1);

      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        const containerWidth = container.offsetWidth;
        const textWidth = text.scrollWidth;

        if (textWidth > containerWidth && containerWidth > 0) {
          const newScale = Math.max(minScale, containerWidth / textWidth);
          setScale(newScale);
        } else {
          setScale(1);
        }
      });
    };

    calculateScale();

    // Recalculate on window resize
    window.addEventListener("resize", calculateScale);
    return () => window.removeEventListener("resize", calculateScale);
  }, [children, minScale]);

  return (
    <div ref={containerRef} className={`overflow-hidden ${className}`}>
      <span
        ref={textRef}
        className="inline-block origin-left whitespace-nowrap"
        style={{ transform: `scale(${scale})` }}
      >
        {children}
      </span>
    </div>
  );
}
