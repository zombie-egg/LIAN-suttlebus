Page({
  data: { status: "页面脚本已执行" },
  onLoad: function () {
    console.info("[LiAn diagnostic 1105C] onLoad");
  },
  onReady: function () {
    console.info("[LiAn diagnostic 1105C] onReady");
  },
  home: function () {
    wx.switchTab({ url: "/pages/home/index" });
  },
});
