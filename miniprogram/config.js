const endpoints = require("./config.runtime");
function getEnvironment() {
  try {
    return wx.getAccountInfoSync().miniProgram.envVersion || "develop";
  } catch (_) {
    return "develop";
  }
}
function isDevtools() {
  try {
    const info =
      typeof wx.getDeviceInfo === "function"
        ? wx.getDeviceInfo()
        : wx.getSystemInfoSync();
    return info.platform === "devtools";
  } catch (_) {
    return false;
  }
}
function normalizeBase(value, production = false) {
  const base = String(value || "")
    .trim()
    .replace(/\/+$/, "");
  // 正式地址只允许 HTTPS；开发 HTTP 仅允许回环和私有网段。
  const match = /^(https?):\/\/([^/:?#\s]+)(:\d{1,5})?(\/[^?#\s]*)?$/i.exec(
    base,
  );
  if (!match) throw Error("请填写有效的接口地址，例如 https://example.com/api");
  if (production && match[1].toLowerCase() !== "https")
    throw Error("体验版和正式版必须配置 HTTPS 接口");
  const host = match[2].toLowerCase(),
    parts = host.split(".").map(Number);
  const privateIp =
    parts.length === 4 &&
    parts.every((x) => Number.isInteger(x) && x >= 0 && x <= 255) &&
    (parts[0] === 10 ||
      (parts[0] === 192 && parts[1] === 168) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31));
  if (
    match[1].toLowerCase() === "http" &&
    host !== "localhost" &&
    host !== "127.0.0.1" &&
    !privateIp
  )
    throw Error("HTTP 仅用于本机和同局域网开发，正式服务请使用 HTTPS");
  return base;
}
const isLoopback = (base) =>
  /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::|\/|$)/i.test(String(base || ""));
function stored(key) {
  try {
    return wx.getStorageSync(key) || "";
  } catch (_) {
    return "";
  }
}
function getApiCandidates() {
  if (getEnvironment() !== "develop") {
    if (!endpoints.productionApiBase)
      throw Error("尚未配置正式后端 HTTPS 地址");
    return [normalizeBase(endpoints.productionApiBase, true)];
  }
  const simulator = isDevtools();
  let override = stored("developmentApiBase");
  // 真机调试可能复制模拟器缓存；手机不能使用电脑的回环地址。
  if (!simulator && isLoopback(override)) override = "";
  const active = stored("activeApiBase");
  const configured = simulator
    ? endpoints.devtoolsApiBase
    : endpoints.deviceApiBase;
  const listed = Array.isArray(endpoints.deviceApiCandidates)
    ? endpoints.deviceApiCandidates
    : [];
  const source = simulator
    ? [override, active, configured]
    : [override, active, configured, ...listed];
  const candidates = [];
  for (const value of source) {
    let base;
    try {
      base = normalizeBase(value);
    } catch (_) {
      continue;
    }
    if (!simulator && isLoopback(base)) continue;
    if (candidates.indexOf(base) < 0) candidates.push(base);
  }
  if (!candidates.length)
    throw Error(
      simulator
        ? "尚未配置后端地址，请运行 npm run mini:connect -- --lan"
        : "请先在电脑上运行 npm run mini:connect -- --lan，配置真机后端地址",
    );
  return candidates;
}
function getApiBase() {
  return getApiCandidates()[0];
}
function setDevelopmentBase(base) {
  if (getEnvironment() !== "develop") throw Error("正式环境不允许切换接口");
  const next = normalizeBase(base);
  if (!isDevtools() && isLoopback(next))
    throw Error("手机不能连接127.0.0.1，请填写电脑局域网地址");
  try {
    wx.setStorageSync("developmentApiBase", next);
    ["activeApiBase", "token", "role", "selected"].forEach((k) =>
      wx.removeStorageSync(k),
    );
  } catch (_) {}
  return next;
}
function resetDevelopmentBase() {
  if (getEnvironment() !== "develop") throw Error("正式环境不允许切换接口");
  try {
    ["developmentApiBase", "activeApiBase", "token", "role", "selected"].forEach(
      (k) => wx.removeStorageSync(k),
    );
  } catch (_) {}
  return getApiBase();
}
function rememberApiBase(base) {
  if (getEnvironment() !== "develop") return;
  try {
    const next = normalizeBase(base);
    if (!isDevtools() && isLoopback(next)) return;
    wx.setStorageSync("activeApiBase", next);
  } catch (_) {}
}
function forgetApiBase() {
  try {
    wx.removeStorageSync("activeApiBase");
  } catch (_) {}
}
module.exports = {
  appid: "wxce7099e8a1d160ed",
  forgetApiBase,
  getApiBase,
  getApiCandidates,
  getEnvironment,
  isDevtools,
  normalizeBase,
  rememberApiBase,
  resetDevelopmentBase,
  setDevelopmentBase,
};
