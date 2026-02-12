import { useEffect, useRef, useState } from 'react';

interface AudioMeterProps {
  stream: MediaStream | null;
  active: boolean;
}

export function AudioMeter({ stream, active }: AudioMeterProps) {
  const [level, setLevel] = useState(0);
  const animFrameRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const contextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!stream || !active) {
      setLevel(0);
      return;
    }

    const ctx = new AudioContext();
    contextRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    function tick() {
      if (!analyserRef.current) return;
      analyserRef.current.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length / 255;
      setLevel(avg);
      animFrameRef.current = requestAnimationFrame(tick);
    }

    tick();

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      analyserRef.current = null;
      source.disconnect();
      ctx.close();
    };
  }, [stream, active]);

  const bars = 20;
  const filledBars = Math.round(level * bars);

  return (
    <div className="audio-meter">
      <span className="meter-label">Audio Level:</span>
      <div className="meter-bar-container">
        {Array.from({ length: bars }, (_, i) => (
          <div
            key={i}
            className={`meter-segment ${i < filledBars ? 'active' : ''} ${
              i >= bars * 0.8 ? 'hot' : i >= bars * 0.6 ? 'warm' : ''
            }`}
          />
        ))}
      </div>
    </div>
  );
}
