import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "../server/index.js";
const root = fileURLToPath(new URL("../miniprogram/", import.meta.url));
function runtime({
  base = "http://127.0.0.1:3100/api",
  environment = "develop",
  platform = "devtools",
  deviceBase = "http://192.168.1.2:3100/api",
  deviceCandidates = [],
  productionBase = "",
} = {}) {
  const storage = new Map(),
    calls = [];
  const wx = {
    getAccountInfoSync: () => ({ miniProgram: { envVersion: environment } }),
    getDeviceInfo: () => ({ platform }),
    getStorageSync: (k) => storage.get(k) || "",
    setStorageSync: (k, v) => storage.set(k, v),
    removeStorageSync: (k) => storage.delete(k),
    request: async (opts) => {
      calls.push(opts);
      try {
        const response = await fetch(opts.url, {
          method: opts.method,
          headers: opts.header,
          body: opts.data ? JSON.stringify(opts.data) : undefined,
        });
        opts.success({
          statusCode: response.status,
          data: await response.json(),
        });
      } catch (e) {
        opts.fail({ errMsg: e.message });
      }
    },
  };
  const cache = new Map();
  function load(file) {
    const full = path.resolve(root, file);
    if (cache.has(full)) return cache.get(full);
    const module = { exports: {} };
    cache.set(full, module.exports);
    const context = {
      module,
      exports: module.exports,
      wx,
      getApp: () => ({ globalData: { lang: "zh" } }),
      require: (specifier) => {
        if (specifier.endsWith("config.runtime"))
          return {
            devtoolsApiBase: base,
            deviceApiBase: deviceBase,
            deviceApiCandidates: deviceCandidates,
            productionApiBase: productionBase,
          };
        return load(
          path.relative(
            root,
            path.resolve(path.dirname(full), specifier + ".js"),
          ),
        );
      },
    };
    vm.runInNewContext(fs.readFileSync(full, "utf8"), context);
    cache.set(full, module.exports);
    return module.exports;
  }
  return {
    config: load("config.js"),
    api: load("utils/api.js"),
    storage,
    calls,
    wx,
  };
}
test("小程序按平台选择后端，正式环境拒绝 HTTP，切换后端清除身份", () => {
  const local = runtime();
  assert.equal(local.config.getApiBase(), "http://127.0.0.1:3100/api");
  const phone = runtime({ platform: "ios" });
  assert.equal(phone.config.getApiBase(), "http://192.168.1.2:3100/api");
  const release = runtime({
    environment: "release",
    productionBase: "https://example.com/api",
  });
  release.storage.set("developmentApiBase", "http://127.0.0.1:3100/api");
  assert.equal(release.config.getApiBase(), "https://example.com/api");
  assert.throws(
    () =>
      runtime({
        environment: "release",
        productionBase: "http://192.168.1.2/api",
      }).config.getApiBase(),
    /HTTPS/,
  );
  assert.throws(
    () => runtime({ environment: "trial" }).config.getApiBase(),
    /HTTPS/,
  );
  local.storage.set("token", "old-token");
  local.config.setDevelopmentBase("http://192.168.1.3:3100/api/");
  assert.equal(local.config.getApiBase(), "http://192.168.1.3:3100/api");
  assert.equal(local.storage.has("token"), false);
  assert.throws(
    () => local.config.setDevelopmentBase("http://example.com/api"),
    /HTTPS/,
  );
});
test("使用小程序真实 request 封装完成后端登录、收藏、反馈与退出", async () => {
  const dir = fs.mkdtempSync(
    path.join(fileURLToPath(new URL("file:///tmp/")), "lian-mini-"),
  );
  const bundle = createApp({
    dbPath: path.join(dir, "test.sqlite"),
    demo: true,
  });
  const server = bundle.app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = "http://127.0.0.1:" + server.address().port + "/api";
  const native = runtime({ base });
  try {
    assert.equal((await native.api.api("/health")).ok, true);
    const result = await native.api.login();
    assert.equal(result.user.role, "student");
    assert.ok(native.storage.get("token"));
    const state = await native.api.api("/public");
    assert.equal(state.routes.length, 2);
    await native.api.api("/favorites", { routeId: "r1" });
    await native.api.api("/feedback", {
      title: "小程序联调",
      content: "验证小程序通过 API 持久化反馈",
    });
    const me = await native.api.api("/me");
    assert.equal(me.favorites[0], "r1");
    assert.equal(me.feedback[0].title, "小程序联调");
    await native.api.api("/logout", {}, "POST");
    await assert.rejects(native.api.api("/me"), /登录|Sign in/);
    assert.equal(native.storage.has("token"), false);
    assert.equal(native.storage.has("role"), false);
    assert.ok(
      native.calls.some((r) => r.header["Content-Type"] === "application/json"),
    );
  } finally {
    await new Promise((r) => server.close(r));
    bundle.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("真机忽略模拟器回环缓存，局域网开发请求等待调试准备，正式版不启用调试", async () => {
  const phone = runtime({ platform: "ios" });
  phone.storage.set("developmentApiBase", "http://127.0.0.1:3100/api");
  assert.equal(phone.config.getApiBase(), "http://192.168.1.2:3100/api");
  assert.throws(
    () => phone.config.setDevelopmentBase("http://localhost:3100/api"),
    /手机不能连接/,
  );
  const sequence = [];
  phone.wx.setEnableDebug = (options) => {
    sequence.push("debug");
    options.complete();
  };
  phone.wx.request = (options) => {
    sequence.push("request");
    options.success({ statusCode: 200, data: { ok: true } });
  };
  await phone.api.api("/health");
  await phone.api.api("/health");
  assert.equal(sequence.join(","), "debug,request,request");
  const release = runtime({
    platform: "ios",
    environment: "release",
    productionBase: "https://example.com/api",
  });
  release.wx.setEnableDebug = () => {
    throw Error("正式环境不可开启本地调试");
  };
  release.wx.request = (options) =>
    options.success({ statusCode: 200, data: { ok: true } });
  assert.equal((await release.api.api("/health")).ok, true);
});
test("真机主地址超时后按候选地址自动切换并记住可用地址", async () => {
  const phone = runtime({
    platform: "ios",
    deviceBase: "http://192.168.1.2:3100/api",
    deviceCandidates: [
      "http://192.168.1.2:3100/api",
      "http://192.168.1.3:3100/api",
    ],
  });
  phone.wx.setEnableDebug = (options) => options.complete();
  const urls = [];
  phone.wx.request = (options) => {
    urls.push(options.url);
    if (options.url.includes("192.168.1.2"))
      options.fail({ errMsg: "request:fail timeout" });
    else options.success({ statusCode: 200, data: { ok: true } });
  };
  assert.equal((await phone.api.api("/health")).ok, true);
  assert.deepEqual(urls, [
    "http://192.168.1.2:3100/api/health",
    "http://192.168.1.3:3100/api/health",
  ]);
  assert.equal(phone.storage.get("activeApiBase"), "http://192.168.1.3:3100/api");
  assert.equal(phone.config.getApiBase(), "http://192.168.1.3:3100/api");
  urls.length = 0;
  await phone.api.api("/health");
  assert.deepEqual(urls, ["http://192.168.1.3:3100/api/health"]);
  phone.storage.set("developmentApiBase", "http://192.168.1.9:3100/api");
  assert.equal(phone.config.getApiBase(), "http://192.168.1.9:3100/api");
  assert.equal(phone.config.resetDevelopmentBase(), "http://192.168.1.2:3100/api");
  assert.equal(phone.storage.has("activeApiBase"), false);
});
test("域名校验失败不做无谓的候选地址重试", async () => {
  const phone = runtime({
    platform: "ios",
    deviceBase: "http://192.168.1.2:3100/api",
    deviceCandidates: ["http://192.168.1.3:3100/api"],
  });
  phone.wx.setEnableDebug = (options) => options.complete();
  const urls = [];
  phone.wx.request = (options) => {
    urls.push(options.url);
    options.fail({ errMsg: "request:fail url not in domain list" });
  };
  await assert.rejects(phone.api.api("/health"), /域名校验/);
  assert.equal(urls.length, 1);
});
