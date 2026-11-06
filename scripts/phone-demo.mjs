import { spawn, execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";
const root = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const envPath = path.join(root, ".env");
const readEnv = (key, fallback) => {
  if (!existsSync(envPath)) return fallback;
  const m = readFileSync(envPath, "utf8").match(
    new RegExp(`^${key}=(.*)$`, "m"),
  );
  return m ? m[1].trim() : fallback;
};
const port = Number(readEnv("PORT", "3100"));
const runtimePath = path.join(root, "miniprogram/config.runtime.js");
const readRuntime = () => {
  const context = { module: { exports: {} } };
  vm.runInNewContext(readFileSync(runtimePath, "utf8"), context);
  return context.module.exports;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function health(url) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(2500),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return { error: "HTTP " + response.status };
    const body = await response.json();
    return body && body.ok === true ? body : { error: "非黎安后端" };
  } catch (error) {
    return { error: error.name === "TimeoutError" ? "超时" : error.message };
  }
}
async function waitHealth(url, seconds) {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    const result = await health(url);
    if (result.ok) return result;
    await sleep(500);
  }
  return null;
}
if (!args.includes("--no-sync")) {
  console.log("同步当前局域网地址…\n");
  execFileSync(process.execPath, ["scripts/mini-connect.mjs", "--lan"], {
    cwd: root,
    stdio: "inherit",
  });
  console.log("");
}
// 同步之后重新读取，避免网络刚变化时打印同步前的旧地址。
const runtime = readRuntime();
const deviceBase = String(runtime.deviceApiBase || "");
const localUrl = `http://127.0.0.1:${port}/api/health`;
const deviceHealth = deviceBase ? deviceBase + "/health" : "";
const lanUrl = deviceHealth;
const webDemo = deviceBase.replace(/\/api\/?$/, "") + "/";
let child = null;
let started = false;
if (!deviceHealth) {
  console.error(
    "没有读到小程序真机接口地址，请先运行 npm run mini:connect -- --lan。",
  );
  process.exit(1);
}
const local = await health(localUrl);
if (!local.ok) {
  console.log("后端未运行，正在启动…\n");
  child = spawn(
    process.execPath,
    ["--env-file-if-exists=.env", "server/index.js"],
    { cwd: root, stdio: "inherit" },
  );
  started = true;
  child.on("exit", (code) => {
    if (started && code) process.exit(code);
  });
  const ready = await waitHealth(localUrl, 15);
  if (!ready) {
    console.error(
      "\n后端启动失败：请查看上方日志，或手动运行 npm run server。",
    );
    process.exit(1);
  }
} else {
  const onLan = await health(lanUrl);
  if (!onLan.ok) {
    console.error(
      `\n后端正在运行，但当前手机接口地址不可达：${lanUrl}（${onLan.error}）。` +
        "\n这通常是换了网络后没有重启后端。请停止终端里的 npm run dev 后重新运行本命令。",
    );
    process.exit(1);
  }
}
const localNow = await health(localUrl);
const lanNow = await health(lanUrl);
const ok = (x) => (x && x.ok ? "✅" : "❌");
console.log("\n—— 真机联调自检 ——");
console.log(`${ok(localNow)} 电脑本机  ${localUrl}`);
console.log(`${ok(lanNow)} 局域网     ${lanUrl}`);
console.log(
  `${lanNow && lanNow.ok ? "✅" : "❌"} 小程序接口 ${runtime.deviceApiBase}/health`,
);
console.log("\n手机端只需要做一件事：用手机浏览器打开下面这个地址");
console.log(`  ${deviceHealth}`);
console.log(
  '  看到 {"ok":true,"demo":true} 说明网络通了；打不开就先解决网络，不要改小程序代码。',
);
console.log("\n真机调试步骤：");
console.log("  1. 保持本终端运行（后端不能关）");
console.log("  2. 微信开发者工具 → 重新编译 → 真机调试");
console.log("  3. 手机微信右上角 “…” → 开发调试 → 打开后重新进入小程序");
console.log("  4. iPhone：设置 → 微信 → 本地网络 → 打开，然后重启微信");
console.log("  5. 手机与电脑必须在同一 Wi-Fi/热点，且热点不能开客户端隔离");
console.log(
  "\n想直接看演示：手机浏览器打开 " + webDemo + "（后端已带网页版，无需另开服务）",
);
console.log(
  "如果手机浏览器打不开上面的地址：把电脑和手机都接到同一个 Wi-Fi 路由器",
);
console.log(
  "（不要让电脑连手机热点、手机又走蜂窝网络），然后重新运行本命令。",
);
console.log(
  "只想先看演示界面：另开终端运行 npm run demo:web，手机浏览器打开 http://电脑IP:5180。",
);
console.log(
  "必须跨网络时才用 npm run demo:tunnel（当前网络可能屏蔽 trycloudflare）。\n",
);
if (started) {
  console.log("后端已启动，按 Ctrl+C 关闭。\n");
  const stop = () => {
    started = false;
    if (child) child.kill("SIGINT");
    setTimeout(() => process.exit(0), 300);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  await new Promise(() => {});
} else {
  console.log("后端已在运行，本检查结束。\n");
}
