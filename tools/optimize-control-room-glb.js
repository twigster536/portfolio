/*
 * Creates a web-ready copy of the Grid Guardian GLB without changing the
 * supplied master. The pass deliberately keeps scene names, rigging, clips,
 * materials, and navigation objects intact.
 *
 * Run with the bundled Sharp module on NODE_PATH:
 *   node tools/optimize-control-room-glb.js
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const INPUT = path.join("assets", "models", "CatBot_Control_Room_FINAL.glb");
const OUTPUT = path.join("assets", "models", "CatBot_Control_Room_WEB.glb");
const MAX_TEXTURE_SIZE = 2048;
const IMAGE_QUALITY = 88;
const HMI_IMAGE_QUALITY = 90;
const MAX_SPLIT_VERTICES = 65535;

const COMPONENT_BYTES = Object.freeze({ 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 });
const TYPE_COMPONENTS = Object.freeze({ SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 });

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function align4(size) { return (size + 3) & ~3; }
function isIdentityRotation(rotation) { return !rotation || (Math.abs(rotation[0]) < 1e-7 && Math.abs(rotation[1]) < 1e-7 && Math.abs(rotation[2]) < 1e-7 && Math.abs(rotation[3] - 1) < 1e-7); }
function isUnitScale(scale) { return !scale || (Math.abs(scale[0] - 1) < 1e-7 && Math.abs(scale[1] - 1) < 1e-7 && Math.abs(scale[2] - 1) < 1e-7); }

function readGlb(file) {
  const source = fs.readFileSync(file);
  if (source.readUInt32LE(0) !== 0x46546c67 || source.readUInt32LE(4) !== 2) throw new Error("Expected a glTF 2.0 binary GLB.");
  const jsonLength = source.readUInt32LE(12);
  const jsonType = source.readUInt32LE(16);
  if (jsonType !== 0x4e4f534a) throw new Error("The first GLB chunk is not JSON.");
  const json = JSON.parse(source.subarray(20, 20 + jsonLength).toString("utf8").replace(/\0+$/, ""));
  const binaryHeader = 20 + jsonLength;
  if (source.readUInt32LE(binaryHeader + 4) !== 0x004e4942) throw new Error("The second GLB chunk is not BIN.");
  const binaryLength = source.readUInt32LE(binaryHeader);
  return { source, json, bin: source.subarray(binaryHeader + 8, binaryHeader + 8 + binaryLength) };
}

class BinBuilder {
  constructor() { this.parts = []; this.length = 0; }
  append(data) {
    const padding = align4(this.length) - this.length;
    if (padding) { this.parts.push(Buffer.alloc(padding)); this.length += padding; }
    const offset = this.length;
    this.parts.push(data);
    this.length += data.length;
    return offset;
  }
  build() {
    const padding = align4(this.length) - this.length;
    if (padding) this.parts.push(Buffer.alloc(padding));
    return Buffer.concat(this.parts);
  }
}

async function main() {
  const { source, json, bin } = readGlb(INPUT);
  const sourceViews = clone(json.bufferViews || []);
  const sourceAccessors = clone(json.accessors || []);
  const replacements = new Map();
  const extraViews = [];
  const staticPositionSpecs = new Map();
  const uvSpecs = new Map();
  const weightSpecs = new Map();
  const imageStats = [];

  const accessorByteLength = (accessor) => COMPONENT_BYTES[accessor.componentType] * TYPE_COMPONENTS[accessor.type];
  const viewData = (view) => bin.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
  const accessorOffset = (accessor, index) => {
    const view = sourceViews[accessor.bufferView];
    const stride = view.byteStride || accessorByteLength(accessor);
    return (view.byteOffset || 0) + (accessor.byteOffset || 0) + index * stride;
  };
  const readFloat = (accessor, index, component) => bin.readFloatLE(accessorOffset(accessor, index) + component * 4);
  const rawElement = (accessor, index) => {
    const size = accessorByteLength(accessor);
    return bin.subarray(accessorOffset(accessor, index), accessorOffset(accessor, index) + size);
  };
  const addExtraView = (data, target) => {
    const index = json.bufferViews.length + extraViews.length;
    extraViews.push({ data, target });
    return index;
  };
  const setReplacement = (viewIndex, data) => {
    if (replacements.has(viewIndex)) throw new Error(`Buffer view ${viewIndex} was unexpectedly requested twice.`);
    replacements.set(viewIndex, data);
  };

  // Texture optimization is intentionally first: all embedded source maps are
  // rewritten as self-contained WebP, and only the 8192px HMI/emissive map is
  // downscaled to the web-safe 2048px ceiling.
  for (let imageIndex = 0; imageIndex < (json.images || []).length; imageIndex += 1) {
    const image = json.images[imageIndex];
    if (image.bufferView === undefined) throw new Error(`Image ${imageIndex} is not embedded; this pass expects the supplied self-contained GLB.`);
    const input = viewData(sourceViews[image.bufferView]);
    const metadata = await sharp(input).metadata();
    const output = await sharp(input)
      .resize({ width: MAX_TEXTURE_SIZE, height: MAX_TEXTURE_SIZE, fit: "inside", withoutEnlargement: true, kernel: sharp.kernel.lanczos3 })
      .webp({ quality: imageIndex === 15 ? HMI_IMAGE_QUALITY : IMAGE_QUALITY, smartSubsample: true, alphaQuality: 92 })
      .toBuffer();
    setReplacement(image.bufferView, output);
    image.mimeType = "image/webp";
    imageStats.push({ imageIndex, name: image.name || "[unnamed]", before: input.length, after: output.length, beforeSize: `${metadata.width}x${metadata.height}`, afterSize: `${Math.min(metadata.width, MAX_TEXTURE_SIZE)}x${Math.min(metadata.height, MAX_TEXTURE_SIZE)}` });
  }

  const meshNode = new Map();
  (json.nodes || []).forEach((node, nodeIndex) => {
    if (node.mesh !== undefined) {
      if (meshNode.has(node.mesh)) throw new Error(`Mesh ${node.mesh} is instanced by more than one node and is excluded from this conservative pass.`);
      meshNode.set(node.mesh, { node, nodeIndex });
    }
  });

  // The five large, static equipment meshes may safely use position
  // quantization because each is used by one plain-TRS node. CatBot remains
  // float-positioned so its armature and existing navigation logic are intact.
  for (let meshIndex = 0; meshIndex <= 4; meshIndex += 1) {
    const primitive = json.meshes[meshIndex]?.primitives?.[0];
    const accessorIndex = primitive?.attributes?.POSITION;
    const nodeInfo = meshNode.get(meshIndex);
    if (accessorIndex === undefined || !nodeInfo) throw new Error(`Static mesh ${meshIndex} has no usable POSITION/node pair.`);
    const accessor = sourceAccessors[accessorIndex];
    if (accessor.componentType !== 5126 || accessor.type !== "VEC3") throw new Error(`Static mesh ${meshIndex} POSITION is not float VEC3.`);
    if (nodeInfo.node.matrix || !isIdentityRotation(nodeInfo.node.rotation) || !isUnitScale(nodeInfo.node.scale)) throw new Error(`Static mesh ${meshIndex} has a non-conservative transform and cannot be quantized safely.`);
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let vertex = 0; vertex < accessor.count; vertex += 1) {
      for (let component = 0; component < 3; component += 1) {
        const value = readFloat(accessor, vertex, component);
        min[component] = Math.min(min[component], value);
        max[component] = Math.max(max[component], value);
      }
    }
    const range = max.map((value, component) => Math.max(value - min[component], 1));
    const originalTranslation = nodeInfo.node.translation || [0, 0, 0];
    nodeInfo.node.translation = originalTranslation.map((value, component) => value + min[component]);
    nodeInfo.node.scale = range;
    staticPositionSpecs.set(accessorIndex, { min, range });
  }

  for (let accessorIndex = 0; accessorIndex < sourceAccessors.length; accessorIndex += 1) {
    const accessor = sourceAccessors[accessorIndex];
    if (accessor.componentType !== 5126 || accessor.type !== "VEC2") continue;
    let valid = true;
    for (let vertex = 0; vertex < accessor.count && valid; vertex += 1) {
      for (let component = 0; component < 2; component += 1) {
        const value = readFloat(accessor, vertex, component);
        if (value < -1e-5 || value > 1 + 1e-5) { valid = false; break; }
      }
    }
    if (valid) uvSpecs.set(accessorIndex, true);
  }

  for (let accessorIndex = 0; accessorIndex < sourceAccessors.length; accessorIndex += 1) {
    const accessor = sourceAccessors[accessorIndex];
    if (accessor.componentType !== 5126 || accessor.type !== "VEC4") continue;
    let valid = true;
    for (let vertex = 0; vertex < accessor.count && valid; vertex += 1) {
      for (let component = 0; component < 4; component += 1) {
        const value = readFloat(accessor, vertex, component);
        if (value < -1e-5 || value > 1 + 1e-5) { valid = false; break; }
      }
    }
    if (valid) weightSpecs.set(accessorIndex, true);
  }

  const encodingFor = (semantic, accessorIndex) => {
    const accessor = sourceAccessors[accessorIndex];
    if (semantic === "POSITION" && staticPositionSpecs.has(accessorIndex)) return { type: "POSITION", spec: staticPositionSpecs.get(accessorIndex) };
    if (semantic === "NORMAL" && accessor.componentType === 5126 && accessor.type === "VEC3") return { type: "NORMAL" };
    if (semantic === "TEXCOORD_0" && uvSpecs.has(accessorIndex)) return { type: "TEXCOORD_0" };
    if (semantic === "WEIGHTS_0" && weightSpecs.has(accessorIndex)) return { type: "WEIGHTS_0" };
    return { type: "RAW" };
  };

  const encodeAttribute = (accessorIndex, semantic, vertexOrder) => {
    const accessor = sourceAccessors[accessorIndex];
    const encoding = encodingFor(semantic, accessorIndex);
    const vertices = vertexOrder || Array.from({ length: accessor.count }, (_, index) => index);
    if (encoding.type === "RAW" && !vertexOrder && !(sourceViews[accessor.bufferView].byteStride)) return Buffer.from(bin.subarray((sourceViews[accessor.bufferView].byteOffset || 0) + (accessor.byteOffset || 0), (sourceViews[accessor.bufferView].byteOffset || 0) + (accessor.byteOffset || 0) + accessor.count * accessorByteLength(accessor)));
    if (encoding.type === "RAW") {
      const data = Buffer.alloc(vertices.length * accessorByteLength(accessor));
      vertices.forEach((vertex, outputIndex) => rawElement(accessor, vertex).copy(data, outputIndex * accessorByteLength(accessor)));
      return data;
    }
    const components = TYPE_COMPONENTS[accessor.type];
    const data = Buffer.alloc(vertices.length * components * 2);
    vertices.forEach((vertex, outputIndex) => {
      for (let component = 0; component < components; component += 1) {
        const value = readFloat(accessor, vertex, component);
        const byteOffset = (outputIndex * components + component) * 2;
        if (encoding.type === "POSITION") {
          const range = encoding.spec.range[component];
          const normalized = Math.max(0, Math.min(1, (value - encoding.spec.min[component]) / range));
          data.writeUInt16LE(Math.round(normalized * 65535), byteOffset);
        } else if (encoding.type === "NORMAL") {
          data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, value)) * 32767), byteOffset);
        } else {
          data.writeUInt16LE(Math.round(Math.max(0, Math.min(1, value)) * 65535), byteOffset);
        }
      }
    });
    return data;
  };

  const applyEncoding = (accessor, semantic, sourceAccessorIndex, count, bufferView) => {
    const encoding = encodingFor(semantic, sourceAccessorIndex);
    accessor.bufferView = bufferView;
    accessor.byteOffset = 0;
    accessor.count = count;
    if (encoding.type === "POSITION") {
      accessor.componentType = 5123;
      accessor.normalized = true;
      accessor.min = [0, 0, 0];
      accessor.max = [65535, 65535, 65535];
    } else if (encoding.type === "NORMAL") {
      accessor.componentType = 5122;
      accessor.normalized = true;
      delete accessor.min;
      delete accessor.max;
    } else if (encoding.type === "TEXCOORD_0" || encoding.type === "WEIGHTS_0") {
      accessor.componentType = 5123;
      accessor.normalized = true;
      delete accessor.min;
      delete accessor.max;
    }
  };

  const createSplitAccessor = (sourceAccessorIndex, semantic, data, count) => {
    const sourceAccessor = sourceAccessors[sourceAccessorIndex];
    const bufferView = addExtraView(data, sourceViews[sourceAccessor.bufferView].target);
    const accessor = clone(sourceAccessor);
    applyEncoding(accessor, semantic, sourceAccessorIndex, count, bufferView);
    json.accessors.push(accessor);
    return json.accessors.length - 1;
  };

  const replaceFirstAccessor = (accessorIndex, semantic, data, count) => {
    const sourceAccessor = sourceAccessors[accessorIndex];
    setReplacement(sourceAccessor.bufferView, data);
    applyEncoding(json.accessors[accessorIndex], semantic, accessorIndex, count, sourceAccessor.bufferView);
    return accessorIndex;
  };

  const readIndices = (accessor) => {
    const values = new Array(accessor.count);
    for (let index = 0; index < accessor.count; index += 1) {
      const offset = accessorOffset(accessor, index);
      values[index] = accessor.componentType === 5125 ? bin.readUInt32LE(offset) : bin.readUInt16LE(offset);
    }
    return values;
  };

  const encodeIndices = (indices) => {
    const data = Buffer.alloc(indices.length * 2);
    indices.forEach((index, offset) => data.writeUInt16LE(index, offset * 2));
    return data;
  };

  const makeSplitChunks = (indices) => {
    const chunks = [];
    let map = new Map();
    let indexList = [];
    const finish = () => {
      if (!indexList.length) return;
      chunks.push({ vertices: [...map.keys()], indices: indexList });
      map = new Map();
      indexList = [];
    };
    for (let offset = 0; offset < indices.length; offset += 3) {
      let additions = 0;
      for (let component = 0; component < 3; component += 1) if (!map.has(indices[offset + component])) additions += 1;
      if (map.size + additions > MAX_SPLIT_VERTICES) finish();
      for (let component = 0; component < 3; component += 1) {
        const original = indices[offset + component];
        if (!map.has(original)) map.set(original, map.size);
        indexList.push(map.get(original));
      }
    }
    finish();
    return chunks;
  };

  const originalMeshes = clone(json.meshes);
  const splitStats = [];
  let convertedNormals = 0;
  let convertedUvs = 0;
  let convertedWeights = 0;
  for (let meshIndex = 0; meshIndex < originalMeshes.length; meshIndex += 1) {
    const result = [];
    for (const primitive of originalMeshes[meshIndex].primitives) {
      const attributes = primitive.attributes || {};
      const sourceIndexAccessor = primitive.indices === undefined ? null : sourceAccessors[primitive.indices];
      const addConvertedCounts = () => {
        Object.entries(attributes).forEach(([semantic, accessorIndex]) => {
          if (encodingFor(semantic, accessorIndex).type === "NORMAL") convertedNormals += sourceAccessors[accessorIndex].count;
          if (encodingFor(semantic, accessorIndex).type === "TEXCOORD_0") convertedUvs += sourceAccessors[accessorIndex].count;
          if (encodingFor(semantic, accessorIndex).type === "WEIGHTS_0") convertedWeights += sourceAccessors[accessorIndex].count;
        });
      };
      if (sourceIndexAccessor?.componentType === 5125) {
        const chunks = makeSplitChunks(readIndices(sourceIndexAccessor));
        splitStats.push({ mesh: originalMeshes[meshIndex].name || `mesh_${meshIndex}`, chunks: chunks.length, originalVertices: sourceAccessors[attributes.POSITION].count, splitVertices: chunks.reduce((total, chunk) => total + chunk.vertices.length, 0) });
        chunks.forEach((chunk, chunkIndex) => {
          const next = clone(primitive);
          next.attributes = {};
          Object.entries(attributes).forEach(([semantic, accessorIndex]) => {
            const data = encodeAttribute(accessorIndex, semantic, chunk.vertices);
            next.attributes[semantic] = chunkIndex === 0 ? replaceFirstAccessor(accessorIndex, semantic, data, chunk.vertices.length) : createSplitAccessor(accessorIndex, semantic, data, chunk.vertices.length);
          });
          const indexData = encodeIndices(chunk.indices);
          if (chunkIndex === 0) {
            setReplacement(sourceIndexAccessor.bufferView, indexData);
            const accessor = json.accessors[primitive.indices];
            accessor.byteOffset = 0;
            accessor.count = chunk.indices.length;
            accessor.componentType = 5123;
            delete accessor.normalized;
          } else {
            const indexView = addExtraView(indexData, sourceViews[sourceIndexAccessor.bufferView].target);
            const accessor = clone(sourceIndexAccessor);
            accessor.bufferView = indexView;
            accessor.byteOffset = 0;
            accessor.count = chunk.indices.length;
            accessor.componentType = 5123;
            delete accessor.normalized;
            json.accessors.push(accessor);
            next.indices = json.accessors.length - 1;
          }
          result.push(next);
        });
        addConvertedCounts();
      } else {
        const next = clone(primitive);
        Object.entries(attributes).forEach(([semantic, accessorIndex]) => {
          const data = encodeAttribute(accessorIndex, semantic, null);
          replaceFirstAccessor(accessorIndex, semantic, data, sourceAccessors[accessorIndex].count);
        });
        addConvertedCounts();
        result.push(next);
      }
    }
    json.meshes[meshIndex].primitives = result;
  }

  if (!json.extensionsUsed) json.extensionsUsed = [];
  if (!json.extensionsUsed.includes("KHR_mesh_quantization")) json.extensionsUsed.push("KHR_mesh_quantization");

  const writer = new BinBuilder();
  json.bufferViews.forEach((view, viewIndex) => {
    const data = replacements.get(viewIndex) || Buffer.from(viewData(sourceViews[viewIndex]));
    view.byteOffset = writer.append(data);
    view.byteLength = data.length;
  });
  extraViews.forEach(({ data, target }) => {
    const byteOffset = writer.append(data);
    json.bufferViews.push({ buffer: 0, byteOffset, byteLength: data.length, ...(target ? { target } : {}) });
  });
  const outputBin = writer.build();
  json.buffers = [{ byteLength: outputBin.length }];
  const jsonData = Buffer.from(JSON.stringify(json));
  const jsonPadding = Buffer.alloc(align4(jsonData.length) - jsonData.length, 0x20);
  const binPadding = Buffer.alloc(align4(outputBin.length) - outputBin.length);
  const totalLength = 12 + 8 + jsonData.length + jsonPadding.length + 8 + outputBin.length + binPadding.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonData.length + jsonPadding.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(outputBin.length + binPadding.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);
  fs.writeFileSync(OUTPUT, Buffer.concat([header, jsonHeader, jsonData, jsonPadding, binHeader, outputBin, binPadding]));

  const outputSize = fs.statSync(OUTPUT).size;
  console.log(JSON.stringify({
    input: { path: INPUT, bytes: source.length },
    output: { path: OUTPUT, bytes: outputSize, reductionPercent: Number(((1 - outputSize / source.length) * 100).toFixed(2)) },
    textureStats: imageStats,
    geometry: { positionQuantizedMeshes: [...staticPositionSpecs.keys()].length, normalVertices: convertedNormals, uvVertices: convertedUvs, skinWeightVertices: convertedWeights, indexSplits: splitStats },
    extensionsUsed: json.extensionsUsed
  }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
