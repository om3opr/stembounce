import { useRef, useCallback } from 'react';
import { useAppStore } from './store';
import { ConnectScreen } from './components/ConnectScreen';
import { ConfigureScreen } from './components/ConfigureScreen';
import { BounceScreen } from './components/BounceScreen';
import { CompleteScreen } from './components/CompleteScreen';
import { DeviceStatus } from './components/DeviceStatus';
import { BounceEngine } from './core/bounce-engine';
import { AudioRecorder } from './core/audio-recorder';
import { MidiController } from './core/midi';
import { opXyProfile } from './devices/op-xy';
import { barsToMs } from './utils/time';
import './App.css';

const STEPS = ['connect', 'configure', 'bouncing', 'complete'] as const;

function StepIndicator({ current }: { current: string }) {
  const idx = STEPS.indexOf(current as (typeof STEPS)[number]);
  return (
    <div className="step-indicator">
      {STEPS.map((step, i) => (
        <div key={step} style={{ display: 'flex', alignItems: 'center' }}>
          <div
            className={`step-dot ${i === idx ? 'active' : ''} ${i < idx ? 'done' : ''}`}
          />
          {i < STEPS.length - 1 && (
            <div className={`step-line ${i < idx ? 'done' : ''}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function App() {
  const {
    screen,
    setScreen,
    tracks,
    tempo,
    songLengthBars,
    tailSeconds,
    sampleRate,
    bitDepth,
    includeMixPass,
    setProgress,
    setStems,
    reset,
  } = useAppStore();

  const midiRef = useRef<MidiController | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const engineRef = useRef<BounceEngine | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);

  const handleConnected = useCallback(
    (midi: MidiController, audioStream: MediaStream) => {
      midiRef.current = midi;
      streamRef.current = audioStream;

      // Start listening for MIDI Clock to auto-detect BPM
      midi.startBpmDetection((bpm) => {
        console.log(`[App] BPM detected from OP-XY: ${bpm}`);
        useAppStore.getState().setTempo(bpm);
      });
    },
    []
  );

  const handleStartBounce = useCallback(async () => {
    if (!midiRef.current || !streamRef.current) return;

    const recorder = new AudioRecorder();
    await recorder.init(streamRef.current, sampleRate);
    recorderRef.current = recorder;

    const engine = new BounceEngine(midiRef.current, recorder);
    engineRef.current = engine;

    setScreen('bouncing');

    const config = {
      tracks,
      songLengthMs: barsToMs(songLengthBars, tempo),
      tailMs: tailSeconds * 1000,
      sampleRate,
      bitDepth,
      includeMixPass,
      tempo,
      songLengthBars,
    };

    try {
      const results = await engine.run(opXyProfile, config, (progress) => {
        setProgress(progress);
      });

      setStems(results);
      setScreen('complete');
    } catch (err) {
      console.error('Bounce failed:', err);
      setScreen('configure');
    } finally {
      setProgress(null);
      recorder.destroy();
    }
  }, [
    tracks,
    tempo,
    songLengthBars,
    tailSeconds,
    sampleRate,
    bitDepth,
    includeMixPass,
    setScreen,
    setProgress,
    setStems,
  ]);

  const handleCancel = useCallback(() => {
    engineRef.current?.cancel();
  }, []);

  const handleNewBounce = useCallback(() => {
    reset();
  }, [reset]);

  const isConnected = screen !== 'connect';

  return (
    <div className="app">
      <header className="app-header">
        <h1>stembounce</h1>
        <span className="subtitle">op-xy stem export</span>
        <StepIndicator current={screen} />
      </header>

      {isConnected && (
        <DeviceStatus
          midiConnected={!!midiRef.current}
          midiName={midiRef.current?.getOutput()?.name || null}
          audioConnected={!!streamRef.current}
          audioName={streamRef.current?.getAudioTracks()[0]?.label || null}
        />
      )}

      <main className="app-main" key={screen}>
        {screen === 'connect' && (
          <ConnectScreen onConnected={handleConnected} />
        )}
        {screen === 'configure' && (
          <ConfigureScreen onStart={handleStartBounce} midi={midiRef.current} />
        )}
        {screen === 'bouncing' && (
          <BounceScreen
            audioStream={streamRef.current}
            onCancel={handleCancel}
          />
        )}
        {screen === 'complete' && (
          <CompleteScreen onNewBounce={handleNewBounce} />
        )}
      </main>

      <footer className="app-footer">
        <a href="https://ko-fi.com/om3op" target="_blank" rel="noopener noreferrer" className="footer-link">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
          made by om3
        </a>
      </footer>
    </div>
  );
}

export default App;
