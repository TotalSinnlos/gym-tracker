import { describe, expect, it } from "vitest";
import { APP_NAME } from ".";

describe("core", () => {
  it("exposes the app name", () => {
    expect(APP_NAME).toBe("Gym Tracker");
  });
});
