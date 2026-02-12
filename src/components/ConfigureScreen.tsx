import { useState } from 'react';
import { useAppStore } from '../store';
import { barsToMs, msToDisplayTime, wait } from '../utils/time';
import { MidiTestPanel } from './MidiTestPanel';
import { opXyProfile } from '../devices/op-xy';
import type { MidiController } from '../core/midi';

interface ConfigureScreenProps {
  onStart: () => void;
  midi: MidiController | null;
}

export function ConfigureScreen({ onStart, midi }: ConfigureScreenProps) {
  const {
    tracks,
    toggleTrack,
    renameTrack,
    tempo,
    setTempo,
    songLengthBars,
    setSongLengthBars,
    tailSeconds,
    setTailSeconds,
    sampleRate,
    setSampleRate,
    bitDepth,
    setBitDepth,
    includeMixPass,
    setIncludeMixPass,
  } = useAppStore();

  const [detecting, setDetecting] = useState(false);
  const [bpmDetected, setBpmDetected] = useState(false);
  const [detectFailed, setDetectFailed] = useState(false);

  const songLengthMs = barsToMs(songLengthBars, tempo);
  const enabledCount = tracks.filter((t) => t.enabled).length;
  const totalPasses = enabledCount + (includeMixPass ? 1 : 0);
  const totalTimeMs = totalPasses * (songLengthMs + tailSeconds * 1000);

  const handleDetectBpm = async () => {
    if (!midi) return;
    setDetecting(true);
    setBpmDetected(false);
    setDetectFailed(false);

    let resolved = false;

    // Start listening for clock + CC80
    await midi.startBpmDetection((bpm) => {
      if (!resolved) {
        resolved = true;
        setTempo(bpm);
        setBpmDetected(true);
      }
    });

    // Briefly play so the OP-XY sends clock/tempo data
    midi.play(opXyProfile);

    // Wait up to 4 seconds for detection
    for (let i = 0; i < 40; i++) {
      await wait(100);
      if (resolved) break;
    }

    // Stop playback
    midi.stop(opXyProfile);
    midi.stopBpmDetection();
    setDetecting(false);

    if (!resolved) {
      const detected = midi.getDetectedBpm();
      if (detected) {
        setTempo(detected);
        setBpmDetected(true);
      } else {
        setDetectFailed(true);
      }
    }
  };

  return (
    <div className="screen configure-screen">
      {detectFailed && !bpmDetected && (
        <div className="clock-banner">
          <span className="clock-banner-text">
            no midi clock detected — on your op-xy press <strong>com → m3</strong> and enable <strong>clock send</strong> + <strong>notes receive</strong>, then hit detect again
          </span>
        </div>
      )}

      <span className="section-label">tracks</span>

      <div className="track-grid">
        {tracks.map((track) => (
          <div
            key={track.trackNumber}
            className={`track-pad ${track.enabled ? 'enabled' : 'disabled'}`}
          >
            <div
              className="track-num"
              onClick={() => toggleTrack(track.trackNumber)}
            >
              {track.trackNumber}
            </div>
            <input
              type="text"
              className="track-name-input"
              value={track.name}
              onChange={(e) => renameTrack(track.trackNumber, e.target.value)}
              placeholder={`Track ${track.trackNumber}`}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        ))}
      </div>

      <span className="section-label">settings</span>

      <div className="settings-group">
        <div className="setting-row">
          <label>song length (bars)</label>
          <input
            type="number"
            min={1}
            max={999}
            value={songLengthBars}
            onChange={(e) => setSongLengthBars(parseInt(e.target.value) || 1)}
          />
        </div>

        <div className="setting-row">
          <label>tempo (bpm)</label>
          <div className="tempo-input-group">
            <input
              type="number"
              min={40}
              max={220}
              value={tempo}
              onChange={(e) => setTempo(parseInt(e.target.value) || 120)}
            />
            <button
              className={`btn-detect ${detecting ? 'detecting' : ''}`}
              onClick={handleDetectBpm}
              disabled={detecting || !midi}
            >
              {detecting ? 'reading...' : bpmDetected ? `${tempo} bpm` : detectFailed ? 'retry' : 'detect'}
            </button>
            {bpmDetected && <span className="auto-detected">from op-xy</span>}
          </div>
        </div>

        <div className="setting-row">
          <label>tail time (seconds)</label>
          <input
            type="number"
            min={0}
            max={30}
            step={0.5}
            value={tailSeconds}
            onChange={(e) => setTailSeconds(parseFloat(e.target.value) || 0)}
          />
        </div>

        <div className="setting-row">
          <label>duration</label>
          <span className="computed-value">{msToDisplayTime(songLengthMs)}</span>
        </div>
      </div>

      <span className="section-label">output</span>

      <div className="settings-group">
        <div className="setting-row">
          <label>format</label>
          <div className="radio-group">
            <label>
              <input
                type="radio"
                checked={bitDepth === 24 && sampleRate === 48000}
                onChange={() => {
                  setBitDepth(24);
                  setSampleRate(48000);
                }}
              />
              24-bit / 48khz
            </label>
            <label>
              <input
                type="radio"
                checked={bitDepth === 16 && sampleRate === 44100}
                onChange={() => {
                  setBitDepth(16);
                  setSampleRate(44100);
                }}
              />
              16-bit / 44.1khz
            </label>
          </div>
        </div>

        <label className="checkbox-row">
          <input
            type="checkbox"
            className="checkbox-toggle"
            checked={includeMixPass}
            onChange={(e) => setIncludeMixPass(e.target.checked)}
          />
          include full mix pass
        </label>
      </div>

      <div className="bounce-summary">
        <p>
          {totalPasses} pass{totalPasses !== 1 ? 'es' : ''} — estimated total time:{' '}
          <strong>{msToDisplayTime(totalTimeMs)}</strong>
        </p>
      </div>

      <div className="warning-box">
        load your project on the op-xy and set it to the start position before
        clicking start.
      </div>

      <button
        className="btn-primary"
        onClick={onStart}
        disabled={enabledCount === 0 || !bpmDetected}
      >
        {bpmDetected ? 'start bounce' : 'detect bpm to start'}
      </button>

      {midi && <MidiTestPanel midi={midi} />}
    </div>
  );
}
