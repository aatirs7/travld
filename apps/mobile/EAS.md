# EAS builds, TestFlight & OTA updates

The app is configured for EAS builds and **EAS Update** (over-the-air JS updates
without a rebuild). Config lives in `app.json` (`updates`, `runtimeVersion`,
`ios.bundleIdentifier = com.travld.app`) and `eas.json` (build/submit profiles +
update channels `development` / `preview` / `production`).

`runtimeVersion` uses the **appVersion** policy: the runtime version equals the
app's `version` (e.g. `1.0.0`), computed identically on any machine. OTA updates
apply to installed builds with the same app version. When you change native code
(new native module, config plugin, SDK bump), **bump `version` in app.json** before
building so old installs don't receive an incompatible JS update.

> We intentionally do NOT use the `fingerprint` policy: it hashes `node_modules`,
> and in this pnpm monorepo the hash computed on Windows (local) differs from the
> one computed on EAS's Linux builder, which makes every build fail with a
> "Runtime version mismatch". appVersion is deterministic and avoids that.

## One-time setup (needs your Expo + Apple accounts — interactive)

```bash
cd apps/mobile
npx eas-cli@latest login                 # Expo account
npx eas-cli@latest init                   # links project, writes extra.eas.projectId
npx eas-cli@latest update:configure       # writes updates.url (https://u.expo.dev/<id>)
```

Apple side: an Apple Developer Program membership ($99/yr) and an App Store
Connect app record. Put its App ID into `eas.json` → `submit.production.ios.ascAppId`
(or let `eas submit` prompt you).

## Build → TestFlight

```bash
cd apps/mobile
# Production build on EAS cloud (handles signing; prompts for Apple credentials):
npx eas-cli@latest build --platform ios --profile production
# Then submit the finished build to TestFlight:
npx eas-cli@latest submit --platform ios --profile production --latest
```

`autoIncrement` + `appVersionSource: remote` means EAS manages the build number.

## Ship an OTA update (no rebuild)

After the TestFlight build is installed, push JS/asset changes instantly:

```bash
cd apps/mobile
npx eas-cli@latest update --branch production --message "what changed"
```

The `production` build's channel is mapped to the `production` branch, so installed
testers pick up the update on next launch. Use `--branch preview` for the preview
build. If you changed native code, `eas update` will warn about a fingerprint
mismatch — that's your signal to run `eas build` instead.

## Dev builds (for MapLibre / MMKV / push later)

Phase 1 runs in Expo Go. Phases 2+ add native modules that need a dev build:

```bash
npx eas-cli@latest build --platform ios --profile development
```
