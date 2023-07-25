# Nucleus.sh React Native SDK

![Nucleus.sh](https://intriguing-lemonade-efa.notion.site/image/https%3A%2F%2Fs3-us-west-2.amazonaws.com%2Fsecure.notion-static.com%2F98020d0c-fd01-43ff-a29e-8f1c8f30de4b%2Fmsdncsmcnsm.jpg?table=block&id=db0f27a3-321c-400e-9ca7-db0213d1dee1)

## Table of Contents

1. [Getting Started](#getting-started)
2. [Usage](#usage)
3. [How to Contribute](#how-to-contribute)

## Getting Started

To get started with Nucleus, create an account at [Nucleus](https://dash.nucleus.sh/login) and grab the App ID, then
use the SDK to start tracking events.

### Installation

As NPM package (recommended)

```bash
# with yarn
yarn add nucleus-rn
```

### Usage


```javascript
import Nucleus from 'nucleus-rn';

Nucleus.init('YOUR_APP_ID');
```

Replace `'YOUR_APP_ID'` with the unique ID of your app. You can get it [here](https://dash.nucleus.sh/account).

You can check examples with different frameworks [here](./playground).

## API

Nucleus supports passing the following options as second argument to the `Nucleus.init()` method:

```js
Nucleus.init('APP_ID', {
  appVersion: '0.0.0', // the version of your application
  endpoint: 'wss://app.nucleus.sh', // only option, we don't allow self hosting yet :(
  disableInDev: true, // disable in development mode. We recommend not to call
                      // `init` method, as that will be more reliable.
  debug: false, // if set to `true`, will log a bunch of things.
  disableTracking: false, // will not track anything. You can also use `Nucleus.disableTracking()`.
                          // note that some events will still be added to the queue, so if you call
                          // Nucleus.enableTracking() again, they will be sent to the server.
  automaticPageTracking: true, // will track all page changes.
  reportInterval: 2 * 1000, // at which interval the events are sent to the server.
  sessionTimeout: 60 * 30 * 1000, // time after which the session is ended
  cutoff: 60 * 60 * 48 * 1000, // time after which event that were not sent yet are deleted
  disableErrorReports: false, // wether to disable error tracking
})
```

### Tracking

Track events with optional custom data

```javascript
Nucleus.track("click", { foo: 'bar' });
```

### Error Tracking

Track errors with a name and the Error object.

```javascript
Nucleus.trackError(name, error);
```

By default Nucleus registers a handler for `ErrorUtils.setGlobalHandler` that sends `'GlobalError'` errors to the API. If you want
to disable this behaviour, you can set `disableErrorReports` to `true`:

```js
Nucleus.init('APP_ID', { disableErrorReports: true })
```

and catch errors manually using `Nucleus.trackError('an error', errObject)`.

### User Identification

Identify a user by a unique ID and optionally set custom properties.

```javascript
Nucleus.identify('04f8846d-ecca-4a81-8740-f6428ceb7f7b', { firstName: 'Jordan', lastName: 'Walke' });
```

### Page Tracking

Track page views with the page name and optional parameters.

```javascript
Nucleus.page('/about', { foo: 'baz' });
```

By default, Nucleus will track any page change by polling the url every 50 ms. If you prefer to manually track page changes, set `automaticPageTracking` to false and call `Nucleus.page()` on every page change.

### Disabling Tracking

To disable tracking

```javascript
Nucleus.disableTracking();
```

### Enabling Tracking

To enable tracking

```javascript
Nucleus.enableTracking();
```

## How to Contribute

We're always looking for contributions from the community. Here's how you can help:

1. **Report Bugs**: Create an issue report detailing the bug you've found.
2. **Suggest Features**: Have a great idea for Nucleus? Don't hesitate to put it forward by creating an issue.
3. **Submit Pull Requests**: Feel free to fix a bug or add a new feature and create a pull request. Make sure to follow the existing code style, and write clear commit messages explaining your changes.
