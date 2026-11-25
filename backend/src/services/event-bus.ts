import { EventEmitter } from 'node:events';

class MediaFlowEvents extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
  }
}

export const events = new MediaFlowEvents();

export const EVENTS = {
  jobCreated: 'job:created',
  jobUpdated: 'job:updated',
  jobRemoved: 'job:removed',
  queueStats: 'queue:stats',
  historyChanged: 'history:changed',
  settingsUpdated: 'settings:updated',
} as const;
