import JSZip from 'jszip';
import type { StemResult } from '../types';

export function stemFileName(stem: StemResult, bpm: number): string {
  const num = stem.trackNumber === 0 ? 'Mix' : stem.trackNumber.toString().padStart(2, '0');
  return `${num}_${sanitizeFileName(stem.name)}_${bpm}BPM.wav`;
}

export async function packageStems(
  stems: StemResult[],
  projectName: string,
  bpm: number
): Promise<Blob> {
  const zip = new JSZip();
  const folderName = `${projectName}_${bpm}BPM`;
  const folder = zip.folder(folderName);

  if (!folder) throw new Error('Failed to create ZIP folder');

  for (const stem of stems) {
    folder.file(stemFileName(stem, bpm), stem.wavBuffer);
  }

  return zip.generateAsync({ type: 'blob' });
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-\s]/g, '').replace(/\s+/g, '_');
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
