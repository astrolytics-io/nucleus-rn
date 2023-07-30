import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';
import { getDeviceInfo } from './device';
import { isDevMode, cleanEvent, generateNumId, ExtendedWebSocket } from './utils';
import defaults from './config';
import Logger from './logger';
import type { Options, ServerACK, HeartbeatEvent, NucleusEvent, Store } from './types';
import buildStore from './store';

// eslint-disable-next-line no-use-before-define
let client: Nucleus | null = null;

export default class Nucleus {
  public static init(appId: string, options: Partial<Options> = {}) {
    client = new Nucleus(appId, options);
  }

  public static track(
    name: NucleusEvent['name'],
    payload: NucleusEvent['payload'],
  ) {
    this.getClient()?.track(name, payload);
  }

  public static trackError(name: string, err: Error) {
    this.getClient()?.trackError(name, err);
  }

  public static disableTracking() {
    this.getClient()?.disableTracking();
  }

  public static enableTracking() {
    this.getClient()?.enableTracking();
  }

  public static identify(newId: string | number | undefined, newProps: object | null = null) {
    this.getClient()?.identify(newId, newProps);
  }

  public static page(name: string, params: object | null = null) {
    this.getClient()?.page(name, params);
  }

  public static get isReady() {
    return this.getClient()?.isReady;
  }

  private stored!: Store;

  private config = defaults;

  private ws!: ExtendedWebSocket;

  private get isConnectionOpen() {
    return this.ws?.readyState === ExtendedWebSocket.OPEN;
  }

  private lastTrackedPath: string | null = null;

  public isReady = false;

  constructor(appId: string, options: Partial<Options> = {}) {
    if (!appId) {
      // eslint-disable-next-line no-console
      console.error('Nucleus: You must provide an appId');
      return;
    }

    this.init(appId, options);
  }

  private async init(appId: string, options: Partial<Options> = {}) {
    this.stored = await buildStore();
    this.stored.appId = appId;
    this.config = { ...defaults, ...options };

    if (!this.stored.initialized) {
      this.stored.initialized = true;
      this.track(null, null, 'init');
      Logger.log('Initialized');
    }

    Logger.setConfig({ debug: this.config.debug });
    Logger.log(`initializing with appId ${appId}...`);
    Logger.log(`config: ${JSON.stringify(this.config)}`);

    if (Object.values(getDeviceInfo()).find((value) => !value)) {
      Logger.warn(`Some device info is missing: ${JSON.stringify(getDeviceInfo())}`);
    }

    if (isDevMode && this.config.disableInDev) {
      Logger.log('in dev mode, not reporting data anything');
      return;
    }

    if (!this.config.disableErrorReports) {
      if (!this.config.disableErrorReports) {
        ErrorUtils.setGlobalHandler((err, isFatal) => {
          if (err && !this.config.disableTracking) {
            this.trackError('GlobalError', err);
            Logger.log(`tracked in ErrorUtils.setGlobalHandler: ${err}`);
          }
        });
      }
    }

    // Automatically send data when back online
    NetInfo.addEventListener((state) => {
      Logger.log(`Connection type: ${state.type}`);
      Logger.log(`Is connected? ${state.isConnected}`);

      if (state.isConnected && state.isInternetReachable) {
        this.reportData();
      }
    });
    this.monitorUserInactivity();

    // Make sure we stay in sync
    // And send/save regularly the latest events without spamming the server in case of bursts
    setInterval(() => this.reportData(), this.config.reportInterval);
    this.reportData();
    this.isReady = true;
  }

  private static getClient(): Nucleus | null {
    if (!client) {
      // eslint-disable-next-line no-console
      console.error('Nucleus: You must initialize the client first');
      return null;
    }

    return client;
  }

  private monitorUserInactivity() {
    const resetActiveTimer = () => {
      if (Date.now() - this.stored.lastActive > this.config.sessionTimeout) {
        // the user is active again after expired session, so we need to call init
        // again with a new session id
        Logger.log('user became active again, reinitializing');
        this.stored.sessionId = generateNumId();
        this.track(null, null, 'init');
      }

      this.stored.lastActive = Date.now();
    };

    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        resetActiveTimer();
      }
      if (nextAppState === 'background') {
        // will send a graceful end to the server but won't end the session if we're
        // only navigating and reconnecting within a few seconds
        this.ws.close();
      }
    };

    AppState.addEventListener('change', handleAppStateChange);

    resetActiveTimer();
  }

  // Received a message from the server
  private handleServerResponse(message: { type: string; data: string }) {
    let data: ServerACK = { reportedIds: [], anonId: '' };

    Logger.log(`server said ${message.data}`);

    try {
      data = JSON.parse(message.data);
    } catch (e) {
      Logger.warn('Could not parse message from server.');
      return;
    }

    if (data.anonId) {
      Logger.log(`anonId received from server ${data.anonId}`);
      this.stored.anonId = data.anonId;
    }

    if (data.reportedIds) {
      Logger.log('Server successfully registered our data.');

      // empty queue
      this.stored.queue = this.stored.queue
        .filter((event): event is NucleusEvent => event.type !== 'heartbeat')
        .filter((e) => !data.reportedIds.includes(e.id));
    }
  }

  private track(
    name: NucleusEvent['name'],
    payload: NucleusEvent['payload'],
    type: NucleusEvent['type'] = 'event',
  ) {
    if (
      (!name && !type)
      || (this.config.disableTracking || (isDevMode && this.config.disableInDev))
      || !this.stored.initialized
    ) return;

    Logger.log(`adding to queue: ${name || type}`);

    // An ID for the event so when the server returns it we know it was reported
    const tempId = Math.floor(Math.random() * 1e6) + 1;

    // remove 500ms from init event to make sure it is always chronologically first
    // (otherwise the first page event might have same time)
    const timestamp = type === 'init'
      ? Date.now() - 500
      : Date.now();

    const { platform, locale, deviceId } = this.stored.device;
    const { sessionId, userId, anonId, props } = this.stored;

    const event: NucleusEvent | HeartbeatEvent = {
      type,
      name,
      id: tempId,
      date: timestamp,
      payload: type === 'init' && props ? props : payload,
      sessionId,
      deviceId,
      platform,
      locale,
      userId,
      anonId,
      moduleVersion: this.config.moduleVersion,
      version: this.config.appVersion,
      client: 'react-native',
    };

    this.stored.queue.push(event);
    Logger.log(`Added to queue: ${JSON.stringify(event)}`);
  }

  private trackError(name: string, err: Error) {
    if (!err) return;
    // Convert Error to normal object, so we can stringify it
    const errorObject = {
      stack: err.stack || err,
      message: err.message || err,
    };

    this.track(name, errorObject, 'error');
  }

  private setUserId(newId: string | undefined) {
    if (!newId || newId.trim() === '') {
      console.error('Nucleus: userId cannot be empty');
      return;
    }

    this.stored.userId = newId;
    Logger.log(`user id set to ${newId}`);
    // if we already initialized, send the new id
    this.track(null, null, 'userid');
  }

  // Allows to set custom properties to users
  private setProps(newProps: object, overwrite: boolean = true) {
    // If it's part of the store object overwrite there (e.g. setting device info)
    Object.keys(newProps).forEach((key) => {
      if (key in this.stored) {
        // @ts-expect-error i don't know how to make sure the type in newProps is correct
        this.stored[key as keyof Store] = newProps[key] as Store[keyof Store];
        delete newProps[key as keyof object];
      }
    });

    // Merge past and new props
    if (!overwrite) this.stored.props = { ...newProps, ...this.stored.props };
    else this.stored.props = newProps;

    if (!Object.keys(newProps).length) return;

    // if we already initialized, send the new props
    this.track(null, this.stored.props, 'props');
  }

  private identify(newId: string | number | undefined, newProps: object | null) {
    this.setUserId(newId?.toString());
    if (newProps) this.setProps(newProps);
  }

  private page(name?: string, params: object | null = null) {
    if (!name || name === this.lastTrackedPath) {
      return;
    }

    Logger.log(`viewing screen ${name}`);

    this.track(name, params, 'nucleus:view');
    this.lastTrackedPath = name;
  }

  private disableTracking() {
    this.config.disableTracking = true;
    Logger.log('tracking disabled');
  }

  private enableTracking() {
    this.config.disableTracking = false;
    Logger.log('tracking enabled');
  }

  private sendQueue() {
    if (!this.isConnectionOpen) {
      Logger.warn('not sending queue, connection not open');
      return;
    }

    Logger.log(`sending stored events (${this.stored.queue.length})`);

    if (!this.stored.queue.length) {
      // if nothing to report and user is active send a heartbeat
      this.track(null, null, 'heartbeat');
    } else if (this.stored.queue.length > 1) {
      // make sure we don't send useless heartbeat events saved previously
      // (ie. in case of network error)
      // just if we have more than 1 event, otherwise it might be the heartbeat
      Logger.log(`removing heartbeat events from queue. Queue length: ${this.stored.queue.length}`);
      this.stored.queue = this.stored.queue
        .filter((event): event is NucleusEvent => event.type !== 'heartbeat')
        .filter((event) => event.date > Date.now() - this.config.cutoff);
      Logger.log(`new queue length: ${this.stored.queue.length}`);
    }

    const events: (NucleusEvent | HeartbeatEvent)[] = this.stored.queue.map((event) => {
      if (event.type === 'heartbeat') {
        return event;
      }

      return cleanEvent(event as NucleusEvent);
    });

    Logger.log('sending events [\n'
      + `${events.map((event) => `> ${JSON.stringify(event)}`).join('\n')}`
      + '\n]');
    this.ws.sendJson(events);
  }

  private openWebSocket() {
    if (!this.isConnectionOpen) {
      Logger.log('No connection to server. Opening it.');

      this.ws = new ExtendedWebSocket(`${this.config.endpoint}/app/${this.stored.appId}/track`);

      this.ws.onerror = (e) => Logger.warn(`ws error ${e}`);
      this.ws.onclose = (e) => Logger.warn(`ws closed ${e.code}: ${e.reason}`);
      this.ws.onmessage = (message) => this.handleServerResponse(message);

      this.ws.onopen = () => {
        Logger.log('ws connection opened');
        // timeout because the connection isn't always directly ready
        setTimeout(() => this.sendQueue(), 1000);
      };
    }
  }

  private reportData() {
    Logger.log('Trying to report data..');

    if (this.config.disableTracking) return;

    if (!this.isConnectionOpen) {
      this.openWebSocket();
    }

    this.sendQueue();
  }
}
