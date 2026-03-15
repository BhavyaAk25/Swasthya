declare module "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/vision_bundle.mjs" {
  export class FilesetResolver {
    static forVisionTasks(basePath: string): Promise<unknown>;
  }

  export class PoseLandmarker {
    static createFromOptions(vision: unknown, options: unknown): Promise<PoseLandmarker>;
    detectForVideo(
      video: HTMLVideoElement,
      timestampMs: number,
    ): { landmarks?: Array<Array<{ x: number; y: number }>> };
  }
}

declare module "/vendor/mediapipe/vision_bundle.mjs" {
  export class FilesetResolver {
    static forVisionTasks(basePath: string): Promise<unknown>;
  }

  export class PoseLandmarker {
    static createFromOptions(vision: unknown, options: unknown): Promise<PoseLandmarker>;
    detectForVideo(
      video: HTMLVideoElement,
      timestampMs: number,
    ): { landmarks?: Array<Array<{ x: number; y: number }>> };
  }
}
