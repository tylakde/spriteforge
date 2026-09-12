import { useEffect, useRef, useState } from "react";
import type { CharacterBuild } from "./build";
import {
  advancePlayback,
  locomotion,
  selectFrame,
  setState,
  type Playback,
} from "./runtime";

export default function PlayTest({
  build,
  onClose,
}: {
  build: CharacterBuild;
  onClose: () => void;
}) {
  const { metadata } = build;
  const canvas = useRef<HTMLCanvasElement>(null),
    keys = useRef(new Set<string>());
  const playback = useRef<Playback>({
    state: metadata.defaultState,
    time: 0,
    finished: false,
  });
  const actor = useRef({ x: 450, y: 290, facing: 0 });
  const [paused, pause] = useState(false),
    [speed, setSpeed] = useState(1),
    [lock, setLock] = useState(""),
    [manual, setManual] = useState(""),
    [camera, setCamera] = useState(0);
  const [debug, setDebug] = useState("Loading baked atlases…"),
    [error, setError] = useState("");
  const settings = useRef({ paused, speed, lock, manual, camera });
  settings.current = { paused, speed, lock, manual, camera };
  const trigger = (name: string) => {
    playback.current = setState(playback.current, name, metadata, true);
  };
  useEffect(() => {
    let disposed = false,
      raf = 0;
    const images: Record<string, ImageBitmap> = {};
    const host = canvas.current!,
      ctx = host.getContext("2d")!;
    const render = (dt: number) => {
      const s = settings.current,
        p = actor.current;
      const current = metadata.states.find(
        (s) => s.name === playback.current.state,
      )!;
      const activeOneShot =
        !current.loop &&
        (playback.current.time < current.duration || playback.current.finished);
      const x = Number(keys.current.has("d")) - Number(keys.current.has("a")),
        y = Number(keys.current.has("s")) - Number(keys.current.has("w"));
      if (!s.paused && !activeOneShot && !s.manual) {
        playback.current = setState(
          playback.current,
          locomotion(metadata, !!(x || y), keys.current.has("shift")),
          metadata,
        );
        if (x || y) {
          const magnitude = Math.hypot(x, y),
            movement = (keys.current.has("shift") ? 160 : 90) * dt;
          p.x = Math.max(50, Math.min(850, p.x + (x / magnitude) * movement));
          p.y = Math.max(130, Math.min(480, p.y + (y / magnitude) * movement));
          p.facing = (Math.atan2(x, y) * 180) / Math.PI + s.camera;
        }
      }
      if (dt > 0)
        playback.current = advancePlayback(playback.current, dt, metadata);
      const state = metadata.states.find(
        (s) => s.name === playback.current.state,
      )!;
      const frame = selectFrame(
        state,
        playback.current.time,
        p.facing,
        s.camera,
        s.lock === "" ? undefined : Number(s.lock),
      );
      ctx.fillStyle = "#192329";
      ctx.fillRect(0, 0, 900, 540);
      ctx.strokeStyle = "#2c3b42";
      ctx.lineWidth = 1;
      for (let n = 0; n < 900; n += 45) {
        ctx.beginPath();
        ctx.moveTo(n, 0);
        ctx.lineTo(n, 540);
        ctx.stroke();
      }
      for (let n = 0; n < 540; n += 45) {
        ctx.beginPath();
        ctx.moveTo(0, n);
        ctx.lineTo(900, n);
        ctx.stroke();
      }
      ctx.strokeStyle = "#688a71";
      ctx.strokeRect(35, 90, 830, 420);
      ctx.fillStyle = "#0005";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 35, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      const size = 190,
        r = frame.rect;
      ctx.imageSmoothingEnabled =
        state.sprite.appearance.textureFilter !== "nearest";
      if (images[state.atlas])
        ctx.drawImage(
          images[state.atlas],
          r.x,
          r.y,
          r.width,
          r.height,
          p.x - size * metadata.anchor.x,
          p.y - size * metadata.anchor.y,
          size,
          size,
        );
      const compass = ["S", "SE", "E", "NE", "N", "NW", "W", "SW"][
        Math.round((((p.facing % 360) + 360) % 360) / 45) % 8
      ];
      setDebug(
        `State: ${state.name} · Direction: ${frame.directionDegrees}° · Frame: ${frame.animationFrame + 1}/${state.frameCount} · FPS: ${state.fps} · Facing: ${compass}`,
      );
    };
    let last = performance.now();
    const tick = (now: number) => {
      const elapsed = Math.min(0.1, (now - last) / 1000);
      last = now;
      render(settings.current.paused ? 0 : elapsed * settings.current.speed);
      raf = requestAnimationFrame(tick);
    };
    void (async () => {
      try {
        for (const [path, blob] of Object.entries(build.atlases)) {
          const image = await createImageBitmap(blob);
          if (disposed) {
            image.close();
            return;
          }
          images[path] = image;
        }
        raf = requestAnimationFrame(tick);
        host.focus();
      } catch (e) {
        if (!disposed) setError((e as Error).message);
      }
    })();
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      Object.values(images).forEach((i) => i.close());
      keys.current.clear();
    };
  }, [build, metadata]);
  return (
    <div className="modal-backdrop">
      <section
        className="forge-play"
        role="dialog"
        aria-modal="true"
        aria-label="Character play test"
      >
        <div className="modal-title">
          <h2>{metadata.name} / Play test</h2>
          <button onClick={onClose}>Close play test</button>
        </div>
        <p>
          WASD move · Shift run · LMB attack · Space dodge/jump · Q/E abilities.
          Click the arena to control.
        </p>
        <canvas
          ref={canvas}
          width={900}
          height={540}
          tabIndex={0}
          aria-label="Playable sprite arena"
          onBlur={() => keys.current.clear()}
          onKeyDown={(e) => {
            const key = e.key.toLowerCase();
            if (["w", "a", "s", "d", "shift", " ", "q", "e"].includes(key))
              e.preventDefault();
            keys.current.add(key);
            if (!e.repeat && key === " ")
              trigger(
                metadata.states.some((s) => s.name === "Dodge")
                  ? "Dodge"
                  : "Jump",
              );
            if (!e.repeat && key === "q")
              trigger(
                metadata.states.some((s) => s.name === "Ability 1")
                  ? "Ability 1"
                  : "Cast",
              );
            if (!e.repeat && key === "e") trigger("Ability 2");
          }}
          onKeyUp={(e) => keys.current.delete(e.key.toLowerCase())}
          onPointerDown={(e) => {
            e.currentTarget.focus();
            if (e.button === 0) trigger("Attack");
          }}
        />
        <output data-testid="play-debug">{debug}</output>
        {error && <p role="alert">{error}</p>}
        <div className="forge-toolbar">
          <button onClick={() => pause(!paused)}>
            {paused ? "Resume" : "Pause"}
          </button>
          <button
            onClick={() => {
              pause(true);
              const state = metadata.states.find(
                (s) => s.name === playback.current.state,
              )!;
              playback.current = advancePlayback(
                playback.current,
                1 / state.fps,
                metadata,
              );
            }}
          >
            Frame step
          </button>
          <label>
            Speed{" "}
            <select
              aria-label="Playback speed"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
            >
              <option value={1}>1×</option>
              <option value={0.25}>0.25×</option>
            </select>
          </label>
          <label>
            State{" "}
            <select
              aria-label="Preview state"
              value={manual}
              onChange={(e) => {
                setManual(e.target.value);
                trigger(e.target.value || metadata.defaultState);
              }}
            >
              <option value="">Automatic</option>
              {metadata.states.map((s) => (
                <option key={s.name}>{s.name}</option>
              ))}
            </select>
          </label>
          <label>
            Direction{" "}
            <select
              aria-label="Direction lock"
              value={lock}
              onChange={(e) => setLock(e.target.value)}
            >
              <option value="">Automatic</option>
              {metadata.directions.map((d) => (
                <option key={d} value={d}>
                  {d}°
                </option>
              ))}
            </select>
          </label>
          <label>
            Camera{" "}
            <select
              aria-label="Arena camera yaw"
              value={camera}
              onChange={(e) => setCamera(Number(e.target.value))}
            >
              {[0, 90, 180, 270].map((d) => (
                <option key={d} value={d}>
                  {d}°
                </option>
              ))}
            </select>
          </label>
          {["Hit", "Death"].map((name) => (
            <button
              key={name}
              disabled={!metadata.states.some((s) => s.name === name)}
              onClick={() => trigger(name)}
            >
              Test {name}
            </button>
          ))}
          <button
            onClick={() => {
              setManual("");
              trigger(metadata.defaultState);
            }}
          >
            Reset character
          </button>
        </div>
      </section>
    </div>
  );
}
