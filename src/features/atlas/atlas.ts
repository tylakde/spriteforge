import type { Metadata, RenderRecipe } from "../../types";
import {
  atlasLayout,
  directionAngles,
  frameName,
  safeName,
} from "../../lib/math";
import { styledAssetName, effectivePixelScale } from "../styles/styles";
export function makeMetadata(
  source: string,
  recipe: RenderRecipe,
  times: number[],
  animation: string,
  pivotY: number,
  clipDuration = 0,
): Metadata {
  const directions = directionAngles(
    recipe.directionCount,
    recipe.frontDirection,
  );
  const layout = atlasLayout(
    directions.length * times.length,
    recipe.cellSize,
    recipe.atlasPadding,
    recipe.atlasLayout,
    recipe.powerOfTwo,
  );
  const asset = styledAssetName(safeName(source), recipe.style);
  return {
    version: 1,
    asset,
    source,
    atlas: {
      file: `${asset}_atlas.png`,
      width: layout.width,
      height: layout.height,
      cellWidth: recipe.cellSize,
      cellHeight: recipe.cellSize,
      padding: recipe.atlasPadding,
    },
    directionCount: directions.length,
    directions,
    frontDirection: recipe.frontDirection,
    coordinateSystem:
      "Y-up; angle 0 = camera at +Z; positive angles toward +X; UV origin top-left",
    frameOrdering: "direction-major",
    anchor: {
      type: recipe.anchor,
      x: 0.5,
      y: recipe.anchor === "center" ? 0.5 : pivotY,
    },
    background: recipe.background,
    appearance: {
      version: 1,
      style: recipe.style,
      textureFilter: effectivePixelScale(recipe) > 1 ? "nearest" : "linear",
      pixelScale: effectivePixelScale(recipe),
    },
    recipe: { ...recipe },
    animations: animation
      ? {
          [animation]: {
            fps: recipe.fps,
            frameCount: times.length,
            duration: clipDuration,
          },
        }
      : {},
    frames: directions.flatMap((angle) =>
      times.map((time, frame) => {
        const index = directions.indexOf(angle) * times.length + frame;
        const rect = layout.rects[index];
        return {
          index,
          file: frameName(asset, angle, animation, frame),
          directionDegrees: angle,
          animation,
          animationFrame: frame,
          time,
          duration: animation
            ? Math.min(1 / recipe.fps, clipDuration - time)
            : 0,
          rect,
          uv: {
            u0: rect.x / layout.width,
            v0: rect.y / layout.height,
            u1: (rect.x + rect.width) / layout.width,
            v1: (rect.y + rect.height) / layout.height,
          },
        };
      }),
    ),
  };
}
export function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("PNG encoding failed.")),
      "image/png",
    ),
  );
}
export function createAtlasWriter(metadata: Metadata) {
  const canvas = document.createElement("canvas");
  canvas.width = metadata.atlas.width;
  canvas.height = metadata.atlas.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.width = canvas.height = 1;
    throw new Error("Canvas unavailable.");
  }
  return {
    draw(index: number, image: CanvasImageSource) {
      const r = metadata.frames[index].rect;
      ctx.drawImage(image, r.x, r.y);
    },
    finish: () => canvasBlob(canvas),
    dispose() {
      canvas.width = canvas.height = 1;
    },
  };
}
export async function buildAtlas(frames: Blob[], metadata: Metadata) {
  const writer = createAtlasWriter(metadata);
  try {
    for (let i = 0; i < frames.length; i++) {
      const bmp = await createImageBitmap(frames[i]);
      try {
        writer.draw(i, bmp);
      } finally {
        bmp.close();
      }
    }
    return await writer.finish();
  } finally {
    writer.dispose();
  }
}
