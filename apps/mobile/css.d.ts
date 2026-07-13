// Ambient declarations for CSS imports used by the Expo template.
// (Expo normally emits these into expo-env.d.ts on first `expo start`; declared
// here so `tsc --noEmit` passes in CI before a dev server has ever run.)
declare module "*.module.css" {
  const classes: { readonly [key: string]: string };
  export default classes;
}
declare module "*.css";
