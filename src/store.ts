import { create } from 'zustand';
import type { AppScreen, TrackConfig, StemResult, BounceProgress } from './types';

interface AppState {
  screen: AppScreen;
  setScreen: (screen: AppScreen) => void;

  // Track configuration
  tracks: TrackConfig[];
  setTracks: (tracks: TrackConfig[]) => void;
  toggleTrack: (trackNumber: number) => void;
  renameTrack: (trackNumber: number, name: string) => void;

  // Bounce settings
  tempo: number;
  setTempo: (tempo: number) => void;
  songLengthBars: number;
  setSongLengthBars: (bars: number) => void;
  tailSeconds: number;
  setTailSeconds: (seconds: number) => void;
  sampleRate: 44100 | 48000;
  setSampleRate: (rate: 44100 | 48000) => void;
  bitDepth: 16 | 24;
  setBitDepth: (depth: 16 | 24) => void;
  includeMixPass: boolean;
  setIncludeMixPass: (include: boolean) => void;

  // Bounce progress
  progress: BounceProgress | null;
  setProgress: (progress: BounceProgress | null) => void;

  // Results
  stems: StemResult[];
  setStems: (stems: StemResult[]) => void;

  // Reset
  reset: () => void;
}

const defaultTracks: TrackConfig[] = Array.from({ length: 8 }, (_, i) => ({
  trackNumber: i + 1,
  name: `Track ${i + 1}`,
  enabled: true,
}));

export const useAppStore = create<AppState>((set) => ({
  screen: 'connect',
  setScreen: (screen) => set({ screen }),

  tracks: defaultTracks,
  setTracks: (tracks) => set({ tracks }),
  toggleTrack: (trackNumber) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.trackNumber === trackNumber ? { ...t, enabled: !t.enabled } : t
      ),
    })),
  renameTrack: (trackNumber, name) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.trackNumber === trackNumber ? { ...t, name } : t
      ),
    })),

  tempo: 120,
  setTempo: (tempo) => set({ tempo }),
  songLengthBars: 32,
  setSongLengthBars: (songLengthBars) => set({ songLengthBars }),
  tailSeconds: 2,
  setTailSeconds: (tailSeconds) => set({ tailSeconds }),
  sampleRate: 48000,
  setSampleRate: (sampleRate) => set({ sampleRate }),
  bitDepth: 24,
  setBitDepth: (bitDepth) => set({ bitDepth }),
  includeMixPass: true,
  setIncludeMixPass: (includeMixPass) => set({ includeMixPass }),

  progress: null,
  setProgress: (progress) => set({ progress }),

  stems: [],
  setStems: (stems) => set({ stems }),

  reset: () =>
    set({
      screen: 'configure',
      progress: null,
      stems: [],
    }),
}));
