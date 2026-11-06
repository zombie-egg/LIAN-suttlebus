const { api, showError, lang, audio } = require("../../utils/api");
const config = require("../../config");
function connectionInfo() {
  try {
    const list = config.getApiCandidates();
    const address = list[0] || "";
    return {
      connectionAddress: address,
      connectionCandidatesText: list.join("\n"),
      healthAddress: address ? address + "/health" : "",
    };
  } catch (_) {
    return {};
  }
}
Page({
  data: {
    en: false,
    loading: true,
    error: "",
    routeIndex: 0,
    stopIndex: 0,
    reminder: false,
    faq: -1,
  },
  onLoad() {
    console.info("[LiAn home] page loaded");
  },
  onReady() {
    console.info("[LiAn home] page rendered");
  },
  onShow() {
    const info = connectionInfo();
    try {
      this.setData({
        ...info,
        development: config.getEnvironment() === "develop",
      });
    } catch (_) {}
    try {
      this.setData({ en: lang() });
    } catch (error) {
      console.warn("[LiAn home] language initialization failed", error.message);
    }
    this.refresh();
    this.timer = setInterval(() => this.refresh(), 10000);
  },
  onHide() {
    clearInterval(this.timer);
  },
  onUnload() {
    clearInterval(this.timer);
  },
  switchLang() {
    getApp().globalData.lang = this.data.en ? "zh" : "en";
    wx.setStorageSync("lang", getApp().globalData.lang);
    this.setData({ en: lang() });
    this.update();
  },
  async refresh() {
    if (this.refreshing) return;
    this.refreshing = true;
    try {
      const d = await api("/public");
      this.public = d;
      getApp().globalData.demo = d.demo;
      const selected = wx.getStorageSync("selected");
      if (selected) {
        this.setData({
          routeIndex: Math.max(
            0,
            d.routes.findIndex((r) => r.id === selected.routeId),
          ),
        });
        this.target = selected.stopId;
        wx.removeStorageSync("selected");
      }
      this.setData({
        demo: d.demo,
        noRoutes: false,
        loading: false,
        error: "",
        routes: d.routes.map((r) => ({
          ...r,
          label: this.data.en ? r.en : r.name,
        })),
      });
      this.update();
    } catch (e) {
      const info = connectionInfo();
      const address = e.apiBase || info.connectionAddress || "";
      this.setData({
        ...info,
        loading: false,
        error: e.message,
        errorDetail: e.detail || "",
        connectionAddress: address,
        healthAddress: address ? address + "/health" : "",
      });
    } finally {
      this.refreshing = false;
    }
  },
  update() {
    if (!this.public) return;
    const d = this.public,
      r = d.routes[this.data.routeIndex];
    if (!r) {
      this.setData({ noRoutes: true, route: null, reminder: false });
      return;
    }
    const stops = r.stations
      .filter((id, i, a) => a.indexOf(id) === i)
      .map((id) => d.stations.find((s) => s.id === id))
      .filter(Boolean)
      .map((s) => ({ ...s, label: this.data.en ? s.en : s.name }));
    let index = this.target
      ? stops.findIndex((s) => s.id === this.target)
      : this.data.stopIndex;
    this.target = null;
    if (index < 0 || index >= stops.length) index = 0;
    const stop = stops[index];
    const buses = d.vehicles.filter((v) => v.routeId === r.id);
    const next = buses
      .filter((v) => v.eta[stop.id] != null)
      .sort((a, b) => a.eta[stop.id] - b.eta[stop.id])[0];
    const en = this.data.en;
    this.setData({
      route: r,
      stops,
      stopIndex: index,
      stop,
      eta: next ? next.eta[stop.id] : null,
      hasEta: !!next && Number.isFinite(next.eta[stop.id]),
      next: next || null,
      lat: stop.lat,
      lng: stop.lng,
      markers: [
        ...d.stations.map((s, i) => ({
          id: i,
          iconPath: "/assets/tabbar/marker-stop.png",
          width: 18,
          height: 18,
          anchor: { x: 0.5, y: 0.5 },
          latitude: s.lat,
          longitude: s.lng,
          title: en ? s.en : s.name,
          callout: {
            content: s.name + " / " + s.en,
            display: "ALWAYS",
            padding: 5,
            borderRadius: 4,
            fontSize: 10,
          },
        })),
        ...buses.map((v, i) => ({
          id: 100 + i,
          iconPath: "/assets/tabbar/travel-active.png",
          width: 30,
          height: 30,
          anchor: { x: 0.5, y: 0.5 },
          latitude: v.lat,
          longitude: v.lng,
          title: v.name,
          callout: {
            content:
              v.name + (v.stale ? (en ? " · stale" : " · 定位过期") : ""),
            display: "ALWAYS",
            padding: 5,
            borderRadius: 5,
            bgColor: "#d4e4c3",
            fontSize: 11,
          },
        })),
      ],
      polyline: [
        {
          points: r.stations.map((id) => {
            const s = d.stations.find((s) => s.id === id);
            return { latitude: s.lat, longitude: s.lng };
          }),
          color: "#4b7452",
          width: 5,
        },
      ],
      notices: d.notices.map((n) => ({
        ...n,
        label: en ? n.en : n.title,
        body: en ? n.contentEn : n.content,
      })),
      routes: d.routes.map((r) => ({ ...r, label: en ? r.en : r.name })),
    });
    if (this.data.reminder && next && next.eta[stop.id] <= 2) {
      this.setData({ reminder: false });
      audio("arrival", en);
      wx.showModal({
        title: en ? "Shuttle arriving" : "车辆即将到站",
        content: en
          ? "Please get ready at the stop."
          : "请做好乘车准备，注意乘车安全。",
        showCancel: false,
      });
    }
  },
  changeRoute(e) {
    this.setData({
      routeIndex: Number(e.detail.value),
      stopIndex: 0,
      reminder: false,
    });
    this.update();
  },
  changeStop(e) {
    this.setData({ stopIndex: Number(e.detail.value), reminder: false });
    this.update();
  },
  remind() {
    const enabled = !this.data.reminder;
    this.setData({ reminder: enabled });
    if (enabled) {
      audio("enabled", this.data.en);
      wx.showModal({
        title: this.data.en ? "Reminder enabled" : "到站提醒已开启",
        content: this.data.en
          ? "Keep this page open. Alert at about 2 minutes."
          : "请保持本页面在前台。预计到站前约2分钟弹窗及语音提醒。",
        showCancel: false,
      });
    }
  },
  async favorite() {
    try {
      const { ensureLogin } = require("../../utils/api");
      await ensureLogin();
      await api("/favorites", { routeId: this.data.route.id });
      wx.showToast({
        title: this.data.en ? "Saved route updated" : "收藏已更新",
        icon: "success",
      });
    } catch (e) {
      showError(e);
    }
  },
  go(e) {
    wx.switchTab({ url: "/pages/" + e.currentTarget.dataset.page + "/index" });
  },
  faq(e) {
    const n = Number(e.currentTarget.dataset.index);
    this.setData({ faq: this.data.faq === n ? -1 : n });
  },
});
