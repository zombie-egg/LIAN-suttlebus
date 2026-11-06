import { Resvg } from "@resvg/resvg-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const directory = fileURLToPath(
  new URL("../miniprogram/assets/tabbar/", import.meta.url),
);
mkdirSync(directory, { recursive: true });
const icons = {
  travel:
    '<rect x="5" y="3" width="14" height="16" rx="4"/><path d="M5 11h14M9 3v8M15 3v8M8 19v2M16 19v2"/><path d="M8 15h.01M16 15h.01"/>',
  routes:
    '<circle cx="6" cy="5" r="2"/><circle cx="18" cy="19" r="2"/><path d="M8 5h7a4 4 0 0 1 0 8H9a3 3 0 0 0 0 6h7"/>',
  services:
    '<path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><rect x="3" y="6" width="18" height="15" rx="3"/><path d="M3 11a20 20 0 0 0 18 0M12 11v4"/>',
  profile:
    '<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
};
for (const [name, body] of Object.entries(icons))
  for (const [selected, color] of [
    [false, "#8b947c"],
    [true, "#355a44"],
  ]) {
    const suffix = selected ? "-active" : "";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="81" height="81" viewBox="0 0 32 32"><g transform="translate(4 4)" fill="none" stroke="${color}" stroke-width="${selected ? 2.2 : 1.9}" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
    writeFileSync(directory + name + suffix + ".svg", svg);
    writeFileSync(
      directory + name + suffix + ".png",
      new Resvg(svg).render().asPng(),
    );
  }
console.log("已生成4组导航SVG源图与8个81×81 PNG图标（普通/选中）。");

const stopSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="54" height="54" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#f9f7ef" stroke="#355a44" stroke-width="3"/><circle cx="12" cy="12" r="3" fill="#355a44"/></svg>';
writeFileSync(directory + "marker-stop.svg", stopSvg);
writeFileSync(
  directory + "marker-stop.png",
  new Resvg(stopSvg).render().asPng(),
);
