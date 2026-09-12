import {
  Box3,
  Group,
  LoadingManager,
  Mesh,
  SkinnedMesh,
  Texture,
  Vector3,
} from "three";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { AssetSource, LoadedAsset } from "../../types";
export function sourcesFromFiles(files: File[]): AssetSource[] {
  return files
    .filter((f) => /\.(glb|gltf)$/i.test(f.name))
    .map((file) => ({ id: crypto.randomUUID(), name: file.name, file, files }));
}
export function disposeObject(root: Group) {
  const geometries = new Set(),
    materials = new Set(),
    textures = new Set<Texture>();
  const skeletons = new Set<import("three").Skeleton>();
  root.traverse((o) => {
    if (o instanceof SkinnedMesh) skeletons.add(o.skeleton);
    if (o instanceof Mesh) {
      if (!geometries.has(o.geometry)) {
        o.geometry.dispose();
        geometries.add(o.geometry);
      }
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        if (!materials.has(m)) {
          materials.add(m);
          for (const value of Object.values(m))
            if (value instanceof Texture) textures.add(value);
          m.dispose();
        }
    }
  });
  skeletons.forEach((s) => s.dispose());
  for (const t of textures) {
    t.dispose();
    const data = t.source?.data;
    if (typeof ImageBitmap !== "undefined" && data instanceof ImageBitmap)
      data.close();
  }
}
export async function loadAsset(
  source: AssetSource,
  options?: { raw?: boolean; animationOnly?: boolean },
): Promise<LoadedAsset> {
  const urls: string[] = [];
  const missing: string[] = [];
  const manager = new LoadingManager();
  const files = new Map<string, File>();
  for (const f of source.files) {
    const path = f.webkitRelativePath || f.name;
    files.set(path.replace(/\\/g, "/"), f);
  }
  const sourcePath = source.file.webkitRelativePath || source.file.name;
  const dir = sourcePath.slice(0, sourcePath.lastIndexOf("/") + 1);
  manager.setURLModifier((url) => {
    if (url.startsWith("data:") || url.startsWith("blob:")) return url;
    const decoded = decodeURIComponent(url).replace(/^\.\//, "");
    const normalised = new URL(decoded, "https://local/" + dir).pathname.slice(
      1,
    );
    let file = files.get(normalised) || files.get(decoded);
    if (!file) {
      const matches = source.files.filter(
        (f) => f.name === decoded.split("/").pop(),
      );
      if (matches.length === 1) file = matches[0];
    }
    if (!file) {
      missing.push(decoded);
      throw new Error(
        `Missing resource: ${decoded}. Import the asset folder with its .bin and texture files.`,
      );
    }
    const objectURL = URL.createObjectURL(file);
    urls.push(objectURL);
    return objectURL;
  });
  manager.onError = (url) => missing.push(url);
  let root: Group | undefined;
  try {
    const data = await source.file.arrayBuffer();
    const gltf = await new GLTFLoader(manager)
      .setMeshoptDecoder(MeshoptDecoder)
      .parseAsync(
        /\.gltf$/i.test(source.name) ? new TextDecoder().decode(data) : data,
        "",
      );
    root = new Group();
    root.add(gltf.scene);
    if (missing.length)
      throw new Error(
        "Missing or unreadable textures. Import the complete asset folder.",
      );
    root.updateMatrixWorld(true);
    let bounds = new Box3().setFromObject(root, true);
    if (
      !options?.animationOnly &&
      (bounds.isEmpty() ||
        ![...bounds.min.toArray(), ...bounds.max.toArray()].every(
          Number.isFinite,
        ))
    )
      throw new Error("Asset has no valid visible geometry.");
    const center = bounds.getCenter(new Vector3());
    if (!options?.raw && !options?.animationOnly) {
      const origin = new Group();
      origin.position.set(-center.x, -bounds.min.y, -center.z);
      origin.add(gltf.scene);
      root.add(origin);
    }
    root.updateMatrixWorld(true);
    bounds = new Box3().setFromObject(root, true);
    const dimensions = bounds.getSize(new Vector3()).toArray() as [
      number,
      number,
      number,
    ];
    let triangles = 0,
      meshes = 0;
    const mats = new Set();
    root.traverse((o) => {
      if (o instanceof Mesh) {
        meshes++;
        triangles +=
          (o.geometry.index?.count ??
            o.geometry.attributes.position?.count ??
            0) / 3;
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          mats.add(m);
        o.frustumCulled = false;
      }
    });
    if (!options?.animationOnly && (!meshes || Math.max(...dimensions) < 1e-8))
      throw new Error("Asset has no renderable meshes.");
    gltf.animations.forEach((clip, i) => {
      if (!clip.name) clip.name = `Animation ${i + 1}`;
    });
    const owned = root;
    return {
      root,
      bounds,
      animations: gltf.animations,
      stats: {
        triangles: Math.round(triangles),
        meshes,
        materials: mats.size,
        dimensions,
      },
      dispose: () => disposeObject(owned),
    };
  } catch (error) {
    if (root) disposeObject(root);
    throw new Error(
      `Could not load ${source.name}: ${error instanceof Error ? error.message : "Invalid GLTF data."}`,
    );
  } finally {
    urls.forEach((url) => URL.revokeObjectURL(url));
  }
}
