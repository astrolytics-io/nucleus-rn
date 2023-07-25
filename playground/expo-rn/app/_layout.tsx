import Nucleus from 'nucleus-rn';
import { DarkTheme, DefaultTheme, ThemeProvider, useNavigationState } from '@react-navigation/native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFonts } from 'expo-font';
import { SplashScreen, Stack } from 'expo-router';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

const APP_ID = '64bff3b8636801ac71d3f823';
Nucleus.init(APP_ID, {
  debug: true,
  reportInterval: 1000 * 4,
  endpoint: 'ws://localhost:3002',
  appVersion: '1.0.0',
});

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

function getActiveRouteName(state) {
  const route = state.routes[state.index ?? 0];

  if (route.state) {
    // Dive into nested navigators
    return getActiveRouteName(route.state);
  }

  return route.name;
}

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  return (
    <>
      {/* Keep the splash screen open until the assets have loaded. In the future, we should just support async font loading with a native version of font-display. */}
      {!loaded && <SplashScreen />}
      {loaded && <RootLayoutNav />}
    </>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  const routeName = useNavigationState((state) => {
    const route = state.routes[state.index ?? 0];

    if (route.state) {
      // Dive into nested navigators
      return getActiveRouteName(route.state);
    }

    return route.name;
  });

  useEffect(() => {
    // NOTE: we don't want to track the initial route when the user opens the page.
    // if you do want to track it, make sure the SDK is properly initialized before:
    // if (Nucleus.isReady) {
    if (routeName !== 'index') {
      Nucleus.page(routeName);
    }
  }, [routeName]);

  return (
    <>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
          </Stack>
      </ThemeProvider>
    </>
  );
}
