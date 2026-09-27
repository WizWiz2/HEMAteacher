import { describe, expect, it } from "vitest";
import { detectWeaponMarkerPixels } from "./weaponMarkers";

function image(width:number,height:number){
  return new Uint8ClampedArray(width*height*4);
}
function paint(data:Uint8ClampedArray,width:number,x0:number,y0:number,x1:number,y1:number,r:number,g:number,b:number){
  for(let y=y0;y<y1;y++) for(let x=x0;x<x1;x++){
    const i=(y*width+x)*4;
    data[i]=r; data[i+1]=g; data[i+2]=b; data[i+3]=255;
  }
}

describe("weapon marker detector", () => {
  it("finds cyan grip and magenta tip and reports a line", () => {
    const width=80,height=40,data=image(width,height);
    paint(data,width,10,18,22,30,0,230,240);
    paint(data,width,55,6,68,18,255,30,190);
    const result=detectWeaponMarkerPixels(data,width,height,{minPixels:3});
    expect(result.detected).toBe(true);
    expect(result.grip?.x).toBeLessThan(result.tip?.x ?? 0);
    expect(result.angleDeg).toBeTypeOf("number");
  });

  it("does not pretend to see a weapon without both markers", () => {
    const width=80,height=40,data=image(width,height);
    paint(data,width,10,18,22,30,0,230,240);
    expect(detectWeaponMarkerPixels(data,width,height,{minPixels:3}).detected).toBe(false);
  });
});
