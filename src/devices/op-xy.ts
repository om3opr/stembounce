import type { DeviceProfile } from '../types';

export const opXyProfile: DeviceProfile = {
  name: 'Teenage Engineering OP-XY',
  detectName: ['OP-XY', 'OP–XY', 'OP_XY'],
  trackCount: 8,
  muteCC: 9,
  muteOnValue: 127,
  muteOffValue: 0,
  playCC: 104,
  stopCC: 105,
  playChannel: 1,
  getTrackChannel: (track: number) => track,
  hasSceneSupport: true,
  sceneCC: 85,
};
