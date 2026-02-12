import { useAppStore } from '../store';
import { msToDisplayTime } from '../utils/time';
import { AudioMeter } from './AudioMeter';

interface BounceScreenProps {
  audioStream: MediaStream | null;
  onCancel: () => void;
}

const WAVE_BARS = 24;

export function BounceScreen({ audioStream, onCancel }: BounceScreenProps) {
  const { progress, tracks } = useAppStore();

  if (!progress) return null;

  const { currentTrack, totalTracks, currentTrackName, trackElapsedMs, trackTotalMs, completedStems, isRecording, warning } = progress;

  const trackProgress = trackTotalMs > 0 ? trackElapsedMs / trackTotalMs : 0;

  // Estimate total remaining time
  const remainingThisTrack = trackTotalMs - trackElapsedMs;
  const remainingTracks = totalTracks - currentTrack;
  const totalRemainingMs = remainingThisTrack + remainingTracks * trackTotalMs;

  const enabledTracks = tracks.filter((t) => t.enabled);

  return (
    <div className="screen bounce-screen">
      <div className="bounce-header">
        <div className="recording-indicator">
          <span className="rec-dot" />
          <span className="rec-label">rec</span>
        </div>
        <div className="bounce-track-name">{currentTrackName}</div>
        <div className="bounce-counter">
          track {currentTrack} of {totalTracks}
        </div>
      </div>

      {/* Animated waveform */}
      <div className="waveform-visualizer">
        {Array.from({ length: WAVE_BARS }, (_, i) => (
          <div
            key={i}
            className={`wave-bar ${isRecording ? 'active' : ''}`}
            style={{ animationDelay: `${i * 0.07}s` }}
          />
        ))}
      </div>

      <div className="progress-bar-container">
        <div
          className="progress-bar-fill"
          style={{ width: `${trackProgress * 100}%` }}
        />
        <span className="progress-time">
          {msToDisplayTime(trackElapsedMs)} / {msToDisplayTime(trackTotalMs)}
        </span>
      </div>

      <div className="track-list">
        {enabledTracks.map((track, i) => {
          const idx = i + 1;
          const isComplete = completedStems.some(
            (s) => s.trackNumber === track.trackNumber
          );
          const isCurrent = idx === currentTrack && currentTrackName !== 'Full Mix';

          return (
            <div
              key={track.trackNumber}
              className={`track-status ${isComplete ? 'complete' : ''} ${isCurrent ? 'current' : ''}`}
            >
              <span className="track-icon">
                {isComplete ? '\u2713' : isCurrent ? '\u25B8' : '\u25CB'}
              </span>
              <span className="track-label">
                {track.name}
              </span>
              <span className="track-info">
                {isComplete
                  ? msToDisplayTime(trackTotalMs)
                  : isCurrent
                    ? 'recording...'
                    : ''}
              </span>
            </div>
          );
        })}

        {useAppStore.getState().includeMixPass && (
          <div
            className={`track-status ${
              completedStems.some((s) => s.trackNumber === 0) ? 'complete' : ''
            } ${currentTrackName === 'Full Mix' ? 'current' : ''}`}
          >
            <span className="track-icon">
              {completedStems.some((s) => s.trackNumber === 0)
                ? '\u2713'
                : currentTrackName === 'Full Mix'
                  ? '\u25B8'
                  : '\u25CB'}
            </span>
            <span className="track-label">full mix</span>
            <span className="track-info">
              {currentTrackName === 'Full Mix' ? 'recording...' : ''}
            </span>
          </div>
        )}
      </div>

      <p className="remaining-time">
        ~{msToDisplayTime(totalRemainingMs)} remaining
      </p>

      <AudioMeter stream={audioStream} active={isRecording} />

      {warning && (
        <div className="bounce-warning">
          <span className="bounce-warning-icon">!</span>
          {warning}
        </div>
      )}

      <button className="btn-danger" onClick={onCancel}>
        cancel bounce
      </button>
    </div>
  );
}
