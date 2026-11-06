export function seed() {
  const now = Date.now();
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
  }).format(now);
  const stations = [
    ["s1", "生活一区", "Residence 01", 18.4318, 110.037],
    ["s2", "公共教学楼", "Teaching Center", 18.4351, 110.0402],
    ["s3", "图书馆", "Library", 18.438, 110.0428],
    ["s4", "体育中心", "Sports Center", 18.4395, 110.0375],
    ["s5", "综合服务中心", "Service Center", 18.4355, 110.0345],
  ].map(([id, name, en, lat, lng]) => ({ id, name, en, lat, lng }));
  return {
    stations,
    routes: [
      {
        id: "r1",
        name: "园区环线",
        en: "Campus Loop",
        color: "#416854",
        stations: ["s1", "s2", "s3", "s4", "s5", "s1"],
        first: "07:00",
        last: "22:00",
        interval: 10,
        description: "演示线路，正式运营信息待管理方确认",
        enabled: true,
      },
      {
        id: "r2",
        name: "教学专线",
        en: "Teaching Express",
        color: "#b97b49",
        stations: ["s1", "s2", "s3"],
        first: "07:30",
        last: "18:30",
        interval: 15,
        description: "演示线路，正式运营信息待管理方确认",
        enabled: true,
      },
    ],
    vehicles: [
      {
        id: "v1",
        name: "黎安 01",
        routeId: "r1",
        driverId: "d1",
        deviceId: "BD-DEMO-01",
        lat: 18.4338,
        lng: 110.039,
        speed: 16,
        status: "running",
        updatedAt: now,
      },
      {
        id: "v2",
        name: "黎安 02",
        routeId: "r1",
        driverId: "d2",
        deviceId: "BD-DEMO-02",
        lat: 18.4388,
        lng: 110.04,
        speed: 12,
        status: "running",
        updatedAt: now,
      },
      {
        id: "v3",
        name: "黎安 03",
        routeId: "r2",
        driverId: "d3",
        deviceId: "BD-DEMO-03",
        lat: 18.4318,
        lng: 110.037,
        speed: 0,
        status: "standby",
        updatedAt: now,
      },
    ],
    drivers: [
      { id: "d1", name: "演示司机 01", phone: "", enabled: true },
      { id: "d2", name: "演示司机 02", phone: "", enabled: true },
      { id: "d3", name: "演示司机 03", phone: "", enabled: true },
    ],
    tasks: [
      {
        id: "t1",
        driverId: "d1",
        vehicleId: "v1",
        routeId: "r1",
        title: "园区环线发车任务",
        en: "Campus loop departure",
        time: "08:00",
        date,
        status: "pending",
        createdAt: now,
      },
    ],
    notices: [
      {
        id: "n1",
        title: "欢迎使用黎安一站式",
        en: "Welcome to Li’an One",
        content:
          "当前为一期功能演示，线路、车辆、站点均为示例。请勿据此安排实际出行。",
        contentEn:
          "Demo routes, vehicles and stops. Do not use this data for actual travel.",
        createdAt: now,
      },
    ],
    lost: [
      {
        id: "l1",
        title: "一把米色折叠伞",
        en: "Beige folding umbrella",
        content: "演示招领：在黎安 01 车上拾获，请提供物品特征申请认领。",
        place: "生活一区",
        status: "published",
        createdAt: now,
        userId: "system",
      },
    ],
    feedback: [],
    reports: [],
    claims: [],
    favorites: [],
    events: [],
  };
}
