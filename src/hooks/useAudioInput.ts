import { useState, useCallback, useRef } from 'react';

export function useAudioInput() {
  const streamRef = useRef<MediaStream | null>(null);
  const [connected, setConnected] = useState(false);
  const [deviceLabel, setDeviceLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async (sampleRate: number = 48000) => {
    try {
      setError(null);

      // First get permission, then enumerate to find OP-XY
      const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      tempStream.getTracks().forEach((t) => t.stop());

      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter((d) => d.kind === 'audioinput');

      // Try to find OP-XY audio device
      const opXyDevice = audioInputs.find(
        (d) =>
          d.label.includes('OP-XY') ||
          d.label.includes('OP–XY') ||
          d.label.includes('OP_XY')
      );

      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: opXyDevice ? { exact: opXyDevice.deviceId } : undefined,
          channelCount: 2,
          sampleRate: { ideal: sampleRate },
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setConnected(true);
      setDeviceLabel(
        opXyDevice?.label || stream.getAudioTracks()[0]?.label || 'Audio Input'
      );
      return stream;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to access audio input';
      setError(msg);
      return null;
    }
  }, []);

  const disconnect = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setConnected(false);
    setDeviceLabel(null);
  }, []);

  return {
    stream: streamRef.current,
    connected,
    deviceLabel,
    error,
    connect,
    disconnect,
  };
}
