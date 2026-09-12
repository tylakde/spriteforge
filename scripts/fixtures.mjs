import { BoxGeometry, CylinderGeometry, IcosahedronGeometry } from "three";
import { mkdirSync, writeFileSync } from "node:fs";
// Original procedural fixtures: no downloaded artwork or network dependencies.
function build(animated, forge = false) {
  const chunks = [];
  let offset = 0;
  const views = [],
    accessors = [],
    meshes = [],
    nodes = [];
  const add = (array, type, componentType = 5126) => {
    const buf = Buffer.from(array.buffer, array.byteOffset, array.byteLength);
    const aligned = Buffer.alloc(Math.ceil(buf.length / 4) * 4);
    buf.copy(aligned);
    const index = views.length;
    views.push({ buffer: 0, byteOffset: offset, byteLength: buf.length });
    chunks.push(aligned);
    offset += aligned.length;
    const comps = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[type];
    const accessor = {
      bufferView: index,
      componentType,
      count: array.length / comps,
      type,
    };
    if (type === "VEC3") {
      accessor.min = [0, 1, 2].map((c) =>
        Math.min(...Array.from(array).filter((_, i) => i % 3 === c)),
      );
      accessor.max = [0, 1, 2].map((c) =>
        Math.max(...Array.from(array).filter((_, i) => i % 3 === c)),
      );
    }
    if (type === "SCALAR" && componentType === 5126) {
      accessor.min = [Math.min(...array)];
      accessor.max = [Math.max(...array)];
    }
    accessors.push(accessor);
    return accessors.length - 1;
  };
  const materials = [
    {
      name: "Jade enamel",
      pbrMetallicRoughness: {
        baseColorFactor: [0.18, 0.5, 0.36, 1],
        metallicFactor: 0.35,
        roughnessFactor: 0.42,
        baseColorTexture: { index: 0 },
      },
    },
    {
      name: "Warm brass",
      pbrMetallicRoughness: {
        baseColorFactor: [0.62, 0.38, 0.12, 1],
        metallicFactor: 0.65,
        roughnessFactor: 0.36,
      },
    },
    {
      name: "Dark stone",
      pbrMetallicRoughness: {
        baseColorFactor: [0.21, 0.27, 0.28, 1],
        metallicFactor: 0.1,
        roughnessFactor: 0.85,
      },
    },
    {
      name: "Glowing rune",
      pbrMetallicRoughness: {
        baseColorFactor: [0.5, 0.95, 0.62, 1],
        roughnessFactor: 0.3,
      },
      emissiveFactor: [0.2, 0.65, 0.3],
    },
  ];
  const part = (name, geometry, position, material, rotation) => {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    const attributes = {
      POSITION: add(g.attributes.position.array, "VEC3"),
      NORMAL: add(g.attributes.normal.array, "VEC3"),
      TEXCOORD_0: add(g.attributes.uv.array, "VEC2"),
    };
    const mesh = meshes.length;
    meshes.push({ name, primitives: [{ attributes, material }] });
    const node = nodes.length;
    nodes.push({
      name,
      mesh,
      translation: position,
      ...(rotation ? { rotation } : {}),
    });
    return node;
  };
  if (animated) {
    part("Left boot", new BoxGeometry(0.4, 0.28, 0.65), [-0.32, 0.14, 0.1], 2);
    part("Right boot", new BoxGeometry(0.4, 0.28, 0.65), [0.32, 0.14, 0.1], 2);
    part("Left leg", new BoxGeometry(0.28, 0.65, 0.3), [-0.32, 0.58, 0], 1);
    part("Right leg", new BoxGeometry(0.28, 0.65, 0.3), [0.32, 0.58, 0], 1);
    part("Torso", new BoxGeometry(1, 0.85, 0.55), [0, 1.18, 0], 0);
    part("Head", new BoxGeometry(0.64, 0.55, 0.58), [0, 1.98, 0], 0);
    part("Visor", new BoxGeometry(0.46, 0.11, 0.06), [0, 2.02, 0.31], 3);
    part(
      "Left shoulder",
      new IcosahedronGeometry(0.32, 0),
      [-0.72, 1.48, 0],
      1,
    );
    part(
      "Right shoulder",
      new IcosahedronGeometry(0.32, 0),
      [0.72, 1.48, 0],
      1,
    );
    part("Left arm", new BoxGeometry(0.23, 0.62, 0.27), [-0.78, 1.05, 0], 0);
    part("Right arm", new BoxGeometry(0.23, 0.62, 0.27), [0.78, 1.05, 0], 0);
    part("Chest rune", new BoxGeometry(0.17, 0.25, 0.04), [0, 1.25, 0.3], 3);
  } else {
    part("Plinth", new CylinderGeometry(0.85, 1, 0.3, 6), [0, 0.15, 0], 2);
    part(
      "Foot trim",
      new CylinderGeometry(0.69, 0.78, 0.15, 6),
      [0, 0.37, 0],
      1,
    );
    part("Monolith", new CylinderGeometry(0.43, 0.63, 1.7, 6), [0, 1.28, 0], 0);
    part("Crown", new IcosahedronGeometry(0.48, 0), [0, 2.3, 0], 1);
    part("Rune", new BoxGeometry(0.12, 0.72, 0.04), [0, 1.45, 0.52], 3);
    part("Rune cross", new BoxGeometry(0.4, 0.1, 0.04), [0, 1.5, 0.53], 3);
    part("Offset shard", new IcosahedronGeometry(0.2, 0), [0.78, 0.5, 0.2], 0);
  }
  const root = nodes.length;
  nodes.push({ name: "AssetRoot", children: nodes.map((_, i) => i) });
  const animations = [];
  if (animated) {
    const input = add(new Float32Array([0, 0.25, 0.5, 0.75, 1]), "SCALAR");
    const output = add(
      new Float32Array([0, 0, 0, 0, 0.09, 0, 0, 0, 0, 0, -0.035, 0, 0, 0, 0]),
      "VEC3",
    );
    animations.push({
      name: "Idle",
      samplers: [{ input, output, interpolation: "LINEAR" }],
      channels: [{ sampler: 0, target: { node: root, path: "translation" } }],
    });
  }
  if (forge) {
    const input = add(new Float32Array([0, 0.25, 0.5, 0.75, 1]), "SCALAR");
    for (const [name, height, stride] of [
      ["Walk_Fwd", 0.12, 0.22],
      ["Jog", 0.22, 0.4],
      ["SwordAttack_A", 0.04, 0.7],
      ["DamageReact", -0.12, -0.2],
      ["Death_A", -0.8, 0.1],
      ["Dodge_Roll", -0.4, 0.5],
    ]) {
      const output = add(
        new Float32Array([
          0,
          0,
          0,
          0,
          height,
          stride,
          0,
          0,
          0,
          0,
          height,
          -stride,
          0,
          0,
          0,
        ]),
        "VEC3",
      );
      animations.push({
        name,
        samplers: [{ input, output, interpolation: "LINEAR" }],
        channels: [{ sampler: 0, target: { node: root, path: "translation" } }],
      });
    }
  }
  const png =
    "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAHklEQVR4nGM4e/bsfxCGAXQ+A0EFuCRgfMIKBoEbAM+/7EFT3jvPAAAAAElFTkSuQmCC";
  const doc = {
    asset: {
      version: "2.0",
      generator: "SpriteForge original procedural fixtures",
    },
    scene: 0,
    scenes: [{ nodes: [root] }],
    nodes,
    meshes,
    materials,
    images: [{ uri: "data:image/png;base64," + png }],
    textures: [{ source: 0 }],
    animations,
    buffers: [{ byteLength: offset }],
    bufferViews: views,
    accessors,
  };
  const json = Buffer.from(JSON.stringify(doc));
  const padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 0x20);
  json.copy(padded);
  const bin = Buffer.concat(chunks);
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + padded.length + 8 + bin.length, 8);
  header.writeUInt32LE(padded.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  const bh = Buffer.alloc(8);
  bh.writeUInt32LE(bin.length, 0);
  bh.writeUInt32LE(0x004e4942, 4);
  return { glb: Buffer.concat([header, padded, bh, bin]), doc, bin };
}
mkdirSync("public/samples", { recursive: true });
mkdirSync("fixtures/sidecar", { recursive: true });
for (const [name, animated] of [
  ["Runestone", false],
  ["Sentinel", true],
]) {
  const { glb, doc, bin } = build(animated);
  writeFileSync(`public/samples/${name}.glb`, glb);
  if (!animated) {
    doc.buffers[0].uri = "mesh.bin";
    writeFileSync("fixtures/sidecar/Runestone.gltf", JSON.stringify(doc));
    writeFileSync("fixtures/sidecar/mesh.bin", bin);
  }
}
writeFileSync("public/samples/ForgeKnight.glb", build(true, true).glb);
writeFileSync("fixtures/malformed.glb", "not a glb");
console.log(
  "Created textured static and animated GLB fixtures, GLTF sidecars and malformed input.",
);
