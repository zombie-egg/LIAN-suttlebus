const config = require("../config");
let localDebugReady;
function prepareLocalDebug(base) {
  if (
    config.getEnvironment() !== "develop" ||
    config.isDevtools() ||
    !String(base || "").startsWith("http://") ||
    typeof wx.setEnableDebug !== "function"
  )
    return Promise.resolve();
  if (!localDebugReady)
    localDebugReady = new Promise((resolve) => {
      try {
        wx.setEnableDebug({ enableDebug: true, complete: resolve });
      } catch (_) {
        resolve();
      }
    });
  return localDebugReady;
}
function networkMessage(error, apiBase) {
  const en = getApp().globalData.lang === "en";
  const reason = (error && error.errMsg) || "";
  if (/domain|url not in/i.test(reason))
    return en
      ? "API domain blocked. Open 开发调试 on the phone, or configure the HTTPS allowed domain."
      : "接口被域名校验拦截：手机右上角“…”→“开发调试”打开后重进；正式环境需配置 HTTPS 合法域名";
  if (/timeout/i.test(reason))
    return en
      ? `Backend timed out at ${apiBase}. Check Wi-Fi, the address, and that the server is running.`
      : `连接 ${apiBase} 超时：请确认手机与电脑在同一 Wi-Fi/热点、后端已启动，且该地址可访问`;
  return en
    ? `Cannot reach ${apiBase}. On iPhone allow WeChat → Local Network, then retry.`
    : `无法连接 ${apiBase}：请确认手机与电脑同一 Wi-Fi/热点、后端已启动；iPhone 还需在“设置→微信→本地网络”中允许访问`;
}
function requestOnce(apiBase, path, body, method) {
  return new Promise((resolve, reject) => {
    const previous = wx.getStorageSync("authApiBase");
    if (previous && previous !== apiBase) {
      wx.removeStorageSync("token");
      wx.removeStorageSync("role");
    }
    wx.setStorageSync("authApiBase", apiBase);
    wx.request({
      url: apiBase + path,
      method: method || (body ? "POST" : "GET"),
      data: body,
      timeout: 6000,
      header: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + (wx.getStorageSync("token") || ""),
      },
      success: (r) => {
        if (r.statusCode >= 200 && r.statusCode < 300) resolve(r.data);
        else {
          if (r.statusCode === 401) {
            wx.removeStorageSync("token");
            wx.removeStorageSync("role");
          }
          const failure = Error(
            (r.data && r.data.error) || "Request failed (" + r.statusCode + ")",
          );
          failure.statusCode = r.statusCode;
          failure.reached = true;
          reject(failure);
        }
      },
      fail: (error) => {
        const failure = Error(networkMessage(error, apiBase));
        failure.detail = (error && error.errMsg) || "";
        failure.apiBase = apiBase;
        failure.reached = false;
        reject(failure);
      },
    });
  });
}
async function api(path, body, method) {
  const bases = config.getApiCandidates();
  let lastError;
  for (const apiBase of bases) {
    await prepareLocalDebug(apiBase);
    try {
      const data = await requestOnce(apiBase, path, body, method);
      config.rememberApiBase(apiBase);
      return data;
    } catch (e) {
      lastError = e;
      // 已收到 HTTP 响应说明地址可达；域名校验换地址也无济于事，直接返回错误。
      if (e.reached) break;
      if (/domain|url not in/i.test(e.detail || "")) break;
    }
  }
  config.forgetApiBase();
  throw lastError || Error("无法连接后端 / Cannot reach backend");
}

const showError = (e) =>
  wx.showToast({
    title: e.message || "请求失败",
    icon: "none",
    duration: 3000,
  });
async function login() {
  const state = await api("/health");
  getApp().globalData.demo = state.demo;
  let result;
  if (state.demo)
    result = await api("/login", {
      role: "student",
      demoIdentity:
        wx.getStorageSync("demoIdentity") ||
        (() => {
          const id =
            "guest-" + Date.now() + "-" + Math.random().toString(36).slice(2);
          wx.setStorageSync("demoIdentity", id);
          return id;
        })(),
    });
  else {
    const { code } = await new Promise((resolve, reject) =>
      wx.login({ success: resolve, fail: reject }),
    );
    result = await api("/wx-login", { code });
  }
  wx.setStorageSync("token", result.token);
  wx.setStorageSync("role", result.user.role);
  return result;
}
async function ensureLogin() {
  if (!wx.getStorageSync("token")) return login();
}
function lang() {
  const en = getApp().globalData.lang === "en";
  ["出行|Travel", "线路|Routes", "服务|Services", "我的|My"].forEach(
    (x, index) => wx.setTabBarItem({ index, text: x.split("|")[en ? 1 : 0] }),
  );
  return en;
}
function audio(name, en) {
  const a = wx.createInnerAudioContext();
  a.src =
    config.getApiBase() + "/audio/" + name + "-" + (en ? "en" : "zh") + ".wav";
  a.onError(() => {
    wx.showToast({
      title: en
        ? "Audio unavailable; read the notification"
        : "语音暂不可用，请查看弹窗提示",
      icon: "none",
    });
    a.destroy();
  });
  a.onEnded(() => a.destroy());
  a.play();
}
module.exports = { api, showError, login, ensureLogin, lang, audio };
