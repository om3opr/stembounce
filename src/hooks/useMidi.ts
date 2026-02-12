import { useState, useCallback, useRef } from 'react';
import { MidiController } from '../core/midi';
import type { DeviceProfile } from '../types';

export function useMidi() {
  const controllerRef = useRef(new MidiController());
  const [connected, setConnected] = useState(false);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async (profile: DeviceProfile) => {
    try {
      setError(null);
      await controllerRef.current.requestAccess();
      const result = controllerRef.current.detectDevice(profile);

      if (result) {
        setConnected(true);
        setDeviceName(result.output.name || profile.name);
        return true;
      } else {
        setError('OP-XY not found. Make sure it is connected via USB-C.');
        return false;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to access MIDI';
      setError(msg);
      return false;
    }
  }, []);

  const disconnect = useCallback(() => {
    controllerRef.current.disconnect();
    setConnected(false);
    setDeviceName(null);
  }, []);

  return {
    controller: controllerRef.current,
    connected,
    deviceName,
    error,
    connect,
    disconnect,
  };
}
