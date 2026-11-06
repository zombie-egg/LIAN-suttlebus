const { api, showError, ensureLogin, lang } = require("../../utils/api");
Page({
  data: { en: false, kind: "feedback", items: [], busy: false },
  onShow() {
    this.setData({ en: lang() });
    this.load();
  },
  async load() {
    try {
      const d = await api("/public");
      this.setData({ items: d.lost, demo: d.demo });
    } catch (e) {
      showError(e);
    }
  },
  tab(e) {
    this.setData({ kind: e.currentTarget.dataset.kind });
  },
  async submit(e) {
    if (this.data.busy) return;
    const b = e.detail.value;
    if (!b.title.trim() || !b.content.trim())
      return showError(
        Error(
          this.data.en ? "Please enter title and details" : "请填写标题及内容",
        ),
      );
    this.setData({ busy: true });
    try {
      await ensureLogin();
      await api("/" + this.data.kind, b);
      wx.showModal({
        title: this.data.en ? "Submitted" : "提交成功",
        content: this.data.en
          ? "Track progress in My requests."
          : "可在“我的”中查看处理进度。",
        showCancel: false,
      });
      this.setData({ formKey: Date.now() });
    } catch (e) {
      showError(e);
    } finally {
      this.setData({ busy: false });
    }
  },
  claim(e) {
    const item = this.data.items.find(
      (x) => x.id === e.currentTarget.dataset.id,
    );
    wx.showModal({
      title: this.data.en ? "Claim item" : "申请认领",
      editable: true,
      placeholderText: this.data.en
        ? "Identifying details + contact"
        : "物品特征和联系方式（仅管理员可见）",
      success: async (r) => {
        if (r.confirm && r.content) {
          try {
            await ensureLogin();
            await api("/claims", {
              lostId: item.id,
              title: item.title,
              content: r.content,
            });
            wx.showToast({ title: this.data.en ? "Submitted" : "申请已提交" });
          } catch (e) {
            showError(e);
          }
        }
      },
    });
  },
});
