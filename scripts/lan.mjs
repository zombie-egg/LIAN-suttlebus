import { networkInterfaces } from "node:os";
export const privateIP = (ip) => {
  const p = String(ip || "")
    .split(".")
    .map(Number);
  return (
    p.length === 4 &&
    p.every((x) => Number.isInteger(x) && x >= 0 && x <= 255) &&
    (p[0] === 10 ||
      (p[0] === 192 && p[1] === 168) ||
      (p[0] === 172 && p[1] >= 16 && p[1] <= 31))
  );
};
// 跳过 VPN、虚拟网桥和自分配地址，优先物理网卡，避免把手机引到不可达的地址。
const usableInterface = (name) =>
  !/^(utun|awdl|llw|bridge|ap|gif|stf|anpi)/.test(name);
const interfaceRank = (name) =>
  name.startsWith("en") ? 0 : name.startsWith("eth") ? 1 : 2;
export function lanAddresses() {
  return Object.entries(networkInterfaces())
    .filter(([name]) => usableInterface(name))
    .sort(([a], [b]) => interfaceRank(a) - interfaceRank(b))
    .flatMap(([, list]) =>
      (list || [])
        .filter(
          (x) => x.family === "IPv4" && !x.internal && privateIP(x.address),
        )
        .map((x) => x.address),
    )
    .filter((ip, index, all) => all.indexOf(ip) === index);
}
