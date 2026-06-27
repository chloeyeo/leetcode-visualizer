'use client';

import { useEffect, useState } from 'react';

/**
 * Shared step/playback state for every visualizer: current step, play/pause,
 * speed, and a self-stopping autoplay timer. Respects prefers-reduced-motion
 * by not auto-advancing (the user can still step manually).
 */
const BASE_MS = 850;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);
  return reduced;
}

export function useStepPlayer(total) {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const reduced = usePrefersReducedMotion();
  const atEnd = step >= total - 1;

  // keep step in range if the frame count changes (e.g. switching modes)
  useEffect(() => {
    if (step > total - 1) setStep(0);
  }, [total]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!playing) return undefined;
    if (atEnd || reduced) {
      setPlaying(false);
      return undefined;
    }
    const t = setTimeout(() => setStep((s) => s + 1), BASE_MS / speed);
    return () => clearTimeout(t);
  }, [playing, step, atEnd, speed, reduced]);

  return { step, setStep, playing, setPlaying, speed, setSpeed, atEnd, total, reduced };
}
