import { Platform, NativeModules } from 'react-native';
import { safeLocalStorage } from './storage';
import type { DeviceInfo } from './types';
import { generateStrId } from './utils';

function getLocale() {
  return Platform.OS === 'ios'
    ? NativeModules.SettingsManager.settings.AppleLocale
          || NativeModules.SettingsManager.settings.AppleLanguages[0]
    : NativeModules.I18nManager.localeIdentifier;
}

const defaultDeviceInfo = {
  deviceId: null,
  locale: null,
  platform: null,
};

// eslint-disable-next-line import/prefer-default-export
export async function getDeviceInfo(): Promise<DeviceInfo> {
  const data: DeviceInfo = {
    ...defaultDeviceInfo,
    locale: getLocale(),
    platform: Platform.OS,
  };

  let deviceId = await safeLocalStorage.getItem<string>('deviceId');
  if (deviceId) {
    data.deviceId = deviceId;
  } else {
    deviceId = generateStrId(12);
    data.deviceId = deviceId;
    await safeLocalStorage.setItem('deviceId', deviceId);
  }

  return data;
}
