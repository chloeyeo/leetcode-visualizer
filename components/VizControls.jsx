'use client';

/**
 * Shared playback controls for all visualizers: a scrubber (range slider),
 * Reset / Back / Play-Pause / Next, and a speed selector. SVG icons carry
 * aria-labels so the controls are screen-reader friendly.
 */

function Icon({ d, label }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
      <path d={d} fill="currentColor" />
    </svg>
  );
}

const PATHS = {
  reset: 'M12 5V2L7 7l5 5V8a5 5 0 1 1-5 5H5a7 7 0 1 0 7-8z',
  prev: 'M6 6h2v12H6zm3.5 6 8.5 6V6z',
  next: 'M16 6h2v12h-2zM6 6l8.5 6L6 18z',
  play: 'M8 5v14l11-7z',
  pause: 'M6 5h4v14H6zm8 0h4v14h-4z',
};

export default function VizControls({ player }) {
  const { step, setStep, playing, setPlaying, speed, setSpeed, atEnd, total } = player;

  return (
    <div className="viz-playback">
      <div className="viz-scrub">
        <input
          type="range"
          min={0}
          max={Math.max(0, total - 1)}
          value={Math.min(step, total - 1)}
          onChange={(e) => {
            setPlaying(false);
            setStep(Number(e.target.value));
          }}
          aria-label={`Step ${Math.min(step + 1, total)} of ${total}`}
        />
        <span className="viz-step">Step {Math.min(step + 1, total)} / {total}</span>
      </div>

      <div className="viz-controls">
        <button onClick={() => { setPlaying(false); setStep(0); }} aria-label="Reset to start">
          <Icon d={PATHS.reset} />
        </button>
        <button
          onClick={() => { setPlaying(false); setStep((s) => Math.max(0, s - 1)); }}
          disabled={step === 0}
          aria-label="Previous step"
        >
          <Icon d={PATHS.prev} />
        </button>
        <button
          className="viz-play"
          onClick={() => { if (atEnd) setStep(0); setPlaying((p) => !p); }}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          <Icon d={playing ? PATHS.pause : PATHS.play} />
          <span>{playing ? 'Pause' : 'Play'}</span>
        </button>
        <button
          onClick={() => { setPlaying(false); setStep((s) => Math.min(total - 1, s + 1)); }}
          disabled={atEnd}
          aria-label="Next step"
        >
          <Icon d={PATHS.next} />
        </button>

        <div className="viz-speed" role="group" aria-label="Playback speed">
          {[0.5, 1, 2].map((x) => (
            <button
              key={x}
              className={speed === x ? 'active' : ''}
              onClick={() => setSpeed(x)}
              aria-pressed={speed === x}
            >
              {x}×
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
