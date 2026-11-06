import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
import { seed } from "../server/seed.js";
import { publicState } from "../server/domain.js";
function page(name, utils, wx = {}) {
  let p;
  const ctx = {
    Page: (x) => (p = x),
    require: () => utils,
    wx,
    getApp: () => ({ globalData: { lang: "zh" } }),
    setInterval: () => 1,
    clearInterval: () => {},
    console,
    Date,
    Set,
  };
  vm.runInNewContext(
    fs.readFileSync(
      new URL("../miniprogram/pages/" + name + "/index.js", import.meta.url),
      "utf8",
    ),
    ctx,
  );
  p.setData = (x) => Object.assign(p.data, x);
  return p;
}
test("小程序候车刷新、线路切换和双语到站提示", async () => {
  const state = publicState(seed(), true);
  const speech = [],
    dialogs = [];
  const p = page(
    "home",
    {
      api: async () => state,
      lang: () => false,
      audio: (...x) => speech.push(x),
    },
    {
      getStorageSync: () => "",
      removeStorageSync: () => {},
      showModal: (x) => dialogs.push(x),
    },
  );
  await p.refresh();
  assert.equal(p.data.route.id, "r1");
  assert.equal(p.data.stops.length, 5);
  p.changeRoute({ detail: { value: "1" } });
  assert.equal(p.data.route.id, "r2");
  assert.equal(p.data.stops.length, 3);
  p.setData({ en: true });
  p.update();
  assert.equal(p.data.stop.label, "Residence 01");
  p.setData({ reminder: true, routeIndex: 0, stopIndex: 1 });
  p.public.vehicles[0].eta.s2 = 1;
  p.update();
  assert.equal(p.data.reminder, false);
  assert.equal(speech[0][0], "arrival");
  assert.equal(dialogs[0].title, "Shuttle arriving");
});
test("小程序线路生成完整发车时刻，站点索引带线路", async () => {
  const state = publicState(seed(), true);
  let selected, navigated;
  const p = page(
    "routes",
    {
      api: async () => state,
      lang: () => false,
      showError: (e) => {
        throw e;
      },
    },
    {
      getStorageSync: () => "",
      setStorageSync: (k, v) => (selected = v),
      switchTab: (x) => (navigated = x.url),
    },
  );
  await p.load();
  assert.equal(p.data.routes[0].times[0], "07:00");
  assert.equal(p.data.routes[0].times.at(-1), "22:00");
  assert.equal(p.data.routes[0].stops.length, 6);
  p.select({ currentTarget: { dataset: { routeId: "r1", stopId: "s2" } } });
  assert.equal(selected.stopId, "s2");
  assert.equal(navigated, "/pages/home/index");
});
