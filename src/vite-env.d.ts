/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** The commit the app was built from: its short id and ISO date (see vite.config.ts). */
declare const __APP_VERSION__: { id: string; date: string | null };
