import type { AnimationClip, Box3, Group } from "three";
export interface RenderRecipe {
  name: string;
  cellSize: 64 | 128 | 256 | 512 | 1024;
  projection: "orthographic" | "perspective";
  perspectiveFov: number;
  cameraElevation: number;
  frontDirection: number;
  directionCount: 1 | 4 | 8 | 16 | 32;
  lightAzimuth: number;
  lightElevation: number;
  lightIntensity: number;
  ambientIntensity: number;
  background: "transparent" | "solid";
  backgroundColor: string;
  paddingPercent: number;
  outlineEnabled: boolean;
  outlineWidth: number;
  anchor: "center" | "ground";
  fps: number;
  atlasLayout: "grid" | "strip";
  atlasPadding: number;
  powerOfTwo: boolean;
}
export interface AssetSource {
  id: string;
  name: string;
  file: File;
  files: File[];
}
export interface LoadedAsset {
  root: Group;
  bounds: Box3;
  animations: AnimationClip[];
  dispose: () => void;
  stats: {
    triangles: number;
    meshes: number;
    materials: number;
    dimensions: [number, number, number];
  };
}
export interface FrameRecord {
  index: number;
  file: string;
  directionDegrees: number;
  animation: string;
  animationFrame: number;
  time: number;
  duration: number;
  rect: { x: number; y: number; width: number; height: number };
  uv: { u0: number; v0: number; u1: number; v1: number };
}
export interface Metadata {
  version: 1;
  asset: string;
  source: string;
  atlas: {
    file: string;
    width: number;
    height: number;
    cellWidth: number;
    cellHeight: number;
    padding: number;
  };
  directionCount: number;
  directions: number[];
  frontDirection: number;
  coordinateSystem: string;
  frameOrdering: "direction-major";
  anchor: { type: "center" | "ground"; x: number; y: number };
  animations: Record<
    string,
    { fps: number; frameCount: number; duration: number }
  >;
  background: "transparent" | "solid";
  recipe: RenderRecipe;
  frames: FrameRecord[];
}
export interface Generation {
  sourceId: string;
  recipeKey: string;
  frames: Blob[];
  thumbnails: string[];
  atlas: Blob;
  metadata: Metadata;
}
