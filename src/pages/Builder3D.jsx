"use client";
/**
 * Builder3D.jsx — Coohom-style house builder in one file (React + three.js, no CSS framework).
 *
 *   npm i three
 *   import Builder3D from "./Builder3D";   <Builder3D />     (fills 100vh; style={{height:700}} to override)
 *
 * Three workspaces (switch in the top bar):
 *   Floor plan  – draw rooms (rectangles), walls, doors and windows on a snapping 2D plan, move/resize everything,
 *                 drop furniture, see room names, areas and dimensions.
 *   Interior    – 3D walk-around of every room with the furniture gizmo, material editor, replace model, etc.
 *   Exterior    – the same plan extruded into a house: storeys, roof style, colours, fence, lawn, trees, driveway.
 * Every room type (bedroom, living, dining, kitchen, bathroom, study, balcony, hall) has a "Furnish room" preset.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/* ================================================================== */
/* Constants                                                           */
/* ================================================================== */
const MM = 0.001;
const WALL_H = 2800;
const STORE_KEY = "builder3d.design.v2";
const uid = (p = "i") => p + Math.random().toString(36).slice(2, 9);
const norm = (d) => ((d % 360) + 360) % 360;
const sn = (v, g = 100) => Math.round(v / g) * g;
const SWATCHES = ["#e7e7e5", "#d9cfc0", "#a8978a", "#8b5e48", "#6a4636", "#7d7f84", "#3b3f46", "#2f4f6f", "#5f7f62", "#b4553f"];
const EXT_WALL = ["#e8e2d6", "#f4f4f2", "#d9c7a8", "#b9c4b0", "#a7b5c4", "#c98f77", "#8e8a85", "#3f4650"];
const EXT_ROOF = ["#8a4b3c", "#4a4f57", "#6b5a4a", "#9aa0a6", "#2f4f3a", "#b4553f"];

const ROOM_TYPES = {
  bedroom: { label: "Bedroom", fill: "#e6edfb", floor: "wood" },
  living: { label: "Living room", fill: "#e6f4e6", floor: "wood" },
  dining: { label: "Dining room", fill: "#fcefd8", floor: "wood" },
  kitchen: { label: "Kitchen", fill: "#fce6de", floor: "tile" },
  bathroom: { label: "Bathroom", fill: "#dff1f6", floor: "tile" },
  study: { label: "Study", fill: "#eee7f7", floor: "wood" },
  balcony: { label: "Balcony", fill: "#edf1de", floor: "concrete" },
  hall: { label: "Hall", fill: "#f0f0f0", floor: "marble" },
  void: { label: "Stairwell / void", fill: "#ffffff", floor: "none" },
};
const FLOOR_SIZE = { wood: 1200, tile: 1200, marble: 2000, concrete: 2000 };
// Placeholder rates for the cost estimate. Change the currency and prices to match your market.
const CURRENCY = "$";
const PRICES = { wardrobe: 650, bed: 700, sofa: 800, tvunit: 280, rug: 150, coffee: 140, sidetable: 70, dining: 450, chair: 60, kitchen: 2400, wallcab: 900, fridge: 850, bath: 550, wc: 220, vanity: 380, desk: 260, shelf: 180, plant: 40, lamp: 90, stairs: 1800 };
const FLOOR_PRICE = { wood: 55, tile: 40, marble: 120, concrete: 30 }; // per m2
const PAINT_PRICE = 6, DOOR_PRICE = 250, WINDOW_PRICE = 220, ROOF_PRICE = 70, STOREY_PRICE = 650; // per m2 except doors
const download = (href, name) => { const a = document.createElement("a"); a.href = href; a.download = name; a.click(); };
const CATEGORIES = [["popular", "Popular"], ["bedroom", "Bedroom"], ["living", "Living room"], ["dining", "Dining room"], ["kitchen", "Kitchen"], ["bathroom", "Bathroom"], ["study", "Study"], ["decor", "Decor"], ["fav", "Favourites"]];

/* ================================================================== */
/* Furniture catalog (procedural models)                               */
/* ================================================================== */
const V = (label, main, second, n) => ({ label, main, second, n });
const CATALOG = [
  { type: "wardrobe", name: "Wardrobe", rooms: ["bedroom"], size: [2038, 600, 2470], variants: [V("Graphite", "#b4b6ba", "#7d7f84", 4), V("Oak cream", "#efe9de", "#d9cfc0", 2), V("Walnut", "#8b5e48", "#6a4636", 3), V("Matte white", "#f7f7f6", "#e1e1df", 2)] },
  { type: "bed", name: "Double bed", rooms: ["bedroom"], size: [1800, 2000, 1100], variants: [V("Taupe", "#a8978a", "#d8cfc5"), V("Sage", "#9fb59f", "#e8e4da"), V("Navy", "#3f5675", "#d9dde3"), V("Linen", "#e4dccf", "#b9a58e")] },
  { type: "sofa", name: "Sofa", rooms: ["living"], size: [2000, 900, 800], variants: [V("Stone", "#b7aca0", "#cfc6bb"), V("Moss", "#6f8266", "#8da283"), V("Ink", "#3b3f46", "#555a63"), V("Blush", "#c79a94", "#dcb7b1")] },
  { type: "tvunit", name: "TV unit", rooms: ["living", "bedroom"], size: [1800, 400, 1300], variants: [V("Oak", "#c9a56b"), V("White", "#f1f1ef"), V("Walnut", "#6a4636")] },
  { type: "rug", name: "Area rug", rooms: ["bedroom", "living"], size: [2000, 1400, 20], variants: [V("Sand", "#cdbfae"), V("Grey", "#9a9a9a"), V("Rust", "#b4553f"), V("Ivory", "#efe9de")] },
  { type: "coffee", name: "Coffee table", rooms: ["living"], size: [1000, 600, 400], variants: [V("Oak", "#c9a56b", "#2b2d31"), V("Walnut", "#6a4636", "#2b2d31"), V("White", "#f1f1ef", "#b4b6ba")] },
  { type: "sidetable", name: "Side table", rooms: ["bedroom", "living"], size: [500, 500, 550], variants: [V("Oak", "#c9a56b"), V("White", "#f1f1ef"), V("Walnut", "#6a4636")] },
  { type: "dining", name: "Dining table", rooms: ["dining"], size: [1600, 900, 750], variants: [V("Oak", "#c9a56b", "#8b6b3f"), V("Walnut", "#6a4636", "#2b2d31"), V("White", "#f1f1ef", "#b4b6ba")] },
  { type: "chair", name: "Chair", rooms: ["dining", "study"], size: [500, 520, 900], variants: [V("Oak", "#c9a56b"), V("Black", "#2b2d31"), V("Olive", "#7d8a52")] },
  { type: "kitchen", name: "Kitchen run", rooms: ["kitchen"], size: [2400, 600, 900], variants: [V("Sage", "#8fa690", "#e9e7e1"), V("Navy", "#3f5675", "#e9e7e1"), V("White", "#f1f1ef", "#3b3f46"), V("Oak", "#c9a56b", "#d8d6d0")] },
  { type: "wallcab", name: "Wall cabinets", rooms: ["kitchen"], size: [2400, 350, 700], elev: 1400, variants: [V("Sage", "#8fa690"), V("Navy", "#3f5675"), V("White", "#f1f1ef"), V("Oak", "#c9a56b")] },
  { type: "fridge", name: "Fridge", rooms: ["kitchen"], size: [700, 700, 1800], variants: [V("Steel", "#c3c7cc"), V("White", "#f4f4f4"), V("Black", "#2b2d31")] },
  { type: "bath", name: "Bathtub", rooms: ["bathroom"], size: [1700, 750, 550], variants: [V("White", "#f6f7f8")] },
  { type: "wc", name: "Toilet", rooms: ["bathroom"], size: [400, 650, 800], variants: [V("White", "#f6f7f8")] },
  { type: "vanity", name: "Vanity & basin", rooms: ["bathroom"], size: [800, 500, 900], variants: [V("Oak", "#f2f2f0", "#c9a56b"), V("Walnut", "#f2f2f0", "#6a4636"), V("Grey", "#f2f2f0", "#7d7f84")] },
  { type: "desk", name: "Desk", rooms: ["study", "bedroom"], size: [1400, 700, 750], variants: [V("Oak", "#c9a56b", "#e7e1d6"), V("White", "#f1f1ef", "#d6d6d4"), V("Walnut", "#6a4636", "#4a3228")] },
  { type: "shelf", name: "Bookshelf", rooms: ["study", "living"], size: [800, 300, 1900], variants: [V("Oak", "#c9a56b", "#8b6b3f"), V("White", "#f1f1ef", "#d6d6d4"), V("Black", "#3b3f46", "#2b2d31")] },
  { type: "stairs", name: "Straight stairs", rooms: ["living", "decor"], size: [1000, 3000, 2800], variants: [V("Oak", "#c9a56b", "#3b3f46"), V("White", "#f1f1ef", "#b4b6ba"), V("Walnut", "#6a4636", "#2b2d31")] },
  { type: "plant", name: "Potted plant", rooms: ["decor"], size: [400, 400, 1200], variants: [V("Fern", "#5f8f5f", "#c9c2b8"), V("Olive", "#7d8a52", "#8b5e48"), V("Deep green", "#3d6b4f", "#2f3338")] },
  { type: "lamp", name: "Floor lamp", rooms: ["decor", "living"], size: [350, 350, 1600], variants: [V("Warm", "#f6e7c8"), V("White", "#f6f6f6"), V("Rattan", "#c9a56b")] },
];
const CAT = Object.fromEntries(CATALOG.map((c) => [c.type, c]));

const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 28);
const SPH = new THREE.SphereGeometry(0.5, 22, 16);
const DARK = "#2b2d31";

function P(g, kind, pos, size, color, role, o = {}) {
  const geo = kind === "box" ? BOX : kind === "cyl" ? CYL : SPH;
  const m = new THREE.MeshStandardMaterial({ color, roughness: o.r ?? 0.7, metalness: o.m ?? 0 });
  if (o.e) { m.emissive = new THREE.Color(o.e); m.emissiveIntensity = 0.7; }
  m.userData.role = role || null;
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set(pos[0], pos[1], pos[2]);
  mesh.scale.set(size[0], size[1], size[2]);
  mesh.castShadow = mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}

const BUILD = {
  wardrobe(g, v) {
    const n = v.n;
    P(g, "box", [0, 0.5, 0], [1, 1, 1], v.second, "second");
    for (let i = 0; i < n; i++) {
      const x = -0.5 + (i + 0.5) / n;
      P(g, "box", [x, 0.5, 0.503], [1 / n - 0.008, 0.97, 0.01], v.main, "main", { r: 0.55 });
      const hx = x + (i % 2 === 0 ? 1 : -1) * (0.5 / n - 0.03);
      P(g, "box", [hx, 0.5, 0.512], [0.006, 0.14, 0.012], DARK, null, { m: 0.6, r: 0.3 });
    }
  },
  bed(g, v) {
    P(g, "box", [0, 0.15, 0], [1, 0.3, 1], "#5d4d40");
    P(g, "box", [0, 0.4, 0.02], [0.96, 0.2, 0.94], "#f1eee9", null, { r: 0.9 });
    P(g, "box", [0, 0.55, -0.49], [1.04, 0.9, 0.05], v.main, "main", { r: 0.9 });
    P(g, "box", [-0.24, 0.54, -0.36], [0.4, 0.08, 0.16], "#fbfaf8", null, { r: 0.95 });
    P(g, "box", [0.24, 0.54, -0.36], [0.4, 0.08, 0.16], "#fbfaf8", null, { r: 0.95 });
    P(g, "box", [0, 0.5, 0.17], [0.98, 0.06, 0.62], v.second, "second", { r: 0.95 });
  },
  sofa(g, v) {
    P(g, "box", [0, 0.28, 0], [1, 0.3, 1], v.main, "main", { r: 0.9 });
    P(g, "box", [0, 0.68, -0.4], [1, 0.56, 0.2], v.main, "main", { r: 0.9 });
    P(g, "box", [-0.455, 0.45, 0], [0.09, 0.6, 1], v.main, "main", { r: 0.9 });
    P(g, "box", [0.455, 0.45, 0], [0.09, 0.6, 1], v.main, "main", { r: 0.9 });
    [-0.23, 0.23].forEach((x) => {
      P(g, "box", [x, 0.5, 0.08], [0.43, 0.14, 0.76], v.second, "second", { r: 0.95 });
      P(g, "box", [x, 0.7, -0.22], [0.43, 0.34, 0.14], v.second, "second", { r: 0.95 });
    });
    [[-0.45, -0.42], [0.45, -0.42], [-0.45, 0.42], [0.45, 0.42]].forEach(([x, z]) => P(g, "cyl", [x, 0.06, z], [0.04, 0.12, 0.04], DARK));
  },
  tvunit(g, v) {
    P(g, "box", [0, 0.18, 0], [1, 0.36, 1], v.main, "main");
    P(g, "box", [0, 0.7, -0.3], [0.72, 0.42, 0.03], "#101114", null, { r: 0.2, m: 0.3 });
    P(g, "box", [0, 0.46, -0.3], [0.08, 0.1, 0.05], DARK);
  },
  rug(g, v) { P(g, "box", [0, 0.5, 0], [1, 1, 1], v.main, "main", { r: 1 }); },
  coffee(g, v) {
    P(g, "box", [0, 0.92, 0], [1, 0.16, 1], v.main, "main");
    [[-0.44, -0.4], [0.44, -0.4], [-0.44, 0.4], [0.44, 0.4]].forEach(([x, z]) => P(g, "box", [x, 0.42, z], [0.05, 0.84, 0.07], v.second, "second", { m: 0.4 }));
  },
  sidetable(g, v) {
    P(g, "cyl", [0, 0.94, 0], [1, 0.12, 1], v.main, "main");
    P(g, "cyl", [0, 0.45, 0], [0.1, 0.9, 0.1], DARK, null, { m: 0.5 });
    P(g, "cyl", [0, 0.02, 0], [0.6, 0.04, 0.6], DARK, null, { m: 0.5 });
  },
  dining(g, v) {
    P(g, "box", [0, 0.95, 0], [1, 0.1, 1], v.main, "main");
    [[-0.45, -0.42], [0.45, -0.42], [-0.45, 0.42], [0.45, 0.42]].forEach(([x, z]) => P(g, "box", [x, 0.45, z], [0.05, 0.9, 0.07], v.second, "second"));
  },
  chair(g, v) {
    [[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42]].forEach(([x, z]) => P(g, "box", [x, 0.23, z], [0.07, 0.46, 0.07], DARK));
    P(g, "box", [0, 0.5, 0], [1, 0.08, 1], v.main, "main");
    P(g, "box", [0, 0.76, -0.46], [1, 0.5, 0.08], v.main, "main");
  },
  kitchen(g, v) {
    P(g, "box", [0, 0.05, -0.02], [0.98, 0.1, 0.9], DARK);
    P(g, "box", [0, 0.5, 0], [1, 0.8, 1], v.main, "main", { r: 0.55 });
    for (let i = 1; i < 6; i++) P(g, "box", [-0.5 + i / 6, 0.5, 0.501], [0.002, 0.78, 0.004], DARK);
    P(g, "box", [0, 0.95, 0.02], [1.005, 0.1, 1.04], v.second, "second", { r: 0.35 });
    P(g, "box", [-0.2, 1.003, 0], [0.22, 0.008, 0.55], "#17181b", null, { r: 0.2 });
    P(g, "box", [0.22, 1.003, 0], [0.16, 0.008, 0.6], "#a9aeb4", null, { r: 0.3, m: 0.7 });
  },
  wallcab(g, v) {
    P(g, "box", [0, 0.5, 0], [1, 1, 1], v.main, "main", { r: 0.55 });
    for (let i = 1; i < 6; i++) P(g, "box", [-0.5 + i / 6, 0.5, 0.501], [0.002, 0.96, 0.004], DARK);
  },
  fridge(g, v) {
    P(g, "box", [0, 0.5, 0], [1, 1, 1], v.main, "main", { m: 0.5, r: 0.35 });
    P(g, "box", [0, 0.64, 0.502], [0.98, 0.004, 0.004], DARK);
    P(g, "box", [0.4, 0.8, 0.51], [0.03, 0.14, 0.03], DARK, null, { m: 0.6 });
    P(g, "box", [0.4, 0.5, 0.51], [0.03, 0.1, 0.03], DARK, null, { m: 0.6 });
  },
  bath(g, v) {
    P(g, "box", [0, 0.5, 0], [1, 1, 1], v.main, "main", { r: 0.25 });
    P(g, "box", [0, 0.98, 0], [0.92, 0.1, 0.84], "#dbe3ea", null, { r: 0.2 });
    P(g, "cyl", [-0.44, 1.12, 0], [0.03, 0.2, 0.03], "#b9bfc6", null, { m: 0.8 });
  },
  wc(g, v) {
    P(g, "box", [0, 0.68, -0.38], [0.95, 0.64, 0.24], v.main, "main", { r: 0.25 });
    P(g, "sph", [0, 0.28, 0.1], [0.95, 0.55, 0.8], v.main, "main", { r: 0.25 });
    P(g, "cyl", [0, 0.55, 0.1], [0.8, 0.04, 0.68], "#e9edf0", null, { r: 0.3 });
  },
  vanity(g, v) {
    P(g, "box", [0, 0.4, 0], [1, 0.78, 1], v.second, "second");
    P(g, "box", [0, 0.82, 0], [1.02, 0.06, 1.02], v.main, "main", { r: 0.3 });
    P(g, "cyl", [0, 0.86, 0.05], [0.5, 0.03, 0.5], "#ffffff", null, { r: 0.2 });
    P(g, "cyl", [0, 0.94, -0.36], [0.03, 0.12, 0.03], "#b9bfc6", null, { m: 0.8 });
  },
  desk(g, v) {
    P(g, "box", [0, 0.96, 0], [1, 0.06, 1], v.main, "main");
    P(g, "box", [-0.48, 0.45, 0], [0.04, 0.9, 0.9], v.second, "second");
    P(g, "box", [0.48, 0.45, 0], [0.04, 0.9, 0.9], v.second, "second");
    P(g, "box", [0, 0.68, -0.45], [0.92, 0.4, 0.02], v.second, "second");
  },
  shelf(g, v) {
    P(g, "box", [0, 0.5, -0.49], [0.98, 1, 0.02], v.second, "second");
    [-0.49, 0.49].forEach((x) => P(g, "box", [x, 0.5, 0], [0.02, 1, 1], v.main, "main"));
    [0.01, 0.25, 0.5, 0.75, 0.99].forEach((y) => P(g, "box", [0, y, 0], [0.96, 0.02, 0.98], v.main, "main"));
    const cols = ["#b4553f", "#2f4f6f", "#5f7f62", "#d9cfc0", "#8b5e48"];
    [0.13, 0.38, 0.63].forEach((y, r) => { for (let i = 0; i < 5; i++) P(g, "box", [-0.34 + i * 0.12 + r * 0.02, y + 0.03, 0], [0.08, 0.2, 0.7], cols[(i + r) % 5]); });
  },
  stairs(g, v) {
    const n = 16;
    for (let i = 0; i < n; i++) P(g, "box", [0, (i + 1) / n / 2, -0.5 + (i + 0.5) / n], [1, (i + 1) / n, 1 / n], v.main, "main");
    [-0.5, 0.5].forEach((x) => P(g, "box", [x, 0.5, 0], [0.03, 1, 1], v.second, "second"));
  },
  plant(g, v) {
    P(g, "cyl", [0, 0.11, 0], [0.8, 0.22, 0.8], v.second, "second", { r: 0.8 });
    P(g, "sph", [0, 0.45, 0], [0.9, 0.5, 0.9], v.main, "main", { r: 0.9 });
    P(g, "sph", [0.05, 0.72, 0], [0.64, 0.42, 0.64], v.main, "main", { r: 0.9 });
    P(g, "sph", [-0.05, 0.92, 0.05], [0.4, 0.3, 0.4], v.main, "main", { r: 0.9 });
  },
  lamp(g, v) {
    P(g, "cyl", [0, 0.01, 0], [0.5, 0.02, 0.5], DARK, null, { m: 0.5 });
    P(g, "cyl", [0, 0.45, 0], [0.04, 0.9, 0.04], DARK, null, { m: 0.5 });
    P(g, "cyl", [0, 0.86, 0], [1, 0.26, 1], v.main, "main", { e: "#ffd9a0", r: 0.9 });
  },
};
function buildModel(type, variant) {
  const g = new THREE.Group();
  const c = CAT[type];
  BUILD[type](g, c.variants[variant] || c.variants[0]);
  return g;
}
function paint(g, v, override) {
  g.traverse((o) => {
    const role = o.material && o.material.userData && o.material.userData.role;
    if (role === "main") o.material.color.set(override || v.main);
    else if (role === "second") o.material.color.set(v.second);
  });
}

/* ================================================================== */
/* Floor textures                                                      */
/* ================================================================== */
function canvasTex(draw, size = 512) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  draw(c.getContext("2d"), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function makeFloorTextures() {
  return {
    wood: canvasTex((x) => {
      const tones = ["#c9a47c", "#c19b72", "#cdaa84", "#b98f66", "#c6a07a"];
      for (let i = 0; i < 8; i++) for (let j = -1; j < 5; j++) { x.fillStyle = tones[(i * 3 + ((j + 5) % 5) * 2) % 5]; x.fillRect(j * 128 + (i % 2) * 64, i * 64, 128, 64); }
      x.strokeStyle = "rgba(90,60,35,.35)";
      for (let i = 0; i <= 8; i++) { x.beginPath(); x.moveTo(0, i * 64); x.lineTo(512, i * 64); x.stroke(); }
      for (let i = 0; i < 8; i++) for (let j = -1; j < 5; j++) { const px = j * 128 + (i % 2) * 64; x.beginPath(); x.moveTo(px, i * 64); x.lineTo(px, i * 64 + 64); x.stroke(); }
    }),
    tile: canvasTex((x, s) => {
      x.fillStyle = "#e8ebee"; x.fillRect(0, 0, s, s);
      x.strokeStyle = "#b9bfc6"; x.lineWidth = 3;
      for (let i = 0; i <= 2; i++) { x.beginPath(); x.moveTo(i * s / 2, 0); x.lineTo(i * s / 2, s); x.stroke(); x.beginPath(); x.moveTo(0, i * s / 2); x.lineTo(s, i * s / 2); x.stroke(); }
    }),
    marble: canvasTex((x, s) => {
      x.fillStyle = "#f2f1ee"; x.fillRect(0, 0, s, s);
      x.strokeStyle = "rgba(120,120,125,.35)"; x.lineWidth = 1.5;
      for (let i = 0; i < 14; i++) { x.beginPath(); let px = Math.random() * s, py = 0; x.moveTo(px, py); while (py < s) { px += (Math.random() - 0.5) * 40; py += 30 + Math.random() * 30; x.lineTo(px, py); } x.stroke(); }
    }),
    concrete: canvasTex((x, s) => {
      x.fillStyle = "#b9bcc0"; x.fillRect(0, 0, s, s);
      for (let i = 0; i < 2500; i++) { x.fillStyle = `rgba(${90 + Math.random() * 80},${90 + Math.random() * 80},${95 + Math.random() * 80},.18)`; x.fillRect(Math.random() * s, Math.random() * s, 3, 3); }
    }),
  };
}

/* ================================================================== */
/* Plan data helpers                                                   */
/* ================================================================== */
const polyBox = (poly) => { const xs = poly.map((q) => q[0]), zs = poly.map((q) => q[1]); const x = Math.min(...xs), z = Math.min(...zs); return { x, z, w: Math.max(...xs) - x, d: Math.max(...zs) - z }; };
const withBox = (r) => ({ ...r, ...polyBox(r.poly) });
const rectPoly = (r) => r.poly || [[r.x, r.z], [r.x + r.w, r.z], [r.x + r.w, r.z + r.d], [r.x, r.z + r.d]];
export const roomArea = (r) => { const P = rectPoly(r); let a = 0; P.forEach((q, i) => { const n = P[(i + 1) % P.length]; a += q[0] * n[1] - n[0] * q[1]; }); return Math.abs(a) / 2 / 1e6; };
export const polyCentroid = (P) => {
  let a = 0, cx = 0, cz = 0;
  P.forEach((q, i) => { const n = P[(i + 1) % P.length], f = q[0] * n[1] - n[0] * q[1]; a += f; cx += (q[0] + n[0]) * f; cz += (q[1] + n[1]) * f; });
  if (Math.abs(a) < 1) { const b = polyBox(P); return { x: b.x + b.w / 2, z: b.z + b.d / 2 }; }
  return { x: cx / (3 * a), z: cz / (3 * a) };
};
export const isRectRoom = (r) => { const P = rectPoly(r); return P.length === 4 && P.every((q, i) => { const n = P[(i + 1) % 4]; return Math.abs(q[0] - n[0]) < 2 || Math.abs(q[1] - n[1]) < 2; }); };
const inPoly = (pt, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, zi] = P[i], [xj, zj] = P[j]; if (zi > pt[1] !== zj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - zi)) / (zj - zi) + xi) c = !c; } return c; };
export const inRect = (it, r) => (it.lv || 0) === (r.lv || 0) && inPoly([it.x, it.z], rectPoly(r));
export const roomWalls = (r) => { const P = rectPoly(r); return P.map((q, k) => ({ id: r.wallIds[k], a: q, b: P[(k + 1) % P.length], t: 150, lv: r.lv || 0 })); };
export const rectWalls = roomWalls;
export const makePolyRoom = (poly, type, name, lv = 0) => {
  const room = withBox({ id: uid("r"), name: name || ROOM_TYPES[type].label, type, lv, poly, floor: null, wallIds: poly.map(() => uid("w")) });
  return { room, walls: roomWalls(room) };
};
export const makeRoom = (x, z, w, d, type, name, lv = 0) => makePolyRoom([[x, z], [x + w, z], [x + w, z + d], [x, z + d]], type, name, lv);
const mk = (type, x, z, rot = 0, extra = {}) => {
  const c = CAT[type];
  return { id: uid("f"), type, name: c.name, variant: 0, size: { L: c.size[0], W: c.size[1], H: c.size[2] }, base: c.size, x, z, elev: c.elev || 0, rot, color: null, mirror: false, locked: false, hidden: false, fav: false, prop: false, lv: 0, ...extra };
};
const axisOf = (w) => (Math.abs(w.a[1] - w.b[1]) < 2 ? "h" : Math.abs(w.a[0] - w.b[0]) < 2 ? "v" : null);
const wallLen = (w) => Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
const opAt = (w, abs, spec) => {
  const ax = axisOf(w) === "h" ? 0 : 1;
  const pos = (abs - w.a[ax]) / (w.b[ax] - w.a[ax]);
  const door = spec.type === "door";
  return { id: uid("o"), wallId: w.id, lv: w.lv || 0, pos, type: spec.type, width: spec.width || (door ? 900 : 1500), h: spec.h || (door ? 2100 : 1200), sill: door ? 0 : spec.sill ?? 900, color: spec.color || "#a9835b" };
};

export function bboxOf(D) {
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  D.walls.forEach((w) => [w.a, w.b].forEach(([x, z]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }));
  D.rooms.forEach((r) => { x0 = Math.min(x0, r.x); x1 = Math.max(x1, r.x + r.w); z0 = Math.min(z0, r.z); z1 = Math.max(z1, r.z + r.d); });
  if (x0 > x1) return { x0: -2500, x1: 2500, z0: -2500, z1: 2500, empty: true };
  return { x0, x1, z0, z1, empty: false };
}

/* Merge collinear / overlapping axis-aligned walls so shared walls render once; map openings onto the merged runs. */
export function mergeWalls(D) {
  const segs = [];
  const lines = new Map();
  D.walls.forEach((w) => {
    const ax = axisOf(w);
    if (!ax) { segs.push({ a: w.a, b: w.b, t: w.t, ops: [], ids: [w.id], axis: false, lv: w.lv || 0 }); return; }
    const h = ax === "h";
    const coord = h ? (w.a[1] + w.b[1]) / 2 : (w.a[0] + w.b[0]) / 2;
    const s = h ? Math.min(w.a[0], w.b[0]) : Math.min(w.a[1], w.b[1]);
    const e = h ? Math.max(w.a[0], w.b[0]) : Math.max(w.a[1], w.b[1]);
    const k = (w.lv || 0) + (h ? "h" : "v") + Math.round(coord / 10);
    if (!lines.has(k)) lines.set(k, { h, coord, list: [], merged: [], lv: w.lv || 0 });
    lines.get(k).list.push({ s, e, t: w.t });
  });
  lines.forEach((L) => {
    L.list.sort((p, q) => p.s - q.s);
    let cur = null;
    L.list.forEach((it) => {
      if (cur && it.s <= cur.e + 2) { cur.e = Math.max(cur.e, it.e); cur.t = Math.max(cur.t, it.t); }
      else { cur = { s: it.s, e: it.e, t: it.t }; L.merged.push(cur); }
    });
    L.merged.forEach((m) => segs.push({ a: L.h ? [m.s, L.coord] : [L.coord, m.s], b: L.h ? [m.e, L.coord] : [L.coord, m.e], t: m.t, ops: [], axis: true, h: L.h, lv: L.lv }));
  });
  const byId = Object.fromEntries(D.walls.map((w) => [w.id, w]));
  D.openings.forEach((o) => {
    const w = byId[o.wallId];
    if (!w) return;
    const cx = w.a[0] + (w.b[0] - w.a[0]) * o.pos, cz = w.a[1] + (w.b[1] - w.a[1]) * o.pos;
    const ax = axisOf(w);
    if (!ax) { const sg = segs.find((q) => q.ids && q.ids[0] === w.id); if (sg) sg.ops.push(o); return; }
    const h = ax === "h", coord = h ? cz : cx, along = h ? cx : cz;
    const sg = segs.find((q) => q.axis && (q.lv || 0) === (w.lv || 0) && q.h === h && Math.abs((h ? q.a[1] : q.a[0]) - coord) < 10 && along >= (h ? q.a[0] : q.a[1]) - 1 && along <= (h ? q.b[0] : q.b[1]) + 1);
    if (!sg) return;
    const s0 = h ? sg.a[0] : sg.a[1], e0 = h ? sg.b[0] : sg.b[1];
    sg.ops.push({ ...o, pos: (along - s0) / (e0 - s0) });
  });
  return segs;
}

/* Snap an axis-aligned item flush to the nearest wall face (within 160 mm). */
export function snapToWalls(it, walls) {
  const r = Math.round(it.rot);
  if (r % 90 !== 0) return { x: it.x, z: it.z };
  const q = Math.abs(r / 90) % 2 === 1;
  const hx = (q ? it.size.W : it.size.L) / 2, hz = (q ? it.size.L : it.size.W) / 2;
  let x = it.x, z = it.z, bx = 160, bz = 160;
  walls.forEach((w) => {
    const ax = axisOf(w);
    if (!ax || (w.lv || 0) !== (it.lv || 0)) return;
    const t = w.t / 2;
    if (ax === "v") {
      const wx = (w.a[0] + w.b[0]) / 2, lo = Math.min(w.a[1], w.b[1]), hi = Math.max(w.a[1], w.b[1]);
      if (it.z + hz < lo - 100 || it.z - hz > hi + 100) return;
      const d1 = Math.abs(it.x - hx - (wx + t)), d2 = Math.abs(wx - t - (it.x + hx));
      if (d1 < bx) { bx = d1; x = wx + t + hx; }
      if (d2 < bx) { bx = d2; x = wx - t - hx; }
    } else {
      const wz = (w.a[1] + w.b[1]) / 2, lo = Math.min(w.a[0], w.b[0]), hi = Math.max(w.a[0], w.b[0]);
      if (it.x + hx < lo - 100 || it.x - hx > hi + 100) return;
      const d1 = Math.abs(it.z - hz - (wz + t)), d2 = Math.abs(wz - t - (it.z + hz));
      if (d1 < bz) { bz = d1; z = wz + t + hz; }
      if (d2 < bz) { bz = d2; z = wz - t - hz; }
    }
  });
  return { x, z };
}

/* Ids of furniture whose boxes overlap (rugs are ignored; heights are respected). */
export function overlapIds(items) {
  const boxes = items.filter((i) => !i.hidden && i.type !== "rug").map((i) => {
    const a = (i.rot * Math.PI) / 180, c = Math.abs(Math.cos(a)), s2 = Math.abs(Math.sin(a));
    const ex = (c * i.size.L + s2 * i.size.W) / 2, ez = (s2 * i.size.L + c * i.size.W) / 2;
    return { id: i.id, lv: i.lv || 0, x0: i.x - ex, x1: i.x + ex, z0: i.z - ez, z1: i.z + ez, y0: i.elev, y1: i.elev + i.size.H };
  });
  const out = new Set(), e = 12;
  for (let p = 0; p < boxes.length; p++) for (let q = p + 1; q < boxes.length; q++) {
    const A = boxes[p], B = boxes[q];
    if (A.lv === B.lv && A.x0 + e < B.x1 && B.x0 + e < A.x1 && A.z0 + e < B.z1 && B.z0 + e < A.z1 && A.y0 + e < B.y1 && B.y0 + e < A.y1) { out.add(A.id); out.add(B.id); }
  }
  return out;
}

/* Quantity and cost estimate from the current design. */
export function estimate(D) {
  const lines = [];
  const add = (label, qty, unit, price) => { if (qty > 0) lines.push({ label, qty: Math.round(qty * 100) / 100, unit, price, total: Math.round(qty * price) }); };
  const byType = {};
  D.items.forEach((i) => { (byType[i.type] = byType[i.type] || []).push(i); });
  Object.entries(byType).forEach(([t, arr]) => {
    const run = t === "kitchen" || t === "wallcab";
    add(CAT[t] ? CAT[t].name : t, arr.reduce((a, i) => a + (run ? i.size.L / 2400 : 1), 0), run ? "run of 2.4 m" : "pc", PRICES[t] ?? 100);
  });
  const floors = {};
  D.rooms.forEach((r) => { const k = r.floor || ROOM_TYPES[r.type].floor; if (k === "none") return; floors[k] = (floors[k] || 0) + roomArea(r); });
  Object.entries(floors).forEach(([k, a]) => add("Flooring: " + k, a, "m²", FLOOR_PRICE[k]));
  let paint = 0;
  mergeWalls(D).forEach((sg) => { paint += (Math.hypot(sg.b[0] - sg.a[0], sg.b[1] - sg.a[1]) / 1000) * (WALL_H / 1000) * 2; sg.ops.forEach((o) => { paint -= ((o.width * o.h) / 1e6) * 2; }); });
  add("Wall paint (both sides)", Math.max(0, paint), "m²", PAINT_PRICE);
  add("Doors", D.openings.filter((o) => o.type === "door").length, "pc", DOOR_PRICE);
  add("Windows", D.openings.filter((o) => o.type === "window").reduce((a, o) => a + (o.width * o.h) / 1e6, 0), "m²", WINDOW_PRICE);
  const bb = bboxOf(D), fp = bb.empty ? 0 : ((bb.x1 - bb.x0) * (bb.z1 - bb.z0)) / 1e6, ex = D.ext || {};
  add("Roof", fp * 1.15, "m²", ROOF_PRICE);
  const nFloors = Math.max(D.levels || 1, ex.storeys || 1);
  if (nFloors > 1) add("Extra storeys", fp * (nFloors - 1), "m²", STOREY_PRICE);
  return { lines, total: lines.reduce((a, l) => a + l.total, 0) };
}

/* ================================================================== */
/* 3D structure (walls, floors, openings)                              */
/* ================================================================== */
function disposeTree(o) {
  o.traverse((n) => {
    if (n.geometry && n.geometry !== BOX && n.geometry !== CYL && n.geometry !== SPH) n.geometry.dispose();
    if (n.material && !n.material.userData.shared) [].concat(n.material).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
  });
}

function buildStructure(D, bb, ctx) {
  const root = new THREE.Group();
  const wallGroups = [];
  const H = WALL_H * MM, maxL = ctx.maxLevel ?? 99;
  const wallMat = new THREE.MeshStandardMaterial({ color: ctx.wallColor, roughness: 0.95, transparent: true, opacity: ctx.wallOp });
  wallMat.depthWrite = ctx.wallOp > 0.95;
  const frameMat = new THREE.MeshStandardMaterial({ color: ctx.trim, roughness: 0.4, metalness: 0.2 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xcfe6f2, transparent: true, opacity: 0.2, roughness: 0.1, depthWrite: false, side: THREE.DoubleSide });
  const slabMat = new THREE.MeshStandardMaterial({ color: 0xdadde2, roughness: 1 });

  D.rooms.forEach((r) => {
    const lv = r.lv || 0, kind = r.floor || ROOM_TYPES[r.type].floor;
    if (lv > maxL || kind === "none") return;
    const shape = new THREE.Shape(r.poly.map(([x, z]) => new THREE.Vector2(x * MM, -z * MM)));
    const tex = ctx.floorTex[kind].clone();
    tex.needsUpdate = true;
    const rep = 1 / ((FLOOR_SIZE[kind] || 1200) * MM);
    tex.repeat.set(rep, rep);
    const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshStandardMaterial({ map: tex, roughness: kind === "wood" ? 0.55 : 0.35, transparent: true, opacity: ctx.floorOp, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = lv * H + 0.001;
    m.receiveShadow = true;
    root.add(m);
    if (lv > 0) {
      const sm = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: false }), slabMat);
      sm.rotation.x = -Math.PI / 2;
      sm.position.y = lv * H - 0.2;
      sm.castShadow = sm.receiveShadow = true;
      root.add(sm);
    }
  });
  const sw = (bb.x1 - bb.x0) * MM + 0.5, sd = (bb.z1 - bb.z0) * MM + 0.5;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(sw, 0.116, sd), slabMat);
  slab.position.set(((bb.x0 + bb.x1) / 2) * MM, -0.06, ((bb.z0 + bb.z1) / 2) * MM);
  slab.receiveShadow = true;
  root.add(slab);

  mergeWalls(D).forEach((sg) => {
    const lv = sg.lv || 0;
    if (lv > maxL) return;
    const [ax, az] = sg.a, [bx, bz] = sg.b;
    const L = Math.hypot(bx - ax, bz - az) * MM;
    if (L < 0.05) return;
    const t = sg.t * MM;
    const g = new THREE.Group();
    g.position.set(((ax + bx) / 2) * MM, lv * H, ((az + bz) / 2) * MM);
    g.rotation.y = -Math.atan2(bz - az, bx - ax);
    const ext = t / 2 - 0.002, xa = -L / 2 - ext, xb = L / 2 + ext;
    const wb = (x0, x1, y0, y1, mat = wallMat) => {
      if (x1 - x0 < 0.002 || y1 - y0 < 0.002) return;
      const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, t), mat);
      m.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0);
      m.castShadow = m.receiveShadow = true;
      g.add(m);
    };
    let cur = xa;
    [...sg.ops].sort((p, q) => p.pos - q.pos).forEach((o) => {
      const cx = (o.pos - 0.5) * L, w = o.width * MM;
      const sill = (o.type === "window" ? o.sill : 0) * MM;
      const oh = Math.min(o.h * MM, H - sill - 0.05);
      const l = Math.max(cur, cx - w / 2), r = Math.min(xb, cx + w / 2);
      if (r <= l) return;
      wb(cur, l, 0, H); wb(l, r, 0, sill); wb(l, r, sill + oh, H);
      cur = r;
      if (o.type === "window") {
        const gl = new THREE.Mesh(new THREE.PlaneGeometry(r - l, oh), glassMat);
        gl.position.set((l + r) / 2, sill + oh / 2, 0);
        g.add(gl);
        const f = 0.05;
        wb(l, r, sill, sill + f, frameMat); wb(l, r, sill + oh - f, sill + oh, frameMat);
        wb(l, l + f, sill, sill + oh, frameMat); wb(r - f, r, sill, sill + oh, frameMat);
        wb((l + r) / 2 - f / 2, (l + r) / 2 + f / 2, sill, sill + oh, frameMat);
      } else {
        const pivot = new THREE.Group();
        pivot.position.set(l + 0.02, 0, 0);
        pivot.rotation.y = -1.15;
        const lw = r - l - 0.04;
        const leaf = new THREE.Mesh(new THREE.BoxGeometry(lw, oh - 0.02, 0.04), new THREE.MeshStandardMaterial({ color: o.color, roughness: 0.6 }));
        leaf.position.set(lw / 2, (oh - 0.02) / 2, 0);
        leaf.castShadow = true;
        pivot.add(leaf);
        const knob = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.08), new THREE.MeshStandardMaterial({ color: 0xb9bfc6, metalness: 0.8, roughness: 0.3 }));
        knob.position.set(lw - 0.08, 1.0, 0);
        pivot.add(knob);
        g.add(pivot);
        wb(l, r, 0, 0.02, frameMat);
      }
    });
    wb(cur, xb, 0, H);
    let edge = null;
    if (sg.axis) {
      if (sg.h && Math.abs(az - bb.z0) < 120) edge = "N";
      else if (sg.h && Math.abs(az - bb.z1) < 120) edge = "S";
      else if (!sg.h && Math.abs(ax - bb.x0) < 120) edge = "W";
      else if (!sg.h && Math.abs(ax - bb.x1) < 120) edge = "E";
    }
    g.userData.edge = edge;
    g.userData.level = lv;
    root.add(g);
    wallGroups.push(g);
  });
  return { root, wallGroups };
}

/* ================================================================== */
/* 3D exterior (storeys, roof, garden)                                 */
/* ================================================================== */
function buildExterior(D, bb) {
  const e = D.ext, H = WALL_H * MM, g = new THREE.Group();
  const x0 = bb.x0 * MM, x1 = bb.x1 * MM, z0 = bb.z0 * MM, z1 = bb.z1 * MM, w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const std = (color, r = 0.9) => new THREE.MeshStandardMaterial({ color, roughness: r });
  const add = (geo, mat, x, y, z, ry = 0, shadow = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = m.receiveShadow = shadow; g.add(m); return m; };
  const wallM = std(e.wall), trimM = std(e.trim, 0.5), roofM = std(e.roofColor, 0.8);

  if (e.lawn) {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), std("#cfe3b8", 1));
    ground.rotation.x = -Math.PI / 2; ground.position.set(cx, -0.118, cz); ground.receiveShadow = true; g.add(ground);
  }
  add(new THREE.BoxGeometry(1.5, 0.1, 7), std("#b9bcc0", 1), cx, -0.1, z1 + 3.5 + 0.2);
  add(new THREE.BoxGeometry(w + 3, 0.1, 3), std("#c9ccd0", 1), cx, -0.1, z1 + 1.5 + 8.5);

  for (let s = Math.max(1, D.levels || 1); s < e.storeys; s++) {
    add(new THREE.BoxGeometry(w, H, d), wallM, cx, H * s + H / 2, cz);
    add(new THREE.BoxGeometry(w + 0.1, 0.14, d + 0.1), trimM, cx, H * s, cz);
    const sides = [[w, 0, cz + d / 2 + 0.03, 0], [w, 0, cz - d / 2 - 0.03, Math.PI], [d, cx + w / 2 + 0.03, 0, Math.PI / 2], [d, cx - w / 2 - 0.03, 0, -Math.PI / 2]];
    sides.forEach(([len, px, pz, ry]) => {
      const n = Math.max(1, Math.floor(len / 2));
      for (let i = 0; i < n; i++) {
        const o = (i + 0.5) / n * len - len / 2;
        const wx = ry === 0 || ry === Math.PI ? cx + o : px, wz = ry === 0 || ry === Math.PI ? pz : cz + o;
        const grp = new THREE.Group();
        grp.position.set(wx, H * s + 1.5, wz); grp.rotation.y = ry;
        const fr = new THREE.Mesh(BOX, trimM); fr.scale.set(1.3, 1.3, 0.05); grp.add(fr);
        const gl = new THREE.Mesh(BOX, new THREE.MeshStandardMaterial({ color: 0x9fc6e0, roughness: 0.1, metalness: 0.3 })); gl.scale.set(1.15, 1.15, 0.07); grp.add(gl);
        g.add(grp);
      }
    });
  }

  const top = H * Math.max(D.levels || 1, e.storeys), ov = 0.45;
  if (e.roof === "flat") {
    add(new THREE.BoxGeometry(w + ov * 2, 0.22, d + ov * 2), roofM, cx, top + 0.11, cz);
    [[w + ov * 2, 0.15, cx, cz + d / 2 + ov], [w + ov * 2, 0.15, cx, cz - d / 2 - ov]].forEach(([l, t, px, pz]) => add(new THREE.BoxGeometry(l, 0.4, t), trimM, px, top + 0.35, pz));
    [[0.15, d + ov * 2, cx + w / 2 + ov, cz], [0.15, d + ov * 2, cx - w / 2 - ov, cz]].forEach(([t, l, px, pz]) => add(new THREE.BoxGeometry(t, 0.4, l), trimM, px, top + 0.35, pz));
  } else if (e.roof === "gable") {
    const alongX = w >= d, span = (alongX ? d : w) + ov * 2, len = (alongX ? w : d) + ov * 2, rise = (span / 2) * Math.tan(0.44);
    const sh = new THREE.Shape(); sh.moveTo(-span / 2, 0); sh.lineTo(span / 2, 0); sh.lineTo(0, rise); sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth: len, bevelEnabled: false }); geo.translate(0, 0, -len / 2);
    add(geo, roofM, cx, top, cz, alongX ? Math.PI / 2 : 0);
  } else {
    const rise = Math.min(w, d) * 0.28;
    const geo = new THREE.ConeGeometry(1, 1, 4); geo.rotateY(Math.PI / 4);
    const m = add(geo, roofM, cx, top + rise / 2, cz);
    m.scale.set((w + ov * 2) / 1.4142, rise, (d + ov * 2) / 1.4142);
  }

  const door = D.openings.find((o) => { const wl = D.walls.find((q) => q.id === o.wallId); return o.type === "door" && (o.lv || 0) === 0 && wl && axisOf(wl) === "h" && Math.abs(wl.a[1] - bb.z1) < 120; });
  if (door) {
    const wl = D.walls.find((q) => q.id === door.wallId);
    const dx = (wl.a[0] + (wl.b[0] - wl.a[0]) * door.pos) * MM;
    add(new THREE.BoxGeometry(door.width * MM + 0.8, 0.18, 1.2), trimM, dx, 2.3, z1 + 0.6);
    add(new THREE.BoxGeometry(door.width * MM + 0.9, 0.12, 0.7), std("#c9ccd0", 1), dx, 0.06, z1 + 0.35);
    add(new THREE.BoxGeometry(door.width * MM + 1.1, 0.12, 0.4), std("#c9ccd0", 1), dx, 0.0, z1 + 0.85);
  }

  if (e.fence) {
    const gx0 = x0 - 4, gx1 = x1 + 4, gz0 = z0 - 4, gz1 = z1 + 11, fm = std("#f1f1ef", 0.7);
    const run = (ax, az, bx, bz) => {
      const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / 1.6));
      for (let i = 0; i <= n; i++) {
        const px = ax + ((bx - ax) * i) / n, pz = az + ((bz - az) * i) / n;
        if (Math.abs(pz - gz1) < 0.01 && Math.abs(px - cx) < 1.6) continue;
        add(new THREE.BoxGeometry(0.1, 1.1, 0.1), fm, px, 0.55, pz);
      }
      const rail = add(new THREE.BoxGeometry(L, 0.07, 0.04), fm, (ax + bx) / 2, 0.9, (az + bz) / 2, -Math.atan2(bz - az, bx - ax));
      rail.castShadow = false;
    };
    run(gx0, gz0, gx1, gz0); run(gx1, gz0, gx1, gz1); run(gx1, gz1, gx0, gz1); run(gx0, gz1, gx0, gz0);
  }
  if (e.trees) {
    [[x0 - 2.2, z0 - 2.4, 1.1], [x1 + 2.6, z0 - 2.8, 1.3], [x0 - 2.8, z1 + 2.5, 0.9], [x1 + 2.4, z1 + 3.5, 1.2], [x0 - 2.5, cz, 1.0]].forEach(([tx, tz, s]) => {
      add(new THREE.CylinderGeometry(0.1 * s, 0.14 * s, 1.8 * s, 10), std("#6a4a35"), tx, 0.9 * s, tz);
      add(new THREE.SphereGeometry(1.1 * s, 18, 14), std("#5f8f5f"), tx, 2.5 * s, tz);
      add(new THREE.SphereGeometry(0.8 * s, 16, 12), std("#6fa06f"), tx + 0.4 * s, 3.2 * s, tz - 0.2 * s);
    });
    for (let x = x0 + 0.6; x < x1 - 0.4; x += 1.4) {
      if (Math.abs(x - cx) < 1.5) continue;
      add(new THREE.SphereGeometry(0.4, 12, 10), std("#6f9f62"), x, 0.3, z1 + 0.7);
    }
  }
  return g;
}

/* ================================================================== */
/* Room furnishing presets                                             */
/* ================================================================== */
export function furnishRoom(r) {
  const m = 170, ix = r.x + m, iz = r.z + m, iw = r.w - 2 * m, id = r.d - 2 * m, cx = r.x + r.w / 2, cz = r.z + r.d / 2;
  const out = [];
  const add = (type, x, z, rot = 0, ex = {}) => out.push(mk(type, Math.round(x), Math.round(z), rot, { lv: r.lv || 0, ...ex }));
  const N = (W) => iz + W / 2, Sx = (W) => iz + id - W / 2, Wx = (W) => ix + W / 2, Ex = (W) => ix + iw - W / 2;
  const diningSet = (x, z) => {
    add("dining", x, z);
    [-400, 400].forEach((o) => { add("chair", x + o, z - 720, 0); add("chair", x + o, z + 720, 180); });
    add("chair", x - 1060, z, 90); add("chair", x + 1060, z, 270);
  };
  switch (r.type) {
    case "bedroom":
      add("rug", cx, cz);
      add("bed", cx, N(2000));
      if (iw >= 3000) { add("sidetable", cx - 1180, N(500), 0, { variant: 1 }); add("sidetable", cx + 1180, N(500), 0, { variant: 1 }); }
      if (id >= 2100 && iw >= 3400) add("wardrobe", Ex(600), cz + (id > 2800 ? 300 : 0), 270);
      add("plant", Wx(400), Sx(400));
      break;
    case "living": {
      const wide = iw >= 5200, lx = wide ? ix + iw * 0.35 : cx;
      add("rug", lx, cz);
      add("tvunit", lx, N(400));
      add("coffee", lx, cz - 100);
      add("sofa", lx, cz + 800, 180);
      add("lamp", Math.max(ix + 200, lx - 1450), N(350));
      add("plant", Wx(400), Sx(400));
      if (wide) diningSet(ix + iw * 0.78, cz);
      break;
    }
    case "dining": diningSet(cx, cz); add("plant", Wx(400), Sx(400)); break;
    case "kitchen": {
      const L = Math.max(900, Math.min(2400, iw - 720));
      add("kitchen", ix + L / 2, N(600), 0, { size: { L, W: 600, H: 900 } });
      add("wallcab", ix + L / 2, N(350), 0, { size: { L, W: 350, H: 700 } });
      add("fridge", ix + L + 360, N(700));
      break;
    }
    case "bathroom":
      add("bath", ix + 850, N(750));
      add("wc", Wx(650), iz + 1100, 90);
      add("vanity", Ex(800) - 20, Sx(500), 180);
      break;
    case "study":
      add("desk", cx, N(700));
      add("chair", cx, N(700) + 640, 180, { variant: 1 });
      add("shelf", Ex(300), cz, 270);
      add("plant", Wx(400), Sx(400));
      break;
    case "balcony":
      add("chair", cx - 600, cz, 0, { variant: 1 }); add("chair", cx + 600, cz, 0, { variant: 1 });
      add("sidetable", cx, cz); add("plant", Wx(400), N(400)); add("plant", Ex(400), N(400), 0, { variant: 1 });
      break;
    case "void": break;
    default: add("plant", Wx(400), N(400)); add("sidetable", cx, N(500));
  }
  return out.filter((i) => inPoly([i.x, i.z], rectPoly(r)));
}

/* ================================================================== */
/* Default / sample house                                              */
/* ================================================================== */
const defaultExt = () => ({ storeys: 1, roof: "gable", wall: EXT_WALL[0], trim: "#ffffff", roofColor: EXT_ROOF[0], fence: true, trees: true, lawn: true, inside: "#f4f4f2" });
function sampleHouse() {
  const R1 = makeRoom(0, 0, 4200, 3900, "bedroom", "Master bedroom");
  const R2 = makeRoom(4200, 0, 2200, 1800, "bathroom", "Bathroom");
  const R3 = makeRoom(4200, 1800, 2200, 2100, "kitchen", "Kitchen");
  const R4 = makeRoom(0, 3900, 6400, 3200, "living", "Living & dining");
  const all = [R1, R2, R3, R4];
  const W = (R, k) => R.walls[k];
  const openings = [
    opAt(W(R1, 3), 1500, { type: "window", width: 2400, sill: 300, h: 2000 }),
    opAt(W(R1, 2), 3300, { type: "door", width: 900 }),
    opAt(W(R1, 0), 2100, { type: "window", width: 1600, sill: 900, h: 1200 }),
    opAt(W(R2, 3), 900, { type: "door", width: 800 }),
    opAt(W(R2, 1), 900, { type: "window", width: 600, sill: 1500, h: 600 }),
    opAt(W(R3, 1), 2850, { type: "window", width: 1400, sill: 900, h: 1200 }),
    opAt(W(R4, 2), 3200, { type: "door", width: 1000, color: "#6a4636" }),
    opAt(W(R4, 2), 900, { type: "window", width: 1600 }),
    opAt(W(R4, 2), 5400, { type: "window", width: 1600 }),
    opAt(W(R4, 3), 5500, { type: "window", width: 2000, sill: 300, h: 2000 }),
  ];
  return { rooms: all.map((a) => a.room), walls: all.flatMap((a) => a.walls), openings, items: all.flatMap((a) => furnishRoom(a.room)), ext: defaultExt(), levels: 1 };
}
export const normalizeD = (d) => {
  const rooms = (d.rooms || []).map((r) => withBox({ lv: 0, ...r, poly: r.poly || [[r.x, r.z], [r.x + r.w, r.z], [r.x + r.w, r.z + r.d], [r.x, r.z + r.d]] }));
  const items = (d.items || []).filter((i) => CAT[i.type]);
  const top = Math.max(0, ...rooms.map((r) => r.lv || 0), ...(d.walls || []).map((w) => w.lv || 0), ...items.map((i) => i.lv || 0));
  return { openings: [], views: [], dims: [], ...d, levels: Math.max(d.levels || 1, top + 1), rooms, items, ext: { ...defaultExt(), ...(d.ext || {}) } };
};
const loadD = () => {
  try {
    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem(STORE_KEY);
      if (raw) { const d = JSON.parse(raw); if (d && d.rooms && d.walls) return normalizeD(d); }
    }
  } catch (e) { /* ignore */ }
  return sampleHouse();
};

/* ================================================================== */
/* Thumbnails                                                          */
/* ================================================================== */
function makeThumbs() {
  const out = {};
  try {
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setPixelRatio(1); r.setSize(128, 128);
    if ("outputColorSpace" in r) r.outputColorSpace = THREE.SRGBColorSpace;
    const sc = new THREE.Scene();
    sc.add(new THREE.HemisphereLight(0xffffff, 0xb8bcc4, 1.1));
    const dl = new THREE.DirectionalLight(0xffffff, 1.5); dl.position.set(2, 4, 3); sc.add(dl);
    const cam = new THREE.PerspectiveCamera(32, 1, 0.05, 50);
    CATALOG.forEach((c) => c.variants.forEach((v, vi) => {
      const g = buildModel(c.type, vi);
      paint(g, v, null);
      const [L, W, H] = c.size;
      g.scale.set(L * MM, H * MM, W * MM);
      sc.add(g);
      const md = Math.max(L, W, H) * MM;
      cam.position.set(md * 1.9, (H * MM) / 2 + md * 0.9, md * 2.4);
      cam.lookAt(0, (H * MM) / 2, 0);
      r.render(sc, cam);
      out[c.type + ":" + vi] = r.domElement.toDataURL("image/png");
      sc.remove(g);
    }));
    r.dispose();
  } catch (e) { /* thumbnails are optional */ }
  return out;
}

/* ================================================================== */
/* Icons + small pieces                                                */
/* ================================================================== */
const ICON = {
  move: "M5 9l-3 3 3 3 M9 5l3-3 3 3 M15 19l-3 3-3-3 M19 9l3 3-3 3 M2 12h20 M12 2v20",
  rotate: "M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8 M21 3v5h-5",
  mirror: "M8 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h3 M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3 M12 20v2 M12 14v2 M12 8v2 M12 2v2",
  swap: "m17 2 4 4-4 4 M3 11v-1a4 4 0 0 1 4-4h14 m7 22-4-4 4-4 M21 13v1a4 4 0 0 1-4 4H3",
  copy: ["M11 9h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z", "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"],
  eyeoff: "M9.88 9.88a3 3 0 1 0 4.24 4.24 M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68 M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61 M2 2l20 20",
  eye: ["M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z", "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"],
  star: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  trash: "M3 6h18 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
  undo: "M3 7v6h6 M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13",
  redo: "M21 7v6h-6 M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13",
  save: "M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z M17 21v-8H7v8 M7 3v5h8",
  clear: "M18 6 6 18 M6 6l12 12",
  file: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6",
  search: ["M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16z", "m21 21-4.3-4.3"],
  plus: "M12 5v14 M5 12h14",
  minus: "M5 12h14",
  home: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10",
  lock: ["M5 11h14v10H5z", "M8 11V7a4 4 0 0 1 8 0v4"],
  chevron: "m9 18 6-6-6-6",
  layers: "M12 2 2 7l10 5 10-5-10-5z M2 17l10 5 10-5 M2 12l10 5 10-5",
  cursor: "M4 3l7 17 2.5-7.5L21 10z",
  room: "M3 5h18v14H3z",
  wall: "M3 8h18v8H3z M9 8v8 M15 8v8",
  door: ["M5 21V3h9l5 3v15", "M5 21h14", "M12 12h.01"],
  window: "M4 4h16v16H4z M12 4v16 M4 12h16",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z",
  ruler: "M3 17L17 3l4 4L7 21z M7 13l2 2 M10 10l2 2 M13 7l2 2",
  poly: "M4 18l3-12 10-2 3 10-7 6z",
  sliders: "M4 6h10 M18 6h2 M4 12h4 M12 12h8 M4 18h12 M20 18h0 M14 4v4 M8 10v4 M16 16v4",
};
const Ic = ({ n, size = 18, fill }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={fill || "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {(Array.isArray(ICON[n]) ? ICON[n] : [ICON[n]]).map((p, i) => <path key={i} d={p} />)}
  </svg>
);
function Row({ label, value, min, max, step = 1, unit = "mm", onChange, onStart, disabled }) {
  const v = Math.round(value);
  return (
    <div className="b3d-row">
      <label>{label}</label>
      <input type="range" min={min} max={max} step={step} value={Math.min(max, Math.max(min, v))} disabled={disabled} onPointerDown={onStart} onChange={(e) => onChange(+e.target.value)} />
      <div className="b3d-num">
        <input type="number" value={v} disabled={disabled} onFocus={onStart} onChange={(e) => onChange(+e.target.value)} />
        <span>{unit}</span>
      </div>
    </div>
  );
}
const Swatches = ({ list, value, onPick }) => (
  <div className="b3d-sw">
    {list.map((c) => <button key={c} aria-label={c} style={{ background: c }} className={value === c ? "on" : ""} onClick={() => onPick(c)} />)}
  </div>
);

/* ================================================================== */
/* Component                                                           */
/* ================================================================== */
function Builder3DInner({ style }) {
  const hostRef = useRef(null);
  const tbRef = useRef(null);
  const svgRef = useRef(null);
  const planWrap = useRef(null);
  const fileInput = useRef(null);
  const S = useRef({ groups: new Map(), wallGroups: [], cut: "cut", mode: "interior" });
  const drag = useRef(null);
  const rootRef = useRef(null);
  const lastTap = useRef({});
  const pointers = useRef(new Map());
  const glbInput = useRef(null);
  const traceInput = useRef(null);

  const [D, setDState] = useState(loadD);
  const dRef = useRef(D);
  const pastRef = useRef([]);
  const futureRef = useRef([]);
  const [, bump] = useState(0);

  const [mode, setMode] = useState("interior"); // plan | interior | exterior
  const [selection, setSelection] = useState(null); // {kind:'item'|'room'|'wall'|'op', id}
  const [tool, setTool] = useState("translate");
  const [ptool, setPtool] = useState("select");
  const [rtype, setRtype] = useState("bedroom");
  const [draft, setDraft] = useState(null);
  const [hover, setHover] = useState(null);
  const [pv, setPv] = useState({ tx: 200, ty: 120, k: 0.1 });
  const [pSize, setPSize] = useState({ w: 800, h: 600 });
  const [rtab, setRtab] = useState("props");
  const [cat, setCat] = useState("popular");
  const [query, setQuery] = useState("");
  const [live, setLive] = useState(true);
  const [cut, setCut] = useState("cut");
  const [menu, setMenu] = useState(null);
  const [matOpen, setMatOpen] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [fileOpen, setFileOpen] = useState(false);
  const [wallOp, setWallOp] = useState(100);
  const [floorOp, setFloorOp] = useState(100);
  const [zoomPct, setZoomPct] = useState(100);
  const [thumbs, setThumbs] = useState({});
  const [msg, setMsg] = useState("");
  const [hour, setHour] = useState(14);
  const [walk, setWalk] = useState(false);
  const [trace, setTrace] = useState(null);
  const [vw, setVw] = useState(1280);
  const [coarse, setCoarse] = useState(false);
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [lv, setLv] = useState(0);
  const lvRef = useRef(0);
  lvRef.current = lv;

  const selId = selection && selection.kind === "item" ? selection.id : null;
  const setSelId = useCallback((id) => setSelection(id ? { kind: "item", id } : null), []);
  const sel = D.items.find((i) => i.id === selId) || null;
  const selRoom = selection && selection.kind === "room" ? D.rooms.find((r) => r.id === selection.id) : null;
  const selWall = selection && selection.kind === "wall" ? D.walls.find((w) => w.id === selection.id) : null;
  const selOp = selection && selection.kind === "op" ? D.openings.find((o) => o.id === selection.id) : null;
  const selDim = selection && selection.kind === "dim" ? (D.dims || []).find((o) => o.id === selection.id) : null;
  const wallById = useMemo(() => Object.fromEntries(D.walls.map((w) => [w.id, w])), [D.walls]);
  const hiddenCount = D.items.filter((i) => i.hidden).length;
  const nL = D.levels || 1;
  const compact = vw < 1000, tapR = coarse ? 2 : 1;
  const compactRef = useRef(false);
  compactRef.current = compact;
  const rootCls = "b3d" + (vw < 640 ? " b3d-sm" : vw < 1000 ? " b3d-md" : vw < 1200 ? " b3d-lg" : "") + (compact ? " b3d-compact" : "") + (coarse ? " b3d-coarse" : "");
  const pressKey = (k, down) => { const st = S.current; if (!st.keys) return; if (down) st.keys.add(k); else st.keys.delete(k); };
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(""), 1700); };

  /* ---------- state helpers ---------- */
  const setD = useCallback((n) => { dRef.current = n; setDState(n); }, []);
  const snapshot = useCallback(() => {
    pastRef.current.push(JSON.stringify(dRef.current));
    if (pastRef.current.length > 100) pastRef.current.shift();
    futureRef.current = [];
    bump((n) => n + 1);
  }, []);
  const commit = useCallback((fn) => { snapshot(); setD(fn(dRef.current)); }, [snapshot, setD]);
  const patchItem = useCallback((id, p) => setD({ ...dRef.current, items: dRef.current.items.map((i) => (i.id === id ? { ...i, ...p } : i)) }), [setD]);
  const patchWall = useCallback((id, p) => setD({ ...dRef.current, walls: dRef.current.walls.map((i) => (i.id === id ? { ...i, ...p } : i)) }), [setD]);
  const patchOp = useCallback((id, p) => setD({ ...dRef.current, openings: dRef.current.openings.map((i) => (i.id === id ? { ...i, ...p } : i)) }), [setD]);
  const patchExt = (p) => commit((d) => ({ ...d, ext: { ...d.ext, ...p } }));
  const rectPatch = useCallback((roomId, p) => {
    const d = dRef.current, r = d.rooms.find((q) => q.id === roomId);
    if (!r) return;
    const nb = { x: p.x ?? r.x, z: p.z ?? r.z, w: Math.max(1000, p.w ?? r.w), d: Math.max(1000, p.d ?? r.d) };
    const poly = r.poly.map(([px, pz]) => [nb.x + ((px - r.x) / (r.w || 1)) * nb.w, nb.z + ((pz - r.z) / (r.d || 1)) * nb.d]);
    const nr = withBox({ ...r, poly });
    const dx = nr.x - r.x, dz = nr.z - r.z, nw = roomWalls(nr);
    setD({
      ...d,
      rooms: d.rooms.map((q) => (q.id === roomId ? nr : q)),
      walls: d.walls.map((w) => { const f = nw.find((q) => q.id === w.id); return f ? { ...w, a: f.a, b: f.b } : w; }),
      items: dx || dz ? d.items.map((i) => (inRect(i, r) ? { ...i, x: i.x + dx, z: i.z + dz } : i)) : d.items,
    });
  }, [setD]);
  const undo = useCallback(() => { const s = pastRef.current.pop(); if (!s) return; futureRef.current.push(JSON.stringify(dRef.current)); setD(JSON.parse(s)); bump((n) => n + 1); }, [setD]);
  const redo = useCallback(() => { const s = futureRef.current.pop(); if (!s) return; pastRef.current.push(JSON.stringify(dRef.current)); setD(JSON.parse(s)); bump((n) => n + 1); }, [setD]);

  const dropPoint = () => {
    const r = selRoom || (selId && null);
    if (r) return { x: r.x + r.w / 2, z: r.z + r.d / 2 };
    if (mode === "plan") return { x: (pSize.w / 2 - pv.tx) / pv.k, z: (pSize.h / 2 - pv.ty) / pv.k };
    const bb = bboxOf(dRef.current);
    return { x: (bb.x0 + bb.x1) / 2, z: (bb.z0 + bb.z1) / 2 };
  };
  const addItem = useCallback((type, at, variant = 0) => {
    const p = at || dropPoint();
    const n = dRef.current.items.length;
    const it = mk(type, Math.round(p.x + (at ? 0 : (n % 3) * 150)), Math.round(p.z + (at ? 0 : (n % 3) * 150)), 0, { variant, lv: lvRef.current });
    commit((d) => ({ ...d, items: [...d.items, it] }));
    setSelId(it.id);
    if (compactRef.current) setLeftOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commit, setSelId, selRoom, mode, pv, pSize]);
  const duplicate = useCallback((id) => {
    const it = dRef.current.items.find((i) => i.id === id);
    if (!it) return;
    const copy = { ...it, id: uid("f"), x: it.x + 300, z: it.z + 300, size: { ...it.size }, locked: false };
    commit((d) => ({ ...d, items: [...d.items, copy] }));
    setSelId(copy.id);
  }, [commit, setSelId]);
  const arrayItem = useCallback((id) => {
    const it = dRef.current.items.find((i) => i.id === id);
    if (!it) return;
    const r = (it.rot * Math.PI) / 180, step = it.size.L + 50;
    commit((d) => ({ ...d, items: [...d.items, ...[1, 2, 3].map((k) => ({ ...it, id: uid("f"), size: { ...it.size }, locked: false, x: it.x + Math.cos(r) * step * k, z: it.z - Math.sin(r) * step * k }))] }));
  }, [commit]);
  const deleteSelection = useCallback(() => {
    if (!selection) return;
    commit((d) => {
      if (selection.kind === "item") return { ...d, items: d.items.filter((i) => i.id !== selection.id) };
      if (selection.kind === "dim") return { ...d, dims: (d.dims || []).filter((o) => o.id !== selection.id) };
      if (selection.kind === "op") return { ...d, openings: d.openings.filter((o) => o.id !== selection.id) };
      if (selection.kind === "wall") return { ...d, walls: d.walls.filter((w) => w.id !== selection.id), openings: d.openings.filter((o) => o.wallId !== selection.id) };
      const r = d.rooms.find((q) => q.id === selection.id);
      if (!r) return d;
      return { ...d, rooms: d.rooms.filter((q) => q.id !== r.id), walls: d.walls.filter((w) => !r.wallIds.includes(w.id)), openings: d.openings.filter((o) => !r.wallIds.includes(o.wallId)) };
    });
    setSelection(null);
  }, [selection, commit]);
  const addRoom = (x, z, w, d, type) => {
    const n = dRef.current.rooms.filter((r) => r.type === type).length + 1;
    const { room, walls } = makeRoom(x, z, w, d, type, ROOM_TYPES[type].label + " " + n, lvRef.current);
    commit((s) => ({ ...s, rooms: [...s.rooms, room], walls: [...s.walls, ...walls] }));
    setSelection({ kind: "room", id: room.id });
  };
  const finishPoly = (pts) => {
    setDraft(null);
    if (pts.length < 3) return;
    const poly = pts.map((q) => [q.x, q.z]);
    if (roomArea({ poly }) < 1) return;
    const n = dRef.current.rooms.filter((r) => r.type === rtype).length + 1;
    const { room, walls } = makePolyRoom(poly, rtype, ROOM_TYPES[rtype].label + " " + n, lvRef.current);
    commit((d) => ({ ...d, rooms: [...d.rooms, room], walls: [...d.walls, ...walls] }));
    setSelection({ kind: "room", id: room.id });
    setPtool("select");
  };
  const moveVertex = (roomId, idx, c) => {
    const d = dRef.current, r = d.rooms.find((q) => q.id === roomId);
    if (!r) return;
    const n = r.poly.length, pt = [c.x, c.z];
    const poly = r.poly.map((q, i) => (i === idx ? pt : q));
    const wA = r.wallIds[idx], wB = r.wallIds[(idx - 1 + n) % n];
    setD({ ...d, rooms: d.rooms.map((q) => (q.id === roomId ? withBox({ ...q, poly }) : q)), walls: d.walls.map((w) => (w.id === wA ? { ...w, a: pt } : w.id === wB ? { ...w, b: pt } : w)) });
  };
  const insertVertex = (e, roomId, k) => {
    const d = dRef.current, r = d.rooms.find((q) => q.id === roomId);
    if (!r) return;
    const n = r.poly.length, A = r.poly[k], B = r.poly[(k + 1) % n], M = [sn((A[0] + B[0]) / 2, 100), sn((A[1] + B[1]) / 2, 100)];
    const wid = r.wallIds[k], nid = uid("w");
    const len = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1, f = Math.min(0.95, Math.max(0.05, Math.hypot(M[0] - A[0], M[1] - A[1]) / len));
    snapshot();
    const poly = [...r.poly.slice(0, k + 1), M, ...r.poly.slice(k + 1)];
    const wallIds = [...r.wallIds.slice(0, k + 1), nid, ...r.wallIds.slice(k + 1)];
    const walls = d.walls.flatMap((w) => (w.id === wid ? [{ ...w, a: A, b: M }, { id: nid, a: M, b: B, t: w.t, lv: w.lv || 0 }] : [w]));
    const openings = d.openings.map((o) => (o.wallId !== wid ? o : o.pos < f ? { ...o, pos: o.pos / f } : { ...o, wallId: nid, pos: (o.pos - f) / (1 - f) }));
    setD({ ...d, rooms: d.rooms.map((q) => (q.id === roomId ? withBox({ ...q, poly, wallIds }) : q)), walls, openings });
    begin(e, { kind: "rvert", id: roomId, idx: k + 1 });
    drag.current.snap = true;
  };
  const removeVertex = (roomId, idx) => {
    const d = dRef.current, r = d.rooms.find((q) => q.id === roomId);
    if (!r || r.poly.length <= 3) return;
    snapshot();
    const n = r.poly.length, prev = (idx - 1 + n) % n, wPrev = r.wallIds[prev], wCur = r.wallIds[idx], next = r.poly[(idx + 1) % n];
    const poly = r.poly.filter((_, i) => i !== idx), wallIds = r.wallIds.filter((_, i) => i !== idx);
    setD({ ...d, rooms: d.rooms.map((q) => (q.id === roomId ? withBox({ ...q, poly, wallIds }) : q)), walls: d.walls.filter((w) => w.id !== wCur).map((w) => (w.id === wPrev ? { ...w, b: next } : w)), openings: d.openings.filter((o) => o.wallId !== wCur) });
  };
  const addFloor = () => {
    const d = dRef.current, top = d.levels || 1, cur = lvRef.current;
    const hasPlan = d.rooms.some((r) => (r.lv || 0) === cur) || d.walls.some((w) => (w.lv || 0) === cur);
    const copy = hasPlan && window.confirm("Copy this floor's rooms, walls, doors and windows to the new floor as a starting point?");
    snapshot();
    let next = { ...d, levels: top + 1 };
    if (copy) {
      const wm = {};
      const walls = d.walls.filter((w) => (w.lv || 0) === cur).map((w) => { const id = uid("w"); wm[w.id] = id; return { ...w, id, lv: top }; });
      const rooms = d.rooms.filter((r) => (r.lv || 0) === cur).map((r) => ({ ...r, id: uid("r"), lv: top, wallIds: r.wallIds.map((i) => wm[i] || i) }));
      const openings = d.openings.filter((o) => wm[o.wallId]).map((o) => ({ ...o, id: uid("o"), wallId: wm[o.wallId], lv: top }));
      next = { ...next, walls: [...d.walls, ...walls], rooms: [...d.rooms, ...rooms], openings: [...d.openings, ...openings] };
    }
    setD(next);
    setLv(top);
  };
  const removeTopFloor = () => {
    const d = dRef.current, top = (d.levels || 1) - 1;
    if (top < 1) return;
    const keep = (e) => (e.lv || 0) !== top;
    const has = [d.rooms, d.walls, d.openings, d.items, d.dims || []].some((a) => a.some((e) => !keep(e)));
    if (has && !window.confirm("Delete everything on " + (top + 1) + "F?")) return;
    snapshot();
    setD({ ...d, levels: top, rooms: d.rooms.filter(keep), walls: d.walls.filter(keep), openings: d.openings.filter(keep), items: d.items.filter(keep), dims: (d.dims || []).filter(keep) });
    if (lvRef.current >= top) setLv(top - 1);
  };
  const furnish = (room) => commit((d) => ({ ...d, items: [...d.items, ...furnishRoom(room)] }));
  const clearRoom = (room) => commit((d) => ({ ...d, items: d.items.filter((i) => !inRect(i, room)) }));
  const setDim = (it, k, val) => {
    val = Math.max(10, Math.min(6000, +val || 10));
    let s = { ...it.size };
    if (it.prop) { const r = val / s[k]; s = { L: s.L * r, W: s.W * r, H: s.H * r }; }
    s[k] = val;
    patchItem(it.id, { size: s });
  };

  /* ---------- responsive: container width + touch detection ---------- */
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    const upd = () => setVw(el.clientWidth || 1280);
    upd();
    const ro = new ResizeObserver(upd);
    ro.observe(el);
    const mq = window.matchMedia ? window.matchMedia("(pointer: coarse)") : null;
    const mc = () => setCoarse(!!(mq && mq.matches));
    mc();
    if (mq && mq.addEventListener) mq.addEventListener("change", mc);
    return () => { ro.disconnect(); if (mq && mq.removeEventListener) mq.removeEventListener("change", mc); };
  }, []);

  /* ---------- three.js init (once) ---------- */
  useEffect(() => {
    const host = hostRef.current, s = S.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    const coarseNow = !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarseNow ? 1.5 : 2));
    if ("outputColorSpace" in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf1f3f6);
    const hemi = new THREE.HemisphereLight(0xffffff, 0xcfd3da, 1.0);
    scene.add(hemi);
    try {
      if ("environmentIntensity" in scene) {
        const pm = new THREE.PMREMGenerator(renderer);
        scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
        scene.environmentIntensity = 0.35;
        pm.dispose();
      }
    } catch (e) { /* the soft reflections are optional */ }
    const dir = new THREE.DirectionalLight(0xffffff, 1.7);
    dir.castShadow = true;
    dir.shadow.mapSize.set(coarseNow ? 1024 : 2048, coarseNow ? 1024 : 2048);
    dir.shadow.bias = -0.0004;
    scene.add(dir, dir.target);
    const grid = new THREE.GridHelper(60, 120, 0xd9dce1, 0xe7e9ed);
    grid.position.y = -0.125;
    scene.add(grid);

    const furn = new THREE.Group();
    scene.add(furn);

    const persp = new THREE.PerspectiveCamera(42, 1, 0.05, 200);
    const oc = new OrbitControls(persp, renderer.domElement);
    oc.maxPolarAngle = Math.PI / 2 - 0.03;
    oc.minDistance = 1.2;
    oc.maxDistance = 90;

    const tc = new TransformControls(persp, renderer.domElement);
    tc.setSize(coarseNow ? 1.3 : 0.9);
    scene.add(tc.getHelper ? tc.getHelper() : tc);
    tc.addEventListener("dragging-changed", (e) => {
      oc.enabled = !e.value; s.dragging = e.value;
      if (e.value) snapshot();
      else if (tc.object) {
        const it = dRef.current.items.find((i) => i.id === tc.object.userData.id);
        if (it) { const q = snapToWalls(it, dRef.current.walls); if (q.x !== it.x || q.z !== it.z) patchItem(it.id, q); }
      }
    });
    tc.addEventListener("objectChange", () => {
      const g = tc.object;
      if (g) patchItem(g.userData.id, { x: g.position.x / MM, z: g.position.z / MM, rot: norm((g.rotation.y * 180) / Math.PI) });
    });
    const box = new THREE.BoxHelper(new THREE.Object3D(), 0x2f6df0);
    box.visible = false;
    scene.add(box);

    Object.assign(s, { renderer, scene, dir, hemi, keys: new Set(), grid, furn, persp, oc, tc, box, floorTex: makeFloorTextures(), struct: null, ext: null, boxTarget: null, dragging: false, bb: bboxOf(dRef.current), homeDist: 10 });

    const sizeIt = () => {
      const w = host.clientWidth, h = host.clientHeight;
      if (w < 2 || h < 2) return;
      renderer.setSize(w, h);
      persp.aspect = w / h;
      persp.updateProjectionMatrix();
    };
    sizeIt();
    const ro = new ResizeObserver(sizeIt);
    ro.observe(host);

    let lastZoom = 100;
    oc.addEventListener("change", () => {
      if (s.mode === "plan") return;
      const z = Math.round((100 * s.homeDist) / persp.position.distanceTo(oc.target));
      if (z !== lastZoom) { lastZoom = z; setZoomPct(z); }
    });

    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    s.pick = (cx, cy) => {
      if (s.mode !== "interior") return null;
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, persp);
      const hit = ray.intersectObjects([...s.groups.values()].filter((g) => g.visible && (g.userData.level || 0) === lvRef.current), true)[0];
      if (!hit) return null;
      let o = hit.object;
      while (o && !o.userData.id) o = o.parent;
      return o ? o.userData.id : null;
    };
    let down = null, onGizmo = false;
    const dom = renderer.domElement;
    const act = new Set();
    let multi = false, press = null;
    const onDown = (e) => {
      act.add(e.pointerId);
      if (act.size > 1) multi = true;
      down = { x: e.clientX, y: e.clientY };
      onGizmo = !!tc.axis;
      clearTimeout(press);
      if (e.pointerType === "touch" && act.size === 1) {
        press = setTimeout(() => {
          if (!down || multi || s.dragging) return;
          const id = s.pick(down.x, down.y);
          if (id) { const r = host.getBoundingClientRect(); setSelId(id); setMenu({ x: down.x - r.left, y: down.y - r.top, id }); down = null; }
        }, 550);
      }
    };
    const onMove = (e) => { if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) clearTimeout(press); };
    const onUp = (e) => {
      clearTimeout(press);
      act.delete(e.pointerId);
      const wasMulti = multi;
      if (!act.size) multi = false;
      if (!down || e.button !== 0) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4;
      if (!moved && !onGizmo && !wasMulti) { setSelId(s.pick(e.clientX, e.clientY)); setMenu(null); setMatOpen(false); }
      down = null;
    };
    const onCancel = (e) => { clearTimeout(press); act.delete(e.pointerId); if (!act.size) multi = false; down = null; };
    const onCtx = (e) => {
      e.preventDefault();
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) return;
      const id = s.pick(e.clientX, e.clientY);
      if (id) { const r = host.getBoundingClientRect(); setSelId(id); setMenu({ x: e.clientX - r.left, y: e.clientY - r.top, id }); } else setMenu(null);
    };
    dom.addEventListener("pointerdown", onDown);
    dom.addEventListener("pointerup", onUp);
    dom.addEventListener("pointermove", onMove);
    dom.addEventListener("pointercancel", onCancel);
    dom.addEventListener("contextmenu", onCtx);
    const kd = (e) => { if (!/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) s.keys.add(e.key.toLowerCase()); };
    const ku = (e) => s.keys.delete(e.key.toLowerCase());
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);

    const v3 = new THREE.Vector3(), bb3 = new THREE.Box3();
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (s.mode === "plan") return;
      if (s.walk) {
        const now = performance.now(), dt = Math.min(0.05, (now - (s.t || now)) / 1000);
        s.t = now;
        const f = new THREE.Vector3().subVectors(oc.target, persp.position);
        f.y = 0;
        if (f.lengthSq() > 1e-10) {
          f.normalize();
          const kk = s.keys;
          const fw = (kk.has("w") || kk.has("arrowup") ? 1 : 0) - (kk.has("s") || kk.has("arrowdown") ? 1 : 0);
          const st = (kk.has("d") || kk.has("arrowright") ? 1 : 0) - (kk.has("a") || kk.has("arrowleft") ? 1 : 0);
          if (fw || st) { const mv = new THREE.Vector3(f.x * fw - f.z * st, 0, f.z * fw + f.x * st).multiplyScalar(2.2 * dt); persp.position.add(mv); oc.target.add(mv); }
        }
      } else s.t = null;
      oc.update();
      // wall cut-away
      const cp = persp.position, b = s.bb;
      s.wallGroups.forEach((g) => {
        let vis = true, sy = 1;
        if (s.mode === "interior") {
          if (s.cut === "low") sy = 0.12;
          else if (s.cut === "cut") {
            const e = g.userData.edge;
            vis = !((e === "N" && cp.z < b.z0 * MM) || (e === "S" && cp.z > b.z1 * MM) || (e === "W" && cp.x < b.x0 * MM) || (e === "E" && cp.x > b.x1 * MM));
          }
        }
        g.visible = vis; g.scale.y = sy;
      });
      if (s.boxTarget) { box.setFromObject(s.boxTarget); box.visible = true; } else box.visible = false;
      const tb = tbRef.current;
      if (tb) {
        if (s.boxTarget && !s.dragging) {
          bb3.setFromObject(s.boxTarget); bb3.getCenter(v3); v3.y = bb3.max.y; v3.project(persp);
          const w = host.clientWidth, h = host.clientHeight;
          tb.style.visibility = v3.z < 1 ? "visible" : "hidden";
          tb.style.left = Math.max(150, Math.min(w - 150, ((v3.x + 1) / 2) * w)) + "px";
          tb.style.top = Math.max(70, ((1 - v3.y) / 2) * h - 14) + "px";
        } else tb.style.visibility = "hidden";
      }
      renderer.render(scene, persp);
    };
    loop();
    const thumbT = setTimeout(() => setThumbs(makeThumbs()), 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => {
      cancelAnimationFrame(raf); clearTimeout(thumbT); ro.disconnect();
      dom.removeEventListener("pointerdown", onDown); dom.removeEventListener("pointerup", onUp); dom.removeEventListener("pointermove", onMove); dom.removeEventListener("pointercancel", onCancel); dom.removeEventListener("contextmenu", onCtx); window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku);
      tc.dispose(); oc.dispose(); renderer.dispose();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
      s.groups.clear(); s.scene = null;
    };
  }, []);

  /* ---------- rebuild walls / floors / exterior ---------- */
  useEffect(() => {
    const s = S.current;
    s.mode = mode; s.cut = cut;
    if (!s.scene || mode === "plan") return;
    if (s.struct) { s.scene.remove(s.struct); disposeTree(s.struct); s.struct = null; }
    if (s.ext) { s.scene.remove(s.ext); disposeTree(s.ext); s.ext = null; }
    const bb = bboxOf(D);
    s.bb = bb;
    const ex = mode === "exterior";
    const { root, wallGroups } = buildStructure(D, bb, { maxLevel: ex ? 99 : lv, floorTex: s.floorTex, wallColor: ex ? D.ext.wall : (D.ext.inside || "#f4f4f2"), trim: ex ? D.ext.trim : "#ffffff", wallOp: ex ? 1 : wallOp / 100, floorOp: ex ? 1 : floorOp / 100 });
    s.struct = root; s.wallGroups = wallGroups; s.scene.add(root);
    if (ex) { s.ext = buildExterior(D, bb); s.scene.add(s.ext); }
    const size = Math.max((bb.x1 - bb.x0) * MM, (bb.z1 - bb.z0) * MM, 4);
    const cx = ((bb.x0 + bb.x1) / 2) * MM, cz = ((bb.z0 + bb.z1) / 2) * MM, sh = s.dir.shadow.camera, ext = size * 0.8 + (ex ? 8 : 0);
    s.dir.position.set(cx - size * 0.6, size * 1.1 + 5, cz + size * 0.4);
    s.dir.target.position.set(cx, 0, cz);
    Object.assign(sh, { left: -ext, right: ext, top: ext, bottom: -ext, near: 0.5, far: size * 3 + 30 });
    sh.updateProjectionMatrix();
  }, [D.walls, D.rooms, D.openings, D.ext, D.levels, lv, mode, wallOp, floorOp, cut]);

  /* ---------- camera per mode ---------- */
  const aimCamera = useCallback((m) => {
    const s = S.current;
    if (!s.scene) return;
    const bb = bboxOf(dRef.current), size = Math.max((bb.x1 - bb.x0) * MM, (bb.z1 - bb.z0) * MM, 4);
    const cx = ((bb.x0 + bb.x1) / 2) * MM, cz = ((bb.z0 + bb.z1) / 2) * MM;
    const tgt = new THREE.Vector3(cx, m === "exterior" ? 1.4 : 0.6 + lvRef.current * (WALL_H * MM), cz);
    const off = m === "exterior" ? new THREE.Vector3(size * 0.9, size * 0.5 + 2 + (dRef.current.levels || 1) * 1.5, size * 1.25 + 3) : new THREE.Vector3(size * 0.75, size * 0.85 + 1.5, size * 0.95 + 1);
    s.oc.target.copy(tgt);
    s.persp.position.copy(tgt).add(off);
    s.homeDist = off.length();
    s.oc.update();
  }, []);
  useEffect(() => {
    const s = S.current;
    if (!s.scene) return;
    s.mode = mode;
    s.scene.background.set(mode === "exterior" ? 0xdbe9f6 : 0xf1f3f6);
    s.grid.visible = mode === "interior";
    s.furn.visible = mode === "interior";
    s.renderer.domElement.style.visibility = mode === "plan" ? "hidden" : "visible";
    if (mode !== "plan") aimCamera(mode);
    setMenu(null); setMatOpen(false);
  }, [mode, aimCamera]);

  /* ---------- walk mode ---------- */
  useEffect(() => {
    const s = S.current;
    if (!s.scene) return;
    const on = walk && mode === "interior";
    s.walk = on;
    if (on) {
      const r = selRoom ? { x: selRoom.x + selRoom.w / 2, z: selRoom.z + selRoom.d / 2 } : (() => { const b = bboxOf(dRef.current); return { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 }; })();
      s.persp.position.set(r.x * MM, 1.6 + lvRef.current * WALL_H * MM, r.z * MM);
      s.oc.target.set(r.x * MM, 1.6 + lvRef.current * WALL_H * MM, r.z * MM - 0.05);
      s.oc.minDistance = 0.01; s.oc.maxPolarAngle = Math.PI * 0.97; s.oc.enablePan = false; s.oc.enableZoom = false; s.oc.rotateSpeed = -0.4;
      s.persp.fov = 70;
      setCut("full");
    } else {
      s.oc.minDistance = 1.2; s.oc.maxPolarAngle = Math.PI / 2 - 0.03; s.oc.enablePan = true; s.oc.enableZoom = true; s.oc.rotateSpeed = 1;
      s.persp.fov = 42;
      if (mode === "interior" && walk === false && s.wasWalking) aimCamera("interior");
    }
    s.wasWalking = on;
    s.persp.updateProjectionMatrix();
    s.oc.update();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walk, mode]);

  /* ---------- time of day ---------- */
  useEffect(() => {
    const s = S.current;
    if (!s.scene) return;
    const a = Math.max(0.03, Math.min(Math.PI - 0.03, ((hour - 6) / 12) * Math.PI));
    const day = hour < 6 || hour > 18 ? 0 : Math.sin(a);
    const bb = bboxOf(dRef.current), size = Math.max((bb.x1 - bb.x0) * MM, (bb.z1 - bb.z0) * MM, 4), R = size * 1.6 + 8;
    const cx = ((bb.x0 + bb.x1) / 2) * MM, cz = ((bb.z0 + bb.z1) / 2) * MM;
    s.dir.position.set(cx - Math.cos(a) * R, Math.sin(a) * R * 0.85 + 1.5, cz + R * 0.35);
    s.dir.target.position.set(cx, 0, cz);
    s.dir.intensity = 0.12 + 1.6 * day;
    s.dir.color.copy(new THREE.Color(0xffa860).lerp(new THREE.Color(0xffffff), Math.min(1, day * 2.2)));
    s.hemi.intensity = 0.3 + 0.7 * day;
    if (mode === "exterior") s.scene.background.copy(new THREE.Color(0x1a2233).lerp(new THREE.Color(0xdbe9f6), Math.min(1, day * 1.6)));
  }, [hour, mode, D.walls, D.rooms]);

  /* ---------- furniture sync ---------- */
  useEffect(() => {
    const s = S.current;
    if (!s.scene) return;
    const seen = new Set();
    D.items.forEach((it) => {
      seen.add(it.id);
      const c = CAT[it.type];
      if (!c) return;
      const v = c.variants[it.variant] || c.variants[0], sig = it.type + ":" + it.variant;
      let g = s.groups.get(it.id);
      if (g && g.userData.sig !== sig) { if (s.tc.object === g) s.tc.detach(); s.furn.remove(g); s.groups.delete(it.id); g = null; }
      if (!g) { g = buildModel(it.type, it.variant); g.userData = { id: it.id, sig }; s.furn.add(g); s.groups.set(it.id, g); }
      paint(g, v, it.color);
      g.userData.level = it.lv || 0;
      g.position.set(it.x * MM, (it.elev + (it.lv || 0) * WALL_H) * MM, it.z * MM);
      g.rotation.y = (it.rot * Math.PI) / 180;
      g.scale.set((it.mirror ? -1 : 1) * it.size.L * MM, it.size.H * MM, it.size.W * MM);
      g.visible = !it.hidden && (it.lv || 0) <= lv;
    });
    s.groups.forEach((g, id) => { if (!seen.has(id)) { if (s.tc.object === g) s.tc.detach(); s.furn.remove(g); s.groups.delete(id); } });
    const it = D.items.find((i) => i.id === selId), g = it && s.groups.get(it.id);
    s.boxTarget = g && !it.hidden && mode === "interior" ? g : null;
    if (g && !it.hidden && !it.locked && mode === "interior") { if (s.tc.object !== g) s.tc.attach(g); } else if (s.tc.object) s.tc.detach();
  }, [D.items, selId, mode, lv]);

  useEffect(() => { if (lv >= nL) setLv(nL - 1); }, [nL, lv]);
  useEffect(() => { setSelection(null); }, [lv]);
  useEffect(() => { if (mode === "interior" && !walk) aimCamera("interior"); /* eslint-disable-next-line */ }, [lv]);

  useEffect(() => { const tc = S.current.tc; if (!tc) return; tc.setMode(tool); tc.showX = tool === "translate"; tc.showY = tool === "rotate"; tc.showZ = tool === "translate"; }, [tool, selId]);
  useEffect(() => { setMatOpen(false); setReplaceOpen(false); }, [selection]);
  useEffect(() => {
    if (!selection) return;
    const lists = { item: D.items, room: D.rooms, wall: D.walls, op: D.openings, dim: D.dims || [] };
    if (!(lists[selection.kind] || []).some((x) => x.id === selection.id)) setSelection(null);
  }, [D, selection]);
  useEffect(() => {
    const s = S.current;
    if (!s.scene) return;
    s.renderer.shadowMap.enabled = live; s.dir.castShadow = live;
    s.renderer.toneMapping = live ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
    s.scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
  }, [live]);

  /* ---------- plan sizing / fit ---------- */
  useEffect(() => {
    const el = planWrap.current;
    if (!el) return;
    const upd = () => setPSize({ w: el.clientWidth || 800, h: el.clientHeight || 600 });
    upd();
    const ro = new ResizeObserver(upd);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const fitPlan = useCallback(() => {
    const el = planWrap.current, W = (el && el.clientWidth) || pSize.w, Hh = (el && el.clientHeight) || pSize.h;
    const bb = bboxOf(dRef.current), w = Math.max(bb.x1 - bb.x0, 3000), h = Math.max(bb.z1 - bb.z0, 3000);
    const mx = Math.min(200, W * 0.1), my = Math.min(220, Hh * 0.22);
    const k = Math.min((W - mx) / w, (Hh - my) / h, 0.3);
    setPv({ k, tx: W / 2 - ((bb.x0 + bb.x1) / 2) * k, ty: Hh / 2 - ((bb.z0 + bb.z1) / 2) * k + 16 });
  }, [pSize]);
  useEffect(() => { if (mode === "plan") fitPlan(); /* eslint-disable-next-line */ }, [mode, pSize.w > pSize.h]);

  /* ---------- zoom helpers ---------- */
  const zoomBy = (f) => {
    if (mode === "plan") {
      setPv((p) => { const k = Math.min(1.2, Math.max(0.02, p.k / f)); const cx = (pSize.w / 2 - p.tx) / p.k, cz = (pSize.h / 2 - p.ty) / p.k; return { k, tx: pSize.w / 2 - cx * k, ty: pSize.h / 2 - cz * k }; });
    } else { const s = S.current; s.persp.position.sub(s.oc.target).multiplyScalar(f).add(s.oc.target); s.oc.update(); }
  };
  const fit = () => (mode === "plan" ? fitPlan() : aimCamera(mode));
  const zoomBox = (b) => {
    const s = S.current, c = b.getCenter(new THREE.Vector3()), sz = b.getSize(new THREE.Vector3());
    const dv = s.persp.position.clone().sub(s.oc.target).normalize();
    s.oc.target.copy(c); s.persp.position.copy(c).addScaledVector(dv, Math.max(sz.x, sz.y, sz.z) * 2.2 + 1.5); s.oc.update();
  };
  const zoomSelection = (id) => { const g = S.current.groups.get(id); if (g) zoomBox(new THREE.Box3().setFromObject(g)); };
  const focusRoom = (r) => {
    setSelection({ kind: "room", id: r.id });
    if (mode === "interior") zoomBox(new THREE.Box3(new THREE.Vector3(r.x * MM, 0, r.z * MM), new THREE.Vector3((r.x + r.w) * MM, 1.2, (r.z + r.d) * MM)));
  };

  /* ---------- keyboard ---------- */
  const save = () => { try { window.localStorage.setItem(STORE_KEY, JSON.stringify(dRef.current)); flash("Design saved"); } catch (e) { flash("Could not save in this browser"); } };
  useEffect(() => {
    const onKey = (e) => {
      if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
      if (mod && k === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if (mod && k === "y") { e.preventDefault(); redo(); }
      else if (mod && k === "s") { e.preventDefault(); save(); }
      else if (mod && k === "c" && selId) { e.preventDefault(); duplicate(selId); }
      else if ((e.key === "Delete" || e.key === "Backspace") && selection) deleteSelection();
      else if (e.key === "Escape") { setSelection(null); setMenu(null); setDraft(null); setPtool("select"); setWalk(false); }
      else if (mode === "plan") { const m = { v: "select", r: "room", w: "wall", d: "door", n: "window", m: "measure", p: "poly" }[k]; if (m && !mod) { setPtool(m); setDraft(null); } }
      else if (k === "g") setTool("translate");
      else if (k === "r") setTool("rotate");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, selId, mode, undo, redo, duplicate, deleteSelection]);

  /* ---------- file actions ---------- */
  const exportJson = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(dRef.current, null, 2)], { type: "application/json" }));
    a.download = "builder3d-house.json"; a.click(); URL.revokeObjectURL(a.href); setFileOpen(false);
  };
  const importJson = (file) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        if (d && d.rooms && d.walls) { snapshot(); setD(normalizeD(d)); setSelection(null); flash("Design imported"); } else flash("That file is not a Builder3D design");
      } catch (e) { flash("That file is not a Builder3D design"); }
    };
    r.readAsText(file); setFileOpen(false);
  };

  /* ---------- exports / imports / views ---------- */
  const exportPng = () => {
    const s = S.current;
    if (mode === "plan") { flash("Open Interior or Exterior to render an image"); return; }
    s.renderer.render(s.scene, s.persp);
    download(s.renderer.domElement.toDataURL("image/png"), "builder3d-" + mode + ".png");
    setFileOpen(false);
  };
  const exportSvg = () => {
    const el = svgRef.current;
    if (mode !== "plan" || !el) { flash("Open the Floor plan to export it"); return; }
    const bb = bboxOf(dRef.current), pad = 1200, w = bb.x1 - bb.x0 + pad * 2, h = bb.z1 - bb.z0 + pad * 2;
    const clone = el.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("viewBox", bb.x0 - pad + " " + (bb.z0 - pad) + " " + w + " " + h);
    clone.setAttribute("width", 1600); clone.setAttribute("height", Math.round((1600 * h) / w));
    clone.removeAttribute("class"); clone.removeAttribute("style");
    const g = clone.querySelector("g");
    if (g) g.setAttribute("transform", "");
    download(URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml" })), "builder3d-floor-plan.svg");
    setFileOpen(false);
  };
  const exportGlb = () => {
    const s = S.current;
    if (mode === "plan") { flash("Open Interior or Exterior to export the 3D model"); return; }
    const objs = [s.struct, s.furn, s.ext].filter(Boolean);
    new GLTFExporter().parse(objs, (res) => {
      const bin = res instanceof ArrayBuffer;
      download(URL.createObjectURL(new Blob([bin ? res : JSON.stringify(res)], { type: bin ? "model/gltf-binary" : "model/gltf+json" })), "builder3d-house." + (bin ? "glb" : "gltf"));
    }, () => flash("Export failed"), { binary: true, onlyVisible: false });
    setFileOpen(false);
  };
  const exportCsv = () => {
    const est = estimate(dRef.current);
    const rows = [["Item", "Qty", "Unit", "Rate", "Total"], ...est.lines.map((l) => [l.label, l.qty, l.unit, l.price, l.total]), ["Total", "", "", "", est.total]];
    const csv = rows.map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(",")).join("\n");
    download(URL.createObjectURL(new Blob([csv], { type: "text/csv" })), "builder3d-estimate.csv");
    setFileOpen(false);
  };
  const importGlb = (file) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    new GLTFLoader().load(url, (gltf) => {
      URL.revokeObjectURL(url);
      const model = gltf.scene, bb = new THREE.Box3().setFromObject(model), sz = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
      const maxd = Math.max(sz.x, sz.y, sz.z) || 1, unit = maxd > 50 ? 0.001 : maxd > 6 ? 0.01 : 1;
      const wrap = new THREE.Group();
      model.position.set(-c.x, -bb.min.y, -c.z);
      wrap.add(model);
      wrap.scale.set(1 / (sz.x || 1), 1 / (sz.y || 1), 1 / (sz.z || 1));
      const type = "glb_" + uid("");
      const entry = { type, name: file.name.replace(/\.[^.]+$/, ""), rooms: ["decor"], size: [Math.round(sz.x * unit * 1000), Math.round(sz.z * unit * 1000), Math.round(sz.y * unit * 1000)], variants: [V("Original", "#ffffff")] };
      BUILD[type] = (g) => { const m = wrap.clone(true); m.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; }); g.add(m); };
      CATALOG.push(entry); CAT[type] = entry;
      setCat("decor");
      addItem(type);
      flash("Model imported for this session");
    }, undefined, () => { URL.revokeObjectURL(url); flash("Could not read that model"); });
    setFileOpen(false);
  };
  const importTrace = (file) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => { const bb = bboxOf(dRef.current); setTrace({ src: r.result, x: bb.empty ? 0 : bb.x0, z: bb.empty ? 0 : bb.z0, w: Math.max(8000, bb.empty ? 0 : bb.x1 - bb.x0), ar: img.height / img.width, opacity: 0.5 }); setMode("plan"); };
      img.src = r.result;
    };
    r.readAsDataURL(file);
    setFileOpen(false);
  };
  const saveView = () => {
    if (mode === "plan") return;
    const s = S.current;
    const v = { id: uid("v"), name: "View " + ((dRef.current.views || []).length + 1), mode, pos: s.persp.position.toArray(), target: s.oc.target.toArray() };
    commit((d) => ({ ...d, views: [...(d.views || []), v] }));
    flash("View saved");
  };
  const gotoView = (v) => {
    setWalk(false);
    if (v.mode !== mode) setMode(v.mode);
    setTimeout(() => { const s = S.current; s.persp.position.fromArray(v.pos); s.oc.target.fromArray(v.target); s.oc.update(); }, 90);
  };

  /* ---------- drag & drop from library ---------- */
  const onDrop = (e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("text/plain");
    if (!CAT[type]) return;
    if (mode === "plan") {
      const r = svgRef.current.getBoundingClientRect();
      addItem(type, { x: sn((e.clientX - r.left - pv.tx) / pv.k, 50), z: sn((e.clientY - r.top - pv.ty) / pv.k, 50) });
    } else if (mode === "interior") {
      const s = S.current, r = s.renderer.domElement.getBoundingClientRect(), ray = new THREE.Raycaster(), p = new THREE.Vector3();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), s.persp);
      if (ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p)) addItem(type, { x: p.x / MM, z: p.z / MM }); else addItem(type);
    }
  };

  /* ================================================================ */
  /* Floor plan interaction                                            */
  /* ================================================================ */
  const toWorld = (e) => { const r = svgRef.current.getBoundingClientRect(); return { x: (e.clientX - r.left - pv.tx) / pv.k, z: (e.clientY - r.top - pv.ty) / pv.k }; };
  const snapPt = (p) => {
    const tol = (14 * tapR) / pv.k;
    let best = null;
    dRef.current.walls.filter((w) => (w.lv || 0) === lvRef.current).forEach((w) => [w.a, w.b].forEach(([x, z]) => { const d = Math.hypot(p.x - x, p.z - z); if (d < tol && (!best || d < best.d)) best = { d, x, z }; }));
    return best ? { x: best.x, z: best.z } : { x: sn(p.x, 100), z: sn(p.z, 100) };
  };
  const nearestWall = (p) => {
    let best = null;
    dRef.current.walls.filter((w) => (w.lv || 0) === lvRef.current).forEach((w) => {
      const dx = w.b[0] - w.a[0], dz = w.b[1] - w.a[1], L2 = dx * dx + dz * dz;
      if (L2 < 1) return;
      const t = Math.max(0, Math.min(1, ((p.x - w.a[0]) * dx + (p.z - w.a[1]) * dz) / L2));
      const dist = Math.hypot(p.x - (w.a[0] + dx * t), p.z - (w.a[1] + dz * t));
      if (dist < Math.max(260, (14 * tapR) / pv.k) && (!best || dist < best.dist)) best = { w, t, dist, L: Math.sqrt(L2) };
    });
    return best;
  };
  const opSpec = { door: { type: "door", width: 900, h: 2100, sill: 0, color: "#a9835b" }, window: { type: "window", width: 1500, h: 1200, sill: 900 } };
  const ghostOf = (b, kind) => { const sp = opSpec[kind], half = sp.width / 2 / b.L; return { wallId: b.w.id, pos: Math.max(half, Math.min(1 - half, b.t)), ...sp }; };

  const begin = (e, d) => { e.stopPropagation(); svgRef.current.setPointerCapture(e.pointerId); drag.current = { ...d, sx: e.clientX, sy: e.clientY, snap: false }; };
  const onPDown = (e) => {
    svgRef.current.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      drag.current = { kind: "pinch", d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, k0: pv.k, tx: pv.tx, ty: pv.ty, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      setDraft(null);
      return;
    }
    if (e.button === 1 || e.button === 2) { drag.current = { kind: "pan", sx: e.clientX, sy: e.clientY, tx: pv.tx, ty: pv.ty }; return; }
    const p = toWorld(e);
    if (ptool === "poly") {
      const pt = snapPt(p);
      if (draft && draft.kind === "poly") {
        const first = draft.pts[0];
        if (draft.pts.length >= 3 && Math.hypot(pt.x - first.x, pt.z - first.z) < (14 * tapR) / pv.k + 1) { finishPoly(draft.pts); return; }
        if (Math.hypot(pt.x - draft.cur.x, pt.z - draft.cur.z) < 50 && draft.pts.length > 1) return;
        setDraft({ kind: "poly", pts: [...draft.pts, pt], cur: pt });
      } else setDraft({ kind: "poly", pts: [pt], cur: pt });
      return;
    }
    if (ptool === "measure") {
      const pt = snapPt(p);
      if (draft && draft.kind === "measure") {
        if (Math.hypot(pt.x - draft.a.x, pt.z - draft.a.z) > 50) commit((d) => ({ ...d, dims: [...(d.dims || []), { id: uid("m"), lv: lvRef.current, a: [draft.a.x, draft.a.z], b: [pt.x, pt.z] }] }));
        setDraft(null);
      } else setDraft({ kind: "measure", a: pt, b: pt });
      return;
    }
    if (ptool === "room") { const a = snapPt(p); drag.current = { kind: "rdraw", a }; setDraft({ kind: "room", a, b: a }); return; }
    if (ptool === "wall") {
      let pt = snapPt(p);
      if (draft && draft.kind === "wall") {
        const last = draft.pts[0];
        if (Math.abs(pt.x - last.x) < 150) pt = { ...pt, x: last.x };
        if (Math.abs(pt.z - last.z) < 150) pt = { ...pt, z: last.z };
        if (Math.hypot(pt.x - last.x, pt.z - last.z) < 80) return;
        const at = pt;
        commit((d) => ({ ...d, walls: [...d.walls, { id: uid("w"), lv: lvRef.current, a: [last.x, last.z], b: [at.x, at.z], t: 150 }] }));
      }
      setDraft({ kind: "wall", pts: [pt], cur: pt });
      return;
    }
    if (ptool === "door" || ptool === "window") {
      const b = nearestWall(p);
      if (b) { const g = ghostOf(b, ptool), o = { id: uid("o"), ...g, lv: b.w.lv || 0 }; commit((d) => ({ ...d, openings: [...d.openings, o] })); setSelection({ kind: "op", id: o.id }); setPtool("select"); }
      return;
    }
    drag.current = { kind: "bg", sx: e.clientX, sy: e.clientY, tx: pv.tx, ty: pv.ty, moved: false };
  };
  const onPMove = (e) => {
    const dr = drag.current;
    const p = toWorld(e);
    const ensure = () => { if (!dr.snap) { snapshot(); dr.snap = true; } };
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (dr && dr.kind === "pinch" && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()], r = svgRef.current.getBoundingClientRect();
      const k = Math.min(1.2, Math.max(0.02, dr.k0 * (Math.hypot(a.x - b.x, a.y - b.y) / dr.d0)));
      const wx = (dr.mx - r.left - dr.tx) / dr.k0, wz = (dr.my - r.top - dr.ty) / dr.k0;
      setPv({ k, tx: (a.x + b.x) / 2 - r.left - wx * k, ty: (a.y + b.y) / 2 - r.top - wz * k });
      return;
    }
    if (!dr) {
      if (ptool === "wall" && draft && draft.kind === "wall") {
        let c = snapPt(p); const l = draft.pts[0];
        if (Math.abs(c.x - l.x) < 150) c = { ...c, x: l.x }; if (Math.abs(c.z - l.z) < 150) c = { ...c, z: l.z };
        setDraft({ ...draft, cur: c });
      } else if (ptool === "poly" && draft && draft.kind === "poly") { setDraft({ ...draft, cur: snapPt(p) });
      } else if (ptool === "measure" && draft && draft.kind === "measure") { setDraft({ ...draft, b: snapPt(p) });
      } else if (ptool === "door" || ptool === "window") { const b = nearestWall(p); setHover(b ? ghostOf(b, ptool) : null); }
      return;
    }
    switch (dr.kind) {
      case "pan": setPv((v) => ({ ...v, tx: dr.tx + e.clientX - dr.sx, ty: dr.ty + e.clientY - dr.sy })); break;
      case "bg": if (dr.moved || Math.hypot(e.clientX - dr.sx, e.clientY - dr.sy) > 4) { dr.moved = true; setPv((v) => ({ ...v, tx: dr.tx + e.clientX - dr.sx, ty: dr.ty + e.clientY - dr.sy })); } break;
      case "rdraw": setDraft({ kind: "room", a: dr.a, b: snapPt(p) }); break;
      case "item": {
        ensure();
        const cur = dRef.current.items.find((i) => i.id === dr.id);
        if (!cur) break;
        let q = { x: sn(dr.ox + p.x - dr.p0.x, 50), z: sn(dr.oz + p.z - dr.p0.z, 50) };
        if (!e.altKey) q = snapToWalls({ ...cur, ...q }, dRef.current.walls);
        patchItem(dr.id, q);
        break;
      }
      case "room": ensure(); rectPatch(dr.id, { x: sn(dr.r0.x + p.x - dr.p0.x, 100), z: sn(dr.r0.z + p.z - dr.p0.z, 100) }); break;
      case "rvert": ensure(); moveVertex(dr.id, dr.idx, snapPt(p)); break;
      case "wall": ensure(); { const dx = sn(p.x - dr.p0.x, 100), dz = sn(p.z - dr.p0.z, 100); patchWall(dr.id, { a: [dr.a0[0] + dx, dr.a0[1] + dz], b: [dr.b0[0] + dx, dr.b0[1] + dz] }); } break;
      case "wend": ensure(); { const c = snapPt(p); patchWall(dr.id, { [dr.end]: [c.x, c.z] }); } break;
      case "op": ensure(); {
        const w = wallById[dr.wallId], o = dRef.current.openings.find((q) => q.id === dr.id);
        if (!w || !o) break;
        const dx = w.b[0] - w.a[0], dz = w.b[1] - w.a[1], L = Math.hypot(dx, dz), half = o.width / 2 / L;
        patchOp(dr.id, { pos: Math.max(half, Math.min(1 - half, ((p.x - w.a[0]) * dx + (p.z - w.a[1]) * dz) / (L * L))) });
      } break;
      default:
    }
  };
  const onPUp = (e) => {
    pointers.current.delete(e.pointerId);
    const dr = drag.current;
    drag.current = null;
    try { svgRef.current.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    if (!dr) return;
    if (dr.kind === "bg" && !dr.moved) setSelection(null);
    if (dr.kind === "rdraw") {
      const d = draft;
      setDraft(null);
      if (d) {
        const x = Math.min(d.a.x, d.b.x), z = Math.min(d.a.z, d.b.z), w = Math.abs(d.a.x - d.b.x), h = Math.abs(d.a.z - d.b.z);
        if (w >= 1000 && h >= 1000) { addRoom(x, z, w, h, rtype); setPtool("select"); }
      }
    }
  };
  const onWheel = (e) => {
    const r = svgRef.current.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, f = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    setPv((p) => { const k = Math.min(1.2, Math.max(0.02, p.k * f)), wx = (mx - p.tx) / p.k, wz = (my - p.ty) / p.k; return { k, tx: mx - wx * k, ty: my - wz * k }; });
  };
  const finishWall = () => { if (draft && draft.kind === "wall") setDraft(null); else if (draft && draft.kind === "poly") finishPoly(draft.pts); };

  /* ---------- derived ---------- */
  const favTypes = useMemo(() => new Set(D.items.filter((i) => i.fav).map((i) => i.type)), [D.items]);
  const list = CATALOG.filter((c) => {
    if (query && !c.name.toLowerCase().includes(query.toLowerCase())) return false;
    if (cat === "popular") return true;
    if (cat === "fav") return favTypes.has(c.type);
    return c.rooms.includes(cat);
  });
  const menuItem = menu && D.items.find((i) => i.id === menu.id);
  const totalArea = D.rooms.reduce((a, r) => a + (r.type === "void" ? 0 : roomArea(r)), 0);
  const doors = D.openings.filter((o) => o.type === "door").length;
  const windows = D.openings.length - doors;
  const fs = 13 / pv.k;
  const hasBuilding = D.walls.length > 0;
  const clash = useMemo(() => overlapIds(D.items), [D.items]);
  const LD = useMemo(() => { const f = (a) => (a || []).filter((e) => (e.lv || 0) === lv); return { rooms: f(D.rooms), walls: f(D.walls), openings: f(D.openings), items: f(D.items), dims: f(D.dims) }; }, [D, lv]);
  const below = useMemo(() => (lv > 0 ? { rooms: D.rooms.filter((r) => (r.lv || 0) === lv - 1), walls: D.walls.filter((w) => (w.lv || 0) === lv - 1) } : null), [D, lv]);

  /* ---------- plan rendering ---------- */
  const planSvg = () => {
    const k = pv.k;
    const opDraw = (o, w, ghost) => {
      const dx = w.b[0] - w.a[0], dz = w.b[1] - w.a[1], L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L, nx = -uz, nz = ux;
      const cx = w.a[0] + dx * o.pos, cz = w.a[1] + dz * o.pos, hw = o.width / 2;
      const p1 = [cx - ux * hw, cz - uz * hw], p2 = [cx + ux * hw, cz + uz * hw], t = w.t;
      const isSel = selOp && selOp.id === o.id;
      return (
        <g key={o.id || "ghost"} opacity={ghost ? 0.7 : 1} style={ghost ? { pointerEvents: "none" } : undefined}
          onPointerDown={(e) => { if (ptool !== "select" || ghost) return; setSelection({ kind: "op", id: o.id }); begin(e, { kind: "op", id: o.id, wallId: o.wallId }); }}>
          <line x1={p1[0]} y1={p1[1]} x2={p2[0]} y2={p2[1]} stroke="#fff" strokeWidth={t + 10} />
          {o.type === "door" ? (
            <>
              <line x1={p1[0]} y1={p1[1]} x2={p1[0] + nx * o.width} y2={p1[1] + nz * o.width} stroke="#374151" strokeWidth={30} />
              <path d={`M ${p1[0] + nx * o.width} ${p1[1] + nz * o.width} A ${o.width} ${o.width} 0 0 0 ${p2[0]} ${p2[1]}`} fill="none" stroke="#6b7280" strokeWidth={14} />
            </>
          ) : (
            <>
              <line x1={p1[0]} y1={p1[1]} x2={p2[0]} y2={p2[1]} stroke="#374151" strokeWidth={t * 0.9} />
              <line x1={p1[0]} y1={p1[1]} x2={p2[0]} y2={p2[1]} stroke="#cfe6f2" strokeWidth={t * 0.45} />
            </>
          )}
          <line x1={p1[0]} y1={p1[1]} x2={p2[0]} y2={p2[1]} stroke="transparent" strokeWidth={Math.max(t + 80, (14 * tapR) / k)} />
          {isSel && <circle cx={cx} cy={cz} r={9 / k} fill="none" stroke="#2d6cdf" strokeWidth={2 / k} />}
        </g>
      );
    };
    return (
      <svg ref={svgRef} className="b3d-plansvg" style={{ cursor: ptool === "select" ? "default" : "crosshair" }}
        onPointerDown={onPDown} onPointerMove={onPMove} onPointerUp={onPUp} onPointerCancel={onPUp} onWheel={onWheel} onDoubleClick={finishWall} onContextMenu={(e) => { e.preventDefault(); finishWall(); }}>
        <defs>
          <pattern id="b3dgrid" width="500" height="500" patternUnits="userSpaceOnUse"><path d="M500 0H0V500" fill="none" stroke="#e3e6ea" strokeWidth="1" vectorEffect="non-scaling-stroke" /></pattern>
          <pattern id="b3dgrid2" width="2500" height="2500" patternUnits="userSpaceOnUse"><path d="M2500 0H0V2500" fill="none" stroke="#cfd4da" strokeWidth="1" vectorEffect="non-scaling-stroke" /></pattern>
        </defs>
        <g transform={`translate(${pv.tx} ${pv.ty}) scale(${k})`}>
          <rect x={-60000} y={-60000} width={120000} height={120000} fill="#fff" />
          <rect x={-60000} y={-60000} width={120000} height={120000} fill="url(#b3dgrid)" />
          <rect x={-60000} y={-60000} width={120000} height={120000} fill="url(#b3dgrid2)" />
          {trace && <image href={trace.src} x={trace.x} y={trace.z} width={trace.w} height={trace.w * trace.ar} opacity={trace.opacity} preserveAspectRatio="none" style={{ pointerEvents: "none" }} />}

          {below && (
            <g style={{ pointerEvents: "none" }} opacity={0.4}>
              {below.rooms.map((r) => <polygon key={r.id} points={r.poly.map((q) => q.join(",")).join(" ")} fill="none" stroke="#9aa3af" strokeWidth={2 / k} strokeDasharray={(6 / k) + " " + (4 / k)} />)}
              {below.walls.map((w) => <line key={w.id} x1={w.a[0]} y1={w.a[1]} x2={w.b[0]} y2={w.b[1]} stroke="#c3c9d1" strokeWidth={w.t} />)}
            </g>
          )}
          {LD.rooms.map((r) => {
            const t = ROOM_TYPES[r.type], isSel = selRoom && selRoom.id === r.id, c = polyCentroid(r.poly), rect = isRectRoom(r);
            return (
              <g key={r.id} onPointerDown={(e) => { if (ptool !== "select") return; setSelection({ kind: "room", id: r.id }); begin(e, { kind: "room", id: r.id, r0: { x: r.x, z: r.z }, p0: toWorld(e) }); }}>
                <polygon points={r.poly.map((q) => q.join(",")).join(" ")} fill={t.fill} stroke={isSel ? "#2d6cdf" : r.type === "void" ? "#9aa3af" : "none"} strokeWidth={isSel ? 6 / k : 2 / k} strokeDasharray={r.type === "void" && !isSel ? (6 / k) + " " + (4 / k) : undefined} />
                <g style={{ pointerEvents: "none", userSelect: "none" }} fontSize={fs} textAnchor="middle" fill="#4b5563">
                  <text x={c.x} y={c.z - fs * 0.2} fontWeight="600" fill="#1f2937">{r.name}</text>
                  <text x={c.x} y={c.z + fs * 1.2} fontSize={fs * 0.9}>{r.type === "void" ? "open to below" : roomArea(r).toFixed(1) + " m²"}</text>
                  {rect && <text x={r.x + r.w / 2} y={r.z + r.d - fs * 0.7} fontSize={fs * 0.85} fill="#7b8491">{Math.round(r.w)}</text>}
                  {rect && <text x={r.x + fs * 0.9} y={r.z + r.d / 2} fontSize={fs * 0.85} fill="#7b8491" transform={`rotate(-90 ${r.x + fs * 0.9} ${r.z + r.d / 2})`}>{Math.round(r.d)}</text>}
                  {isSel && !rect && r.poly.map((q, i) => { const n = r.poly[(i + 1) % r.poly.length]; return <text key={i} x={(q[0] + n[0]) / 2} y={(q[1] + n[1]) / 2 - fs * 0.5} fontSize={fs * 0.85} fill="#2d6cdf">{Math.round(Math.hypot(n[0] - q[0], n[1] - q[1]))}</text>; })}
                </g>
              </g>
            );
          })}

          {[...LD.items].sort((a, b) => (a.type === "rug" ? -1 : 0) - (b.type === "rug" ? -1 : 0)).map((it) => (
            <g key={it.id} transform={`translate(${it.x} ${it.z}) rotate(${-it.rot})`} opacity={it.hidden ? 0.25 : 1}
              onPointerDown={(e) => { if (ptool !== "select") return; setSelId(it.id); begin(e, { kind: "item", id: it.id, ox: it.x, oz: it.z, p0: toWorld(e) }); }} style={{ cursor: "move" }}>
              <rect x={-it.size.L / 2} y={-it.size.W / 2} width={it.size.L} height={it.size.W} rx={30}
                fill={it.id === selId ? "#cfe0ff" : it.type === "rug" ? "#ece6dc" : "#fff"} fillOpacity={it.type === "rug" ? 0.8 : 0.95}
                stroke={it.id === selId ? "#2d6cdf" : clash.has(it.id) ? "#e5484d" : "#7b8491"} strokeWidth={it.id === selId || clash.has(it.id) ? 4 / k : 1.5 / k} />
              <line x1={-it.size.L / 2} y1={it.size.W / 2 - 40} x2={it.size.L / 2} y2={it.size.W / 2 - 40} stroke={it.id === selId ? "#2d6cdf" : "#9aa3af"} strokeWidth={1.5 / k} />
            </g>
          ))}

          {LD.walls.map((w) => (
            <g key={w.id} onPointerDown={(e) => { if (ptool !== "select") return; setSelection({ kind: "wall", id: w.id }); begin(e, { kind: "wall", id: w.id, a0: w.a, b0: w.b, p0: toWorld(e) }); }}>
              <line x1={w.a[0]} y1={w.a[1]} x2={w.b[0]} y2={w.b[1]} stroke={selWall && selWall.id === w.id ? "#2d6cdf" : "#374151"} strokeWidth={w.t} strokeLinecap="square" />
              <line x1={w.a[0]} y1={w.a[1]} x2={w.b[0]} y2={w.b[1]} stroke="transparent" strokeWidth={Math.max(w.t + 60, (12 * tapR) / k)} />
            </g>
          ))}
          {LD.openings.map((o) => (wallById[o.wallId] ? opDraw(o, wallById[o.wallId], false) : null))}
          {LD.dims.map((m) => {
            const dx = m.b[0] - m.a[0], dz = m.b[1] - m.a[1], L = Math.hypot(dx, dz) || 1, nx = (-dz / L) * (8 / k), nz = (dx / L) * (8 / k);
            const on = selDim && selDim.id === m.id, col = on ? "#2d6cdf" : "#0f766e";
            return (
              <g key={m.id} onPointerDown={(e) => { if (ptool !== "select") return; e.stopPropagation(); setSelection({ kind: "dim", id: m.id }); }} style={{ cursor: "pointer" }}>
                <line x1={m.a[0]} y1={m.a[1]} x2={m.b[0]} y2={m.b[1]} stroke={col} strokeWidth={2 / k} />
                <line x1={m.a[0] - nx} y1={m.a[1] - nz} x2={m.a[0] + nx} y2={m.a[1] + nz} stroke={col} strokeWidth={2 / k} />
                <line x1={m.b[0] - nx} y1={m.b[1] - nz} x2={m.b[0] + nx} y2={m.b[1] + nz} stroke={col} strokeWidth={2 / k} />
                <line x1={m.a[0]} y1={m.a[1]} x2={m.b[0]} y2={m.b[1]} stroke="transparent" strokeWidth={14 / k} />
                <text x={(m.a[0] + m.b[0]) / 2} y={(m.a[1] + m.b[1]) / 2 - fs * 0.7} fontSize={fs} textAnchor="middle" fill={col} style={{ pointerEvents: "none", userSelect: "none" }}>{Math.round(L)} mm</text>
              </g>
            );
          })}
          {hover && (ptool === "door" || ptool === "window") && wallById[hover.wallId] && opDraw(hover, wallById[hover.wallId], true)}

          {selWall && (
            <g>
              {[["a", selWall.a], ["b", selWall.b]].map(([end, pt]) => (
                <circle key={end} cx={pt[0]} cy={pt[1]} r={(7 * tapR) / k} fill="#fff" stroke="#2d6cdf" strokeWidth={2 / k} style={{ cursor: "pointer" }}
                  onPointerDown={(e) => { begin(e, { kind: "wend", id: selWall.id, end }); }} />
              ))}
              <text x={(selWall.a[0] + selWall.b[0]) / 2} y={(selWall.a[1] + selWall.b[1]) / 2 - 130} fontSize={fs} textAnchor="middle" fill="#2d6cdf" style={{ pointerEvents: "none" }}>{Math.round(wallLen(selWall))} mm</text>
            </g>
          )}
          {selRoom && (selRoom.lv || 0) === lv && selRoom.poly.map((q, idx) => {
            const nx = selRoom.poly[(idx + 1) % selRoom.poly.length];
            return (
              <g key={idx}>
                <circle cx={(q[0] + nx[0]) / 2} cy={(q[1] + nx[1]) / 2} r={(5 * tapR) / k} fill="#2d6cdf" fillOpacity={0.25} stroke="#2d6cdf" strokeWidth={1.5 / k} style={{ cursor: "copy" }} onPointerDown={(e) => insertVertex(e, selRoom.id, idx)} />
                <circle cx={q[0]} cy={q[1]} r={(7 * tapR) / k} fill="#fff" stroke="#2d6cdf" strokeWidth={2 / k} style={{ cursor: "move" }} onPointerDown={(e) => {
                  const now = Date.now(), lt = lastTap.current;
                  if (lt.id === selRoom.id && lt.idx === idx && now - lt.t < 350) { e.stopPropagation(); lastTap.current = {}; removeVertex(selRoom.id, idx); return; }
                  lastTap.current = { id: selRoom.id, idx, t: now };
                  begin(e, { kind: "rvert", id: selRoom.id, idx });
                }} />
              </g>
            );
          })}

          {draft && draft.kind === "room" && (() => {
            const x = Math.min(draft.a.x, draft.b.x), z = Math.min(draft.a.z, draft.b.z), w = Math.abs(draft.a.x - draft.b.x), h = Math.abs(draft.a.z - draft.b.z);
            return (
              <g style={{ pointerEvents: "none" }}>
                <rect x={x} y={z} width={w} height={h} fill={ROOM_TYPES[rtype].fill} fillOpacity={0.7} stroke="#2d6cdf" strokeWidth={3 / k} strokeDasharray={`${8 / k} ${5 / k}`} />
                <text x={x + w / 2} y={z + h / 2} fontSize={fs} textAnchor="middle" fill="#2d6cdf">{w} × {h}</text>
              </g>
            );
          })()}
          {draft && draft.kind === "poly" && (
            <g style={{ pointerEvents: "none" }}>
              <polyline points={[...draft.pts, draft.cur].map((q) => q.x + "," + q.z).join(" ")} fill={ROOM_TYPES[rtype].fill} fillOpacity={0.6} stroke="#2d6cdf" strokeWidth={3 / k} strokeDasharray={(8 / k) + " " + (5 / k)} />
              {draft.pts.map((q, i) => <circle key={i} cx={q.x} cy={q.z} r={(i === 0 ? 8 : 5) / k} fill={i === 0 ? "#2d6cdf" : "#fff"} stroke="#2d6cdf" strokeWidth={2 / k} />)}
              <text x={(draft.pts[draft.pts.length - 1].x + draft.cur.x) / 2} y={(draft.pts[draft.pts.length - 1].z + draft.cur.z) / 2 - fs * 0.8} fontSize={fs} textAnchor="middle" fill="#2d6cdf">{Math.round(Math.hypot(draft.cur.x - draft.pts[draft.pts.length - 1].x, draft.cur.z - draft.pts[draft.pts.length - 1].z))} mm</text>
            </g>
          )}
          {draft && draft.kind === "measure" && (
            <g style={{ pointerEvents: "none" }}>
              <line x1={draft.a.x} y1={draft.a.z} x2={draft.b.x} y2={draft.b.z} stroke="#0f766e" strokeWidth={2 / k} strokeDasharray={(6 / k) + " " + (4 / k)} />
              <text x={(draft.a.x + draft.b.x) / 2} y={(draft.a.z + draft.b.z) / 2 - fs * 0.8} fontSize={fs} textAnchor="middle" fill="#0f766e">{Math.round(Math.hypot(draft.b.x - draft.a.x, draft.b.z - draft.a.z))} mm</text>
            </g>
          )}
          {draft && draft.kind === "wall" && (
            <g style={{ pointerEvents: "none" }}>
              <line x1={draft.pts[0].x} y1={draft.pts[0].z} x2={draft.cur.x} y2={draft.cur.z} stroke="#2d6cdf" strokeWidth={150} strokeOpacity={0.45} />
              <circle cx={draft.pts[0].x} cy={draft.pts[0].z} r={6 / k} fill="#2d6cdf" />
              <text x={(draft.pts[0].x + draft.cur.x) / 2} y={(draft.pts[0].z + draft.cur.z) / 2 - 170} fontSize={fs} textAnchor="middle" fill="#2d6cdf">{Math.round(Math.hypot(draft.cur.x - draft.pts[0].x, draft.cur.z - draft.pts[0].z))} mm</text>
            </g>
          )}
        </g>
      </svg>
    );
  };

  const hints = { select: coarse ? "Tap to select, drag to move. Pinch to zoom, drag empty space to pan." : "Click to select, drag to move. Drag a corner dot to reshape a room. Scroll to zoom.", room: "Drag on the plan to draw a room. It gets its own walls and floor.", wall: "Click to place wall points. Double-click or press Esc to finish.", door: "Click a wall to place a door.", window: "Click a wall to place a window.", poly: "Click corners for any shape. Click the first point or double-click to close it.", measure: "Click two points to add a dimension line. Snaps to wall ends. Esc cancels." };

  /* ================================================================ */
  return (
    <div ref={rootRef} className={rootCls} style={style} onClick={() => setFileOpen(false)}>
      <style>{CSS}</style>

      <header className="b3d-top">
        <div className="b3d-logo b3d-hide-sm">Builder3D</div>
        <div className="b3d-sep b3d-hide-sm" />
        <div className="b3d-menu">
          <button className="b3d-tb" onClick={(e) => { e.stopPropagation(); setFileOpen((o) => !o); }}><Ic n="file" /><span>File</span></button>
          {fileOpen && (
            <div className="b3d-drop" onClick={(e) => e.stopPropagation()}>
              <button onClick={exportPng}>Export render (PNG)</button>
              <button onClick={exportSvg}>Export floor plan (SVG)</button>
              <button onClick={exportGlb}>Export 3D model (GLB)</button>
              <button onClick={exportCsv}>Export estimate (CSV)</button>
              <button onClick={exportJson}>Save design file (.json)</button>
              <button onClick={() => glbInput.current && glbInput.current.click()}>Import furniture model (GLB)…</button>
              <button onClick={() => traceInput.current && traceInput.current.click()}>Trace over image…</button>
              <button onClick={() => fileInput.current && fileInput.current.click()}>Import design…</button>
              <button onClick={() => { snapshot(); setD(sampleHouse()); setSelection(null); setFileOpen(false); }}>Load sample house</button>
              <button onClick={() => { snapshot(); setD({ rooms: [], walls: [], openings: [], items: [], ext: defaultExt() }); setSelection(null); setFileOpen(false); setMode("plan"); }}>New empty plan</button>
              <button onClick={() => { setLive((v) => !v); setFileOpen(false); }}>{live ? "Turn live render off" : "Turn live render on"}</button>
              <button onClick={() => { setFileOpen(false); if ((D.items.length || D.walls.length) && window.confirm("Remove everything from this design?")) { commit(() => ({ rooms: [], walls: [], openings: [], items: [], ext: defaultExt() })); setSelection(null); } }}>Clear everything</button>
            </div>
          )}
          <input ref={fileInput} type="file" accept="application/json" hidden onChange={(e) => importJson(e.target.files[0])} />
          <input ref={glbInput} type="file" accept=".glb,.gltf,model/gltf-binary" hidden onChange={(e) => { importGlb(e.target.files[0]); e.target.value = ""; }} />
          <input ref={traceInput} type="file" accept="image/*" hidden onChange={(e) => { importTrace(e.target.files[0]); e.target.value = ""; }} />
        </div>
        <button className="b3d-tb" onClick={save}><Ic n="save" /><span>Save</span></button>
        <button className="b3d-tb" onClick={undo} disabled={!pastRef.current.length}><Ic n="undo" /><span>Undo</span></button>
        <button className="b3d-tb" onClick={redo} disabled={!futureRef.current.length}><Ic n="redo" /><span>Redo</span></button>
        <button className="b3d-tb b3d-hide-sm" onClick={() => { if ((D.items.length || D.walls.length) && window.confirm("Remove everything from this design?")) { commit(() => ({ rooms: [], walls: [], openings: [], items: [], ext: defaultExt() })); setSelection(null); } }}><Ic n="clear" /><span>Clear</span></button>
        <div className="b3d-grow" />
        <div className="b3d-modes" role="tablist" aria-label="Workspace">
          {[["plan", "Floor plan"], ["interior", "Interior"], ["exterior", "Exterior"]].map(([k, l]) => <button key={k} role="tab" aria-selected={mode === k} className={mode === k ? "on" : ""} onClick={() => setMode(k)}>{l}</button>)}
        </div>
        <div className="b3d-grow" />
        <button className={"b3d-live b3d-hide-sm" + (live ? " on" : "")} onClick={() => setLive((v) => !v)} aria-pressed={live}><span>Live render</span><i /></button>
        {msg && <div className="b3d-msg" role="status">{msg}</div>}
      </header>

      <div className="b3d-main">
        {compact && (leftOpen || rightOpen) && <div className="b3d-backdrop" onClick={() => { setLeftOpen(false); setRightOpen(false); }} />}
        {/* ------------- left ------------- */}
        <aside className={"b3d-left" + (leftOpen ? " open" : "")}>
          {compact && <button className="b3d-dclose" onClick={() => setLeftOpen(false)} aria-label="Close library"><Ic n="clear" size={16} /></button>}
          {mode === "exterior" ? (
            <div className="b3d-lib b3d-scroll">
              <div className="b3d-lib-h"><strong>Exterior</strong></div>
              <h5 className="b3d-h5">Floors (extra ones beyond those you drew appear as plain blocks)</h5>
              <div className="b3d-cats">{[1, 2, 3].map((n) => <button key={n} className={D.ext.storeys === n ? "on" : ""} onClick={() => patchExt({ storeys: n })}>{n}</button>)}</div>
              <h5 className="b3d-h5">Roof</h5>
              <div className="b3d-cats">{[["gable", "Gable"], ["hip", "Hip"], ["flat", "Flat"]].map(([k, l]) => <button key={k} className={D.ext.roof === k ? "on" : ""} onClick={() => patchExt({ roof: k })}>{l}</button>)}</div>
              <h5 className="b3d-h5">Wall colour</h5>
              <Swatches list={EXT_WALL} value={D.ext.wall} onPick={(c) => patchExt({ wall: c })} />
              <h5 className="b3d-h5">Roof colour</h5>
              <Swatches list={EXT_ROOF} value={D.ext.roofColor} onPick={(c) => patchExt({ roofColor: c })} />
              <h5 className="b3d-h5">Trim and window frames</h5>
              <Swatches list={["#ffffff", "#2b2b2b", "#8b5e48", "#7d7f84"]} value={D.ext.trim} onPick={(c) => patchExt({ trim: c })} />
              <h5 className="b3d-h5">Garden</h5>
              {[["lawn", "Lawn"], ["fence", "Fence and gate"], ["trees", "Trees and shrubs"]].map(([k, l]) => (
                <label key={k} className="b3d-chk"><input type="checkbox" checked={D.ext[k]} onChange={(e) => patchExt({ [k]: e.target.checked })} /> {l}</label>
              ))}
              {!hasBuilding && <p className="b3d-note">Draw rooms in Floor plan first. The house is built from your plan.</p>}
            </div>
          ) : replaceOpen && sel ? (
            <div className="b3d-lib">
              <div className="b3d-lib-h"><strong>Replace model</strong><button className="b3d-x" onClick={() => setReplaceOpen(false)} aria-label="Close"><Ic n="clear" size={16} /></button></div>
              <div className="b3d-grid">
                {CAT[sel.type].variants.map((v, i) => (
                  <button key={i} className={"b3d-card" + (sel.variant === i ? " on" : "")} onClick={() => commit((d) => ({ ...d, items: d.items.map((x) => (x.id === sel.id ? { ...x, variant: i, color: null } : x)) }))}>
                    <div className="b3d-thumb">{thumbs[sel.type + ":" + i] ? <img alt="" src={thumbs[sel.type + ":" + i]} /> : null}</div>
                    <span>{v.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="b3d-lib">
              <div className="b3d-search"><Ic n="search" size={15} /><input placeholder="Search furniture" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
              <div className="b3d-cats" role="tablist">{CATEGORIES.map(([k, l]) => <button key={k} role="tab" aria-selected={cat === k} className={cat === k ? "on" : ""} onClick={() => setCat(k)}>{l}</button>)}</div>
              <div className="b3d-grid">
                {list.map((c) => (
                  <button key={c.type} className="b3d-card" draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", c.type)} onClick={() => addItem(c.type)} title="Click to add (into the selected room), or drag into the plan or room">
                    <div className="b3d-thumb">{thumbs[c.type + ":0"] ? <img alt="" src={thumbs[c.type + ":0"]} /> : null}</div>
                    <span>{c.name}</span><small>{c.size[0]} × {c.size[1]} mm</small>
                  </button>
                ))}
                {!list.length && <p className="b3d-empty">{cat === "fav" ? "Star an item in the room to find it here." : "No furniture matches that search."}</p>}
              </div>
            </div>
          )}
        </aside>

        {/* ------------- centre ------------- */}
        <section className="b3d-view" onDragOver={(e) => e.preventDefault()} onDrop={onDrop} onClick={() => setMenu(null)}>
          <div ref={hostRef} className="b3d-canvas" />
          <div ref={planWrap} className="b3d-plan" style={{ display: mode === "plan" ? "block" : "none" }}>
            {planSvg()}
            <div className="b3d-ptools" onPointerDown={(e) => e.stopPropagation()}>
              {[["select", "cursor", "Select (V)"], ["room", "room", "Room (R)"], ["wall", "wall", "Wall (W)"], ["door", "door", "Door (D)"], ["window", "window", "Window (N)"], ["poly", "poly", "Polygon (P)"], ["measure", "ruler", "Measure (M)"]].map(([k, ic, t]) => (
                <button key={k} className={ptool === k ? "on" : ""} title={t} onClick={() => { setPtool(k); setDraft(null); setHover(null); }}><Ic n={ic} /><span>{t.split(" ")[0]}</span></button>
              ))}
              {ptool === "room" && (
                <select className="b3d-select" value={rtype} onChange={(e) => setRtype(e.target.value)} aria-label="Room type">
                  {Object.entries(ROOM_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              )}
            </div>
            <div className="b3d-phint">{hints[ptool]}</div>
            {((draft && (draft.kind === "wall" || draft.kind === "poly")) || (!draft && selection)) && (
              <div className="b3d-pact">
                {draft && draft.kind === "poly" && draft.pts.length >= 3 && <button className="b3d-primary" onClick={() => finishPoly(draft.pts)}>Close shape</button>}
                {draft && draft.kind === "wall" && <button className="b3d-primary" onClick={() => setDraft(null)}>Done</button>}
                {draft && <button onClick={() => setDraft(null)}>Cancel</button>}
                {!draft && selection && <button onClick={deleteSelection}><Ic n="trash" size={15} /> Delete</button>}
              </div>
            )}
            {(() => {
              let len = 200;
              [200, 500, 1000, 2000, 5000, 10000].forEach((o) => { if (o * pv.k <= 140) len = o; });
              return <div className="b3d-scale-bar" style={{ width: len * pv.k }}><span>{len >= 1000 ? len / 1000 + " m" : len + " mm"}</span></div>;
            })()}
            {!D.rooms.length && !draft && <div className="b3d-hint">Start with the Room tool, then drag out your first room.</div>}
          </div>

          <div ref={tbRef} className="b3d-float" style={{ visibility: "hidden" }} onPointerDown={(e) => e.stopPropagation()}>
            {sel && mode === "interior" && (
              <>
                <button className="b3d-chip" onClick={() => setMatOpen((o) => !o)}>Material editor <Ic n="chevron" size={13} /></button>
                <div className="b3d-bar">
                  <button className={tool === "translate" ? "on" : ""} title="Move (G)" onClick={() => setTool("translate")}><Ic n="move" /></button>
                  <button className={tool === "rotate" ? "on" : ""} title="Rotate (R)" onClick={() => setTool("rotate")}><Ic n="rotate" /></button>
                  <button title="Mirror" onClick={() => commit((d) => ({ ...d, items: d.items.map((x) => (x.id === sel.id ? { ...x, mirror: !x.mirror } : x)) }))}><Ic n="mirror" /></button>
                  <button title="Replace model" onClick={() => setReplaceOpen(true)}><Ic n="swap" /></button>
                  <button title="Copy (Ctrl+C)" onClick={() => duplicate(sel.id)}><Ic n="copy" /></button>
                  <button title="Hide" onClick={() => { commit((d) => ({ ...d, items: d.items.map((x) => (x.id === sel.id ? { ...x, hidden: true } : x)) })); setSelection(null); }}><Ic n="eyeoff" /></button>
                  <button title="Favourite" className={sel.fav ? "on" : ""} onClick={() => commit((d) => ({ ...d, items: d.items.map((x) => (x.id === sel.id ? { ...x, fav: !x.fav } : x)) }))}><Ic n="star" fill={sel.fav ? "currentColor" : "none"} /></button>
                  <button title="Delete" onClick={deleteSelection}><Ic n="trash" /></button>
                </div>
                {matOpen && (
                  <div className="b3d-pop">
                    <p>Colour</p>
                    <Swatches list={SWATCHES} value={sel.color} onPick={(c) => commit((d) => ({ ...d, items: d.items.map((x) => (x.id === sel.id ? { ...x, color: c } : x)) }))} />
                    <button className="b3d-link" onClick={() => commit((d) => ({ ...d, items: d.items.map((x) => (x.id === sel.id ? { ...x, color: null } : x)) }))}>Use original colour</button>
                  </div>
                )}
              </>
            )}
          </div>

          {menu && menuItem && mode === "interior" && (
            <div className="b3d-ctx" style={{ left: menu.x, top: menu.y }} onClick={(e) => e.stopPropagation()}>
              <button onClick={() => { commit((d) => ({ ...d, items: d.items.map((x) => (x.id === menu.id ? { ...x, locked: !x.locked } : x)) })); setMenu(null); }}><Ic n="lock" size={15} />{menuItem.locked ? "Unlock" : "Lock"}</button>
              <button onClick={() => { arrayItem(menu.id); setMenu(null); }}><Ic n="layers" size={15} />Array (3 copies)</button>
              <button onClick={() => { setMode("plan"); setMenu(null); }}><Ic n="home" size={15} />View on floor plan</button>
              <button onClick={() => { zoomSelection(menu.id); setMenu(null); }}><Ic n="search" size={15} />Zoom selection</button>
            </div>
          )}

          <div className="b3d-bottom">
            {compact && (
              <>
                <button className="b3d-pill b3d-btn" onClick={() => { setLeftOpen(true); setRightOpen(false); }}><Ic n="plus" size={15} /> Library</button>
                <button className={"b3d-pill b3d-btn" + (selection ? " b3d-on" : "")} onClick={() => { setRightOpen(true); setLeftOpen(false); }}><Ic n="sliders" size={15} /> {selection ? "Edit" : "Info"}</button>
              </>
            )}
            <div className="b3d-seg" role="group" aria-label="Floor">
              {Array.from({ length: nL }, (_, i) => <button key={i} className={lv === i ? "on" : ""} onClick={() => setLv(i)}>{i + 1}F</button>)}
              <button title="Add a floor" aria-label="Add floor" onClick={addFloor}><Ic n="plus" size={14} /></button>
              {nL > 1 && <button title="Remove the top floor" aria-label="Remove top floor" onClick={removeTopFloor}><Ic n="minus" size={14} /></button>}
            </div>
            {mode === "interior" && (
              <div className="b3d-seg" role="group" aria-label="Wall display">
                {[["cut", "Cut-away"], ["full", "Full walls"], ["low", "Low walls"]].map(([k, l]) => <button key={k} className={cut === k ? "on" : ""} onClick={() => setCut(k)}>{l}</button>)}
              </div>
            )}
            <div className="b3d-grow" />
            {mode === "interior" && <button className={"b3d-pill b3d-btn" + (walk ? " b3d-on" : "")} onClick={() => setWalk((w) => !w)} aria-pressed={walk} title="First-person walk (WASD, drag to look, Esc to exit)">Walk</button>}
            {hiddenCount > 0 && <button className="b3d-pill b3d-btn" onClick={() => commit((d) => ({ ...d, items: d.items.map((x) => ({ ...x, hidden: false })) }))}><Ic n="eye" size={15} /> Show {hiddenCount} hidden</button>}
            <button className="b3d-icon" title="Fit to view" onClick={fit}><Ic n="home" size={16} /></button>
            <button className="b3d-icon" title="Zoom out" onClick={() => zoomBy(1.2)}><Ic n="minus" size={16} /></button>
            <span className="b3d-zoom">{mode === "plan" ? Math.round((pv.k / 0.1) * 100) : zoomPct}</span>
            <button className="b3d-icon" title="Zoom in" onClick={() => zoomBy(1 / 1.2)}><Ic n="plus" size={16} /></button>
          </div>
          {walk && mode === "interior" && (
            <>
              <div className="b3d-phint">{coarse ? "Use the arrows to move, drag to look." : "WASD or arrow keys to move, drag to look, Esc to exit."} <button className="b3d-link" style={{ marginLeft: 8, color: "#9ec1ff" }} onClick={() => setWalk(false)}>Exit</button></div>
              {coarse && (
                <div className="b3d-dpad">
                  {[["w", "▲", "u", "Forward"], ["a", "◀", "l", "Step left"], ["s", "▼", "d", "Back"], ["d", "▶", "r", "Step right"]].map(([k, ch, pos, label]) => (
                    <button key={k} className={"b3d-dp-" + pos} aria-label={label}
                      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); pressKey(k, true); }}
                      onPointerUp={() => pressKey(k, false)} onPointerCancel={() => pressKey(k, false)} onLostPointerCapture={() => pressKey(k, false)}>{ch}</button>
                  ))}
                </div>
              )}
            </>
          )}
          {mode !== "plan" && !hasBuilding && <div className="b3d-hint">There is no house yet. Open Floor plan and draw a room.</div>}
        </section>

        {/* ------------- right ------------- */}
        <aside className={"b3d-right" + (rightOpen ? " open" : "")}>
          {compact && <button className="b3d-dclose" onClick={() => setRightOpen(false)} aria-label="Close properties"><Ic n="clear" size={16} /></button>}
          <div className="b3d-tabs" role="tablist">
            {[["props", "Properties"], ["rooms", "Rooms"], ["sched", "Schedule"], ["cost", "Cost"], ["views", "Views"]].map(([k, l]) => <button key={k} role="tab" aria-selected={rtab === k} className={rtab === k ? "on" : ""} onClick={() => setRtab(k)}>{l}</button>)}
          </div>

          {rtab === "props" && (
            <div className="b3d-props">
              {sel && (
                <>
                  <div className="b3d-ph">
                    <div className="b3d-thumb sm">{thumbs[sel.type + ":" + sel.variant] ? <img alt="" src={thumbs[sel.type + ":" + sel.variant]} /> : null}</div>
                    <div><strong>{sel.name}</strong><small>{CAT[sel.type].variants[sel.variant].label}{sel.locked ? " · Locked" : ""}</small></div>
                  </div>
                  <h5>Size</h5>
                  <Row label="Length" value={sel.size.L} min={50} max={4000} onStart={snapshot} onChange={(v) => setDim(sel, "L", v)} />
                  <Row label="Width" value={sel.size.W} min={50} max={4000} onStart={snapshot} onChange={(v) => setDim(sel, "W", v)} />
                  <Row label="Height" value={sel.size.H} min={10} max={3000} onStart={snapshot} onChange={(v) => setDim(sel, "H", v)} />
                  <div className="b3d-scale">
                    <label><input type="checkbox" checked={sel.prop} onChange={(e) => patchItem(sel.id, { prop: e.target.checked })} /> Proportional scale</label>
                    <button onClick={() => commit((d) => ({ ...d, items: d.items.map((x) => (x.id === sel.id ? { ...x, size: { L: x.base[0], W: x.base[1], H: x.base[2] } } : x)) }))}>Reset</button>
                  </div>
                  <h5>Location</h5>
                  <Row label="Distance to floor" value={sel.elev} min={0} max={2500} onStart={snapshot} onChange={(v) => patchItem(sel.id, { elev: Math.max(0, v || 0) })} />
                  <Row label="Angle" value={sel.rot} min={0} max={360} unit="°" onStart={snapshot} onChange={(v) => patchItem(sel.id, { rot: norm(v || 0) })} />
                  <Row label="Position X" value={sel.x} min={-2000} max={14000} onStart={snapshot} onChange={(v) => patchItem(sel.id, { x: v || 0 })} />
                  <Row label="Position Z" value={sel.z} min={-2000} max={14000} onStart={snapshot} onChange={(v) => patchItem(sel.id, { z: v || 0 })} />
                </>
              )}

              {selRoom && (
                <>
                  <h4>Room</h4>
                  <label className="b3d-field">Name<input value={selRoom.name} onFocus={snapshot} onChange={(e) => setD({ ...dRef.current, rooms: dRef.current.rooms.map((r) => (r.id === selRoom.id ? { ...r, name: e.target.value } : r)) })} /></label>
                  <label className="b3d-field">Type
                    <select className="b3d-select" value={selRoom.type} onChange={(e) => commit((d) => ({ ...d, rooms: d.rooms.map((r) => (r.id === selRoom.id ? { ...r, type: e.target.value, floor: null } : r)) }))}>
                      {Object.entries(ROOM_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </label>
                  <label className="b3d-field">Floor finish
                    <select className="b3d-select" value={selRoom.floor || ROOM_TYPES[selRoom.type].floor} onChange={(e) => commit((d) => ({ ...d, rooms: d.rooms.map((r) => (r.id === selRoom.id ? { ...r, floor: e.target.value } : r)) }))}>
                      {Object.keys(FLOOR_SIZE).map((k) => <option key={k} value={k}>{k[0].toUpperCase() + k.slice(1)}</option>)}
                      <option value="none">None (open to below)</option>
                    </select>
                  </label>
                  <dl className="b3d-dl"><dt>Area</dt><dd>{roomArea(selRoom).toFixed(2)} m²</dd></dl>
                  <Row label="Width" value={selRoom.w} min={1000} max={12000} step={100} onStart={snapshot} onChange={(v) => rectPatch(selRoom.id, { w: v })} />
                  <Row label="Depth" value={selRoom.d} min={1000} max={12000} step={100} onStart={snapshot} onChange={(v) => rectPatch(selRoom.id, { d: v })} />
                  <Row label="Position X" value={selRoom.x} min={-2000} max={14000} step={100} onStart={snapshot} onChange={(v) => rectPatch(selRoom.id, { x: v })} />
                  <Row label="Position Z" value={selRoom.z} min={-2000} max={14000} step={100} onStart={snapshot} onChange={(v) => rectPatch(selRoom.id, { z: v })} />
                  <p className="b3d-note" style={{ marginTop: 6 }}>{selRoom.poly.length} corners. On the plan: drag a corner, click the small dot on an edge to add a corner, double-click a corner to remove it. Width and Depth scale the whole shape.</p>
                  <div className="b3d-btns">
                    <button className="b3d-primary" onClick={() => furnish(selRoom)}><Ic n="sparkle" size={15} /> Furnish room</button>
                    <button onClick={() => clearRoom(selRoom)}>Clear furniture</button>
                    <button onClick={deleteSelection}>Delete room</button>
                  </div>
                </>
              )}

              {selWall && (
                <>
                  <h4>Wall</h4>
                  <dl className="b3d-dl"><dt>Length</dt><dd>{Math.round(wallLen(selWall))} mm</dd><dt>Height</dt><dd>{WALL_H} mm</dd></dl>
                  <Row label="Thickness" value={selWall.t} min={80} max={400} step={10} onStart={snapshot} onChange={(v) => patchWall(selWall.id, { t: v })} />
                  <div className="b3d-btns"><button onClick={deleteSelection}>Delete wall</button></div>
                  <p className="b3d-note">Drag the white dots on the plan to change the ends. Use the Door and Window tools to add openings.</p>
                </>
              )}

              {selOp && (
                <>
                  <h4>{selOp.type === "door" ? "Door" : "Window"}</h4>
                  <Row label="Width" value={selOp.width} min={400} max={3200} step={50} onStart={snapshot} onChange={(v) => patchOp(selOp.id, { width: v })} />
                  <Row label="Height" value={selOp.h} min={400} max={2600} step={50} onStart={snapshot} onChange={(v) => patchOp(selOp.id, { h: v })} />
                  {selOp.type === "window" && <Row label="Sill height" value={selOp.sill} min={0} max={1600} step={50} onStart={snapshot} onChange={(v) => patchOp(selOp.id, { sill: v })} />}
                  {selOp.type === "door" && (<><h5>Door colour</h5><Swatches list={["#a9835b", "#6a4636", "#f1f1ef", "#2b2d31", "#3f5675", "#5f7f62"]} value={selOp.color} onPick={(c) => commit((d) => ({ ...d, openings: d.openings.map((o) => (o.id === selOp.id ? { ...o, color: c } : o)) }))} /></>)}
                  <div className="b3d-btns"><button onClick={deleteSelection}>Delete {selOp.type}</button></div>
                  <p className="b3d-note">Drag it along its wall on the plan to reposition.</p>
                </>
              )}

              {selDim && (
                <>
                  <h4>Dimension</h4>
                  <dl className="b3d-dl"><dt>Length</dt><dd>{Math.round(Math.hypot(selDim.b[0] - selDim.a[0], selDim.b[1] - selDim.a[1]))} mm</dd></dl>
                  <div className="b3d-btns"><button onClick={deleteSelection}>Delete dimension</button></div>
                </>
              )}

              {!selection && (
                <>
                  <h4>House</h4>
                  <dl className="b3d-dl">
                    <dt>Floors</dt><dd>{nL}</dd><dt>Rooms</dt><dd>{D.rooms.length}</dd>
                    <dt>Total floor area</dt><dd>{totalArea.toFixed(1)} m²</dd>
                    <dt>Doors</dt><dd>{doors}</dd>
                    <dt>Windows</dt><dd>{windows}</dd>
                    <dt>Furniture</dt><dd>{D.items.length}</dd>
                  </dl>
                  {mode !== "exterior" && (<><h5>Opacity</h5><Row label="Wall" value={wallOp} min={0} max={100} unit="%" onChange={setWallOp} /><Row label="Floor" value={floorOp} min={0} max={100} unit="%" onChange={setFloorOp} /><h5>Interior wall paint</h5><Swatches list={["#f4f4f2", "#e9e4da", "#dfe6df", "#dde6ee", "#efe0dc", "#d9d9d9"]} value={D.ext.inside} onPick={(c) => patchExt({ inside: c })} /></>)}
                  <h5>Time of day</h5>
                  <Row label="Sun" value={hour} min={5} max={20} unit="h" onChange={setHour} />
                  {trace && (
                    <>
                      <h5>Trace image</h5>
                      <Row label="Width" value={trace.w} min={1000} max={40000} step={100} onChange={(v) => setTrace({ ...trace, w: v })} />
                      <Row label="Position X" value={trace.x} min={-20000} max={40000} step={100} onChange={(v) => setTrace({ ...trace, x: v })} />
                      <Row label="Position Z" value={trace.z} min={-20000} max={40000} step={100} onChange={(v) => setTrace({ ...trace, z: v })} />
                      <Row label="Opacity" value={Math.round(trace.opacity * 100)} min={5} max={100} unit="%" onChange={(v) => setTrace({ ...trace, opacity: v / 100 })} />
                      <div className="b3d-btns"><button onClick={() => setTrace(null)}>Remove image</button></div>
                    </>
                  )}
                  {D.rooms.some((r) => r.type !== "void" && !D.items.some((i) => inRect(i, r))) && (
                    <div className="b3d-btns"><button className="b3d-primary" onClick={() => commit((d) => ({ ...d, items: [...d.items, ...d.rooms.filter((r) => r.type !== "void" && !d.items.some((i) => inRect(i, r))).flatMap(furnishRoom)] }))}><Ic n="sparkle" size={15} /> Furnish all empty rooms</button></div>
                  )}
                  <p className="b3d-note">Select a room, wall, door, window or piece of furniture to edit it.</p>
                </>
              )}
            </div>
          )}

          {rtab === "rooms" && (
            <div className="b3d-props">
              <h4>Rooms</h4>
              {!D.rooms.length && <p className="b3d-note">No rooms yet. Use the Room tool on the floor plan.</p>}
              <table className="b3d-table"><tbody>
                {LD.rooms.map((r) => (
                  <tr key={r.id} className={selRoom && selRoom.id === r.id ? "on" : ""} onClick={() => focusRoom(r)}>
                    <td><strong>{r.name}</strong><br /><small>{ROOM_TYPES[r.type].label}</small></td>
                    <td>{roomArea(r).toFixed(1)} m²</td>
                  </tr>
                ))}
              </tbody></table>
            </div>
          )}

          {rtab === "cost" && (() => {
            const est = estimate(D);
            return (
              <div className="b3d-props">
                <h4>Estimate</h4>
                <table className="b3d-table"><tbody>
                  {est.lines.map((l, i) => <tr key={i}><td>{l.label}<br /><small>{l.qty} {l.unit} × {CURRENCY}{l.price}</small></td><td>{CURRENCY}{l.total.toLocaleString()}</td></tr>)}
                  <tr><td><strong>Total</strong></td><td><strong>{CURRENCY}{est.total.toLocaleString()}</strong></td></tr>
                </tbody></table>
                <p className="b3d-note">Rates are placeholders. Edit the price constants at the top of the file. File, Export estimate saves a CSV.</p>
              </div>
            );
          })()}

          {rtab === "views" && (
            <div className="b3d-props">
              <h4>Saved views</h4>
              <div className="b3d-btns" style={{ marginTop: 0 }}><button className="b3d-primary" onClick={saveView} disabled={mode === "plan"}>Save current view</button></div>
              {!(D.views || []).length && <p className="b3d-note">Orbit to a spot in Interior or Exterior, then save it here.</p>}
              <table className="b3d-table"><tbody>
                {(D.views || []).map((v) => (
                  <tr key={v.id} onClick={() => gotoView(v)}>
                    <td>{v.name}<br /><small>{v.mode}</small></td>
                    <td><button className="b3d-x" aria-label="Delete view" onClick={(e) => { e.stopPropagation(); commit((d) => ({ ...d, views: (d.views || []).filter((x) => x.id !== v.id) })); }}><Ic n="clear" size={14} /></button></td>
                  </tr>
                ))}
              </tbody></table>
            </div>
          )}

          {rtab === "sched" && (
            <div className="b3d-props">
              <h4>Furniture</h4>
              {!D.items.length && <p className="b3d-note">Nothing placed yet.</p>}
              <table className="b3d-table"><tbody>
                {D.items.map((i) => (
                  <tr key={i.id} className={i.id === selId ? "on" : ""} onClick={() => setSelId(i.id)}>
                    <td>{i.name}</td><td>{Math.round(i.size.L)} × {Math.round(i.size.W)} × {Math.round(i.size.H)}</td>
                  </tr>
                ))}
              </tbody></table>
              <h4 style={{ marginTop: 18 }}>Doors and windows</h4>
              <table className="b3d-table"><tbody>
                {D.openings.map((o) => (
                  <tr key={o.id} className={selOp && selOp.id === o.id ? "on" : ""} onClick={() => setSelection({ kind: "op", id: o.id })}>
                    <td>{o.type === "door" ? "Door" : "Window"}</td><td>{o.width} × {o.h}</td>
                  </tr>
                ))}
              </tbody></table>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

/* ================================================================== */
/* Styles                                                              */
/* ================================================================== */
const CSS = `
.b3d{--blue:#2d6cdf;--blue-soft:#e8f0fe;--ink:#1f2937;--mute:#6b7280;--line:#e5e7eb;position:relative;display:flex;flex-direction:column;height:100vh;height:100dvh;min-height:320px;padding:0 env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none;overscroll-behavior:none;user-select:none;-webkit-user-select:none;background:#f3f4f6;color:var(--ink);font:13px/1.35 "Inter","Segoe UI",system-ui,-apple-system,sans-serif;overflow:hidden}
.b3d *{box-sizing:border-box}
.b3d button{font:inherit;color:inherit;cursor:pointer;background:none;border:0;padding:0}
.b3d button:disabled{opacity:.35;cursor:default}
.b3d button:focus-visible,.b3d input:focus-visible,.b3d select:focus-visible{outline:2px solid var(--blue);outline-offset:1px}
.b3d-grow{flex:1}
.b3d-top{height:48px;flex:none;display:flex;align-items:center;gap:2px;padding:0 10px;background:#fff;border-bottom:1px solid var(--line);position:relative;z-index:5}
.b3d-logo{font-weight:700;font-size:15px;padding:0 8px;color:var(--blue)}
.b3d-sep{width:1px;height:22px;background:var(--line);margin:0 6px}
.b3d-tb{display:flex;flex-direction:column;align-items:center;gap:1px;padding:4px 9px;border-radius:6px;font-size:11px;color:#374151}
.b3d-tb:hover:not(:disabled){background:#f3f4f6}
.b3d-menu{position:relative}
.b3d-drop{position:absolute;top:44px;left:0;min-width:210px;background:#fff;border:1px solid var(--line);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.12);padding:4px;z-index:10}
.b3d-drop button{display:block;width:100%;text-align:left;padding:8px 10px;border-radius:5px}
.b3d-drop button:hover{background:#f3f4f6}
.b3d-modes{display:flex;background:#f3f4f6;border-radius:8px;padding:3px}
.b3d-modes button{padding:6px 16px;border-radius:6px;font-weight:600;color:#4b5563}
.b3d-modes button.on{background:#fff;color:var(--blue);box-shadow:0 1px 3px rgba(0,0,0,.12)}
.b3d-live{display:flex;align-items:center;gap:8px;padding:5px 10px 5px 12px;border-radius:999px;background:#e8f0fe;color:var(--blue);font-weight:600}
.b3d-live i{width:30px;height:16px;border-radius:999px;background:#c7d2e5;position:relative;transition:background .15s}
.b3d-live i:after{content:"";position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;background:#fff;transition:transform .15s}
.b3d-live.on i{background:var(--blue)}
.b3d-live.on i:after{transform:translateX(14px)}
.b3d-msg{position:absolute;right:14px;top:56px;background:#111827;color:#fff;padding:5px 12px;border-radius:6px;font-size:12px;z-index:20}
.b3d-main{flex:1;display:flex;min-height:0}
.b3d-left{width:272px;flex:none;background:#fff;border-right:1px solid var(--line);display:flex;min-height:0}
.b3d-lib{flex:1;display:flex;flex-direction:column;min-height:0;padding:10px 10px 0}
.b3d-scroll{overflow:auto;padding-bottom:16px}
.b3d-lib-h{display:flex;align-items:center;justify-content:space-between;padding:2px 2px 10px;font-size:14px}
.b3d-x{padding:4px;border-radius:5px;color:var(--mute)}
.b3d-x:hover{background:#f3f4f6}
.b3d-search{display:flex;align-items:center;gap:7px;border:1px solid var(--line);border-radius:7px;padding:0 9px;height:34px;color:var(--mute);background:#f9fafb}
.b3d-search input{flex:1;border:0;background:none;font:inherit;color:var(--ink);outline:none;min-width:0}
.b3d-cats{display:flex;flex-wrap:wrap;gap:4px;padding:10px 0}
.b3d-cats button{padding:4px 9px;border-radius:999px;border:1px solid var(--line);font-size:12px;color:#4b5563}
.b3d-cats button.on{background:var(--blue);border-color:var(--blue);color:#fff}
.b3d-h5{margin:12px 0 0;font-size:12px;color:var(--mute);font-weight:600}
.b3d-chk{display:flex;gap:8px;align-items:center;padding:5px 0}
.b3d-grid{flex:1;overflow:auto;display:grid;grid-template-columns:1fr 1fr;gap:8px;align-content:start;padding:2px 0 12px}
.b3d-card{display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:6px;border:1px solid var(--line);border-radius:8px;text-align:left;background:#fff}
.b3d-card:hover{border-color:#b7c9ee;background:#fafcff}
.b3d-card.on{border-color:var(--blue);box-shadow:0 0 0 1px var(--blue)}
.b3d-card span{font-weight:600;font-size:12px}
.b3d-card small{color:var(--mute);font-size:11px}
.b3d-thumb{width:100%;aspect-ratio:1;background:#f3f4f6;border-radius:6px;overflow:hidden;display:grid;place-items:center}
.b3d-thumb img{width:100%;height:100%;object-fit:contain}
.b3d-thumb.sm{width:44px;height:44px;flex:none}
.b3d-empty{grid-column:1/-1;color:var(--mute);padding:12px 4px}
.b3d-view{position:relative;flex:1;min-width:0;background:#f1f3f6}
.b3d-canvas{position:absolute;inset:0}
.b3d-plan{position:absolute;inset:0;background:#fff}
.b3d-plansvg{position:absolute;inset:0;width:100%;height:100%;touch-action:none;user-select:none}
.b3d-ptools{position:absolute;left:50%;top:12px;transform:translateX(-50%);display:flex;align-items:center;gap:2px;background:#fff;border:1px solid var(--line);border-radius:10px;padding:4px;box-shadow:0 2px 10px rgba(0,0,0,.08)}
.b3d-ptools button{display:flex;flex-direction:column;align-items:center;gap:1px;padding:5px 11px;border-radius:7px;font-size:11px;color:#4b5563}
.b3d-ptools button:hover{background:#f3f4f6}
.b3d-ptools button.on{background:var(--blue);color:#fff}
.b3d-phint{position:absolute;left:50%;top:70px;transform:translateX(-50%);background:rgba(17,24,39,.85);color:#fff;padding:5px 12px;border-radius:6px;font-size:12px;pointer-events:none;max-width:90%;text-align:center}
.b3d-select{height:30px;border:1px solid var(--line);border-radius:6px;padding:0 8px;background:#fff;font:inherit;color:var(--ink)}
.b3d-float{position:absolute;z-index:4;transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:flex-start}
.b3d-chip{display:flex;align-items:center;gap:3px;background:#2b2d33;color:#fff;font-size:12px;padding:3px 9px;border-radius:5px 5px 0 0}
.b3d-bar{display:flex;background:#2b2d33;border-radius:0 6px 6px 6px;padding:3px;gap:1px}
.b3d-bar button{width:32px;height:30px;display:grid;place-items:center;border-radius:5px;color:#e5e7eb}
.b3d-bar button:hover{background:#444851}
.b3d-bar button.on{background:var(--blue);color:#fff}
.b3d-pop{position:absolute;top:100%;left:0;margin-top:6px;width:210px;background:#fff;border:1px solid var(--line);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.14);padding:10px}
.b3d-pop p{margin:0 0 7px;font-weight:600}
.b3d-sw{display:grid;grid-template-columns:repeat(5,1fr);gap:7px;padding:6px 0}
.b3d-sw button{aspect-ratio:1;border-radius:50%;border:1px solid rgba(0,0,0,.18)}
.b3d-sw button.on{outline:2px solid var(--blue);outline-offset:2px}
.b3d-link{margin-top:9px;color:var(--blue);font-size:12px}
.b3d-ctx{position:absolute;z-index:6;min-width:190px;background:#fff;border:1px solid var(--line);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.16);padding:4px}
.b3d-ctx button{display:flex;align-items:center;gap:9px;width:100%;text-align:left;padding:8px 10px;border-radius:5px}
.b3d-ctx button:hover{background:#f3f4f6}
.b3d-bottom{position:absolute;left:12px;right:12px;bottom:12px;display:flex;align-items:center;gap:8px;pointer-events:none;z-index:3}
.b3d-bottom>*{pointer-events:auto}
.b3d-pill{display:flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:7px;background:#fff;border:1px solid var(--line);font-weight:600}
.b3d-btn:hover{border-color:#b7c9ee}
.b3d-seg{display:flex;background:#fff;border:1px solid var(--line);border-radius:7px;padding:2px}
.b3d-seg button{height:26px;padding:0 11px;border-radius:5px;font-weight:600;color:#4b5563}
.b3d-seg button.on{background:var(--blue);color:#fff}
.b3d-icon{width:32px;height:32px;display:grid;place-items:center;border-radius:7px;background:#fff;border:1px solid var(--line)}
.b3d-icon:hover{border-color:#b7c9ee}
.b3d-zoom{min-width:34px;text-align:center;font-variant-numeric:tabular-nums;color:#4b5563}
.b3d-hint{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:#fff;border:1px solid var(--line);padding:10px 16px;border-radius:8px;color:var(--mute);pointer-events:none}
.b3d-right{width:292px;flex:none;background:#fff;border-left:1px solid var(--line);display:flex;flex-direction:column;min-height:0;overflow:auto}
.b3d-tabs{display:flex;border-bottom:1px solid var(--line);position:sticky;top:0;background:#fff;z-index:1}
.b3d-tabs button{flex:1;padding:11px 0;color:var(--mute);font-weight:600;border-bottom:2px solid transparent}
.b3d-tabs button.on{color:var(--blue);border-bottom-color:var(--blue)}
.b3d-props{padding:12px 14px 20px}
.b3d-props h4{margin:0 0 8px;font-size:14px}
.b3d-props h5{margin:14px 0 4px;font-size:12px;color:var(--mute);font-weight:600}
.b3d-ph{display:flex;gap:10px;align-items:center;padding-bottom:12px;margin-bottom:6px;border-bottom:1px solid var(--line)}
.b3d-ph strong{display:block;font-size:13px}
.b3d-ph small{color:var(--mute)}
.b3d-field{display:flex;flex-direction:column;gap:3px;margin:8px 0;color:#4b5563}
.b3d-field input{height:30px;border:1px solid var(--line);border-radius:6px;padding:0 8px;font:inherit;color:var(--ink)}
.b3d-row{display:grid;grid-template-columns:1fr auto;gap:2px 8px;align-items:center;padding:5px 0}
.b3d-row label{grid-column:1/-1;color:#4b5563}
.b3d-row input[type=range]{width:100%;accent-color:var(--blue);margin:0}
.b3d-num{display:flex;align-items:center;gap:4px;border:1px solid var(--line);border-radius:6px;padding:0 6px;height:26px;background:#fff}
.b3d-num input{width:52px;border:0;font:inherit;text-align:right;outline:none;background:none;color:var(--ink)}
.b3d-num span{color:var(--mute);font-size:11px}
.b3d-scale{display:flex;align-items:center;justify-content:space-between;padding:6px 0}
.b3d-scale label{display:flex;gap:6px;align-items:center;color:#4b5563}
.b3d-scale button,.b3d-btns button{border:1px solid var(--line);border-radius:6px;padding:6px 12px}
.b3d-scale button:hover,.b3d-btns button:hover{border-color:var(--blue);color:var(--blue)}
.b3d-btns{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px}
.b3d-btns .b3d-primary{display:flex;align-items:center;gap:6px;background:var(--blue);border-color:var(--blue);color:#fff}
.b3d-btns .b3d-primary:hover{color:#fff;opacity:.92}
.b3d-dl{display:grid;grid-template-columns:1fr auto;gap:6px 10px;margin:6px 0}
.b3d-dl dt{color:var(--mute)}
.b3d-dl dd{margin:0;font-weight:600;text-align:right}
.b3d-note{color:var(--mute);margin:14px 0 0}
.b3d-table{width:100%;border-collapse:collapse}
.b3d-table td{padding:8px 4px;border-bottom:1px solid var(--line);vertical-align:top}
.b3d-table td:last-child{text-align:right;color:var(--mute);font-variant-numeric:tabular-nums}
.b3d-table small{color:var(--mute)}
.b3d-table tr{cursor:pointer}
.b3d-table tr:hover,.b3d-table tr.on{background:var(--blue-soft)}
.b3d input,.b3d select{user-select:text;-webkit-user-select:text}
.b3d-main{position:relative}
.b3d-ptools{max-width:calc(100% - 16px);flex-wrap:wrap;justify-content:center}
.b3d-phint button{pointer-events:auto}
.b3d-pact{position:absolute;left:50%;bottom:58px;transform:translateX(-50%);display:flex;gap:8px;z-index:4}
.b3d-pact button{display:flex;align-items:center;gap:6px;height:38px;padding:0 16px;border-radius:999px;background:#fff;border:1px solid var(--line);font-weight:600;box-shadow:0 2px 10px rgba(0,0,0,.12)}
.b3d-pact .b3d-primary{background:var(--blue);border-color:var(--blue);color:#fff}
.b3d-dpad{position:absolute;right:14px;bottom:70px;display:grid;grid-template-columns:repeat(3,52px);grid-template-rows:repeat(2,52px);gap:6px;z-index:4}
.b3d-dpad button{border-radius:50%;background:rgba(255,255,255,.92);border:1px solid var(--line);font-size:18px;box-shadow:0 2px 8px rgba(0,0,0,.15);touch-action:none}
.b3d-dpad button:active{background:var(--blue);color:#fff}
.b3d-dp-u{grid-column:2;grid-row:1}.b3d-dp-l{grid-column:1;grid-row:2}.b3d-dp-d{grid-column:2;grid-row:2}.b3d-dp-r{grid-column:3;grid-row:2}
.b3d-dclose,.b3d-backdrop{display:none}
.b3d-lg .b3d-left{width:230px}.b3d-lg .b3d-right{width:260px}
.b3d-compact .b3d-left,.b3d-compact .b3d-right{position:absolute;top:0;bottom:0;z-index:12;box-shadow:0 0 30px rgba(0,0,0,.25);transition:transform .2s ease}
.b3d-compact .b3d-left{left:0;width:min(88%,330px);transform:translateX(-105%)}
.b3d-compact .b3d-right{right:0;width:min(88%,340px);transform:translateX(105%)}
.b3d-compact .b3d-left.open,.b3d-compact .b3d-right.open{transform:none}
.b3d-compact .b3d-left:not(.open),.b3d-compact .b3d-right:not(.open){visibility:hidden;transition:transform .2s ease,visibility 0s .2s}
.b3d-compact .b3d-left.open,.b3d-compact .b3d-right.open{visibility:visible;transition:transform .2s ease}
.b3d-compact .b3d-backdrop{display:block;position:absolute;inset:0;background:rgba(15,23,42,.35);z-index:11}
.b3d-compact .b3d-dclose{display:grid;position:absolute;right:8px;top:8px;z-index:3;width:34px;height:34px;place-items:center;border-radius:8px;background:#f3f4f6}
.b3d-compact .b3d-lib{padding-top:46px}
.b3d-compact .b3d-tabs{padding-right:46px}
.b3d-sm .b3d-left,.b3d-sm .b3d-right{top:auto;left:0;right:0;width:100%;height:58%;border-radius:16px 16px 0 0;border:0;transform:translateY(105%)}
.b3d-sm .b3d-left.open,.b3d-sm .b3d-right.open{transform:none}
.b3d-sm .b3d-grid{grid-template-columns:repeat(3,1fr)}
.b3d-sm .b3d-hide-sm{display:none}
.b3d-sm .b3d-top{gap:0;padding:0 4px}
.b3d-sm .b3d-tb span{display:none}
.b3d-sm .b3d-tb{padding:6px 8px}
.b3d-sm .b3d-modes button{padding:6px 9px;font-size:12px}
.b3d-sm .b3d-ptools button span{display:none}
.b3d-sm .b3d-bottom{left:6px;right:6px;bottom:6px;gap:5px;flex-wrap:wrap}
.b3d-sm .b3d-zoom{display:none}
.b3d-sm .b3d-pill{padding:0 9px}
.b3d-sm .b3d-phint{top:auto;bottom:100px;font-size:11px}
.b3d-sm .b3d-pact{bottom:100px}
.b3d-sm .b3d-scale-bar{bottom:98px}
.b3d-sm .b3d-dpad{bottom:104px}
.b3d-sm .b3d-msg{top:52px;right:8px}
.b3d-sm,.b3d-sm .b3d-props,.b3d-sm .b3d-card span{font-size:14px}
.b3d-coarse input,.b3d-coarse select,.b3d-sm input,.b3d-sm select{font-size:16px}
.b3d-coarse .b3d-bar button{width:42px;height:40px}
.b3d-coarse .b3d-icon{width:40px;height:40px}
.b3d-coarse .b3d-pill{height:40px}
.b3d-coarse .b3d-seg button{height:34px;padding:0 14px}
.b3d-coarse .b3d-ptools button{padding:7px 12px}
.b3d-coarse .b3d-cats button{padding:8px 13px}
.b3d-coarse .b3d-tabs button{padding:14px 0}
.b3d-coarse .b3d-row input[type=range]{height:30px}
.b3d-coarse .b3d-num{height:36px}
.b3d-coarse .b3d-num input{width:64px}
.b3d-coarse .b3d-ctx button,.b3d-coarse .b3d-drop button{padding:13px 14px}
.b3d-coarse .b3d-scale button,.b3d-coarse .b3d-btns button{padding:10px 14px}
.b3d-coarse .b3d-sw{gap:10px}
@media (prefers-reduced-motion:reduce){.b3d *{transition:none!important}}
`;


/* ================================================================== */
/* Error boundary + public component                                   */
/* ================================================================== */
class Builder3DBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (this.state.err) {
      return (
        <div style={{ height: "100vh", display: "grid", placeItems: "center", font: "14px system-ui, sans-serif", color: "#1f2937", ...(this.props.style || {}) }}>
          <div style={{ maxWidth: 420, textAlign: "center" }}>
            <h3 style={{ margin: "0 0 8px" }}>The 3D builder hit a problem</h3>
            <p style={{ margin: "0 0 14px", color: "#6b7280" }}>{String((this.state.err && this.state.err.message) || this.state.err)}</p>
            <button onClick={() => this.setState({ err: null })} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #2d6cdf", background: "#2d6cdf", color: "#fff", cursor: "pointer" }}>Try again</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function Builder3D(props) {
  return (
    <Builder3DBoundary style={props.style}>
      <Builder3DInner {...props} />
    </Builder3DBoundary>
  );
}
