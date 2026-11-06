const { api, showError, login, lang } = require("../../utils/api");
const config = require("../../config");
Page({
  data: { en: false, me: null, password: "", driverId: "d1" },
  onShow() {
    let address = "",
      candidates = [];
    try {
      address = config.getApiBase();
      candidates = config.getApiCandidates();
    } catch (_) {}
    this.setData({
      en: lang(),
      development: config.getEnvironment() === "develop",
      connectionAddress: address,
      connectionInput: address,
      connectionCandidatesText: candidates.join("\n"),
      connectionStatus: "",
    });
    this.load();
  },
  async load() {
    try {
      const d = await api("/public");
      let me = null;
      if (wx.getStorageSync("token")) me = await api("/me");
      const en = this.data.en;
      const statuses = {
        pending: en ? "Pending review" : "待审核",
        published: en ? "Published" : "招领中",
        open: en ? "Submitted" : "已提交",
        processing: en ? "In progress" : "处理中",
        closed: en ? "Closed" : "已办结",
      };
      this.setData({
        demo: d.demo,
        connectionStatus: en ? "Connected" : "后端已连接",
        me,
        role: wx.getStorageSync("role"),
        favorites: d.routes.filter((r) => me && me.favorites.includes(r.id)),
        records: me
          ? [...me.feedback, ...me.lost, ...me.claims]
              .sort((a, b) => b.createdAt - a.createdAt)
              .map((x) => ({
                ...x,
                statusLabel: statuses[x.status],
                time: new Date(x.createdAt).toLocaleString(),
              }))
          : [],
      });
    } catch (e) {
      this.setData({ connectionStatus: e.message });
      showError(e);
    }
  },
  changeConnection(e) {
    this.setData({ connectionInput: e.detail.value });
  },
  async connectBackend() {
    this.setData({ connectionChecking: true });
    try {
      const address = config.setDevelopmentBase(this.data.connectionInput);
      let candidates = [];
      try {
        candidates = config.getApiCandidates();
      } catch (_) {}
      this.setData({
        connectionAddress: address,
        connectionCandidatesText: candidates.join("\n"),
        me: null,
        role: "",
      });
      const health = await api("/health");
      if (health.ok !== true)
        throw Error(
          this.data.en ? "Incompatible backend" : "该地址不是黎安一站式后端",
        );
      await this.load();
    } catch (e) {
      this.setData({ connectionStatus: e.message });
      showError(e);
    } finally {
      this.setData({ connectionChecking: false });
    }
  },
  async login() {
    try {
      await login();
      this.load();
    } catch (e) {
      showError(e);
    }
  },
  resetConnection() {
    try {
      const address = config.resetDevelopmentBase();
      let candidates = [];
      try {
        candidates = config.getApiCandidates();
      } catch (_) {}
      this.setData({
        connectionAddress: address,
        connectionInput: address,
        connectionCandidatesText: candidates.join("\n"),
        me: null,
        role: "",
        connectionStatus: "",
      });
      this.load();
    } catch (e) {
      showError(e);
    }
  },
  logout() {
    api("/logout", {}, "POST").catch(() => {});
    wx.removeStorageSync("token");
    wx.removeStorageSync("role");
    this.setData({ me: null });
    this.load();
  },
  select(e) {
    wx.setStorageSync("selected", { routeId: e.currentTarget.dataset.id });
    wx.switchTab({ url: "/pages/home/index" });
  },
  changeLang() {
    getApp().globalData.lang = this.data.en ? "zh" : "en";
    wx.setStorageSync("lang", getApp().globalData.lang);
    this.setData({ en: lang() });
    this.load();
  },
  async driverLogin(e) {
    try {
      const r = await api("/login", { role: "driver", ...e.detail.value });
      wx.setStorageSync("token", r.token);
      wx.setStorageSync("role", r.user.role);
      wx.navigateTo({ url: "/pages/driver/index" });
    } catch (e) {
      showError(e);
    }
  },
  goDriver() {
    wx.navigateTo({ url: "/pages/driver/index" });
  },
});
