import { FalProvider } from "./fal";
import { KlingProvider } from "./kling";
import { MockProvider } from "./mock";
import { RunwayProvider } from "./runway";
import type { VideoProvider } from "./types";
import type { ProviderName } from "../types";

let mockSingleton: MockProvider | null = null;

export function getVideoProvider(): VideoProvider {
  const raw = (process.env.VIDEO_API_PROVIDER || "runway").toLowerCase();
  const name = (
    raw === "runway" ||
    raw === "kling" ||
    raw === "mock" ||
    raw === "fal"
      ? raw
      : "runway"
  ) as ProviderName;

  switch (name) {
    case "fal":
      return new FalProvider();
    case "kling":
      return new KlingProvider();
    case "mock":
      if (!mockSingleton) {
        mockSingleton = new MockProvider();
      }
      return mockSingleton;
    case "runway":
    default:
      return new RunwayProvider();
  }
}
