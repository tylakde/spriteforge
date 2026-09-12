import {
  AnimationClip,
  Bone,
  BoxGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  QuaternionKeyframeTrack,
  Skeleton,
  SkinnedMesh,
  Uint16BufferAttribute,
  VectorKeyframeTrack,
} from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { mkdirSync, writeFileSync } from "node:fs";
// GLTFExporter uses browser FileReader for binary export; no DOM or image assets needed.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = result;
      this.onloadend?.();
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = `data:${blob.type};base64,${Buffer.from(result).toString("base64")}`;
      this.onloadend?.();
    });
  }
};
function rig() {
  const root = new Group();
  root.name = "Character";
  const hips = new Bone();
  hips.name = "Hips";
  hips.position.y = 1;
  const hand = new Bone();
  hand.name = "Hand";
  hand.position.set(0.7, 0.35, 0);
  hips.add(hand);
  root.add(hips);
  root.updateMatrixWorld(true);
  return { root, hips, hand, skeleton: new Skeleton([hips, hand]) };
}
function skin(r, name, color, dimensions, center) {
  const g = new BoxGeometry(...dimensions);
  g.translate(...center);
  const count = g.attributes.position.count;
  const indices = [],
    weights = [];
  for (let i = 0; i < count; i++) {
    indices.push(0, 0, 0, 0);
    weights.push(1, 0, 0, 0);
  }
  g.setAttribute("skinIndex", new Uint16BufferAttribute(indices, 4));
  g.setAttribute("skinWeight", new Float32BufferAttribute(weights, 4));
  const mesh = new SkinnedMesh(g, new MeshStandardMaterial({ color }));
  mesh.name = name;
  r.root.add(mesh);
  mesh.bind(r.skeleton);
}
function clips() {
  return ["Idle", "Walk", "Run", "Attack", "Hit", "Death"].map(
    (name, i) =>
      new AnimationClip(name, 1, [
        new VectorKeyframeTrack(
          "Hips.position",
          [0, 0.5, 1],
          [0, 1, 0, 0, name === "Death" ? 0.4 : 1.04 + i * 0.015, 0, 0, 1, 0],
        ),
        new QuaternionKeyframeTrack(
          "Hand.quaternion",
          [0, 0.5, 1],
          [
            0,
            0,
            0,
            1,
            0,
            0,
            Math.sin((i + 1) * 0.2),
            Math.cos((i + 1) * 0.2),
            0,
            0,
            0,
            1,
          ],
        ),
      ]),
  );
}
mkdirSync("public/samples/factory", { recursive: true });
async function save(name, root, animations = []) {
  const data = await new GLTFExporter().parseAsync(root, {
    binary: true,
    animations,
  });
  writeFileSync(`public/samples/factory/${name}.glb`, Buffer.from(data));
}
const base = rig();
skin(base, "Body", 0x50745c, [0.65, 1.3, 0.45], [0, 0.9, 0]);
skin(base, "Face", 0xd4ae81, [0.5, 0.5, 0.48], [0, 1.8, 0]);
await save("Base_Human", base.root, clips());
for (const [name, color] of [
  ["Chest_Iron", 0x718491],
  ["Chest_Gold", 0xceac56],
  ["Chest_Shadow", 0x3e405d],
]) {
  const r = rig();
  skin(r, name, color, [0.8, 0.8, 0.58], [0, 1.25, 0]);
  await save(name, r.root);
}
const sword = new Group();
const blade = new Mesh(
  new BoxGeometry(0.08, 0.75, 0.05),
  new MeshStandardMaterial({ color: 0xa6d8de }),
);
blade.position.y = 0.3;
sword.add(blade);
await save("Weapon_Sword", sword);
const shield = new Group();
shield.add(
  new Mesh(
    new BoxGeometry(0.45, 0.65, 0.1),
    new MeshStandardMaterial({ color: 0x9b6241 }),
  ),
);
await save("Offhand_Shield", shield);
await save("Human_Combat_Animations", rig().root, clips());
console.log(
  "Created original skinned body, three compatible chest pieces, static equipment and bone-only animation library.",
);
for (let i = 0; i < 4; i++) {
  const root = new Group();
  const helmet = new Mesh(
    new BoxGeometry(0.58, 0.25 + i * 0.04, 0.56),
    new MeshStandardMaterial({
      color: [0x647986, 0xb9a970, 0x485263, 0x8d6353][i],
    }),
  );
  helmet.position.set(0, 2.08 + i * 0.02, 0);
  root.add(helmet);
  await save(`Helmet_Guard_${i + 1}`, root);
}
for (let i = 0; i < 5; i++) {
  const root = new Group();
  const hair = new Mesh(
    new BoxGeometry(0.55 + i * 0.025, 0.35, 0.15 + i * 0.035),
    new MeshStandardMaterial({
      color: [0x33281f, 0x7d5035, 0xd3b66b, 0xa8a49e, 0x68372c][i],
    }),
  );
  hair.position.set(0, 1.87, -0.28);
  root.add(hair);
  await save(`Hair_Guard_${i + 1}`, root);
}
