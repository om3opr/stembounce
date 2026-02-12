export class AudioRecorder {
  private audioContext: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private leftBuffers: Float32Array[] = [];
  private rightBuffers: Float32Array[] = [];
  private isRecording = false;
  private stream: MediaStream | null = null;
  private recordingStartTime = 0;

  async init(stream: MediaStream, sampleRate: number): Promise<void> {
    this.stream = stream;
    this.audioContext = new AudioContext({ sampleRate });

    // Resume context if suspended (Chrome autoplay policy)
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  startRecording(): void {
    if (!this.audioContext || !this.stream) {
      throw new Error('AudioRecorder not initialized');
    }

    this.leftBuffers = [];
    this.rightBuffers = [];
    this.isRecording = true;
    this.recordingStartTime = performance.now();

    this.source = this.audioContext.createMediaStreamSource(this.stream);

    // Using ScriptProcessorNode for broad compatibility
    // (AudioWorklet would be ideal but requires serving a separate file)
    this.processor = this.audioContext.createScriptProcessor(4096, 2, 2);

    this.processor.onaudioprocess = (e: AudioProcessingEvent) => {
      if (!this.isRecording) return;

      const left = e.inputBuffer.getChannelData(0);
      const right = e.inputBuffer.getChannelData(1);

      this.leftBuffers.push(new Float32Array(left));
      this.rightBuffers.push(new Float32Array(right));
    };

    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }

  stopRecording(): { left: Float32Array; right: Float32Array } {
    this.isRecording = false;

    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }

    const left = this.mergeBuffers(this.leftBuffers);
    const right = this.mergeBuffers(this.rightBuffers);

    this.leftBuffers = [];
    this.rightBuffers = [];

    return { left, right };
  }

  getRecordingState(): boolean {
    return this.isRecording;
  }

  getRecordingStartTime(): number {
    return this.recordingStartTime;
  }

  getSampleRate(): number {
    return this.audioContext?.sampleRate ?? 48000;
  }

  getCurrentLevel(): number {
    if (this.leftBuffers.length === 0) return 0;
    const lastBuffer = this.leftBuffers[this.leftBuffers.length - 1];
    let sum = 0;
    for (let i = 0; i < lastBuffer.length; i++) {
      sum += Math.abs(lastBuffer[i]);
    }
    return sum / lastBuffer.length;
  }

  private mergeBuffers(buffers: Float32Array[]): Float32Array {
    const totalLength = buffers.reduce((acc, buf) => acc + buf.length, 0);
    const result = new Float32Array(totalLength);
    let offset = 0;
    for (const buffer of buffers) {
      result.set(buffer, offset);
      offset += buffer.length;
    }
    return result;
  }

  destroy(): void {
    this.isRecording = false;
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
