import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createApp } from "../server/index.js";
import { arrival, csv } from "../server/domain.js";
import { seed } from "../server/seed.js";
test("到站预测按顺序计算、拒绝过期及偏离线路数据", () => {
  const s = seed(),
    v = s.vehicles[0],
    r = s.routes[0];
  assert.ok(arrival(v, r, s.stations, "s2") > 0);
  assert.equal(arrival({ ...v, updatedAt: 0 }, r, s.stations, "s2"), null);
  assert.equal(arrival({ ...v, status: "fault" }, r, s.stations, "s2"), null);
  assert.equal(arrival({ ...v, lat: 20, lng: 112 }, r, s.stations, "s2"), null);
  assert.equal(arrival(v, r, s.stations, "missing"), null);
  assert.equal(arrival(v, { ...r, stations: [] }, s.stations, "s2"), null);
});
test("CSV 转义及电子表格公式防护", () => {
  assert.match(csv([["=1+1", 'a"b']]), /"'=1\+1","a""b"/);
});
test("端到端权限、收藏、反馈闭环、失物审核、任务、定位、CRUD、持久化", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "lian-test-"));
  const dbPath = path.join(dir, "test.sqlite");
  process.env.TELEMETRY_KEY = "test-device-key";
  let bundle = createApp({ dbPath, demo: true });
  let srv = bundle.app.listen(0, "127.0.0.1");
  await new Promise((r) => srv.once("listening", r));
  let base = "http://127.0.0.1:" + srv.address().port + "/api";
  const call = async (p, b, token, method) => {
    const r = await fetch(base + p, {
      method: method || (b ? "POST" : "GET"),
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + (token || ""),
      },
      body: b ? JSON.stringify(b) : undefined,
    });
    return { status: r.status, data: await r.json() };
  };
  const login = async (role) =>
    (await call("/login", { role, driverId: "d1" })).data.token;
  try {
    const student = await login("student"),
      other = await login("student"),
      admin = await login("admin"),
      driver = await login("driver");
    assert.equal((await call("/admin")).status, 401);
    assert.equal((await call("/admin", null, student)).status, 403);
    assert.equal((await call("/admin", null, driver)).status, 403);
    const pub = (await call("/public")).data;
    assert.equal(pub.demo, true);
    assert.equal(pub.vehicles[0].deviceId, undefined);
    assert.equal(pub.vehicles[0].driverId, undefined);
    assert.equal(
      (await call("/favorites", { routeId: "r1" }, student)).status,
      200,
    );
    assert.deepEqual((await call("/me", null, student)).data.favorites, ["r1"]);
    assert.deepEqual((await call("/me", null, other)).data.favorites, []);
    assert.equal(
      (await call("/feedback", { title: "", content: "x" }, student)).status,
      400,
    );
    const f = (
      await call(
        "/feedback",
        { title: "改善候车", content: "增加遮阳设施" },
        student,
      )
    ).data;
    assert.equal(
      (
        await call(
          "/admin/feedback/" + f.id,
          { status: "closed", reply: "已安排现场核查" },
          student,
          "PATCH",
        )
      ).status,
      403,
    );
    await call(
      "/admin/feedback/" + f.id,
      { status: "closed", reply: "已安排现场核查" },
      admin,
      "PATCH",
    );
    assert.equal(
      (await call("/me", null, student)).data.feedback[0].reply,
      "已安排现场核查",
    );
    assert.equal((await call("/me", null, other)).data.feedback.length, 0);
    const lost = (
      await call("/lost", { title: "眼镜", content: "蓝色眼镜盒" }, student)
    ).data;
    assert.ok(!(await call("/public")).data.lost.find((l) => l.id === lost.id));
    await call(
      "/admin/lost/" + lost.id,
      { status: "published", publicTitle: "眼镜", publicContent: "蓝色眼镜盒" },
      admin,
      "PATCH",
    );
    assert.ok((await call("/public")).data.lost.find((l) => l.id === lost.id));
    assert.equal(
      (
        await call(
          "/claims",
          { title: "认领", content: "物品特征", lostId: lost.id },
          student,
        )
      ).status,
      201,
    );
    assert.equal(
      (await call("/tasks/t1", { status: "completed" }, driver, "PATCH"))
        .status,
      400,
    );
    assert.equal(
      (await call("/tasks/t1", { status: "accepted" }, driver, "PATCH")).status,
      200,
    );
    assert.equal(
      (await call("/tasks/t1", { status: "completed" }, driver, "PATCH"))
        .status,
      200,
    );
    assert.equal(
      (
        await call(
          "/reports",
          { title: "异常", content: "故障", vehicleId: "v2" },
          driver,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await call(
          "/reports",
          { title: "异常", content: "故障", vehicleId: "v1" },
          driver,
        )
      ).status,
      201,
    );
    assert.equal(
      (
        await call(
          "/admin/stations/new",
          { name: "新站", en: "New Stop", lat: 18.4, lng: 110.04 },
          admin,
          "PUT",
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await call(
          "/admin/stations/bad",
          { name: "坏站", en: "Bad", lat: 91, lng: 110 },
          admin,
          "PUT",
        )
      ).status,
      400,
    );
    assert.equal(
      (await call("/admin/stations/s1", null, admin, "DELETE")).status,
      409,
    );
    assert.equal(
      (await call("/admin/stations/new", null, admin, "DELETE")).status,
      200,
    );
    assert.equal(
      (
        await call("/telemetry", {
          deviceId: "BD-DEMO-01",
          coordinateSystem: "gcj02",
          lat: 18.43,
          lng: 110.04,
          speed: 15,
          timestamp: Date.now(),
        })
      ).status,
      401,
    );
    const tele = await fetch(base + "/telemetry", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Device-Key": "test-device-key",
      },
      body: JSON.stringify({
        deviceId: "BD-DEMO-01",
        coordinateSystem: "gcj02",
        lat: 18.433,
        lng: 110.038,
        speed: 15,
        timestamp: Date.now(),
      }),
    });
    assert.equal(tele.status, 200);
    const exp = await fetch(base + "/admin/export", {
      headers: { Authorization: "Bearer " + admin },
    });
    assert.equal(exp.status, 200);
    assert.match(await exp.text(), /车辆/);
    await new Promise((r) => srv.close(r));
    bundle.close();
    bundle = createApp({ dbPath, demo: true });
    srv = bundle.app.listen(0, "127.0.0.1");
    await new Promise((r) => srv.once("listening", r));
    base = "http://127.0.0.1:" + srv.address().port + "/api";
    assert.equal(
      (await call("/me", null, student)).data.feedback[0].status,
      "closed",
    );
    assert.equal(
      (await call("/admin", null, admin)).data.stats.completedTasks,
      1,
    );
  } finally {
    await new Promise((r) => srv.close(r));
    bundle.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("正式模式不注入演示资料，拒绝免密登录并校验司机独立凭据", async () => {
  const old = {
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    DRIVER_CREDENTIALS: process.env.DRIVER_CREDENTIALS,
    TELEMETRY_KEY: process.env.TELEMETRY_KEY,
  };
  Object.assign(process.env, {
    ADMIN_PASSWORD: "admin-test-secret",
    DRIVER_CREDENTIALS: JSON.stringify({
      d1: "driver-one-secret",
      d2: "driver-two-secret",
    }),
    TELEMETRY_KEY: "device-test-secret",
  });
  const dir = mkdtempSync(path.join(tmpdir(), "lian-prod-"));
  const bundle = createApp({
    dbPath: path.join(dir, "prod.sqlite"),
    demo: false,
  });
  const srv = bundle.app.listen(0, "127.0.0.1");
  await new Promise((r) => srv.once("listening", r));
  const base = "http://127.0.0.1:" + srv.address().port + "/api";
  const request = (p, body, token) =>
    fetch(base + p, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + (token || ""),
      },
      body: JSON.stringify(body),
    });
  try {
    const state = await (await fetch(base + "/public")).json();
    assert.equal(state.demo, false);
    assert.equal(state.routes.length, 0);
    assert.equal((await request("/login", { role: "admin" })).status, 401);
    assert.equal((await request("/login", { role: "student" })).status, 401);
    const { token } = await (
      await request("/login", { role: "admin", password: "admin-test-secret" })
    ).json();
    const add = await fetch(base + "/admin/drivers/d1", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ name: "司机一", enabled: true }),
    });
    assert.equal(add.status, 200);
    assert.equal(
      (
        await request("/login", {
          role: "driver",
          driverId: "d1",
          password: "driver-two-secret",
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await request("/login", {
          role: "driver",
          driverId: "d1",
          password: "driver-one-secret",
        })
      ).status,
      200,
    );
    await request("/logout", {}, token);
    assert.equal(
      (
        await fetch(base + "/admin", {
          headers: { Authorization: "Bearer " + token },
        })
      ).status,
      401,
    );
  } finally {
    await new Promise((r) => srv.close(r));
    bundle.close();
    rmSync(dir, { recursive: true, force: true });
    for (const [k, v] of Object.entries(old))
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
  }
});
