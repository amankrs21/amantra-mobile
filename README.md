# Amantra

A secure, encrypted password vault & notes app built with React Native and Expo.

Amantra lets you store passwords and private notes with end-to-end encryption that you control. Available on Android and iOS.

## Tech Stack

- **Expo SDK 54** with New Architecture enabled
- **React Native** with TypeScript
- **expo-router** for file-based navigation (typed routes)
- **expo-secure-store** for secure local storage
- **Google Sign-In** & email/password authentication
- **EAS Build** for cloud & local builds

## Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- npm
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (`npx expo`)
- [EAS CLI](https://docs.expo.dev/build/introduction/) (`npm install -g eas-cli`) — for builds
- [Android Studio](https://developer.android.com/studio) — for local Android builds & emulator

## Getting Started

```bash
# Clone the repo
git clone https://github.com/amankrs21/amantra-mobile.git
cd amantra-mobile

# Install dependencies
npm install
```

### Environment Variables

Create a `.env` file in the project root:

```env
EXPO_PUBLIC_API_URL=https://your-api-url.com
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-google-web-client-id
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=your-google-ios-client-id
```

### Development

```bash
# Start the dev server
npx expo start

# Run on Android emulator
npx expo run:android

# Run on iOS simulator (macOS only)
npx expo run:ios
```

## Building Production APK Locally

1. Install EAS CLI:
   ```bash
   npm install -g eas-cli
   ```

2. Login to your Expo account:
   ```bash
   eas login
   ```

3. Build the APK locally:
   ```bash
   eas build -p android --profile production --local
   ```

4. The `.apk` file will be output in the project root.

5. **Alternative** (requires Android Studio & SDK setup):
   ```bash
   npx expo run:android --variant release
   ```

## Building for iOS

> Requires macOS with Xcode installed.

1. Build locally:
   ```bash
   eas build -p ios --profile production --local
   ```

2. Or build in the cloud:
   ```bash
   eas build -p ios --profile production
   ```

3. Submit to App Store:
   ```bash
   eas submit -p ios
   ```

## CI/CD Pipeline

This project uses **GitHub Actions** (`.github/workflows/ci.yml`):

- **On Pull Request to `main`**: Runs linting, type-checking, and SonarCloud analysis.
- **On merge to `main`**: Builds Android and iOS production builds via EAS.

Required repository secrets:
- `EXPO_TOKEN` — Expo access token for EAS builds
- `SONAR_TOKEN` — SonarCloud token for code analysis

## License

Licensed under the [Apache License 2.0](LICENSE).

Copyright 2025 Aman Kumar.
