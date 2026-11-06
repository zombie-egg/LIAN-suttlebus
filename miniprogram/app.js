App({
  globalData: { lang: "zh", demo: false, startupError: "" },
  onLaunch() {
    try {
      this.globalData.lang = wx.getStorageSync("lang") || "zh";
    } catch (error) {
      console.warn("[LiAn startup] storage unavailable", error.message);
    }
    console.info("[LiAn startup] application launched");
  },
  onError(message) {
    this.globalData.startupError = String(message || "").slice(0, 500);
    console.error("[LiAn startup]", this.globalData.startupError);
  },
});
