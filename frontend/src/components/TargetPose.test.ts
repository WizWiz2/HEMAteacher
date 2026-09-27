import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TargetPose } from "./TargetPose";
import type { Checkpoint } from "../drill/types";

const checkpoint: Checkpoint = {
  id: "vom-tag", title: "Vom Tag", targetPoseId: "vom-tag", holdMs: 500,
};

describe("stand guidance", () => {
  it("marks the hands and shows a forward direction when the coach asks to extend them", () => {
    const cue = { name: "hand_center_x", text: "РУКИ ДАЛЬШЕ ВПЕРЁД", ok: false, gap: 0.7 };
    const right = renderToStaticMarkup(createElement(TargetPose, { checkpoint, facing: "right", cue }));
    const left = renderToStaticMarkup(createElement(TargetPose, { checkpoint, facing: "left", cue }));

    expect(right).toContain("target-direction");
    expect(right).toContain("РУКИ ДАЛЬШЕ ВПЕРЁД");
    expect(right).toMatch(/class="target-focus"[^>]*>[\s\S]*?<circle[^>]*cx="/);
    expect(right).not.toBe(left);
    expect(left).toContain("target-direction");
  });

  it("keeps the first pose visible and calls out the stance during calibration", () => {
    const html = renderToStaticMarkup(createElement(TargetPose, { checkpoint, facing: "right", calibrating: true }));
    expect(html).toContain("Повтори позу");
    expect(html).toContain("Встань боком как на рисунке и задержись");
    expect(html).toContain("target-focus");
  });
});
