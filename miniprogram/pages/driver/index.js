const { api, showError, lang, audio } = require("../../utils/api");
const phrases = [
  ["请在站台内有序候车", "Please queue inside the stop."],
  ["下一站是公共教学楼", "Next stop is the Teaching Center."],
  ["请保管好随身物品", "Please take care of your belongings."],
  [
    "车辆故障，请等待后续车辆",
    "Vehicle fault. Please wait for the next shuttle.",
  ],
];
Page({
  data: { en: false, tasks: [], vehicles: [], phrases },
  onShow() {
    this.setData({ en: lang() });
    this.known = this.known || new Set();
    this.load();
    this.timer = setInterval(() => this.load(), 10000);
  },
  onHide() {
    clearInterval(this.timer);
  },
  onUnload() {
    clearInterval(this.timer);
  },
  async load() {
    try {
      const d = await api("/driver");
      this.setData(d);
      d.tasks
        .filter((t) => t.status === "pending")
        .forEach((t) => {
          if (!this.known.has(t.id)) {
            this.known.add(t.id);
            audio("task", this.data.en);
            wx.showToast({
              title: this.data.en ? "New dispatch task" : "有新的排班任务",
              icon: "none",
            });
          }
        });
      const now = new Date(),
        hhmm =
          String(now.getHours()).padStart(2, "0") +
          ":" +
          String(now.getMinutes()).padStart(2, "0");
      d.tasks
        .filter(
          (t) =>
            t.status !== "completed" &&
            t.date ===
              [
                now.getFullYear(),
                String(now.getMonth() + 1).padStart(2, "0"),
                String(now.getDate()).padStart(2, "0"),
              ].join("-") &&
            t.time === hhmm,
        )
        .forEach((t) => {
          if (!this.known.has(t.id + "due")) {
            this.known.add(t.id + "due");
            audio("departure", this.data.en);
            wx.showModal({
              title: this.data.en ? "Departure reminder" : "发车提醒",
              content: this.data.en ? t.en : t.title,
              showCancel: false,
            });
          }
        });
    } catch (e) {
      showError(e);
    }
  },
  speakTask() {
    audio("task", this.data.en);
  },
  phrase(e) {
    audio("phrase" + e.currentTarget.dataset.index, this.data.en);
  },
  async accept(e) {
    try {
      await api(
        "/tasks/" + e.currentTarget.dataset.id,
        { status: e.currentTarget.dataset.status },
        "PATCH",
      );
      this.load();
    } catch (e) {
      showError(e);
    }
  },
  async report(e) {
    const b = e.detail.value;
    if (!this.data.vehicles.length)
      return showError(
        Error(this.data.en ? "No assigned vehicle" : "暂无分配车辆"),
      );
    if (!b.content.trim())
      return showError(
        Error(this.data.en ? "Enter details" : "请填写异常详情"),
      );
    try {
      await api("/reports", {
        title: b.type,
        content: b.content,
        vehicleId: this.data.vehicles[this.data.vehicleIndex || 0].id,
      });
      wx.showToast({ title: this.data.en ? "Report sent" : "上报成功" });
      this.load();
    } catch (e) {
      showError(e);
    }
  },
  vehicle(e) {
    this.setData({ vehicleIndex: Number(e.detail.value) });
  },
  quick(e) {
    const kind = e.currentTarget.dataset.kind;
    wx.showModal({
      title: this.data.en ? "Send report?" : "一键上报",
      content: this.data.en
        ? kind + " · Report assigned vehicle to dispatch."
        : kind + " · 上报已分配车辆至调度中心",
      success: async (r) => {
        if (!r.confirm) return;
        try {
          const v = this.data.vehicles[this.data.vehicleIndex || 0];
          if (!v)
            throw Error(this.data.en ? "No assigned vehicle" : "暂无分配车辆");
          await api("/reports", {
            title: kind,
            content: kind + " / " + v.name,
            vehicleId: v.id,
          });
          wx.showToast({ title: this.data.en ? "Report sent" : "已上报" });
          this.load();
        } catch (e) {
          showError(e);
        }
      },
    });
  },
});
