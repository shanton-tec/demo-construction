// Run with: npx vitest run   (keep next to Builder3D.jsx; needs vitest + three installed)
import { describe, it, expect } from "vitest";
import {
  mergeWalls, rectWalls, bboxOf, furnishRoom, overlapIds, snapToWalls, estimate, normalizeD,
  makeRoom, makePolyRoom, roomArea, inRect, isRectRoom, polyCentroid,
} from "./Builder3D.jsx";

const room = (id, x, z, w, d, type = "bedroom") => ({ id, name: id, type, x, z, w, d, floor: null, wallIds: [id + "t", id + "r", id + "b", id + "l"] });
const twoRooms = () => {
  const A = room("A", 0, 0, 4000, 3000), B = room("B", 4000, 0, 2000, 3000, "kitchen");
  return { rooms: [A, B], walls: [...rectWalls(A), ...rectWalls(B)], openings: [], items: [], ext: {} };
};

describe("walls", () => {
  it("merges touching and shared walls so each renders once", () => expect(mergeWalls(twoRooms())).toHaveLength(5));
  it("remaps an opening onto the merged wall", () => {
    const D = twoRooms();
    D.openings.push({ id: "o", wallId: "At", pos: 0.25, type: "door", width: 900, h: 2100, sill: 0 });
    expect(mergeWalls(D).find((s) => s.ops.length).ops[0].pos).toBeCloseTo(1000 / 6000, 9);
  });
  it("computes the building bounding box", () => {
    const b = bboxOf(twoRooms());
    expect([b.x0, b.x1, b.z0, b.z1]).toEqual([0, 6000, 0, 3000]);
  });
  it("never merges walls from different floors", () => {
    const A = makeRoom(0, 0, 4000, 3000, "bedroom", "A", 0), B = makeRoom(0, 0, 4000, 3000, "bedroom", "B", 1);
    const D = { rooms: [A.room, B.room], walls: [...A.walls, ...B.walls], openings: [], items: [], ext: {} };
    expect(mergeWalls(D)).toHaveLength(8);
  });
});

describe("polygon rooms", () => {
  const L = () => makePolyRoom([[0, 0], [6000, 0], [6000, 2000], [4000, 2000], [4000, 4000], [0, 4000]], "living", "L", 0);
  it("computes area and one wall per edge", () => {
    expect(roomArea(L().room)).toBeCloseTo(20, 9);
    expect(L().walls).toHaveLength(6);
  });
  it("tells rectangles from other shapes", () => {
    expect(isRectRoom(makeRoom(0, 0, 3000, 3000, "bedroom").room)).toBe(true);
    expect(isRectRoom(L().room)).toBe(false);
  });
  it("tests point containment, including the notch and other floors", () => {
    const r = L().room;
    expect(inRect({ x: 1000, z: 3000, lv: 0 }, r)).toBe(true);
    expect(inRect({ x: 5000, z: 3000, lv: 0 }, r)).toBe(false);
    expect(inRect({ x: 1000, z: 3000, lv: 1 }, r)).toBe(false);
  });
  it("finds the centroid of a rectangle", () => {
    const c = polyCentroid(makeRoom(0, 0, 4000, 2000, "hall").room.poly);
    expect(c.x).toBeCloseTo(2000, 6);
    expect(c.z).toBeCloseTo(1000, 6);
  });
  it("furnishes an L-shaped room only inside the shape, on its own floor", () => {
    const r = { ...L().room, type: "living", lv: 2 };
    const items = furnishRoom(r);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.lv === 2 && inRect(i, r))).toBe(true);
  });
  it("adds nothing to a stairwell void", () => expect(furnishRoom(makeRoom(0, 0, 2000, 3000, "void").room)).toHaveLength(0));
});

describe("furnishing presets", () => {
  const sizes = { bedroom: [4200, 3900], living: [6400, 3200], dining: [4200, 3600], kitchen: [2200, 2100], bathroom: [2200, 1800], study: [3000, 3000], balcony: [3000, 1600], hall: [2400, 2400] };
  Object.entries(sizes).forEach(([type, [w, d]]) => {
    it(`${type} preset has no overlapping furniture`, () => expect(overlapIds(furnishRoom(makeRoom(0, 0, w, d, type).room)).size).toBe(0));
  });
});

describe("snapping, overlap, estimate, persistence", () => {
  it("snaps an item flush to a nearby wall face", () => {
    const it = { rot: 0, x: 415, z: 1500, size: { L: 500, W: 500, H: 550 } };
    expect(snapToWalls(it, rectWalls(room("A", 0, 0, 4000, 3000))).x).toBe(325);
  });
  it("only counts overlaps on the same floor", () => {
    const a = { id: "a", type: "bed", x: 1000, z: 1000, rot: 0, elev: 0, lv: 0, size: { L: 1800, W: 2000, H: 1100 } };
    expect(overlapIds([a, { ...a, id: "b", lv: 1 }]).size).toBe(0);
    expect(overlapIds([a, { ...a, id: "b" }]).size).toBe(2);
  });
  it("produces a positive estimate", () => {
    const D = twoRooms();
    D.items = furnishRoom(D.rooms[0]);
    expect(estimate(D).total).toBeGreaterThan(0);
  });
  it("migrates an old single-floor rectangle save", () => {
    const d = normalizeD({ rooms: [room("r", 0, 0, 4000, 3000)], walls: [], items: [{ type: "nope" }] });
    expect(d.rooms[0].poly).toHaveLength(4);
    expect(d.rooms[0].lv).toBe(0);
    expect(d.levels).toBe(1);
    expect(d.items).toHaveLength(0);
    expect(d.ext.roof).toBe("gable");
  });
});
