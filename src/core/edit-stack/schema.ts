import { MAX_EXPORT_DIMENSION, MAX_PIXEL_COUNT } from "@/core/limits";

export interface CropStep {
  type: "crop";
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RotateStep {
  type: "rotate";
  degrees: 90 | 180 | 270;
}

export interface FlipStep {
  type: "flip";
  horizontal: boolean;
  vertical: boolean;
}

export interface ResizeStep {
  type: "resize";
  width: number;
  height: number;
}

export interface AdjustStep {
  type: "adjust";
  brightness: number;
  contrast: number;
  saturation: number;
  sharpness: number;
}

export type EditStep = CropStep | RotateStep | FlipStep | ResizeStep | AdjustStep;
export interface EditStack {
  version: 1;
  steps: EditStep[];
}

export const EMPTY_EDIT_STACK: EditStack = { version: 1, steps: [] };

export function validateEditStack(value: unknown): EditStack {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.steps)) {
    throw new Error("This image has an unsupported edit history.");
  }
  const steps = value.steps.map((step): EditStep => {
    if (!isRecord(step) || typeof step.type !== "string") {
      throw new Error("An edit step is malformed.");
    }
    switch (step.type) {
      case "crop": {
        const x = numberField(step.x);
        const y = numberField(step.y);
        const width = numberField(step.width);
        const height = numberField(step.height);
        if (
          x === undefined ||
          y === undefined ||
          width === undefined ||
          height === undefined ||
          x < 0 ||
          y < 0 ||
          width <= 0 ||
          height <= 0 ||
          x + width > 1 ||
          y + height > 1
        )
          throw new Error("The crop values are invalid.");
        return { type: "crop", x, y, width, height };
      }
      case "rotate":
        if (step.degrees !== 90 && step.degrees !== 180 && step.degrees !== 270)
          throw new Error("The rotation value is invalid.");
        return { type: "rotate", degrees: step.degrees };
      case "flip":
        if (typeof step.horizontal !== "boolean" || typeof step.vertical !== "boolean")
          throw new Error("The flip values are invalid.");
        return { type: "flip", horizontal: step.horizontal, vertical: step.vertical };
      case "resize": {
        const width = numberField(step.width);
        const height = numberField(step.height);
        if (
          width === undefined ||
          height === undefined ||
          !Number.isInteger(width) ||
          !Number.isInteger(height) ||
          width < 1 ||
          height < 1 ||
          width > MAX_EXPORT_DIMENSION ||
          height > MAX_EXPORT_DIMENSION ||
          width * height > MAX_PIXEL_COUNT
        )
          throw new Error("The resize dimensions are invalid.");
        return { type: "resize", width, height };
      }
      case "adjust": {
        const brightness = requiredNumber(
          step.brightness,
          "The adjustment values are invalid.",
        );
        const contrast = requiredNumber(
          step.contrast,
          "The adjustment values are invalid.",
        );
        const saturation = requiredNumber(
          step.saturation,
          "The adjustment values are invalid.",
        );
        const sharpness = requiredNumber(
          step.sharpness,
          "The adjustment values are invalid.",
        );
        if (
          brightness < -100 ||
          brightness > 100 ||
          contrast < -100 ||
          contrast > 100 ||
          saturation < -100 ||
          saturation > 100 ||
          sharpness < -1 ||
          sharpness > 1
        )
          throw new Error("The adjustment values are out of range.");
        return {
          type: "adjust",
          brightness,
          contrast,
          saturation,
          sharpness,
        };
      }
      default:
        throw new Error("This edit type is not supported.");
    }
  });
  return { version: 1, steps };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function numberField(value: unknown): number | undefined {
  return isFiniteNumber(value) ? value : undefined;
}

function requiredNumber(value: unknown, message: string): number {
  const parsed = numberField(value);
  if (parsed === undefined) throw new Error(message);
  return parsed;
}
