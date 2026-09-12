import { useEffect, useRef, useState } from "react";
import {
  ACESFilmicToneMapping,
  AnimationMixer,
  Clock,
  Color,
  GridHelper,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Grid2X2, Maximize, RotateCcw } from "lucide-react";
import { loadAsset } from "../assets/loadAsset";
import { lighting } from "../renderer/lighting";
import { baseRecipe } from "../recipes/recipes";
import { useStore } from "../../stores/useStore";
import type { AssetSource, LoadedAsset } from "../../types";
interface Props {
  source: AssetSource | null;
  loader?: () => Promise<LoadedAsset>;
  clipIndex: number | null;
  playing: boolean;
  time: number;
  resetKey: number;
  onLoaded: (asset: LoadedAsset) => void;
  onError: (error: string) => void;
  onTime: (time: number) => void;
}
export default function Viewport({
  source,
  loader,
  clipIndex,
  playing,
  time,
  resetKey,
  onLoaded,
  onError,
  onTime,
}: Props) {
  const mount = useRef<HTMLDivElement>(null);
  const live = useRef({ clipIndex, playing, time, onLoaded, onError, onTime });
  live.current = { clipIndex, playing, time, onLoaded, onError, onTime };
  const [loading, setLoading] = useState(false);
  const grid = useStore((s) => s.grid),
    background = useStore((s) => s.previewBackground),
    preferences = useStore((s) => s.preferences);
  const controlsRef = useRef<OrbitControls | null>(null);
  const reset = useRef<() => void>(() => {});
  const mixerRef = useRef<AnimationMixer | null>(null);
  const assetRef = useRef<LoadedAsset | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const gridRef = useRef<GridHelper | null>(null);
  useEffect(() => {
    const host = mount.current;
    if (!host) return;
    let disposed = false,
      asset: LoadedAsset | null = null,
      raf = 0,
      renderer: WebGLRenderer | undefined;
    const scene = new Scene();
    sceneRef.current = scene;
    scene.add(
      lighting({ ...baseRecipe, lightIntensity: 3, ambientIntensity: 2 }),
    );
    const camera = new PerspectiveCamera(40, 1, 0.001, 10000);
    camera.position.set(4, 3, 6);
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      live.current.onError(
        "WebGL 2 is unavailable. Enable hardware acceleration or update your graphics driver.",
      );
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    host.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controlsRef.current = controls;
    const observer = new ResizeObserver(() => {
      if (!host.clientWidth || !host.clientHeight) return;
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
      renderer!.setSize(host.clientWidth, host.clientHeight);
    });
    observer.observe(host);
    const clock = new Clock();
    let last = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.1);
      if (mixerRef.current && live.current.playing) {
        mixerRef.current.update(delta);
        if (clock.elapsedTime - last > 0.1) {
          const clip = asset?.animations[live.current.clipIndex ?? -1];
          if (clip) live.current.onTime(mixerRef.current.time % clip.duration);
          last = clock.elapsedTime;
        }
      }
      controls.update();
      if (host.clientWidth && host.clientHeight)
        renderer!.render(scene, camera);
    };
    animate();
    if (source) {
      setLoading(true);
      (loader ? loader() : loadAsset(source))
        .then((loaded) => {
          if (disposed) {
            loaded.dispose();
            return;
          }
          asset = loaded;
          assetRef.current = loaded;
          scene.add(loaded.root);
          const max = Math.max(...loaded.stats.dimensions),
            center = loaded.bounds.getCenter(new Vector3());
          const helper = new GridHelper(max * 3, 20, 0x454952, 0x30343d);
          helper.position.y = -max * 0.002;
          scene.add(helper);
          gridRef.current = helper;
          helper.visible = useStore.getState().grid;
          reset.current = () => {
            camera.near = max / 1000;
            camera.far = max * 100;
            camera.position
              .copy(center)
              .add(new Vector3(1, 0.7, 1.5).multiplyScalar(max * 1.4));
            camera.updateProjectionMatrix();
            controls.target.copy(center);
            controls.update();
          };
          reset.current();
          mixerRef.current = new AnimationMixer(loaded.root);
          const selected = loaded.animations[live.current.clipIndex ?? -1];
          if (selected) mixerRef.current.clipAction(selected).play();
          live.current.onLoaded(loaded);
          setLoading(false);
        })
        .catch((e) => {
          if (!disposed) {
            setLoading(false);
            live.current.onError(e.message);
          }
        });
    }
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      controls.dispose();
      mixerRef.current?.stopAllAction();
      if (asset) mixerRef.current?.uncacheRoot(asset.root);
      mixerRef.current = null;
      assetRef.current = null;
      asset?.dispose();
      gridRef.current?.geometry.dispose();
      const m = gridRef.current?.material;
      if (Array.isArray(m)) m.forEach((x) => x.dispose());
      else m?.dispose();
      gridRef.current = null;
      renderer!.dispose();
      renderer!.forceContextLoss();
      renderer!.domElement.remove();
    };
  }, [source, loader]);
  useEffect(() => {
    if (gridRef.current) gridRef.current.visible = grid;
  }, [grid, loading]);
  useEffect(() => {
    if (sceneRef.current)
      sceneRef.current.background =
        background === "solid" ? new Color("#22252c") : null;
  }, [background, source]);
  useEffect(() => {
    reset.current();
  }, [resetKey]);
  useEffect(() => {
    const mixer = mixerRef.current,
      asset = assetRef.current;
    if (!mixer || !asset) return;
    mixer.stopAllAction();
    const clip = asset.animations[clipIndex ?? -1];
    if (clip) mixer.clipAction(clip).reset().play();
    mixer.setTime(0);
  }, [clipIndex, loading]);
  useEffect(() => {
    if (!playing) mixerRef.current?.setTime(time);
  }, [time, playing]);
  return (
    <div className={`viewport ${background}`}>
      <div className="viewport-label">
        <span className="live-dot" /> PERSPECTIVE{" "}
        <span className="muted">/</span> LIT
      </div>
      <div ref={mount} className="canvas-mount" />
      {loading && <div className="viewport-empty">Loading model…</div>}
      {!source && (
        <div className="viewport-empty">
          <div className="empty-mark">◇</div>
          <h2>Your next asset starts here</h2>
          <p>Import a GLB / GLTF, or open a sample from the library.</p>
          <span>Models stay on your machine.</span>
        </div>
      )}
      <div className="viewport-tools">
        <button title="Reset camera" onClick={() => reset.current()}>
          <RotateCcw size={16} />
        </button>
        <button
          title="Toggle grid"
          className={grid ? "active" : ""}
          onClick={() => preferences({ grid: !grid })}
        >
          <Grid2X2 size={16} />
        </button>
        <button
          title="Change preview background"
          onClick={() =>
            preferences({
              previewBackground: background === "checker" ? "solid" : "checker",
            })
          }
        >
          <Maximize size={16} />
        </button>
      </div>
      <div className="viewport-help">
        Drag to orbit <b>·</b> Right-drag to pan <b>·</b> Scroll to zoom
      </div>
      <div className="axis">
        <span>Y</span>
        <i>Z</i>
        <b>X</b>
      </div>
    </div>
  );
}
