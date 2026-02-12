import { useState } from 'react';
import { useMidi } from '../hooks/useMidi';
import { useAudioInput } from '../hooks/useAudioInput';
import { opXyProfile } from '../devices/op-xy';
import { useAppStore } from '../store';
import { wait } from '../utils/time';
import type { MidiController } from '../core/midi';

interface ConnectScreenProps {
  onConnected: (midi: MidiController, audioStream: MediaStream) => void;
}

export function ConnectScreen({ onConnected }: ConnectScreenProps) {
  const { setScreen, setTempo } = useAppStore();
  const midi = useMidi();
  const audio = useAudioInput();
  const [connecting, setConnecting] = useState(false);
  const [clockMissing, setClockMissing] = useState(false);

  const handleConnect = async () => {
    setConnecting(true);
    setClockMissing(false);

    const midiOk = await midi.connect(opXyProfile);
    const stream = await audio.connect(48000);

    if (!midiOk || !stream) {
      setConnecting(false);
      return;
    }

    // MIDI + audio connected — now check for clock
    let bpmResolved = false;

    await midi.controller.startBpmDetection((bpm) => {
      if (!bpmResolved) {
        bpmResolved = true;
        setTempo(bpm);
      }
    });

    // Briefly play to trigger clock data from OP-XY
    midi.controller.play(opXyProfile);

    // Wait up to 4 seconds for clock
    for (let i = 0; i < 40; i++) {
      await wait(100);
      if (bpmResolved) break;
    }

    midi.controller.stop(opXyProfile);

    // Also check getDetectedBpm in case callback fired slightly late
    if (!bpmResolved) {
      const detected = midi.controller.getDetectedBpm();
      if (detected) {
        bpmResolved = true;
        setTempo(detected);
      }
    }

    midi.controller.stopBpmDetection();
    setConnecting(false);

    if (bpmResolved) {
      onConnected(midi.controller, stream);
      setScreen('configure');
    } else {
      // Clock not detected — stay on connect screen
      setClockMissing(true);
    }
  };

  const error = midi.error || audio.error;

  return (
    <div className="screen connect-screen">
      {clockMissing && (
        <div className="clock-banner">
          <span className="clock-banner-text">
            no midi clock detected — on your op-xy press <strong>com → m3</strong> and enable <strong>clock send</strong> + <strong>notes receive</strong>, then try again
          </span>
        </div>
      )}

      <div className="connect-hero">
        <div className="connect-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="2" width="16" height="20" rx="2" />
            <line x1="8" y1="6" x2="8" y2="6.01" />
            <line x1="12" y1="6" x2="12" y2="6.01" />
            <line x1="16" y1="6" x2="16" y2="6.01" />
            <line x1="8" y1="10" x2="8" y2="10.01" />
            <line x1="12" y1="10" x2="12" y2="10.01" />
            <line x1="16" y1="10" x2="16" y2="10.01" />
            <rect x="7" y="14" width="10" height="5" rx="1" />
          </svg>
        </div>
        <div className="connect-title">
          connect your <span>op-xy</span>
        </div>
      </div>

      <div className="connect-instructions">
        <div className="step">
          <span className="step-num">1</span>
          connect op-xy via usb-c
        </div>
        <div className="step">
          <span className="step-num">2</span>
          on op-xy: press com → m3, enable clock send + notes receive
        </div>
        <div className="step">
          <span className="step-num">3</span>
          click connect below and allow midi + audio access
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <button
        className={`btn-connect ${connecting ? 'connecting' : ''}`}
        onClick={handleConnect}
        disabled={connecting}
      >
        {connecting ? 'connecting...' : clockMissing ? 'retry' : 'connect'}
      </button>

      <p className="footnote">
        works with chrome 43+ on mac / windows / linux
      </p>
    </div>
  );
}
