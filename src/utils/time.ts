export function barsToMs(bars: number, tempo: number, beatsPerBar = 4): number {
  const msPerBeat = 60000 / tempo;
  return bars * beatsPerBar * msPerBeat;
}

export function msToDisplayTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function parseTimeInput(input: string): number | null {
  // Try mm:ss format
  const timeParts = input.match(/^(\d+):(\d{1,2})$/);
  if (timeParts) {
    const minutes = parseInt(timeParts[1], 10);
    const seconds = parseInt(timeParts[2], 10);
    if (seconds < 60) {
      return (minutes * 60 + seconds) * 1000;
    }
  }
  // Try raw seconds
  const numVal = parseFloat(input);
  if (!isNaN(numVal) && numVal > 0) {
    return numVal * 1000;
  }
  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
