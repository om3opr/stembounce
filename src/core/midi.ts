import type { DeviceProfile } from '../types';

export interface MidiDeviceInfo {
  id: string;
  name: string | null;
  manufacturer: string | null;
  type: 'input' | 'output';
}

export class MidiController {
  private output: MIDIOutput | null = null;
  private input: MIDIInput | null = null;
  private access: MIDIAccess | null = null;
  private _log: string[] = [];

  // BPM detection from MIDI Clock (0xF8, 24 ppqn)
  private clockTimestamps: number[] = [];
  private detectedBpm: number | null = null;
  private onBpmChange: ((bpm: number) => void) | null = null;
  private midiInputHandler: ((e: MIDIMessageEvent) => void) | null = null;

  private log(msg: string): void {
    const ts = new Date().toISOString().slice(11, 23);
    this._log.push(`[${ts}] ${msg}`);
    console.log(`[MIDI] ${msg}`);
  }

  getLog(): string[] {
    return [...this._log];
  }

  clearLog(): void {
    this._log = [];
  }

  async requestAccess(): Promise<MIDIAccess> {
    if (!navigator.requestMIDIAccess) {
      throw new Error('Web MIDI API is not supported in this browser. Please use Chrome.');
    }
    // Request sysex to allow System Realtime messages (Start/Stop/Continue)
    try {
      this.access = await navigator.requestMIDIAccess({ sysex: true });
      this.log(`MIDI access granted (with sysex). Outputs: ${this.access.outputs.size}, Inputs: ${this.access.inputs.size}`);
    } catch {
      // Fall back to non-sysex if user denies
      this.access = await navigator.requestMIDIAccess({ sysex: false });
      this.log(`MIDI access granted (no sysex). Outputs: ${this.access.outputs.size}, Inputs: ${this.access.inputs.size}`);
    }
    return this.access;
  }

  listAllDevices(): MidiDeviceInfo[] {
    if (!this.access) return [];
    const devices: MidiDeviceInfo[] = [];

    for (const output of this.access.outputs.values()) {
      devices.push({
        id: output.id,
        name: output.name,
        manufacturer: output.manufacturer,
        type: 'output',
      });
      this.log(`Found output: "${output.name}" (${output.manufacturer || 'no manufacturer'}) id=${output.id}`);
    }
    for (const input of this.access.inputs.values()) {
      devices.push({
        id: input.id,
        name: input.name,
        manufacturer: input.manufacturer,
        type: 'input',
      });
      this.log(`Found input: "${input.name}" (${input.manufacturer || 'no manufacturer'}) id=${input.id}`);
    }
    return devices;
  }

  selectOutputById(id: string): boolean {
    if (!this.access) return false;
    for (const output of this.access.outputs.values()) {
      if (output.id === id) {
        this.output = output;
        this.log(`Manually selected output: "${output.name}" id=${id}`);
        return true;
      }
    }
    return false;
  }

  detectDevice(profile: DeviceProfile): { output: MIDIOutput; input: MIDIInput | null } | null {
    if (!this.access) return null;

    // Log all available devices first
    this.listAllDevices();

    let foundOutput: MIDIOutput | null = null;
    let foundInput: MIDIInput | null = null;

    for (const output of this.access.outputs.values()) {
      if (profile.detectName.some((name) => output.name?.includes(name))) {
        foundOutput = output;
        this.log(`Auto-detected output: "${output.name}"`);
        break;
      }
    }

    // If no auto-detect match, use the first available output
    if (!foundOutput) {
      const firstOutput = this.access.outputs.values().next().value;
      if (firstOutput) {
        foundOutput = firstOutput;
        this.log(`No OP-XY name match — falling back to first output: "${firstOutput.name}"`);
      }
    }

    for (const input of this.access.inputs.values()) {
      if (profile.detectName.some((name) => input.name?.includes(name))) {
        foundInput = input;
        break;
      }
    }

    if (foundOutput) {
      this.output = foundOutput;
      this.input = foundInput;
      return { output: foundOutput, input: foundInput };
    }

    this.log('ERROR: No MIDI outputs found at all');
    return null;
  }

  getOutput(): MIDIOutput | null {
    return this.output;
  }

  getInput(): MIDIInput | null {
    return this.input;
  }

  sendCC(channel: number, cc: number, value: number): void {
    if (!this.output) throw new Error('MIDI output not connected');
    const statusByte = 0xb0 + (channel - 1);
    const clampedValue = Math.max(0, Math.min(127, value));
    const msg = [statusByte, cc, clampedValue];
    this.log(`TX → ch=${channel} cc=${cc} val=${clampedValue} [${msg.map(b => '0x' + b.toString(16).toUpperCase()).join(', ')}] → "${this.output.name}"`);
    this.output.send(msg);
  }

  muteTrack(profile: DeviceProfile, track: number): void {
    this.sendCC(profile.getTrackChannel(track), profile.muteCC, profile.muteOnValue);
  }

  unmuteTrack(profile: DeviceProfile, track: number): void {
    this.sendCC(profile.getTrackChannel(track), profile.muteCC, profile.muteOffValue);
  }

  muteAllTracks(profile: DeviceProfile): void {
    for (let i = 1; i <= profile.trackCount; i++) {
      this.muteTrack(profile, i);
    }
  }

  unmuteAllTracks(profile: DeviceProfile): void {
    for (let i = 1; i <= profile.trackCount; i++) {
      this.unmuteTrack(profile, i);
    }
  }

  // CC-based transport (per spec doc — may not work on all firmware)
  playCC(profile: DeviceProfile): void {
    this.sendCC(profile.playChannel, profile.playCC, 127);
  }

  stopCC(profile: DeviceProfile): void {
    this.sendCC(profile.playChannel, profile.stopCC, 127);
  }

  // MIDI System Realtime transport (standard sequencer control)
  sendRaw(bytes: number[]): void {
    if (!this.output) throw new Error('MIDI output not connected');
    this.log(`TX → RAW [${bytes.map(b => '0x' + b.toString(16).toUpperCase()).join(', ')}] → "${this.output.name}"`);
    this.output.send(bytes);
  }

  midiStart(): void {
    this.sendRaw([0xfa]); // MIDI Start
  }

  midiStop(): void {
    this.sendRaw([0xfc]); // MIDI Stop
  }

  midiContinue(): void {
    this.sendRaw([0xfb]); // MIDI Continue
  }

  // Default play/stop — uses Realtime
  play(_profile: DeviceProfile): void {
    this.midiStart();
  }

  stop(_profile: DeviceProfile): void {
    this.midiStop();
  }

  jumpToScene(profile: DeviceProfile, scene: number): void {
    if (profile.hasSceneSupport && profile.sceneCC != null) {
      this.sendCC(profile.playChannel, profile.sceneCC, scene);
    }
  }

  // --- BPM detection ---

  async startBpmDetection(callback: (bpm: number) => void): Promise<void> {
    if (!this.input) {
      this.log('Cannot detect BPM: no MIDI input connected');
      return;
    }

    // Explicitly open the input port
    if (this.input.connection !== 'open') {
      this.log(`Opening MIDI input port: "${this.input.name}"...`);
      await this.input.open();
      this.log(`MIDI input port opened: ${this.input.connection}`);
    }

    this.onBpmChange = callback;
    this.clockTimestamps = [];
    this.detectedBpm = null;

    let msgCount = 0;

    this.midiInputHandler = (e: MIDIMessageEvent) => {
      const data = e.data;
      if (!data || data.length === 0) return;

      const status = data[0];
      msgCount++;

      // Log first few messages for debugging
      if (msgCount <= 5) {
        const hex = Array.from(data).map(b => '0x' + b.toString(16).toUpperCase()).join(', ');
        this.log(`RX ← [${hex}] from "${this.input?.name}"`);
      }

      // 0xF8 = MIDI Clock (24 per quarter note)
      if (status === 0xf8) {
        const now = performance.now();
        this.clockTimestamps.push(now);

        if (this.clockTimestamps.length > 48) {
          this.clockTimestamps.shift();
        }

        if (this.clockTimestamps.length >= 24) {
          const count = this.clockTimestamps.length;
          const spanMs = this.clockTimestamps[count - 1] - this.clockTimestamps[0];
          const avgClockMs = spanMs / (count - 1);
          const quarterNoteMs = avgClockMs * 24;
          const bpm = Math.round(60000 / quarterNoteMs);

          if (bpm >= 20 && bpm <= 300) {
            this.detectedBpm = bpm;
            this.log(`BPM from MIDI Clock: ${bpm}`);
            this.onBpmChange?.(bpm);
          }
        }
      }

      // CC 80 = Tempo on OP-XY (value 0-127 maps to 40-220 BPM)
      if ((status & 0xf0) === 0xb0 && data.length >= 3 && data[1] === 80) {
        const val = data[2];
        // Linear map: 0 = 40 BPM, 127 = 220 BPM
        const bpm = Math.round(40 + (val / 127) * 180);
        this.detectedBpm = bpm;
        this.log(`BPM from CC80: val=${val} → ${bpm} BPM`);
        this.onBpmChange?.(bpm);
      }

      // MIDI Song Position Pointer or other timing messages
      // can also help detect tempo — logged for debugging
      if (status === 0xfa) this.log('RX ← MIDI Start');
      if (status === 0xfb) this.log('RX ← MIDI Continue');
      if (status === 0xfc) this.log('RX ← MIDI Stop');
    };

    this.input.onmidimessage = this.midiInputHandler;
    this.log(`BPM detection started on input: "${this.input.name}" (state: ${this.input.connection})`);
  }

  stopBpmDetection(): void {
    if (this.input) {
      this.input.onmidimessage = null;
    }
    this.midiInputHandler = null;
    this.onBpmChange = null;
    this.clockTimestamps = [];
  }

  getDetectedBpm(): number | null {
    return this.detectedBpm;
  }

  // --- Beat-1 sync for recording alignment ---
  // Listens for the first MIDI Clock tick after we send Start.
  // Returns a high-res timestamp (performance.now()) of beat 1.

  private beat1Timestamp: number | null = null;
  private beat1Handler: ((e: MIDIMessageEvent) => void) | null = null;
  private beat1ClockCount = 0;

  async startBeat1Sync(): Promise<void> {
    this.beat1Timestamp = null;
    this.beat1ClockCount = 0;

    if (!this.input) {
      this.log('Beat-1 sync: no MIDI input — will use play-command timestamp as fallback');
      return;
    }

    if (this.input.connection !== 'open') {
      await this.input.open();
    }

    this.beat1Handler = (e: MIDIMessageEvent) => {
      const data = e.data;
      if (!data || data.length === 0) return;

      // First MIDI Clock (0xF8) after Start = beat 1
      if (data[0] === 0xf8 && this.beat1Timestamp === null) {
        this.beat1ClockCount++;
        // Use the very first clock tick as beat 1
        if (this.beat1ClockCount === 1) {
          this.beat1Timestamp = performance.now();
          this.log(`Beat-1 sync: first clock at ${this.beat1Timestamp.toFixed(2)}ms`);
        }
      }

      // MIDI Start echo — reset clock count
      if (data[0] === 0xfa) {
        this.beat1ClockCount = 0;
        this.beat1Timestamp = null;
      }
    };

    this.input.onmidimessage = this.beat1Handler;
    this.log('Beat-1 sync listener started');
  }

  stopBeat1Sync(): void {
    if (this.input && this.beat1Handler) {
      this.input.onmidimessage = null;
    }
    this.beat1Handler = null;
  }

  getBeat1Timestamp(): number | null {
    return this.beat1Timestamp;
  }

  disconnect(): void {
    this.stopBpmDetection();
    this.stopBeat1Sync();
    this.output = null;
    this.input = null;
  }
}
