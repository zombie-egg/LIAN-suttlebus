import { spawn, execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
const envPath = path.join(root, ".env");
const readEnv = (key, fallback) => {
  if (!existsSync(envPath)) return fallback;
  const m = readFileSync(envPath, "utf8").match(
    new RegExp(`^${key}=(.*)$`, "m"),
  );
  return m ? m[1].trim() : fallback;
};
const port = Number(readEnv("PORT", "3100"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function health(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
    const body = await r.json();
    return r.ok && body.ok === true ? body : null;
  } catch (_) {
    return null;
  }
}
if (!(await health(`http://127.0.0.1:${port}/api/health`))) {
  console.error(
    `后端没有在 127.0.0.1:${port} 运行。请先在另一个终端运行 npm run server。`,
  );
  process.exit(1);
}
const binary = ["cloudflared"].find((name) => {
  try {
    execFileSync("which", [name], { stdio: "ignore" });
    return true;
  } catch (_) {
    return false;
  }
});
if (!binary) {
  console.error(
    "未找到 cloudflared。安装后重试：\n  brew install cloudflared\n" +
      "或者把电脑与手机接到同一个 Wi-Fi/路由器，改用 npm run demo:phone。",
  );
  process.exit(1);
}
console.log("正在建立公网 HTTPS 隧道（演示接口会短暂公开可访问）…\n");
const tunnel = spawn(
  binary,
  ["tunnel", "--url", `http://127.0.0.1:${port}`, "--no-autoupdate"],
  { cwd: root, stdio: ["ignore", "pipe", "pipe"] },
);
let publicUrl = "";
let buffer = "";
const onData = (chunk) => {
  const text = String(chunk);
  process.stdout.write(text);
  buffer += text;
  const match = buffer.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
  if (match && !publicUrl) publicUrl = match[0];
};
tunnel.stdout.on("data", onData);
tunnel.stderr.on("data", onData);
tunnel.on("exit", (code) => {
  console.error(`\n隧道已退出（${code}）。`);
  process.exit(code || 1);
});
const deadline = Date.now() + 45000;
while (!publicUrl && Date.now() < deadline) await sleep(300);
if (!publicUrl) {
  console.error("\n没有拿到隧道地址，请检查网络后重试。");
  tunnel.kill("SIGINT");
  process.exit(1);
}
let ready = null;
while (Date.now() < deadline) {
  ready = await health(publicUrl + "/api/health");
  if (ready) break;
  await sleep(1000);
}
if (!ready) {
  console.error(
    `\n隧道地址 ${publicUrl} 在 45 秒内不可访问。常见原因：当前网络屏蔽了 trycloudflare.com` +
      `（DNS 解析失败或连接超时）。\n可改用同一 Wi-Fi 下的 npm run demo:phone，` +
      `或用 npm run demo:web 在手机浏览器查看演示。`,
  );
  tunnel.kill("SIGINT");
  process.exit(1);
}
execFileSync(
  process.execPath,
  ["scripts/mini-connect.mjs", "--device-url", publicUrl + "/api"],
  { cwd: root, stdio: "inherit" },
);
console.log("\n—— 公网真机联调 ——");
console.log(`手机自测：${publicUrl}/api/health`);
console.log(`小程序接口：${publicUrl}/api`);
console.log("现在重新编译小程序，再扫真机调试二维码。");
console.log("手机微信右上角 “…” → 开发调试；iPhone 无需本地网络权限也能访问。");
console.log("隧道地址每次启动都会变化，换地址后要重新运行本命令并重新编译。");
console.log("演示结束按 Ctrl+C，接口随即关闭。\n");
const stop = () => {
  tunnel.kill("SIGINT");
  setTimeout(() => process.exit(0), 300);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
await new Promise(() => {});
