import { useState, useEffect } from 'react';
import type { MidiController, MidiDeviceInfo } from '../core/midi';
import { opXyProfile } from '../devices/op-xy';

interface MidiTestPanelProps {
  midi: MidiController;
}

export function MidiTestPanel({ midi }: MidiTestPanelProps) {
  const [log, setLog] = useState<string[]>([]);
  const [devices, setDevices] = useState<MidiDeviceInfo[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [rawHex, setRawHex] = useState('');

  useEffect(() => {
    setDevices(midi.listAllDevices());
  }, [midi]);

  const refreshLog = () => setLog(midi.getLog());

  // System Realtime transport
  const testMidiStart = () => { midi.midiStart(); refreshLog(); };
  const testMidiStop = () => { midi.midiStop(); refreshLog(); };
  const testMidiContinue = () => { midi.midiContinue(); refreshLog(); };

  // CC-based transport (fallback)
  const testPlayCC = () => { midi.playCC(opXyProfile); refreshLog(); };
  const testStopCC = () => { midi.stopCC(opXyProfile); refreshLog(); };

  // Mute/unmute
  const testMuteTrack = (track: number) => { midi.muteTrack(opXyProfile, track); refreshLog(); };
  const testUnmuteTrack = (track: number) => { midi.unmuteTrack(opXyProfile, track); refreshLog(); };
  const testUnmuteAll = () => { midi.unmuteAllTracks(opXyProfile); refreshLog(); };

  // Try mute on all channels at once
  const testMuteAllChannels = (track: number) => {
    for (let ch = 1; ch <= 16; ch++) {
      midi.sendCC(ch, 9, 127);
    }
    // Then unmute just the target track
    midi.sendCC(track, 9, 0);
    refreshLog();
  };

  // Raw MIDI send
  const sendRawMidi = () => {
    const bytes = rawHex
      .trim()
      .split(/[\s,]+/)
      .map((s) => parseInt(s, 16))
      .filter((n) => !isNaN(n) && n >= 0 && n <= 255);
    if (bytes.length > 0) {
      midi.sendRaw(bytes);
      refreshLog();
    }
  };

  const selectOutput = (id: string) => {
    midi.selectOutputById(id);
    refreshLog();
    setDevices(midi.listAllDevices());
  };

  const outputs = devices.filter((d) => d.type === 'output');
  const currentOutput = midi.getOutput();

  return (
    <div className="midi-test-panel">
      <button
        className="panel-toggle"
        onClick={() => setExpanded(!expanded)}
      >
        <span className={`panel-toggle-icon ${expanded ? 'open' : ''}`}>{'\u25B6'}</span>
        midi diagnostics
      </button>

      {expanded && (
        <div className="panel-content">
          {/* Device list */}
          <div className="panel-section">
            <div className="panel-label">MIDI Outputs Detected:</div>
            {outputs.length === 0 && (
              <div className="panel-warning">No MIDI outputs found!</div>
            )}
            {outputs.map((d) => (
              <div key={d.id} className="device-row">
                <span className={d.id === currentOutput?.id ? 'device-active' : 'device-inactive'}>
                  {d.id === currentOutput?.id ? '\u25CF' : '\u25CB'}
                </span>
                <span className="device-name">{d.name || '(unnamed)'}</span>
                <span className="device-mfr">{d.manufacturer || ''}</span>
                {d.id !== currentOutput?.id && (
                  <button className="btn-tiny" onClick={() => selectOutput(d.id)}>
                    Use
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Transport — Realtime (most likely to work) */}
          <div className="panel-section">
            <div className="panel-label">Transport — MIDI Realtime (try these first):</div>
            <div className="test-buttons">
              <button className="btn-test btn-test-play" onClick={testMidiStart}>
                START (0xFA)
              </button>
              <button className="btn-test btn-test-stop" onClick={testMidiStop}>
                STOP (0xFC)
              </button>
              <button className="btn-test" onClick={testMidiContinue}>
                CONTINUE (0xFB)
              </button>
            </div>
          </div>

          {/* Transport — CC fallback */}
          <div className="panel-section">
            <div className="panel-label">Transport — CC (fallback):</div>
            <div className="test-buttons">
              <button className="btn-test" onClick={testPlayCC}>
                PLAY CC104
              </button>
              <button className="btn-test" onClick={testStopCC}>
                STOP CC105
              </button>
            </div>
          </div>

          {/* Mute/Unmute */}
          <div className="panel-section">
            <div className="panel-label">Track Mute (CC9):</div>
            <div className="test-buttons">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((t) => (
                <div key={t} className="mute-pair">
                  <button className="btn-test btn-test-sm" onClick={() => testMuteTrack(t)}>
                    M{t}
                  </button>
                  <button className="btn-test btn-test-sm" onClick={() => testUnmuteTrack(t)}>
                    U{t}
                  </button>
                </div>
              ))}
            </div>
            <div className="test-buttons">
              <button className="btn-test" onClick={testUnmuteAll}>
                Unmute All
              </button>
              <button className="btn-test" onClick={() => testMuteAllChannels(1)}>
                Mute All + Solo Tk1
              </button>
            </div>
          </div>

          {/* Raw MIDI */}
          <div className="panel-section">
            <div className="panel-label">Send Raw MIDI (hex bytes):</div>
            <div className="raw-midi-row">
              <input
                type="text"
                className="track-name-input"
                value={rawHex}
                onChange={(e) => setRawHex(e.target.value)}
                placeholder="e.g. FA or B0 09 7F"
                onKeyDown={(e) => e.key === 'Enter' && sendRawMidi()}
              />
              <button className="btn-tiny" onClick={sendRawMidi}>
                Send
              </button>
            </div>
          </div>

          {/* Log */}
          <div className="panel-section">
            <div className="panel-label">
              MIDI Log:
              <button className="btn-tiny" onClick={refreshLog} style={{ marginLeft: '0.5rem' }}>
                Refresh
              </button>
              <button className="btn-tiny" onClick={() => { midi.clearLog(); setLog([]); }} style={{ marginLeft: '0.25rem' }}>
                Clear
              </button>
            </div>
            <div className="midi-log">
              {log.length === 0 && <div className="log-empty">No messages yet. Click a test button above.</div>}
              {log.map((line, i) => (
                <div key={i} className="log-line">{line}</div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
