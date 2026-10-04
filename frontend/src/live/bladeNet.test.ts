import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { BladeNet, type BladeNetWeights } from "./bladeNet";
import weights from "./bladeNetWeights.json";

// Parity with the PyTorch training model (exported by the training pipeline with BatchNorm folded): two training crops
// and the torch outputs [cos, sin, presence logit].
const P = JSON.parse(readFileSync(new URL("../../test-fixtures/blade-net-parity.json", import.meta.url), "utf8"));

describe("blade net", () => {
  it("matches the torch reference outputs", () => {
    const net = new BladeNet(weights as BladeNetWeights);
    for (const [c, o] of [[P.crop, P.out], [P.crop2, P.out2]] as [string, number[]][]) {
      const crop = Float32Array.from(Buffer.from(c, "base64"));
      const y = net.forward(crop);
      for (let k = 0; k < 3; k++) expect(Math.abs(y[k] - o[k])).toBeLessThan(2e-3);
    }
  });
});
