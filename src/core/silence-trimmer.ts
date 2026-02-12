/**
 * Find the sample index where audio first exceeds the silence threshold.
 * Uses a small lookback window to avoid cutting transients.
 */
export function findAudioStart(
  left: Float32Array,
  right: Float32Array,
  threshold = 0.005, // ~-46dB — catches even quiet beginnings
  lookbackSamples = 64 // keep a tiny buffer before the first sound
): number {
  const length = Math.min(left.length, right.length);

  for (let i = 0; i < length; i++) {
    const level = Math.max(Math.abs(left[i]), Math.abs(right[i]));
    if (level > threshold) {
      return Math.max(0, i - lookbackSamples);
    }
  }

  // All silence — return 0 (don't trim)
  return 0;
}

/**
 * Trim silence from the beginning of stereo audio buffers.
 * Returns new trimmed buffers.
 */
export function trimSilence(
  left: Float32Array,
  right: Float32Array,
  trimSamples: number
): { left: Float32Array; right: Float32Array } {
  if (trimSamples <= 0) return { left, right };

  return {
    left: left.subarray(trimSamples),
    right: right.subarray(trimSamples),
  };
}

/**
 * For a batch of stems, find the trim offset from the first stem
 * that has audio, then apply the same trim to all.
 * This keeps all stems perfectly aligned.
 */
export function findConsistentTrimOffset(
  recordings: Array<{ left: Float32Array; right: Float32Array }>,
  threshold = 0.005,
  lookbackSamples = 64
): number {
  let minOffset = Infinity;

  for (const rec of recordings) {
    const offset = findAudioStart(rec.left, rec.right, threshold, lookbackSamples);
    if (offset > 0 && offset < minOffset) {
      minOffset = offset;
    }
  }

  return minOffset === Infinity ? 0 : minOffset;
}
