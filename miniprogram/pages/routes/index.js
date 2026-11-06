const { api, showError, lang } = require("../../utils/api");
Page({
  data: { en: false, routes: [] },
  onShow() {
    this.setData({ en: lang() });
    this.load();
  },
  async load() {
    try {
      const d = await api("/public");
      const favorites = wx.getStorageSync("token")
        ? (await api("/me")).favorites
        : [];
      this.setData({
        demo: d.demo,
        routes: d.routes.map((r) => {
          const [h, m] = r.first.split(":").map(Number),
            [hh, mm] = r.last.split(":").map(Number);
          const times = [];
          for (let x = h * 60 + m; x <= hh * 60 + mm; x += r.interval)
            times.push(
              String(Math.floor(x / 60)).padStart(2, "0") +
                ":" +
                String(x % 60).padStart(2, "0"),
            );
          return {
            ...r,
            favorite: favorites.includes(r.id),
            stops: r.stations.map((id, i) => ({
              ...d.stations.find((s) => s.id === id),
              key: r.id + "-" + i,
            })),
            times,
          };
        }),
      });
    } catch (e) {
      showError(e);
    }
  },
  select(e) {
    wx.setStorageSync("selected", e.currentTarget.dataset);
    wx.switchTab({ url: "/pages/home/index" });
  },
  async favorite(e) {
    try {
      await require("../../utils/api").ensureLogin();
      await api("/favorites", { routeId: e.currentTarget.dataset.id });
      this.load();
    } catch (e) {
      showError(e);
    }
  },
  expand(e) {
    this.setData({
      expanded:
        this.data.expanded === e.currentTarget.dataset.id
          ? ""
          : e.currentTarget.dataset.id,
    });
  },
});
