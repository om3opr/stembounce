export interface DeviceProfile {
  name: string;
  detectName: string[];
  trackCount: number;
  muteCC: number;
  muteOnValue: number;
  muteOffValue: number;
  playCC: number;
  stopCC: number;
  playChannel: number;
  getTrackChannel(track: number): number;
  hasSceneSupport: boolean;
  sceneCC?: number;
}

export interface TrackConfig {
  trackNumber: number;
  name: string;
  enabled: boolean;
}

export interface BounceConfig {
  tracks: TrackConfig[];
  songLengthMs: number;
  tailMs: number;
  sampleRate: 44100 | 48000;
  bitDepth: 16 | 24;
  includeMixPass: boolean;
  tempo: number;
  songLengthBars: number;
}

export interface StemResult {
  trackNumber: number;
  name: string;
  wavBuffer: ArrayBuffer;
  durationMs: number;
}

export type AppScreen = 'connect' | 'configure' | 'bouncing' | 'complete';

export interface ConnectionState {
  midiOutput: MIDIOutput | null;
  midiInput: MIDIInput | null;
  audioStream: MediaStream | null;
  deviceName: string | null;
}

export interface BounceProgress {
  currentTrack: number;
  totalTracks: number;
  currentTrackName: string;
  trackElapsedMs: number;
  trackTotalMs: number;
  completedStems: StemResult[];
  isRecording: boolean;
  warning?: string;
}
