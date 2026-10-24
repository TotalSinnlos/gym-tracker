// The core module: all app rules live here, independent of the screens.
// Screens call its commands and read its queries; tests do the same.

export const APP_NAME = "Gym Tracker";

export * from "./types";
export * from "./store";
export * from "./core";
