import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Validate the full PNG stream, not just its dimensions or file size.
export function checkEngravingAssets(directory) {
  for (const [name, width, height] of [
    ["engraving-anatomy.png", 1024, 1536],
    ["engraving-torso-sleeves.png", 1254, 1254],
  ]) {
    const png = readFileSync(path.join(directory, name));
    const fail = () => { throw new Error(`Corrupt engraving asset: ${name}`); };
    if (!png.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) fail();
    const data = [];
    let header = false, ended = false;
    for (let offset = 8; offset < png.length;) {
      if (offset + 12 > png.length) fail();
      const length = png.readUInt32BE(offset);
      const end = offset + 8 + length;
      if (end + 4 > png.length) fail();
      let crc = 0xffffffff;
      for (const byte of png.subarray(offset + 4, end)) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
      }
      if (((crc ^ 0xffffffff) >>> 0) !== png.readUInt32BE(end)) fail();
      const type = png.toString("ascii", offset + 4, offset + 8);
      if (type === "IHDR") {
        if (header || offset !== 8 || length !== 13 || png.readUInt32BE(offset+8) !== width ||
            png.readUInt32BE(offset+12) !== height ||
            !png.subarray(offset+16, end).equals(Buffer.from([8,6,0,0,0]))) fail();
        header = true;
      }
      if (type === "IDAT") data.push(png.subarray(offset+8, end));
      offset = end + 4;
      if (type === "IEND") {
        if (length !== 0 || offset !== png.length) fail();
        ended = true;
      }
    }
    if (!header || !ended || !data.length) fail();
    const pixels = inflateSync(Buffer.concat(data));
    const stride = width * 4 + 1;
    if (pixels.length !== stride * height) fail();
    for (let row = 0; row < height; row++) if (pixels[row * stride] > 4) fail();
  }
  console.log("Engraving textures: CRCs, dimensions and complete pixel streams verified.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  checkEngravingAssets(path.resolve(process.argv[2] ?? "frontend/public/theme"));
}
