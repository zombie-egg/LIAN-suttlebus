import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";
import { lanAddresses, privateIP } from "./lan.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const arg = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
const runtimePath = path.join(root, "miniprogram/config.runtime.js");
const context = { module: { exports: {} } };
vm.runInNewContext(readFileSync(runtimePath, "utf8"), context);
const config = context.module.exports;
const validBase = (value) => {
  let url;
  try {
    url = new URL(value);
  } catch (_) {
    throw Error("接口地址不是有效 URL，例如 http://192.168.1.20:3100/api");
  }
  if (!["http:", "https:"].includes(url.protocol))
    throw Error("接口地址只支持 http 或 https");
  if (url.username || url.password || url.search || url.hash)
    throw Error("接口地址不能包含凭据、参数或锚点");
  if (url.protocol === "http:" && !privateIP(url.hostname))
    throw Error("HTTP 只允许本机或私有局域网地址，公网请使用 HTTPS");
  return url.href.replace(/\/$/, "");
};
if (args.includes("--lan")) {
  const ip = arg("--ip") || lanAddresses()[0];
  if (!ip || !privateIP(ip))
    throw Error("没有找到私有局域网 IPv4，请连接 Wi-Fi/热点，或通过 --ip 指定地址");
  if (lanAddresses().length && !lanAddresses().includes(ip))
    throw Error(`${ip} 不是当前网卡的地址，可用地址：${lanAddresses().join(", ")}`);
  const port = Number(arg("--port") || 3100);
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw Error("端口无效");
  const candidates = lanAddresses().includes(ip)
    ? [ip, ...lanAddresses().filter((x) => x !== ip)]
    : [ip];
  config.devtoolsApiBase = `http://127.0.0.1:${port}/api`;
  config.deviceApiBase = `http://${ip}:${port}/api`;
  config.deviceApiCandidates = candidates.map((x) => `http://${x}:${port}/api`);
  const envPath = path.join(root, ".env");
  let env = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  for (const [k, v] of Object.entries({ LIAN_LAN_IP: ip, PORT: String(port) }))
    env = new RegExp(`^${k}=.*$`, "m").test(env)
      ? env.replace(new RegExp(`^${k}=.*$`, "m"), `${k}=${v}`)
      : env.replace(/\s*$/, "") + `\n${k}=${v}\n`;
  writeFileSync(envPath, env);
  // 仅本项目开发工具的本机设置；不会修改生产项目设置或全局安全设置。
  const privatePath = path.join(root, "project.private.config.json");
  const local = existsSync(privatePath)
    ? JSON.parse(readFileSync(privatePath, "utf8"))
    : {};
  local.setting = { ...local.setting, urlCheck: false };
  writeFileSync(privatePath, JSON.stringify(local, null, 2) + "\n");
  console.log(
    `开发工具：${config.devtoolsApiBase}\n同局域网真机：${config.deviceApiBase}\n候选地址：${config.deviceApiCandidates.join(" , ")}\n本项目本地调试已允许局域网 HTTP；正式项目域名校验保持开启。重启后端并重新编译小程序后生效。`,
  );
} else if (args.includes("--device-url")) {
  const base = validBase(arg("--device-url"));
  config.deviceApiBase = base;
  config.deviceApiCandidates = [base];
  console.log(
    `真机接口已改为：${base}\n需要重新编译小程序；正式/体验版仍不读取该开发地址。`,
  );
} else if (arg("--url")) {
  const u = new URL(arg("--url"));
  if (u.protocol !== "https:" || u.username || u.password || u.search || u.hash)
    throw Error("请提供不含凭据、参数的 HTTPS API 地址");
  config.productionApiBase = u.href.replace(/\/$/, "");
  console.log("体验版与正式版接口已设置，请在微信后台添加 request 合法域名。");
} else
  throw Error(
    "用法：npm run mini:connect -- --lan [--ip 192.168.x.x] [--port 3100]\n" +
      "      npm run mini:connect -- --device-url https://example.com/api\n" +
      "      npm run mini:connect -- --url https://example.com/api",
  );
writeFileSync(
  runtimePath,
  "// 由 npm run mini:connect 更新，仅包含公开接口地址。\nmodule.exports = " +
    JSON.stringify(config, null, 2) +
    ";\n",
);
