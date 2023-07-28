import { getDeviceInfo } from './device';
import { safeLocalStorage, safeSessionStorage } from './storage';
import type { Store } from './types';
import { generateNumId, generateStrId } from './utils';

const storageKeys = {
  appId: 'local',
  queue: 'local',
  props: 'local',
  userId: 'local',
  anonId: 'local',
  device: 'local',
  sessionId: 'session',
  lastActive: 'local',
  initialized: 'local',
};

async function getInitialStore(): Promise<Store> {
  const appId = (await safeLocalStorage.getItem<string>('appId')) ?? null;
  const queue = JSON.parse(await safeLocalStorage.getItem('queue') || '[]');
  const props = JSON.parse(await safeLocalStorage.getItem('props') || '{}');
  const userId = await safeLocalStorage.getItem<string>('userId') ?? null;
  const anonId = await safeLocalStorage.getItem<string>('anonId') ?? generateStrId(12);
  const device = JSON.parse(await safeLocalStorage.getItem('device') || 'null') ?? await getDeviceInfo();
  const sessionId = await safeLocalStorage.getItem<number>('sessionId') ?? generateNumId();
  const lastActive = JSON.parse(await safeLocalStorage.getItem('lastActive') || 'null') ?? Date.now();
  const initialized = JSON.parse(await safeLocalStorage.getItem('initialized') || 'false');

  return {
    appId,
    queue,
    props,
    userId,
    anonId,
    device,
    sessionId,
    lastActive,
    initialized,
  };
}

export default async function buildStore(): Promise<Store> {
  const stored = await getInitialStore();

  const store = new Proxy(stored, {
    get(target: Store, prop: keyof Store) {
      const value = Reflect.get(target, prop);
      if (value != null) return value; // value in memory

      const storageType = storageKeys[prop];
      const storage = storageType === 'session' ? safeSessionStorage : safeLocalStorage;

      const storageValue = storage.getItem(`nucleus-${String(prop)}`);
      if (storageValue !== null && typeof storageValue === 'string') {
        const parsedValue = JSON.parse(storageValue);
        // @ts-expect-error: this is fine
        target[prop] = parsedValue;
        return parsedValue;
      }

      return null;
    },
    set(target: Store, prop: keyof Store, value: unknown) {
      const storageType = storageKeys[prop];
      const storage = storageType === 'session' ? safeSessionStorage : safeLocalStorage;

      // @ts-expect-error: this is fine
      target[prop] = value;
      storage.setItem(`nucleus-${String(prop)}`, JSON.stringify(value));
      return true;
    },
  });

  return store;
}
