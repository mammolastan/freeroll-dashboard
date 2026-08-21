import { useState, useEffect, useCallback, useRef } from "react";

interface UseSlideshowOptions {
  /** Optional callback to skip a slide (e.g., skip if no content) */
  skipSlide?: (slide: string) => boolean;
  /** Whether the slideshow is paused */
  paused?: boolean;
}

interface UseSlideshowReturn {
  currentSlide: string;
  currentIndex: number;
  /** Progress from 100 (start) to 0 (end) for current slide */
  progress: number;
  /** Whether the slideshow is actively rotating */
  isRotating: boolean;
  /** Manually advance to next slide */
  next: () => void;
  /** Manually go to previous slide */
  prev: () => void;
  /** Go to a specific slide by index */
  goTo: (index: number) => void;
}

/**
 * Hook for managing slideshow rotation through an array of slides.
 *
 * @param slides - Array of slide identifiers (e.g., ['td', 'chat'] or ad IDs)
 * @param intervalSeconds - Time between slide transitions
 * @param options - Optional configuration
 * @returns Current slide info, progress, and navigation controls
 */
export function useSlideshow(
  slides: string[],
  intervalSeconds: number,
  options: UseSlideshowOptions = {}
): UseSlideshowReturn {
  const { skipSlide, paused = false } = options;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(100);

  // Use refs to store latest values without causing effect re-runs
  const slidesRef = useRef(slides);
  const skipSlideRef = useRef(skipSlide);
  const intervalSecondsRef = useRef(intervalSeconds);
  const slideStartTimeRef = useRef<number>(Date.now());

  // Update refs when values change
  useEffect(() => {
    slidesRef.current = slides;
  }, [slides]);

  useEffect(() => {
    skipSlideRef.current = skipSlide;
  }, [skipSlide]);

  useEffect(() => {
    intervalSecondsRef.current = intervalSeconds;
  }, [intervalSeconds]);

  // Get available slides (those not skipped)
  const getAvailableSlides = useCallback(() => {
    const currentSlides = slidesRef.current;
    const currentSkipSlide = skipSlideRef.current;
    if (!currentSkipSlide) return currentSlides;
    return currentSlides.filter((slide) => !currentSkipSlide(slide));
  }, []);

  // Find next valid index
  const findNextValidIndex = useCallback((fromIndex: number): number => {
    const currentSlides = slidesRef.current;
    const currentSkipSlide = skipSlideRef.current;
    const availableSlides = getAvailableSlides();
    if (availableSlides.length === 0) return 0;

    // Find the next available slide
    for (let i = 1; i <= currentSlides.length; i++) {
      const nextIndex = (fromIndex + i) % currentSlides.length;
      const slide = currentSlides[nextIndex];
      if (!currentSkipSlide || !currentSkipSlide(slide)) {
        return nextIndex;
      }
    }
    return fromIndex;
  }, [getAvailableSlides]);

  // Find previous valid index
  const findPrevValidIndex = useCallback((fromIndex: number): number => {
    const currentSlides = slidesRef.current;
    const currentSkipSlide = skipSlideRef.current;
    const availableSlides = getAvailableSlides();
    if (availableSlides.length === 0) return 0;

    // Find the previous available slide
    for (let i = 1; i <= currentSlides.length; i++) {
      const prevIndex = (fromIndex - i + currentSlides.length) % currentSlides.length;
      const slide = currentSlides[prevIndex];
      if (!currentSkipSlide || !currentSkipSlide(slide)) {
        return prevIndex;
      }
    }
    return fromIndex;
  }, [getAvailableSlides]);

  // Advance to next slide
  const next = useCallback(() => {
    setCurrentIndex((prev) => findNextValidIndex(prev));
    setProgress(100);
    slideStartTimeRef.current = Date.now();
  }, [findNextValidIndex]);

  // Go to previous slide
  const prev = useCallback(() => {
    setCurrentIndex((prev) => findPrevValidIndex(prev));
    setProgress(100);
    slideStartTimeRef.current = Date.now();
  }, [findPrevValidIndex]);

  // Go to specific index
  const goTo = useCallback((index: number) => {
    const currentSlides = slidesRef.current;
    const currentSkipSlide = skipSlideRef.current;
    if (index >= 0 && index < currentSlides.length) {
      // If the target slide should be skipped, find the next valid one
      if (currentSkipSlide && currentSkipSlide(currentSlides[index])) {
        setCurrentIndex(findNextValidIndex(index - 1));
      } else {
        setCurrentIndex(index);
      }
      setProgress(100);
      slideStartTimeRef.current = Date.now();
    }
  }, [findNextValidIndex]);

  // Calculate if we should be rotating
  const availableSlides = getAvailableSlides();
  const isRotating = !paused && availableSlides.length > 1;

  // Reset to first valid slide when slides array changes significantly
  useEffect(() => {
    const available = getAvailableSlides();
    if (available.length === 0) {
      setCurrentIndex(0);
      return;
    }

    // If current slide is no longer valid, find first valid one
    const currentSlide = slides[currentIndex];
    if (!currentSlide || (skipSlide && skipSlide(currentSlide))) {
      setCurrentIndex(findNextValidIndex(-1));
    }
  }, [slides.length, skipSlide, currentIndex, getAvailableSlides, findNextValidIndex, slides]);

  // Set up rotation interval - use a single effect that checks isRotating
  useEffect(() => {
    if (!isRotating) {
      setProgress(100);
      return;
    }

    // Reset progress when starting
    setProgress(100);
    slideStartTimeRef.current = Date.now();

    const intervalMs = intervalSeconds * 1000;

    // Main rotation interval
    const rotationInterval = setInterval(() => {
      setCurrentIndex((prev) => {
        const currentSlides = slidesRef.current;
        const currentSkipSlide = skipSlideRef.current;

        // Find next valid index inline to avoid stale closure
        for (let i = 1; i <= currentSlides.length; i++) {
          const nextIndex = (prev + i) % currentSlides.length;
          const slide = currentSlides[nextIndex];
          if (!currentSkipSlide || !currentSkipSlide(slide)) {
            return nextIndex;
          }
        }
        return prev;
      });
      setProgress(100);
      slideStartTimeRef.current = Date.now();
    }, intervalMs);

    // Progress update interval
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - slideStartTimeRef.current;
      const currentIntervalMs = intervalSecondsRef.current * 1000;
      const remaining = Math.max(0, 100 - (elapsed / currentIntervalMs) * 100);
      setProgress(remaining);
    }, 50);

    return () => {
      clearInterval(rotationInterval);
      clearInterval(progressInterval);
    };
  }, [isRotating, intervalSeconds]);

  // Ensure current slide is valid
  const currentSlide = slides[currentIndex] ?? slides[0] ?? "";

  return {
    currentSlide,
    currentIndex,
    progress,
    isRotating,
    next,
    prev,
    goTo,
  };
}
