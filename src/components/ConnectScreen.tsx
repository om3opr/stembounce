import { useState } from 'react';
import { useMidi } from '../hooks/useMidi';
import { useAudioInput } from '../hooks/useAudioInput';
import { opXyProfile } from '../devices/op-xy';
import { useAppStore } from '../store';
import type { MidiController } from '../core/midi';

interface ConnectScreenProps {
  onConnected: (midi: MidiController, audioStream: MediaStream) => void;
}

export function ConnectScreen({ onConnected }: ConnectScreenProps) {
  const { setScreen } = useAppStore();
  const midi = useMidi();
  const audio = useAudioInput();
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async () => {
    setConnecting(true);

    const midiOk = await midi.connect(opXyProfile);
    const stream = await audio.connect(48000);

    setConnecting(false);

    if (midiOk && stream) {
      onConnected(midi.controller, stream);
      setScreen('configure');
    }
  };

  const error = midi.error || audio.error;

  return (
    <div className="screen connect-screen">
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
          click connect below
        </div>
        <div className="step">
          <span className="step-num">3</span>
          allow midi + audio access
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <button
        className={`btn-connect ${connecting ? 'connecting' : ''}`}
        onClick={handleConnect}
        disabled={connecting}
      >
        {connecting ? 'connecting...' : 'connect'}
      </button>

      <p className="footnote">
        works with chrome 43+ on mac / windows / linux
      </p>
    </div>
  );
}
