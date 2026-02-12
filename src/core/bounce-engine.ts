import { MidiController } from './midi';
import { AudioRecorder } from './audio-recorder';
import { encodeWAV } from './wav-encoder';
import { trimSilence } from './silence-trimmer';
import { wait } from '../utils/time';
import type { DeviceProfile, BounceConfig, StemResult, BounceProgress } from '../types';

export type BounceCallback = (progress: BounceProgress) => void;

interface RawRecording {
  trackNumber: number;
  name: string;
  left: Float32Array;
  right: Float32Array;
  durationMs: number;
  trimSamples: number; // samples to trim from head for beat-1 alignment
}

export class BounceEngine {
  private midi: MidiController;
  private recorder: AudioRecorder;
  private cancelled = false;

  constructor(midi: MidiController, recorder: AudioRecorder) {
    this.midi = midi;
    this.recorder = recorder;
  }

  cancel(): void {
    this.cancelled = true;
  }

  /**
   * Calculate how many samples to trim based on the delta between
   * recording start and beat 1 (from MIDI clock or play-command timestamp).
   */
  private calculateTrimSamples(
    recordingStartMs: number,
    playCommandMs: number,
    beat1Ms: number | null,
    sampleRate: number
  ): number {
    // Prefer MIDI Clock beat-1 timestamp if available (sample-accurate)
    // Otherwise fall back to the play-command timestamp
    const beat1Time = beat1Ms ?? playCommandMs;
    const deltaMs = beat1Time - recordingStartMs;

    if (deltaMs <= 0) return 0;

    const samples = Math.round((deltaMs / 1000) * sampleRate);
    console.log(
      `[Bounce] Trim: recStart=${recordingStartMs.toFixed(1)}ms, ` +
      `play=${playCommandMs.toFixed(1)}ms, ` +
      `beat1=${beat1Ms?.toFixed(1) ?? 'n/a'}ms, ` +
      `delta=${deltaMs.toFixed(1)}ms → ${samples} samples`
    );
    return samples;
  }

  /**
   * Record one pass: start recording, play, wait, stop, return raw audio + trim info.
   */
  private async recordOnePass(
    profile: DeviceProfile,
    config: BounceConfig,
    passIndex: number,
    totalTracks: number,
    passName: string,
    completedStems: StemResult[],
    onProgress: BounceCallback
  ): Promise<{ left: Float32Array; right: Float32Array; trimSamples: number } | null> {
    const totalWait = config.songLengthMs + config.tailMs;

    // Start the beat-1 sync listener
    await this.midi.startBeat1Sync();

    // Start recording — timestamp is captured internally
    this.recorder.startRecording();
    const recStartMs = this.recorder.getRecordingStartTime();

    onProgress({
      currentTrack: passIndex,
      totalTracks,
      currentTrackName: passName,
      trackElapsedMs: 0,
      trackTotalMs: totalWait,
      completedStems: [...completedStems],
      isRecording: true,
    });

    // Jump to scene 1 for consistent start position
    if (profile.hasSceneSupport) {
      this.midi.jumpToScene(profile, 0);
      await wait(100);
    }

    // Send play — capture timestamp
    const playCommandMs = performance.now();
    this.midi.play(profile);

    // Wait for song duration + tail, updating progress
    const updateInterval = 250;
    let elapsed = 0;

    while (elapsed < totalWait && !this.cancelled) {
      const sleepTime = Math.min(updateInterval, totalWait - elapsed);
      await wait(sleepTime);
      elapsed += sleepTime;

      onProgress({
        currentTrack: passIndex,
        totalTracks,
        currentTrackName: passName,
        trackElapsedMs: elapsed,
        trackTotalMs: totalWait,
        completedStems: [...completedStems],
        isRecording: true,
      });
    }

    // Stop playback
    this.midi.stop(profile);
    await wait(100);

    // Grab beat-1 timestamp before stopping sync
    const beat1Ms = this.midi.getBeat1Timestamp();
    this.midi.stopBeat1Sync();

    // Stop recording
    const { left, right } = this.recorder.stopRecording();

    if (this.cancelled) return null;

    // Calculate trim: how many samples of pre-roll to remove
    const trimSamples = this.calculateTrimSamples(
      recStartMs,
      playCommandMs,
      beat1Ms,
      config.sampleRate
    );

    return { left, right, trimSamples };
  }

  async run(
    profile: DeviceProfile,
    config: BounceConfig,
    onProgress: BounceCallback
  ): Promise<StemResult[]> {
    this.cancelled = false;
    const rawRecordings: RawRecording[] = [];
    const completedStems: StemResult[] = [];
    const enabledTracks = config.tracks.filter((t) => t.enabled);
    const totalTracks = enabledTracks.length + (config.includeMixPass ? 1 : 0);

    // Phase 1: Mute all tracks
    this.midi.muteAllTracks(profile);
    await wait(200);

    // Phase 2: Bounce each enabled track
    for (let i = 0; i < enabledTracks.length; i++) {
      if (this.cancelled) break;

      const track = enabledTracks[i];

      onProgress({
        currentTrack: i + 1,
        totalTracks,
        currentTrackName: track.name,
        trackElapsedMs: 0,
        trackTotalMs: config.songLengthMs + config.tailMs,
        completedStems: [...completedStems],
        isRecording: false,
      });

      // Unmute this track only
      this.midi.unmuteTrack(profile, track.trackNumber);
      await wait(100);

      const result = await this.recordOnePass(
        profile, config, i + 1, totalTracks, track.name, completedStems, onProgress
      );

      if (result) {
        rawRecordings.push({
          trackNumber: track.trackNumber,
          name: track.name,
          left: result.left,
          right: result.right,
          durationMs: config.songLengthMs + config.tailMs,
          trimSamples: result.trimSamples,
        });
        completedStems.push({
          trackNumber: track.trackNumber,
          name: track.name,
          wavBuffer: new ArrayBuffer(0),
          durationMs: config.songLengthMs + config.tailMs,
        });
      }

      // Re-mute this track
      this.midi.muteTrack(profile, track.trackNumber);
      await wait(200);
    }

    // Phase 3: Optional full mix pass (only selected tracks)
    if (config.includeMixPass && !this.cancelled) {
      this.midi.muteAllTracks(profile);
      await wait(100);
      for (const track of enabledTracks) {
        this.midi.unmuteTrack(profile, track.trackNumber);
      }
      await wait(200);

      const result = await this.recordOnePass(
        profile, config, totalTracks, totalTracks, 'Full Mix', completedStems, onProgress
      );

      if (result) {
        rawRecordings.push({
          trackNumber: 0,
          name: 'Full Mix',
          left: result.left,
          right: result.right,
          durationMs: config.songLengthMs + config.tailMs,
          trimSamples: result.trimSamples,
        });
      }
    }

    // Phase 4: Restore — unmute all tracks
    this.midi.unmuteAllTracks(profile);

    // Phase 5: Align all stems
    // Use a single consistent trim offset across all stems.
    // If MIDI Clock was available, each pass has its own precise trim.
    // If not, each pass has its play-command-timestamp trim.
    // Either way, to guarantee alignment, use the MEDIAN trim value
    // (robust against outliers) so all stems share the same cut point.
    const trimValues = rawRecordings.map((r) => r.trimSamples);
    const medianTrim = trimValues.length > 0
      ? trimValues.sort((a, b) => a - b)[Math.floor(trimValues.length / 2)]
      : 0;

    console.log(
      `[Bounce] Per-pass trims: [${trimValues.join(', ')}] → using median: ${medianTrim} samples`
    );

    // Encode all stems with the same trim
    const stems: StemResult[] = [];
    for (const rec of rawRecordings) {
      const trimmed = trimSilence(rec.left, rec.right, medianTrim);
      const wavBuffer = encodeWAV(
        [trimmed.left, trimmed.right],
        config.sampleRate,
        config.bitDepth
      );
      stems.push({
        trackNumber: rec.trackNumber,
        name: rec.name,
        wavBuffer,
        durationMs: rec.durationMs,
      });
    }

    return stems;
  }
}
