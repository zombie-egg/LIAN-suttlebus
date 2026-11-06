# 黎安一站式

黎安国际教育创新试验区公共摆渡车一期数字化服务。项目包含原生微信小程序、React 师生体验页与管理工作台，以及使用 SQLite 的后端服务。界面按照用户提供的 FAQ Drawer 参考设计，使用暖白纸卡、金属抽屉、标签和实体按键质感。

## 本地启动

需要 Node.js 22.13+（建议 Node 24）及 npm。

```bash
cd /Users/zombie/Desktop/园区建设/lian-one
npm ci
npm run dev
```

终端打印网页预览地址；默认尝试 http://127.0.0.1:5173 ，端口占用时自动顺延。本次开发预览地址为 http://127.0.0.1:5176 。API 为 http://127.0.0.1:3100/api 。数据会保存在 `data/demo.sqlite`，服务重启后保留。

本地默认演示模式。在网页登录框选择师生、司机、调度管理员可直接体验，不需要填写密码。司机编号默认 d1。桌面侧边栏可打开工作台；手机版从“我的记录”登录，再切换工作身份。管理后台提供资料增改删、双语公告发布、带日期的发车任务、失物审核/认领处理、服务反馈、异常处理和CSV导出。

演示定位不会自动伪装成实时车流，90秒后正常显示过期。在管理工作台“运行总览”点击“刷新演示定位时间”可重新体验预测。

## 微信开发工具（真机）

1. 一个命令完成地址同步、后端启动和自检：

   ```bash
   npm run demo:phone
   ```

   终端会打印开发工具地址、手机接口地址，并分别从本机和局域网请求 `/api/health`。保持该终端运行。

2. 用手机浏览器打开终端打印的 **手机自测地址**（形如 `http://172.20.10.12:3100/api/health`）。只有看到 `{"ok":true,"demo":true}` 才说明手机到电脑的网络通了；打不开时先换网络，不要改小程序代码。

3. 微信开发工具导入本目录，AppID 为 **wxce7099e8a1d160ed**，点击“真机调试”扫码。手机微信右上角“…”→“开发调试”打开后重新进入小程序；iPhone 还需在“设置→微信→本地网络”中允许访问。开发版手机自动使用电脑局域网地址，模拟器使用 127.0.0.1。

4. 手机打不开自测地址时：让电脑和手机连接**同一个 Wi-Fi 路由器**（不要让电脑连手机热点、手机又走蜂窝网络，热点下手机访问电脑常被系统拦截）。必须跨网络时可以试 `npm run demo:tunnel`，但当前网络可能屏蔽 `trycloudflare.com`，脚本会先自检再改配置。

5. 只想先看演示界面时，直接在手机浏览器打开 `http://电脑局域网IP:3100/`。后端已内置构建好的网页版演示，同一个地址同时提供 API，不经过微信域名校验。需要热更新时再运行 `npm run demo:web`（默认 5180 端口）。

`npm run mini:connect` 会写入 `miniprogram/config.runtime.js`：开发工具地址、真机地址及所有当前私有网卡候选地址，只对本项目 `project.private.config.json` 关闭域名校验。小程序请求按候选地址自动切换，主地址超时会自动尝试下一个。完整排查见 [真机调试排查](docs/真机调试排查.md)。

小程序不读取师生当前位置，不需要定位授权。地图展示的是车辆和站点坐标。语音从同一 API 域名的 `/api/audio/` 播放，文件已经附带，无需使用付费 TTS。提醒及司机轮询只在页面前台工作。

## 生产部署

```bash
cp .env.example .env
# 编辑 .env，DEMO_MODE=false，配置管理员、司机独立凭据、设备密钥和微信密钥
npm run build
npm start
```

`NODE_ENV=production` 时强制关闭免密演示身份。服务默认绑定 127.0.0.1:3100，放在 HTTPS 反向代理后，管理后台与 API 同源。生产模式新建独立空库 `data/park.sqlite`，先用管理员工作台录入司机、站点、线路、车辆、任务和公告。不要将演示数据库拷贝为生产数据库。

环境变量：

| 变量               | 用途                                                                                            |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| ADMIN_PASSWORD     | 管理员工作密码，使用足够长的随机值                                                              |
| DRIVER_CREDENTIALS | JSON 对象，司机编号映射到独立密码，例如 `{"d1":"long-random-password"}`；编号必须与后台资料一致 |
| TELEMETRY_KEY      | 终端接入层共享密钥，使用足够长的随机值，只在终端网关保存                                        |
| WX_APP_ID          | wxce7099e8a1d160ed                                                                              |
| WX_APP_SECRET      | 微信服务端密钥，只保存在服务端，不写进小程序源码                                                |
| DEMO_MODE          | 本地可 true；生产 false                                                                         |
| PORT               | 默认3100                                                                                        |

服务端微信登录调用 code2session，正式师生应使用小程序。浏览器师生入口仅用于演示，生产工作台支持管理员、司机密码登录。部署方需要配置 TLS、域名、微信合法域名、进程守护、备份及日志轮转。单实例 SQLite 适合一期小规模试点，当前整库 JSON 状态存储不适合高频大规模轨迹归档；扩容前应拆分业务表和定位时序存储。设备事件不包含乘客数据，不生成未经采集的客流指标。

## 北斗终端统一接入协议

```http
POST /api/telemetry
Content-Type: application/json
X-Device-Key: <TELEMETRY_KEY>
```

```json
{
  "deviceId": "BD-001",
  "coordinateSystem": "gcj02",
  "lat": 18.4351,
  "lng": 110.0402,
  "speed": 16,
  "timestamp": 1793887200000
}
```

上例时间戳仅示意，联调时应填写当前毫秒时间戳。speed 单位 km/h，0～100；坐标 GCJ-02。请求需比该车上次上报更新，不得超前30秒或过旧120秒。终端供应商如提供 TCP、MQTT 或 WGS-84，需要由接入层完成协议和坐标转换。鉴权成功后车辆状态仍由调度配置控制，不会把故障车辆自动改成运营中。

ETA 使用车辆投影到线路站点连线后的顺序距离、上报速度及停站补偿估算。偏离线路500米、定位超过90秒、车辆非运营或目标不在前进方向时不提供预测。正式运行需采集实车数据校准。

## 验证命令

```bash
npm test
npm run build
npm run check:mini
```

测试使用临时数据库，不修改本地演示库。原生页面仍必须进行微信开发工具和真机验证。完整需求映射、范围、边界与试运营验收见 [一期需求与验收](docs/一期需求与验收.md)。

## 代码结构与样式参考

- miniprogram：原生微信 WXML / WXSS / JavaScript，5个页面，16个中英音频。
- server：身份权限、业务 API、持久化、定位接入和到站计算。
- web/src：React / TypeScript，Tailwind CSS v4，lucide-react 图标。
- web/src/components/ui：复用UI目录，components.json 提供 shadcn 路径约定；在此放复用组件可以统一导入和样式维护。组件已在此实现，无需再运行 shadcn 初始化覆盖工程。
- web/src/components/ui/faq-drawer.tsx：适配园区双语业务的抽屉式帮助组件。
- web/src/components/ui/faq-drawer-reference.tsx.txt：用户提供的原始组件参考，原样留存，不参与编译。原版使用浏览器 DOM，因此微信端用 WXML/WXSS 重构相同视觉语言。

技术依据：[Vite 官方指南](https://vite.dev/guide/)、[微信官方示例项目配置](https://github.com/wechat-miniprogram/miniprogram-demo/blob/master/project.config.json)、[腾讯位置服务小程序坐标说明](https://github.com/TencentLBS/tencentmap-miniprogram-skill/blob/main/quick_start_and_best_practices.md)。

## 界面预览

[桌面网页预览](docs/桌面预览.jpg) · [手机网页预览](docs/手机网页预览.jpg)

也可双击项目中的「启动黎安一站式.command」启动本地服务。以上截图为网页体验端；原生小程序仍需微信开发工具及真机验收。

## 小程序连接与底栏图标更新

小程序现已区分开发工具、局域网真机与正式 HTTPS 后端，底栏已增加普通/选中图标及 SVG 源文件。详见 [小程序后端接入说明](docs/小程序后端接入.md)。

## 网站部署到 Zeabur 专用服务器

从 GitHub 克隆到 `/srv/lian-one` 后，以具备 sudo 权限的用户执行 `deploy/install-zeabur.sh <网站域名>`。域名需解析到服务器公网 IP。脚本用现有 Zeabur 网关接入网站，为本项目创建独立路由与 TLS 证书。网站数据写入 `/var/lib/lian-one`，管理员、司机和定位接口的凭据在首次部署时生成并保存在服务器 `/etc/lian-one.env`。部署会为新库初始化标记为演示的站点和车辆。访客可直接使用网页，收藏和服务记录保存在其浏览器访客身份下。管理员和司机需要工作密码。
