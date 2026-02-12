interface DeviceStatusProps {
  midiConnected: boolean;
  midiName: string | null;
  audioConnected: boolean;
  audioName: string | null;
}

export function DeviceStatus({ midiConnected, midiName, audioConnected, audioName }: DeviceStatusProps) {
  return (
    <div className="device-status">
      <div className={`status-item ${midiConnected ? 'connected' : ''}`}>
        <span className="status-dot" />
        <span>MIDI: {midiConnected ? midiName : 'Not connected'}</span>
      </div>
      <div className={`status-item ${audioConnected ? 'connected' : ''}`}>
        <span className="status-dot" />
        <span>Audio: {audioConnected ? audioName : 'Not connected'}</span>
      </div>
    </div>
  );
}
