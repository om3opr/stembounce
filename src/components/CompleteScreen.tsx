import { useAppStore } from '../store';
import { formatFileSize, msToDisplayTime } from '../utils/time';
import { packageStems, stemFileName, downloadBlob } from '../core/zip-packager';

interface CompleteScreenProps {
  onNewBounce: () => void;
}

export function CompleteScreen({ onNewBounce }: CompleteScreenProps) {
  const { stems, tempo } = useAppStore();

  const handleDownloadAll = async () => {
    const zipBlob = await packageStems(stems, 'StemBounce_Export', tempo);
    downloadBlob(zipBlob, `StemBounce_Export_${tempo}BPM.zip`);
  };

  const handleDownloadSingle = (stem: (typeof stems)[0]) => {
    const blob = new Blob([stem.wavBuffer], { type: 'audio/wav' });
    downloadBlob(blob, stemFileName(stem, tempo));
  };

  const totalSize = stems.reduce((acc, s) => acc + s.wavBuffer.byteLength, 0);

  return (
    <div className="screen complete-screen">
      <div className="complete-hero">
        <div className="complete-check">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#22c97a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4,10 8,14 16,6" />
          </svg>
        </div>
        <div className="complete-title">bounce complete</div>
        <div className="complete-count">{stems.length} stems exported</div>
      </div>

      <div className="stem-list">
        {stems.map((stem) => (
          <div
            key={stem.trackNumber}
            className="stem-row"
            onClick={() => handleDownloadSingle(stem)}
          >
            <span className="stem-icon">{'\u2713'}</span>
            <span className="stem-name">{stemFileName(stem, tempo)}</span>
            <span className="stem-size">
              {formatFileSize(stem.wavBuffer.byteLength)}
            </span>
            <span className="stem-duration">{msToDisplayTime(stem.durationMs)}</span>
            <span className="stem-download-hint">{'\u2193'}</span>
          </div>
        ))}
      </div>

      <p className="total-size">total: {formatFileSize(totalSize)}</p>

      <div className="action-row">
        <button className="btn-primary" onClick={handleDownloadAll}>
          download all (zip)
        </button>
        <button className="btn-secondary" onClick={onNewBounce}>
          new bounce
        </button>
      </div>

      <p className="footnote">click any stem to download individually</p>
    </div>
  );
}
