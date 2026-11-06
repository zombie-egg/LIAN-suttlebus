const fs = require("fs"),
  path = require("path"),
  vm = require("vm"),
  assert = require("assert/strict");
const root = path.join(__dirname, "../miniprogram");
const app = JSON.parse(fs.readFileSync(path.join(root, "app.json")));
assert.equal(app.entryPagePath, "pages/home/index");
assert.equal(app.renderer, "webview");
assert.equal(app.componentFramework, "glass-easel");

let count = 0;
function walk(p) {
  for (const f of fs.readdirSync(p)) {
    const x = path.join(p, f);
    if (fs.statSync(x).isDirectory()) walk(x);
    else if (f.endsWith(".json")) JSON.parse(fs.readFileSync(x));
    else if (f.endsWith(".js")) {
      new vm.Script(fs.readFileSync(x, "utf8"), { filename: x });
      count++;
    }
  }
}
walk(root);
for (const p of app.pages) {
  assert.ok(fs.existsSync(path.join(root, p + ".js")));
  assert.ok(fs.existsSync(path.join(root, p + ".wxml")));
  assert.ok(fs.existsSync(path.join(root, p + ".json")), `缺少页面配置 ${p}`);
}
for (const page of app.pages) {
  const wxml = fs.readFileSync(path.join(root, page + ".wxml"), "utf8");
  for (const match of wxml.matchAll(/wx:(?:if|elif|for)="([^"]*)"/g))
    assert.ok(
      /^\{\{[\s\S]*\}\}$/.test(match[1]),
      `条件/循环需要数据绑定：${page} ${match[0]}`,
    );
}
for (const item of app.tabBar.list)
  for (const key of ["iconPath", "selectedIconPath"]) {
    assert.ok(item[key], `底栏缺少 ${key}`);
    const file = path.join(root, item[key]);
    const buffer = fs.readFileSync(file);
    assert.equal(buffer.subarray(1, 4).toString(), "PNG");
    assert.ok(buffer.length < 40 * 1024);
    assert.equal(buffer.readUInt32BE(16), 81);
    assert.equal(buffer.readUInt32BE(20), 81);
  }
for (const stem of [
  "arrival",
  "enabled",
  "task",
  "departure",
  "phrase0",
  "phrase1",
  "phrase2",
  "phrase3",
])
  for (const lang of ["zh", "en"]) {
    const b = fs.readFileSync(
      path.join(root, "audio", stem + "-" + lang + ".wav"),
    );
    assert.equal(b.subarray(0, 4).toString(), "RIFF");
    assert.ok(b.length > 1000);
  }
const config = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../project.config.json")),
);
assert.equal(config.appid, "wxce7099e8a1d160ed");
console.log(
  `小程序检查通过：${app.pages.length} 个页面，${count} 个 JavaScript 文件，16 个中英音频，8 个底栏图标及条件绑定有效，AppID 配置有效。此检查不能代替微信开发工具编译和真机验证。`,
);
