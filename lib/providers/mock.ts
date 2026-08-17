import type {
  ImageToVideoInput,
  ProviderTaskResult,
  VideoProvider,
} from "./types";

interface MockJob {
  createdAt: number;
  durationMs: number;
  prompt: string;
}

const jobs = new Map<string, MockJob>();

/**
 * In-memory mock provider for local UI development without API keys.
 * Completes successfully after ~6 seconds with a sample video URL.
 */
export class MockProvider implements VideoProvider {
  readonly name = "mock";

  async startImageToVideo(
    input: ImageToVideoInput
  ): Promise<{ externalTaskId: string }> {
    const externalTaskId = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const durationMs = input.collaborative
      ? Math.min(input.duration * 1000, 12000)
      : 6000;
    jobs.set(externalTaskId, {
      createdAt: Date.now(),
      durationMs,
      prompt: input.prompt,
    });
    return { externalTaskId };
  }

  async getTask(externalTaskId: string): Promise<ProviderTaskResult> {
    const job = jobs.get(externalTaskId);
    if (!job) {
      return {
        status: "failed",
        error: "Mock job not found. Restart the server clears in-memory jobs.",
        errorCode: "PROVIDER",
      };
    }

    const elapsed = Date.now() - job.createdAt;
    if (elapsed < job.durationMs / 2) {
      return { status: "pending" };
    }
    if (elapsed < job.durationMs) {
      return { status: "running" };
    }

    // Public domain / freely usable sample MP4 for demo playback
    return {
      status: "succeeded",
      videoUrl:
        "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    };
  }
}
