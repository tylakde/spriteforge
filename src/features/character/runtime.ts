import { normaliseAngle } from "../../lib/math";
import type { CharacterMetadata, CharacterState } from "./schema";
export interface Playback {
  state: string;
  time: number;
  finished: boolean;
}
export function setState(
  current: Playback,
  name: string,
  character: CharacterMetadata,
  restart = false,
): Playback {
  if (
    !character.states.some((s) => s.name === name) ||
    (current.state === name && !restart)
  )
    return current;
  return { state: name, time: 0, finished: false };
}
export function advancePlayback(
  current: Playback,
  dt: number,
  character: CharacterMetadata,
): Playback {
  const state = character.states.find((s) => s.name === current.state)!;
  let time = current.time + Math.max(0, dt);
  if (time >= state.duration) {
    if (state.loop) time %= state.duration;
    else if (state.returnToDefault && state.name !== character.defaultState)
      return { state: character.defaultState, time: 0, finished: false };
    else return { ...current, time: state.duration, finished: true };
  }
  return { ...current, time };
}
export function selectFrame(
  state: CharacterState,
  time: number,
  facing: number,
  cameraYaw = 0,
  lockedDirection?: number,
) {
  const target =
    lockedDirection ??
    normaliseAngle(cameraYaw - facing + state.sprite.frontDirection);
  const distance = (v: number) =>
    Math.abs(normaliseAngle(v - target + 180) - 180);
  const direction = state.sprite.directions.reduce((a, b) =>
    distance(a) <= distance(b) ? a : b,
  );
  const frame = Math.min(
    state.frameCount - 1,
    Math.max(0, Math.floor(time * state.fps)),
  );
  return state.sprite.frames.find(
    (f) => f.directionDegrees === direction && f.animationFrame === frame,
  )!;
}
export function locomotion(
  character: CharacterMetadata,
  moving: boolean,
  running: boolean,
) {
  const desired = moving ? (running ? ["Run", "Walk"] : ["Walk", "Run"]) : [];
  return (
    desired.find((name) => character.states.some((s) => s.name === name)) ??
    character.defaultState
  );
}
