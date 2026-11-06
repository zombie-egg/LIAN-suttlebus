import express from "express";
import { DatabaseSync } from "node:sqlite";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { seed } from "./seed.js";
import { publicState, csv } from "./domain.js";
export function createApp({
  dbPath,
  demo = process.env.NODE_ENV !== "production" &&
    process.env.DEMO_MODE !== "false",
} = {}) {
  if (
    !demo &&
    (!process.env.ADMIN_PASSWORD ||
      !process.env.DRIVER_CREDENTIALS ||
      !process.env.TELEMETRY_KEY)
  )
    throw Error(
      "生产模式必须配置 ADMIN_PASSWORD、DRIVER_CREDENTIALS、TELEMETRY_KEY",
    );
  dbPath ||= process.env.LIAN_DB_PATH || (demo ? "data/demo.sqlite" : "data/park.sqlite");
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(
    "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY, body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, body TEXT NOT NULL, expires INTEGER NOT NULL)",
  );
  let s =
    JSON.parse(
      db.prepare("SELECT body FROM state WHERE id=1").get()?.body || "null",
    ) ||
    (demo || process.env.LIAN_SAMPLE_DATA === "true"
      ? { ...seed(), sampleData: true }
      : {
          stations: [],
          routes: [],
          vehicles: [],
          drivers: [],
          tasks: [],
          notices: [],
          lost: [],
          feedback: [],
          reports: [],
          claims: [],
          favorites: [],
          events: [],
        });
  const save = () =>
    db
      .prepare("INSERT OR REPLACE INTO state VALUES (1,?)")
      .run(JSON.stringify(s));
  save();
  const app = express();
  app.disable("x-powered-by");
  if (process.env.LIAN_TRUST_PROXY === "true") app.set("trust proxy", 1);
  app.use(express.json({ limit: "64kb" }));
  app.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    res.set("X-Content-Type-Options", "nosniff");
    next();
  });
  const fail = (res, msg, code = 400) => res.status(code).json({ error: msg });
  const text = (x, max = 500) =>
    typeof x === "string" && x.trim().length > 0 && x.length <= max;
  const driverCredentials = JSON.parse(process.env.DRIVER_CREDENTIALS || "{}");
  const secure = (a, b) =>
    typeof a === "string" &&
    typeof b === "string" &&
    Buffer.byteLength(a) === Buffer.byteLength(b) &&
    timingSafeEqual(Buffer.from(a), Buffer.from(b));
  const session = (user, res) => {
    const token = randomUUID();
    db.prepare("INSERT INTO sessions VALUES (?,?,?)").run(
      token,
      JSON.stringify(user),
      Date.now() + 86400000,
    );
    res.json({ token, user, demo });
  };
  const auth = (req, res, next) => {
    const row = db
      .prepare("SELECT * FROM sessions WHERE token=? AND expires>?")
      .get(
        (req.headers.authorization || "").replace("Bearer ", ""),
        Date.now(),
      );
    if (!row) return fail(res, "请先登录 / Sign in required", 401);
    req.user = JSON.parse(row.body);
    if (
      req.user.role === "driver" &&
      !s.drivers.some((d) => d.id === req.user.driverId && d.enabled)
    )
      return fail(res, "司机账号已停用", 403);
    next();
  };
  const role =
    (...roles) =>
    (req, res, next) =>
      roles.includes(req.user.role)
        ? next()
        : fail(res, "无权限 / Forbidden", 403);
  const audit = (kind, userId, detail) => {
    s.events.push({
      id: randomUUID(),
      kind,
      userId,
      detail,
      createdAt: Date.now(),
    });
  };
  const attempts = new Map();
  const limitLogin = (req, res, next) => {
    const ip = req.ip;
    const a = attempts.get(ip) || { n: 0, t: Date.now() };
    if (Date.now() - a.t > 60000) {
      a.n = 0;
      a.t = Date.now();
    }
    a.n++;
    attempts.set(ip, a);
    if (a.n > 20) return fail(res, "请求过于频繁", 429);
    next();
  };
  app.post("/api/web-session", limitLogin, (req, res) => {
    if (!req.secure && !demo) return fail(res, "请通过 HTTPS 使用网页服务", 403);
    const existing = /(?:^|;\s*)lian_visitor=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || "")?.[1];
    const visitor = existing || randomBytes(32).toString("hex");
    res.cookie("lian_visitor", visitor, { httpOnly: true, secure: !demo, sameSite: "strict", maxAge: 90 * 86400000, path: "/api/web-session" });
    session({ id: "web:" + createHash("sha256").update(visitor).digest("hex"), role: "student" }, res);
  });
  app.post("/api/login", limitLogin, (req, res) => {
    if (!demo && process.env.LIAN_TRUST_PROXY === "true" && !req.secure)
      return fail(res, "请通过 HTTPS 登录", 403);
    const { role: r, password } = req.body;
    if (!["student", "driver", "admin"].includes(r))
      return fail(res, "身份无效");
    if (
      !demo &&
      (r === "student" ||
        !secure(
          password,
          r === "admin"
            ? process.env.ADMIN_PASSWORD
            : driverCredentials[req.body.driverId],
        ))
    )
      return fail(res, "账号或密码错误", 401);
    const driverId = r === "driver" ? req.body.driverId : undefined;
    if (
      r === "driver" &&
      !s.drivers.some((d) => d.id === driverId && d.enabled)
    )
      return fail(res, "司机未启用");
    session(
      {
        id:
          r === "student"
            ? text(req.body.demoIdentity, 80)
              ? "demo:" + req.body.demoIdentity
              : randomUUID()
            : r === "driver"
              ? driverId
              : "admin",
        role: r,
        driverId,
      },
      res,
    );
  });
  app.post("/api/wx-login", async (req, res, next) => {
    try {
      if (!text(req.body.code, 200)) return fail(res, "登录凭证无效");
      if (!process.env.WX_APP_ID || !process.env.WX_APP_SECRET)
        return fail(res, "微信登录尚未配置", 503);
      const u = new URL("https://api.weixin.qq.com/sns/jscode2session");
      u.search = new URLSearchParams({
        appid: process.env.WX_APP_ID,
        secret: process.env.WX_APP_SECRET,
        js_code: req.body.code,
        grant_type: "authorization_code",
      });
      const response = await fetch(u, { signal: AbortSignal.timeout(8000) });
      const result = await response.json();
      if (!result.openid) return fail(res, "微信登录失败，请重试", 401);
      session({ id: result.openid, role: "student" }, res);
    } catch (e) {
      next(e);
    }
  });
  app.use(
    "/api/audio",
    express.static(
      fileURLToPath(new URL("../miniprogram/audio/", import.meta.url)),
    ),
  );
  app.get("/api/health", (_req, res) => res.json({ ok: true, demo }));
  app.get("/api/public", (_req, res) => res.json(publicState(s, demo)));
  app.post("/api/logout", auth, (req, res) => {
    db.prepare("DELETE FROM sessions WHERE token=?").run(
      req.headers.authorization.replace("Bearer ", ""),
    );
    res.json({ ok: true });
  });
  app.get("/api/me", auth, (req, res) =>
    res.json({
      user: req.user,
      favorites: s.favorites
        .filter((x) => x.userId === req.user.id)
        .map((x) => x.routeId),
      feedback: s.feedback.filter((x) => x.userId === req.user.id),
      lost: s.lost.filter((x) => x.userId === req.user.id),
      claims: s.claims.filter((x) => x.userId === req.user.id),
    }),
  );
  app.post("/api/favorites", auth, (req, res) => {
    const { routeId } = req.body;
    if (!s.routes.some((r) => r.id === routeId)) return fail(res, "线路不存在");
    const i = s.favorites.findIndex(
      (x) => x.userId === req.user.id && x.routeId === routeId,
    );
    if (i >= 0) s.favorites.splice(i, 1);
    else s.favorites.push({ userId: req.user.id, routeId });
    save();
    res.json({ ok: true });
  });
  for (const kind of ["feedback", "lost", "claims", "reports"])
    app.post("/api/" + kind, auth, (req, res) => {
      if (kind === "reports" && !["driver", "admin"].includes(req.user.role))
        return fail(res, "无权限", 403);
      const { title, content, place, lostId, vehicleId } = req.body;
      if (!text(content, 2000) || !text(title, 80))
        return fail(res, "请填写标题（最多80字）及内容（最多2000字）");
      if (
        kind === "claims" &&
        !s.lost.some((x) => x.id === lostId && x.status === "published")
      )
        return fail(res, "该物品暂不可认领");
      if (
        kind === "reports" &&
        req.user.role === "driver" &&
        !s.vehicles.some(
          (v) => v.id === vehicleId && v.driverId === req.user.driverId,
        )
      )
        return fail(res, "只能上报本人车辆");
      const item = {
        id: randomUUID(),
        title,
        content,
        place: String(place || "").slice(0, 100),
        lostId,
        vehicleId,
        userId: req.user.id,
        status: kind === "lost" ? "pending" : "open",
        createdAt: Date.now(),
      };
      s[kind].push(item);
      audit(kind, req.user.id, item.id);
      save();
      res.status(201).json(item);
    });
  app.get("/api/driver", auth, role("driver"), (req, res) =>
    res.json({
      tasks: s.tasks.filter((t) => t.driverId === req.user.driverId),
      vehicles: s.vehicles.filter((v) => v.driverId === req.user.driverId),
      reports: s.reports.filter((r) => r.userId === req.user.id),
    }),
  );
  app.patch("/api/tasks/:id", auth, role("driver", "admin"), (req, res) => {
    const t = s.tasks.find((t) => t.id === req.params.id);
    if (!t) return fail(res, "任务不存在", 404);
    if (req.user.role === "driver" && t.driverId !== req.user.driverId)
      return fail(res, "无权限", 403);
    const states = { pending: ["accepted"], accepted: ["completed"] };
    if (!states[t.status]?.includes(req.body.status))
      return fail(res, "任务状态不可回退或跳过");
    t.status = req.body.status;
    audit("task", req.user.id, t.id + ":" + t.status);
    save();
    res.json(t);
  });
  app.post("/api/telemetry", (req, res) => {
    if (!secure(req.headers["x-device-key"], process.env.TELEMETRY_KEY))
      return fail(res, "设备鉴权失败", 401);
    const { deviceId, lat, lng, speed, timestamp, coordinateSystem } = req.body;
    const v = s.vehicles.find((v) => v.deviceId === deviceId);
    if (!v) return fail(res, "终端不存在", 404);
    if (
      coordinateSystem !== "gcj02" ||
      !Number.isFinite(lat) ||
      lat < -90 ||
      lat > 90 ||
      !Number.isFinite(lng) ||
      lng < -180 ||
      lng > 180 ||
      !Number.isFinite(speed) ||
      speed < 0 ||
      speed > 100 ||
      !Number.isFinite(timestamp) ||
      timestamp > Date.now() + 30000 ||
      Date.now() - timestamp > 120000 ||
      timestamp <= v.updatedAt
    )
      return fail(res, "坐标、速度或时间戳无效");
    Object.assign(v, { lat, lng, speed, updatedAt: timestamp });
    audit("position", deviceId, { vehicleId: v.id });
    save();
    res.json({ ok: true });
  });
  app.get("/api/admin", auth, role("admin"), (_req, res) => {
    const now = Date.now();
    res.json({
      ...s,
      demo,
      stats: {
        vehicles: s.vehicles.length,
        running: s.vehicles.filter(
          (v) => v.status === "running" && now - v.updatedAt <= 90000,
        ).length,
        alerts: s.vehicles
          .filter(
            (v) =>
              v.status === "fault" ||
              (v.status === "running" && now - v.updatedAt > 90000),
          )
          .map((v) => ({
            vehicle: v.name,
            reason: v.status === "fault" ? "车辆故障" : "定位超过90秒未更新",
          })),
        feedback: s.feedback.filter((f) => f.status !== "closed").length,
        positions: s.events.filter((e) => e.kind === "position").length,
        completedTasks: s.tasks.filter((t) => t.status === "completed").length,
      },
    });
  });
  app.get("/api/admin/export", auth, role("admin"), (req, res) => {
    res
      .type("text/csv")
      .attachment("lian-operation.csv")
      .send(
        csv([
          ["类型", "编号", "名称或内容", "状态", "时间"],
          ...s.vehicles.map((v) => [
            "车辆",
            v.id,
            v.name,
            v.status,
            new Date(v.updatedAt).toISOString(),
          ]),
          ...["tasks", "feedback", "reports"].flatMap((k) =>
            s[k].map((x) => [
              k,
              x.id,
              x.title,
              x.status,
              new Date(x.createdAt).toISOString(),
            ]),
          ),
        ]),
      );
  });
  const entities = [
    "stations",
    "routes",
    "vehicles",
    "drivers",
    "tasks",
    "notices",
  ];
  function validate(k, x) {
    if (k === "stations")
      return (
        text(x.name, 80) &&
        text(x.en, 120) &&
        Number.isFinite(x.lat) &&
        x.lat >= -90 &&
        x.lat <= 90 &&
        Number.isFinite(x.lng) &&
        x.lng >= -180 &&
        x.lng <= 180
      );
    if (k === "routes")
      return (
        text(x.name, 80) &&
        text(x.en, 120) &&
        Array.isArray(x.stations) &&
        x.stations.length >= 2 &&
        x.stations.every((id) => s.stations.some((t) => t.id === id)) &&
        /^([01]\d|2[0-3]):[0-5]\d$/.test(x.first) &&
        /^([01]\d|2[0-3]):[0-5]\d$/.test(x.last) &&
        x.first <= x.last &&
        Number.isInteger(x.interval) &&
        x.interval >= 1 &&
        x.interval <= 180 &&
        typeof x.enabled === "boolean"
      );
    if (k === "vehicles")
      return (
        text(x.name, 80) &&
        text(x.deviceId, 80) &&
        !s.vehicles.some((v) => v.deviceId === x.deviceId && v.id !== x.id) &&
        s.routes.some((r) => r.id === x.routeId) &&
        s.drivers.some((d) => d.id === x.driverId) &&
        ["running", "standby", "fault"].includes(x.status) &&
        Number.isFinite(x.lat) &&
        Math.abs(x.lat) <= 90 &&
        Number.isFinite(x.lng) &&
        Math.abs(x.lng) <= 180
      );
    if (k === "drivers")
      return text(x.name, 80) && typeof x.enabled === "boolean";
    if (k === "tasks")
      return (
        s.vehicles.some(
          (v) =>
            v.id === x.vehicleId &&
            v.driverId === x.driverId &&
            v.routeId === x.routeId,
        ) &&
        text(x.title, 80) &&
        text(x.en, 120) &&
        /^\d{4}-\d{2}-\d{2}$/.test(x.date) &&
        !Number.isNaN(Date.parse(x.date + "T00:00:00+08:00")) &&
        /^([01]\d|2[0-3]):[0-5]\d$/.test(x.time)
      );
    if (k === "notices")
      return (
        text(x.title, 80) &&
        text(x.en, 120) &&
        text(x.content, 2000) &&
        text(x.contentEn, 3000)
      );
    return false;
  }
  app.put("/api/admin/:kind/:id", auth, role("admin"), (req, res) => {
    const { kind, id } = req.params;
    if (!entities.includes(kind)) return fail(res, "类型无效");
    const old = s[kind].find((x) => x.id === id);
    const x = { ...old, ...req.body, id };
    if (!validate(kind, x)) return fail(res, "字段无效或关联资料不存在");
    if (kind === "tasks") x.status = old?.status || "pending";
    if (kind === "vehicles") {
      x.updatedAt = old?.updatedAt || 0;
      x.speed = old?.speed || 0;
    }
    x.createdAt = old?.createdAt || Date.now();
    s[kind] = s[kind].filter((x) => x.id !== id);
    s[kind].push(x);
    audit("update:" + kind, req.user.id, id);
    save();
    res.json(x);
  });
  app.delete("/api/admin/:kind/:id", auth, role("admin"), (req, res) => {
    const { kind, id } = req.params;
    if (!entities.includes(kind)) return fail(res, "类型无效");
    if (
      s.routes.some((r) => kind === "stations" && r.stations.includes(id)) ||
      s.vehicles.some(
        (v) =>
          (kind === "routes" && v.routeId === id) ||
          (kind === "drivers" && v.driverId === id),
      ) ||
      s.tasks.some(
        (t) =>
          (kind === "vehicles" && t.vehicleId === id) ||
          (kind === "routes" && t.routeId === id) ||
          (kind === "drivers" && t.driverId === id),
      )
    )
      return fail(res, "资料仍被线路、车辆或任务使用，请先解除关联", 409);
    if (!s[kind].some((x) => x.id === id)) return fail(res, "资料不存在", 404);
    s[kind] = s[kind].filter((x) => x.id !== id);
    s.favorites = s.favorites.filter(
      (f) => !(kind === "routes" && f.routeId === id),
    );
    audit("delete:" + kind, req.user.id, id);
    save();
    res.json({ ok: true });
  });
  app.patch("/api/admin/:kind/:id", auth, role("admin"), (req, res) => {
    const { kind, id } = req.params;
    const allowed = {
      lost: ["published", "closed"],
      feedback: ["processing", "closed"],
      claims: ["processing", "closed"],
      reports: ["processing", "closed"],
    };
    if (!allowed[kind]?.includes(req.body.status)) return fail(res, "状态无效");
    const x = s[kind].find((x) => x.id === id);
    if (!x) return fail(res, "记录不存在", 404);
    if (kind === "lost" && req.body.status === "published") {
      if (
        !text(req.body.publicTitle, 80) ||
        !text(req.body.publicContent, 2000)
      )
        return fail(res, "请填写审核后的公开标题和描述");
      Object.assign(x, {
        publicTitle: req.body.publicTitle,
        publicContent: req.body.publicContent,
        publicPlace: String(req.body.publicPlace || "").slice(0, 100),
        en: String(req.body.en || "").slice(0, 120),
        contentEn: String(req.body.contentEn || "").slice(0, 3000),
      });
    }
    Object.assign(x, {
      status: req.body.status,
      reply: String(req.body.reply || "").slice(0, 1000),
    });
    audit("handle:" + kind, req.user.id, id);
    save();
    res.json(x);
  });
  app.post("/api/demo/refresh", auth, role("admin"), (_req, res) => {
    if (!demo) return fail(res, "仅演示环境可用", 403);
    s.vehicles.forEach((v) => (v.updatedAt = Date.now()));
    save();
    res.json({ ok: true });
  });
  const dist = fileURLToPath(new URL("../dist/", import.meta.url));
  app.use(express.static(dist));
  app.use("/api", (_req, res) => fail(res, "接口不存在", 404));
  app.get(/.*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
  app.use((err, req, res, next) => {
    console.error(err.message);
    res.status(500).json({ error: "服务暂不可用，请稍后再试" });
  });
  return { app, close: () => db.close() };
}
const privateIPv4 = (ip) => {
  const p = String(ip || "")
    .split(".")
    .map(Number);
  return (
    p.length === 4 &&
    p.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) &&
    (p[0] === 10 ||
      (p[0] === 192 && p[1] === 168) ||
      (p[0] === 172 && p[1] >= 16 && p[1] <= 31))
  );
};
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { app } = createApp();
  const port = Number(process.env.PORT || 3100);
  // 生产只监听回环交给反向代理；本地每次启动自动绑定当前所有私有网卡地址。
  const addresses = new Set(["127.0.0.1"]);
  if (process.env.NODE_ENV === "production" && process.env.LIAN_INGRESS_IP) {
    if (!privateIPv4(process.env.LIAN_INGRESS_IP)) throw Error("LIAN_INGRESS_IP must be private IPv4");
    addresses.add(process.env.LIAN_INGRESS_IP);
  }
  if (process.env.NODE_ENV !== "production") {
    const current = new Set();
    for (const list of Object.values(networkInterfaces()))
      for (const net of list || [])
        if (
          net.family === "IPv4" &&
          !net.internal &&
          privateIPv4(net.address)
        ) {
          current.add(net.address);
          addresses.add(net.address);
        }
    const configured = String(process.env.LIAN_LAN_IP || "").trim();
    if (configured) {
      if (!privateIPv4(configured))
        throw Error("LIAN_LAN_IP 必须是本机私有局域网IPv4（例如 192.168.1.20）");
      if (current.has(configured)) addresses.add(configured);
      else
        console.warn(
          `LIAN_LAN_IP=${configured} 不是当前网卡地址，已按实际地址监听（可运行 npm run mini:connect -- --lan 更新）`,
        );
    }
  }
  const list = [...addresses];
  const lan = [];
  for (const address of list) {
    const result = await new Promise((resolve) => {
      const server = app.listen(port, address, () => resolve("ok"));
      server.on("error", resolve);
    });
    if (result === "ok") {
      console.log(`黎安一站式 http://${address}:${port}`);
      if (address !== "127.0.0.1") lan.push(`http://${address}:${port}`);
    } else {
      // 旧 IP 已不属于本机时只跳过该地址，不让整个后端退出。
      console.warn(`跳过 ${address}:${port}（${result.code || result.message}）`);
      if (address === "127.0.0.1") {
        console.error(
          `监听 127.0.0.1:${port} 失败，可能有另一个后端实例正在运行。`,
        );
        process.exit(1);
      }
    }
  }
  if (lan.length)
    console.log(`真机联调地址：${lan.map((x) => x + "/api").join("  ")}`);
  else console.warn("没有可用的局域网地址，真机暂时只能通过本机回环访问。");
}
