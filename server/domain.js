export const distance = (a, b) => {
  const r = Math.PI / 180;
  const x = (b.lat - a.lat) * r,
    y = (b.lng - a.lng) * r;
  return (
    6371000 *
    2 *
    Math.asin(
      Math.min(
        1,
        Math.sqrt(
          Math.sin(x / 2) ** 2 +
            Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(y / 2) ** 2,
        ),
      ),
    )
  );
};
export function arrival(vehicle, route, stations, targetId, now = Date.now()) {
  if (
    !route ||
    !route.enabled ||
    vehicle.status !== "running" ||
    now - vehicle.updatedAt > 90000
  )
    return null;
  const path = route.stations.map((id) => stations.find((s) => s.id === id));
  if (path.some((p) => !p) || !path.length) return null;
  // 沿线路顺序：投影到最近路段，仅向前累计，不用直线距离代替行程
  let segment = 0,
    best = Infinity,
    progress = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i],
      b = path[i + 1];
    const dx = b.lng - a.lng,
      dy = b.lat - a.lat;
    const t = Math.max(
      0,
      Math.min(
        1,
        ((vehicle.lng - a.lng) * dx + (vehicle.lat - a.lat) * dy) /
          (dx * dx + dy * dy || 1),
      ),
    );
    const p = { lat: a.lat + dy * t, lng: a.lng + dx * t };
    const d = distance(vehicle, p);
    if (d < best) {
      best = d;
      segment = i;
      progress = t;
    }
  }
  if (best > 500) return null;
  const loop = path[0].id === path.at(-1).id;
  let meters = 0;
  for (let n = 0; n < path.length - 1; n++) {
    const i = (segment + n) % (path.length - 1);
    if (!loop && i < segment) break;
    meters += distance(path[i], path[i + 1]) * (n === 0 ? 1 - progress : 1);
    if (path[i + 1].id === targetId)
      return Math.max(
        1,
        Math.ceil(
          meters / ((Math.max(6, vehicle.speed) * 1000) / 60) + n * 0.3,
        ),
      );
  }
  return null;
}
export function publicState(s, demo) {
  const now = Date.now();
  return {
    demo,
    sampleData: demo || s.sampleData === true,
    serverTime: now,
    stations: s.stations,
    routes: s.routes.filter((r) => r.enabled),
    vehicles: s.vehicles.map((v) => {
      const { driverId, deviceId, ...safe } = v;
      return {
        ...safe,
        stale: now - v.updatedAt > 90000,
        eta: Object.fromEntries(
          s.stations.map((t) => [
            t.id,
            arrival(
              v,
              s.routes.find((r) => r.id === v.routeId),
              s.stations,
              t.id,
              now,
            ),
          ]),
        ),
      };
    }),
    notices: s.notices,
    lost: s.lost
      .filter((l) => l.status === "published")
      .map((l) => ({
        id: l.id,
        title: l.publicTitle || l.title,
        en: l.en || "",
        content: l.publicContent || (l.userId === "system" ? l.content : ""),
        contentEn: l.contentEn || "",
        place: l.publicPlace || (l.userId === "system" ? l.place : ""),
        status: l.status,
        createdAt: l.createdAt,
      })),
  };
}
export function csv(rows) {
  return (
    "\ufeff" +
    rows
      .map((r) =>
        r
          .map(
            (v) =>
              '"' +
              String(v ?? "")
                .replace(/^[=+@\-\t\r]/, "'" + "$&")
                .replaceAll('"', '""') +
              '"',
          )
          .join(","),
      )
      .join("\r\n")
  );
}
