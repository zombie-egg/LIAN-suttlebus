import { PageTitle, Section, CampusMap, statusLabel } from "./common";
import React, { useEffect, useState } from "react";
import {
  BusFront,
  MapPin,
  ArrowUpRight,
  ArrowRight,
  Clock,
  Star,
  Bell,
  Globe2,
  LayoutGrid,
  Route,
  Briefcase,
  UserRound,
  Settings2,
  ChevronRight,
  Check,
  X,
  Volume2,
  RefreshCw,
  Search,
  Plus,
  Download,
  LogOut,
  Navigation,
  ShieldCheck,
  Inbox,
} from "lucide-react";
import { api, send } from "./api";
import { FaqDrawer } from "./components/ui/faq-drawer";
import { Admin } from "./pages-admin";
import "./styles.css";
export default function App() {
  const [en, E] = useState(localStorage.lang === "en");
  const [page, P] = useState("home");
  const [data, D] = useState<any>(null);
  const [me, M] = useState<any>(null);
  const [toast, T] = useState("");
  const [error, Err] = useState("");
  const [route, R] = useState("");
  const [stop, S] = useState("");
  const [reminder, B] = useState(false);
  const [role, Role] = useState(sessionStorage.role || "student");
  const [login, L] = useState(false);
  const [service, F] = useState("feedback");
  const [driver, Driver] = useState<any>(null);
  const [search, Q] = useState("");
  const t = (zh: string, eng: string) => (en ? eng : zh);
  const refresh = async () => {
    try {
      const d = await api("/public");
      D(d);
      R((r) =>
        d.routes.some((x: any) => x.id === r) ? r : d.routes[0]?.id || "",
      );
      S((s) =>
        d.stations.some((x: any) => x.id === s) ? s : d.stations[0]?.id || "",
      );
      Err("");
      if (sessionStorage.token) {
        M(await api("/me"));
        if (sessionStorage.role === "driver") Driver(await api("/driver"));
      }
    } catch (e: any) {
      Err(e.message);
    }
  };
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 10000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (toast) {
      const id = setTimeout(() => T(""), 4500);
      return () => clearTimeout(id);
    }
  }, [toast]);
  const speak = (zh: string, eng: string) => {
    if ("speechSynthesis" in window) {
      const u = new SpeechSynthesisUtterance(en ? eng : zh);
      u.lang = en ? "en-US" : "zh-CN";
      speechSynthesis.speak(u);
    }
  };
  useEffect(() => {
    if (!reminder || !data) return;
    const vehicles = data.vehicles.filter(
      (v: any) => v.routeId === route && v.eta[stop] != null,
    );
    if (vehicles.some((v: any) => v.eta[stop] <= 2)) {
      B(false);
      const msg = t(
        "车辆即将到站，请做好乘车准备",
        "Your shuttle is arriving. Please get ready.",
      );
      T(msg);
      speak(msg, msg);
      window.alert(msg);
    }
  }, [data, reminder, route, stop]);
  const act = async (fn: () => Promise<any>) => {
    try {
      await fn();
      await refresh();
    } catch (e: any) {
      T(e.message);
    }
  };
  const requireLogin = () => {
    if (!me) {
      L(true);
      return false;
    }
    return true;
  };
  const fav = (id: string) => {
    if (requireLogin()) act(() => send("/favorites", { routeId: id }));
  };
  const loginAs = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await act(async () => {
      const r = f.get("role") === "student" && !data?.demo ? await send("/web-session", {}) : await send("/login", {
        role: f.get("role"),
        demoIdentity:
          localStorage.demoIdentity ||
          (localStorage.demoIdentity = crypto.randomUUID()),
        password: f.get("password"),
        driverId: f.get("driverId"),
      });
      sessionStorage.token = r.token;
      sessionStorage.role = r.user.role;
      Role(r.user.role);
      M(await api("/me"));
      if (r.user.role === "driver") Driver(await api("/driver"));
      L(false);
      P(
        r.user.role === "admin"
          ? "admin"
          : r.user.role === "driver"
            ? "driver"
            : "home",
      );
    });
  };
  const selected = data?.routes.find((r: any) => r.id === route);
  const currentStop = data?.stations.find((s: any) => s.id === stop);
  const buses = data?.vehicles.filter((v: any) => v.routeId === route) || [];
  const arriving = buses
    .filter((v: any) => v.eta[stop] != null)
    .sort((a: any, b: any) => a.eta[stop] - b.eta[stop])[0];
  const nav = [
    ["home", LayoutGrid, t("出行首页", "Overview")],
    ["routes", Route, t("线路时刻", "Routes")],
    ["service", Briefcase, t("便民服务", "Services")],
    ["profile", UserRound, t("我的记录", "My requests")],
  ] as const;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={() => P("home")}>
          <span className="brand-icon">
            <BusFront size={23} />
          </span>
          <span>
            黎安一站式<small>LI’AN ONE</small>
          </span>
        </a>
        <div className="workspace-label">
          {t("园区公共出行服务", "CAMPUS MOBILITY")}
          <span>01</span>
        </div>
        <nav>
          {nav.map(([id, Icon, label]) => (
            <button
              className={page === id ? "active" : ""}
              onClick={() => P(id)}
              key={id}
            >
              <Icon size={19} />
              {label}
              {page === id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="side-note">
          <span className="live-dot" />
          {t("让园区生活，近一点。", "A little closer, every day.")}
          <p>
            {t(
              "黎安国际教育创新试验区",
              "Li’an International Education Innovation Pilot Zone",
            )}
          </p>
          <span className="side-rule" />
          <small>PUBLIC SERVICE · PHASE 01</small>
        </div>
        <div className="side-bottom">
          <button
            onClick={() => {
              if (role === "admin") P("admin");
              else L(true);
            }}
          >
            <Settings2 size={17} />
            {t("管理调度工作台", "Operations console")}
            <ArrowUpRight size={15} />
          </button>
          <button
            onClick={() => {
              if (role === "driver") P("driver");
              else L(true);
            }}
          >
            <ShieldCheck size={17} />
            {t("司机工作台", "Driver workspace")}
            <ArrowUpRight size={15} />
          </button>
          <div className="profile-mini">
            <span>LA</span>
            <div>
              {me
                ? t(
                    role === "student"
                      ? "师生访客"
                      : role === "driver"
                        ? "司机"
                        : "调度管理员",
                    role,
                  )
                : t("欢迎来到黎安", "Welcome to Li’an")}
              <small>
                {me
                  ? t("已登录 · 点击退出", "Signed in · sign out")
                  : t("访客模式 · 点击登录", "Guest · sign in")}
              </small>
            </div>
            <button
              aria-label="登录或退出"
              onClick={() => {
                if (me) {
                  api("/logout", { method: "POST" }).catch(() => {});
                  sessionStorage.clear();
                  M(null);
                  Role("student");
                  P("home");
                } else L(true);
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <span>
            <span className="crumb">LI’AN ONE</span>
            <ChevronRight size={13} />
            {t(
              page === "admin"
                ? "管理调度"
                : page === "driver"
                  ? "司机作业"
                  : "公共出行",
              page === "admin"
                ? "Operations"
                : page === "driver"
                  ? "Driver"
                  : "Public mobility",
            )}
          </span>
          <div>
            <button
              className="language"
              onClick={() => {
                E(!en);
                localStorage.lang = en ? "zh" : "en";
              }}
            >
              <Globe2 size={15} />
              {en ? "中文" : "EN"}
            </button>
            <span className="top-location">
              <MapPin size={14} />
              {t("海南 · 陵水黎安", "Li’an · Hainan")}
            </span>
          </div>
        </header>
        <div className="content">
          {error && (
            <div className="error">
              {error}
              <button onClick={refresh}>{t("重试", "Retry")}</button>
            </div>
          )}
          {(data?.demo || data?.sampleData) && (
            <div className="demo-strip">
              <span className="demo-chip">DEMO</span>
              {t(
                "当前为演示环境 · 车辆、线路与站点为示例数据，请勿用于实际出行",
                "Demo environment · Routes, stops and vehicles are sample data. Do not use for actual travel.",
              )}
              <span>{t("一期建设", "PHASE 01")}</span>
            </div>
          )}
          {!data ? (
            <div className="empty">{t("正在连接园区服务…", "Connecting…")}</div>
          ) : page === "admin" ? (
            <Admin onToast={T} />
          ) : page === "driver" ? (
            <>
              <PageTitle
                kicker="DRIVER WORKSPACE"
                title={t("每一程，安心出发。", "Ready for the next trip.")}
                subtitle={t(
                  "今日任务、调度通知与司乘沟通",
                  "Tasks, dispatch and bilingual assistance",
                )}
              />
              {role !== "driver" ? (
                <button onClick={() => L(true)}>
                  {t("登录司机身份", "Sign in as driver")}
                </button>
              ) : (
                <>
                  <div className="two-columns">
                    <section className="panel">
                      <Section
                        title={t("发车任务", "Departure tasks")}
                        note="DISPATCH"
                      />
                      {driver?.tasks.length === 0 && (
                        <div className="empty">{t("暂无任务", "No tasks")}</div>
                      )}
                      {driver?.tasks.map((x: any) => (
                        <div className="task" key={x.id}>
                          <span className="time-large">{x.time}</span>
                          <h3>{en ? x.en : x.title}</h3>
                          <p>
                            {x.date} ·{" "}
                            {x.status === "pending"
                              ? t("待确认", "Pending")
                              : x.status === "accepted"
                                ? t("已确认", "Accepted")
                                : t("已完成", "Completed")}
                          </p>
                          <button
                            className="key dark"
                            onClick={() => speak(x.title, x.en)}
                          >
                            <Volume2 size={16} />
                            {t("播报任务", "Read task")}
                          </button>
                          {x.status !== "completed" && (
                            <button
                              className="key"
                              onClick={() =>
                                act(() =>
                                  send(
                                    "/tasks/" + x.id,
                                    {
                                      status:
                                        x.status === "pending"
                                          ? "accepted"
                                          : "completed",
                                    },
                                    "PATCH",
                                  ),
                                )
                              }
                            >
                              {x.status === "pending"
                                ? t("确认任务", "Accept")
                                : t("完成任务", "Complete")}
                            </button>
                          )}
                        </div>
                      ))}
                    </section>
                    <section className="panel">
                      <Section
                        title={t("双语沟通卡", "Communication cards")}
                        note="ZH / EN"
                      />
                      {[
                        ["请在站台内有序候车", "Please queue inside the stop."],
                        [
                          "下一站是公共教学楼",
                          "Next stop is the Teaching Center.",
                        ],
                        [
                          "请保管好随身物品",
                          "Please take care of your belongings.",
                        ],
                        [
                          "车辆故障，请等待后续车辆",
                          "Vehicle fault. Please wait for the next shuttle.",
                        ],
                      ].map(([zh, eng]) => (
                        <button
                          className="phrase"
                          key={zh}
                          onClick={() => speak(zh, eng)}
                        >
                          <span>
                            {zh}
                            <small>{eng}</small>
                          </span>
                          <Volume2 size={17} />
                        </button>
                      ))}
                    </section>
                  </div>
                  <section className="panel">
                    <Section
                      title={t("异常一键上报", "Report an issue")}
                      note="REPORT"
                    />
                    <ServiceForm
                      kind="reports"
                      en={en}
                      vehicles={driver?.vehicles}
                      onSubmit={async (b: any) => {
                        await send("/reports", b);
                        T(t("异常已上报调度中心", "Report sent to dispatch"));
                        refresh();
                      }}
                    />
                  </section>
                </>
              )}
            </>
          ) : page === "home" ? (
            <>
              <PageTitle
                kicker="CAMPUS MOBILITY / 园区公共出行"
                title={t("下一程，从容出发。", "Your next trip, at ease.")}
                subtitle={t(
                  "查一辆车，少等一会。连接校园里的每一个日常。",
                  "Less waiting. More living. Your everyday campus connection.",
                )}
                right={
                  <div className="service-badge">
                    <span className="live-dot" />
                    {t("公益出行服务", "PUBLIC SERVICE")}
                    <small>LI’AN · HAINAN</small>
                  </div>
                }
              />
              <div className="home-grid">
                <section className="travel-panel">
                  <div className="section-line">
                    <span className="eyebrow">
                      01 / {t("实时候车", "LIVE ARRIVAL")}
                    </span>
                    <span className="subtle">
                      <RefreshCw size={12} />
                      {t("每 10 秒更新", "Updates every 10s")}
                    </span>
                  </div>
                  <h2>{t("你的摆渡车，到哪了？", "Where is your shuttle?")}</h2>
                  <div className="selectors">
                    <label>
                      <span>{t("选择线路", "ROUTE")}</span>
                      <select
                        value={route}
                        onChange={(e) => {
                          R(e.target.value);
                          S(
                            data.routes.find(
                              (r: any) => r.id === e.target.value,
                            )?.stations[0] || "",
                          );
                          B(false);
                        }}
                      >
                        {data.routes.map((r: any) => (
                          <option key={r.id} value={r.id}>
                            {en ? r.en : r.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="selector-divider" />
                    <label>
                      <span>{t("候车站点", "YOUR STOP")}</span>
                      <select
                        value={stop}
                        onChange={(e) => {
                          S(e.target.value);
                          B(false);
                        }}
                      >
                        {data.stations
                          .filter((s: any) => selected?.stations.includes(s.id))
                          .map((s: any) => (
                            <option key={s.id} value={s.id}>
                              {en ? s.en : s.name}
                            </option>
                          ))}
                      </select>
                    </label>
                  </div>
                  <div className="arrival-ticket">
                    <div className="ticket-top">
                      <span>
                        <span className="live-dot" />
                        {en ? currentStop?.en : currentStop?.name}
                      </span>
                      <span>{t("预计到站", "EST. ARRIVAL")}</span>
                    </div>
                    <div className="arrival-number">
                      {arriving ? (
                        <>
                          {arriving.eta[stop]}
                          <small>{t("分钟", "min")}</small>
                        </>
                      ) : (
                        <span className="no-eta">
                          {t("等待定位", "Awaiting GPS")}
                        </span>
                      )}
                      <div className="arrival-detail">
                        <span>
                          {arriving?.name ||
                            t("暂无可靠预测", "No reliable estimate")}
                        </span>
                        <small>
                          {arriving
                            ? t("按当前路况估算", "Based on current telemetry")
                            : t(
                                "定位未更新或车辆未运营",
                                "Stale location or out of service",
                              )}
                        </small>
                      </div>
                    </div>
                    <div className="ticket-bottom">
                      <span>
                        <BusFront size={15} />
                        {selected?.first} — {selected?.last}
                      </span>
                      <span>
                        {t("约", "Every ")} {selected?.interval}{" "}
                        {t("分钟 / 班", "min")}
                      </span>
                    </div>
                  </div>
                  <div className="travel-actions">
                    <button
                      className={"key " + (reminder ? "green" : "dark")}
                      onClick={() => {
                        if (!route || !stop) return;
                        B(!reminder);
                        if (!reminder) {
                          speak("到站提醒已开启", "Arrival reminder enabled");
                          T(
                            t(
                              "保持页面打开，到站前约2分钟提醒",
                              "Keep this page open. Alert at about 2 min.",
                            ),
                          );
                        }
                      }}
                    >
                      <Bell size={16} />
                      {reminder
                        ? t("提醒已开启", "Reminder on")
                        : t("到站提醒我", "Remind me")}
                      <span>
                        {reminder ? <Check size={15} /> : <Plus size={15} />}
                      </span>
                    </button>
                    <button
                      className={
                        "key icon " +
                        (me?.favorites.includes(route) ? "starred" : "")
                      }
                      onClick={() => fav(route)}
                      aria-label={t("收藏线路", "Save route")}
                    >
                      <Star size={18} />
                    </button>
                  </div>
                  <p className="footnote">
                    {t(
                      "前台弹窗 + 双语语音提醒 · 预计到站时间仅供参考",
                      "Foreground alert + bilingual audio · Estimates may vary",
                    )}
                  </p>
                </section>
                <section className="map-panel">
                  <div className="map-header">
                    <div>
                      <span className="eyebrow">LIVE MAP</span>
                      <h3>{t("园区出行地图", "Campus travel map")}</h3>
                    </div>
                    <span className="map-demo">
                      {t("示意地图", "SCHEMATIC")}
                    </span>
                  </div>
                  <CampusMap
                    data={data}
                    en={en}
                    selected={route}
                    onStop={(id: string) => {
                      if (!selected?.stations.includes(id))
                        R(
                          data.routes.find((r: any) => r.stations.includes(id))
                            ?.id || route,
                        );
                      S(id);
                      B(false);
                    }}
                    stop={stop}
                  />
                  <div className="map-legend">
                    <span>
                      <i />
                      {t("园区环线", "Campus Loop")}
                    </span>
                    <span>
                      <i className="orange" />
                      {t("教学专线", "Teaching Express")}
                    </span>
                    <span className="map-count">
                      {
                        buses.filter(
                          (v: any) => !v.stale && v.status === "running",
                        ).length
                      }{" "}
                      {t("辆在线", "online")}
                    </span>
                  </div>
                </section>
              </div>
              <div className="quick-links">
                {[
                  [
                    Route,
                    t("线路与时刻", "Routes & times"),
                    t("每一站，都心中有数", "Know every stop"),
                    "routes",
                  ],
                  [
                    Inbox,
                    t("失物招领", "Lost & found"),
                    t("让遗落的物品回家", "Reconnect with your belongings"),
                    "service",
                  ],
                  [
                    Briefcase,
                    t("建议与反馈", "Suggestions"),
                    t("让每次出行更好一点", "Make every trip better"),
                    "service",
                  ],
                ].map(([Icon, title, sub, id]: any, i) => (
                  <button
                    key={title}
                    onClick={() => {
                      P(id);
                      F(i === 1 ? "lost" : "feedback");
                    }}
                  >
                    <span className="quick-icon">
                      <Icon size={22} />
                    </span>
                    <span>
                      <b>{title}</b>
                      <small>{sub}</small>
                    </span>
                    <ArrowUpRight size={18} />
                  </button>
                ))}
              </div>
              <div className="bottom-grid">
                <section className="notice-board">
                  <Section
                    title={t("出行公告", "Travel notice")}
                    note="BULLETIN / 02"
                  />
                  {data.notices.map((n: any) => (
                    <article key={n.id}>
                      <span className="paper-label">
                        {t("服务公告", "NOTICE")}
                      </span>
                      <h3>{en ? n.en : n.title}</h3>
                      <p>{en ? n.contentEn : n.content}</p>
                    </article>
                  ))}
                  <span className="notice-footer">
                    LI’AN ONE · {t("把服务放在身边", "HERE FOR YOUR EVERYDAY")}
                  </span>
                </section>
                <div>
                  <Section
                    title={t("候车小指南", "Before you ride")}
                    note="TRAVEL NOTES"
                  />
                  <FaqDrawer en={en} />
                </div>
              </div>
            </>
          ) : page === "routes" ? (
            <>
              <PageTitle
                kicker="ROUTES & TIMETABLE"
                title={t("每一站，都心中有数。", "Know every stop.")}
                subtitle={t(
                  "全线路时刻表与常用路线",
                  "Schedules and saved routes",
                )}
              />
              <div className="search-box">
                <Search size={18} />
                <input
                  value={search}
                  onChange={(e) => Q(e.target.value)}
                  placeholder={t("搜索线路或站点", "Search routes or stops")}
                />
              </div>
              <div className="route-grid">
                {data.routes
                  .filter((r: any) =>
                    [
                      r.name,
                      r.en,
                      ...r.stations.map((id: string) => {
                        const s = data.stations.find((s: any) => s.id === id);
                        return s?.name + " " + s?.en;
                      }),
                    ]
                      .join(" ")
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )
                  .map((r: any) => (
                    <section className="panel route-card" key={r.id}>
                      <div className="section-line">
                        <span className="route-tag">
                          {r.id.toUpperCase()} / {en ? r.en : r.name}
                        </span>
                        <button
                          className="plain"
                          onClick={() => fav(r.id)}
                          aria-label="收藏"
                        >
                          <Star
                            size={19}
                            fill={
                              me?.favorites.includes(r.id) ? "#b58d47" : "none"
                            }
                          />
                        </button>
                      </div>
                      <h2>{en ? r.en : r.name}</h2>
                      <p>
                        {r.first} — {r.last} · {t("约", "Every")} {r.interval}{" "}
                        {t("分钟 / 班", "min")}
                      </p>
                      <div className="stop-list">
                        {r.stations.map((id: string, i: number) => {
                          const s = data.stations.find((s: any) => s.id === id);
                          return (
                            <button
                              key={i}
                              onClick={() => {
                                R(r.id);
                                S(id);
                                P("home");
                              }}
                            >
                              <i />
                              {en ? s?.en : s?.name}
                              <small>{en ? s?.name : s?.en}</small>
                              <ArrowUpRight size={14} />
                            </button>
                          );
                        })}
                      </div>
                      <details>
                        <summary>
                          {t("查看完整发车时刻", "View departure times")}
                        </summary>
                        <div className="schedule">
                          {schedule(r).map((x) => (
                            <span key={x}>{x}</span>
                          ))}
                        </div>
                        <small>
                          {t(
                            "按配置间隔生成；运营时刻待确认",
                            "Generated from configured interval. Schedule pending confirmation.",
                          )}
                        </small>
                      </details>
                    </section>
                  ))}
              </div>
            </>
          ) : page === "service" ? (
            <>
              <PageTitle
                kicker="HERE TO HELP"
                title={t("小事，也有人在意。", "Here for the little things.")}
                subtitle={t(
                  "失物招领与服务建议，每一件都有回应。",
                  "Lost belongings and suggestions, all in one place.",
                )}
              />
              <div className="tabs">
                {[
                  ["feedback", t("建议反馈", "Feedback")],
                  ["lost", t("失物招领", "Lost & found")],
                ].map(([id, n]) => (
                  <button
                    className={service === id ? "selected" : ""}
                    key={id}
                    onClick={() => F(id)}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="two-columns">
                <section className="panel">
                  <Section
                    title={
                      service === "lost"
                        ? t("提交失物信息", "Report a lost item")
                        : t("说说你的建议", "Share your feedback")
                    }
                    note="NEW REQUEST"
                  />
                  <ServiceForm
                    en={en}
                    kind={service}
                    onSubmit={async (b: any) => {
                      if (!requireLogin()) return false;
                      await send("/" + service, b);
                      T(
                        t(
                          "提交成功，可在我的记录查看进展",
                          "Submitted. Track it in My requests.",
                        ),
                      );
                      await refresh();
                    }}
                  />
                </section>
                <section className="panel">
                  <Section
                    title={
                      service === "lost"
                        ? t("待认领物品", "Found items")
                        : t("反馈处理流程", "How it works")
                    }
                    note="SERVICE DESK"
                  />
                  {service === "lost" ? (
                    data.lost.map((l: any) => (
                      <article className="lost-item" key={l.id}>
                        <span className="paper-label">
                          {t("招领中", "FOUND")}
                        </span>
                        <h3>{en ? l.en || l.title : l.title}</h3>
                        <p>{en ? l.contentEn || l.content : l.content}</p>
                        <small>
                          <MapPin size={12} />
                          {l.place}
                        </small>
                        <button
                          className="key"
                          onClick={() => {
                            if (!requireLogin()) return;
                            const description = prompt(
                              t(
                                "请描述物品特征和领取联系方式（仅管理员可见）",
                                "Describe identifying details and private contact information",
                              ),
                            );
                            if (description)
                              act(async () => {
                                await send("/claims", {
                                  lostId: l.id,
                                  title: l.title,
                                  content: description,
                                });
                                T(t("认领申请已提交", "Claim submitted"));
                              });
                          }}
                        >
                          {t("申请认领", "Claim item")}
                          <ArrowRight size={14} />
                        </button>
                      </article>
                    ))
                  ) : (
                    <div className="steps">
                      {[
                        t(
                          "提交建议，描述发生的时间与站点",
                          "Submit details, time and stop",
                        ),
                        t(
                          "管理人员受理并跟进处理",
                          "Operations reviews your request",
                        ),
                        t(
                          "在我的记录中查看处理回复",
                          "Read the reply in My requests",
                        ),
                      ].map((x, i) => (
                        <p key={x}>
                          <span>0{i + 1}</span>
                          {x}
                        </p>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </>
          ) : (
            <>
              <PageTitle
                kicker="YOUR EVERYDAY"
                title={t("常用的，都在这里。", "Your everyday, in one place.")}
                subtitle={t(
                  "收藏线路与我的服务记录",
                  "Saved routes and service requests",
                )}
              />
              {!me ? (
                <div className="empty panel">
                  <UserRound size={36} />
                  <p>
                    {t(
                      "登录后查看收藏与服务进度",
                      "Sign in to view saved routes and requests",
                    )}
                  </p>
                  <button className="key dark" onClick={() => L(true)}>
                    {t("登录", "Sign in")}
                  </button>
                </div>
              ) : (
                <>
                  <section className="panel">
                    <Section
                      title={t("常用线路", "Saved routes")}
                      note="FAVORITES"
                    />
                    {!me.favorites.length && (
                      <p className="muted">
                        {t(
                          "还没有收藏，在线路页点亮星标即可添加",
                          "No saved routes. Tap a star to add one.",
                        )}
                      </p>
                    )}
                    {data.routes
                      .filter((r: any) => me.favorites.includes(r.id))
                      .map((r: any) => (
                        <button
                          className="phrase"
                          key={r.id}
                          onClick={() => {
                            R(r.id);
                            P("home");
                          }}
                        >
                          {en ? r.en : r.name}
                          <ArrowUpRight size={16} />
                        </button>
                      ))}
                  </section>
                  <section className="panel">
                    <div className="travel-actions">
                      <button className="key" onClick={() => L(true)}>
                        {t("切换工作身份", "Switch workspace")}
                      </button>
                      {role === "admin" && (
                        <button className="key" onClick={() => P("admin")}>
                          管理工作台
                        </button>
                      )}
                      {role === "driver" && (
                        <button className="key" onClick={() => P("driver")}>
                          司机工作台
                        </button>
                      )}
                    </div>
                    <br />
                    <Section
                      title={t("我的服务记录", "My requests")}
                      note="TRACKING"
                    />
                    {["feedback", "lost", "claims"].flatMap((k) =>
                      (me[k] || []).map((x: any) => (
                        <article key={x.id} className="record">
                          <span className="paper-label">
                            {statusLabel(x.status, en)}
                          </span>
                          <h3>{x.title}</h3>
                          <p>{x.content}</p>
                          {x.reply && (
                            <blockquote>
                              {t("处理回复：", "Reply: ")}
                              {x.reply}
                            </blockquote>
                          )}
                          <small>
                            {new Date(x.createdAt).toLocaleString()}
                          </small>
                        </article>
                      )),
                    )}
                    {!me.feedback.length &&
                      !me.lost.length &&
                      !me.claims.length && (
                        <p className="muted">
                          {t("暂无服务记录", "No requests yet")}
                        </p>
                      )}
                  </section>
                </>
              )}
            </>
          )}
          <footer>
            <span>
              LI’AN ONE <i />{" "}
              {t("黎安一站式 · 园区公共出行服务", "CAMPUS PUBLIC MOBILITY")}
            </span>
            <span>
              {t("公益服务，让日常更从容。", "A calmer campus commute.")} ↗
            </span>
          </footer>
        </div>
      </main>
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
          <button onClick={() => T("")}>
            <X size={14} />
          </button>
        </div>
      )}
      {login && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={loginAs}>
            <button
              type="button"
              className="modal-close"
              onClick={() => L(false)}
              aria-label="关闭"
            >
              <X />
            </button>
            <span className="eyebrow">WELCOME TO LI’AN ONE</span>
            <h2>{t("连接你的园区日常", "Connect to campus life")}</h2>
            <p>
              {data?.demo
                ? t(
                    "演示环境可直接选择身份体验。",
                    "Choose a role to explore the demo.",
                  )
                : t(
                    "访客可在当前浏览器保存收藏和服务记录，员工使用工作密码。",
                    "Visitors can save routes and requests in this browser. Staff use a work password.",
                  )}
            </p>
            <label>
              {t("身份", "Role")}
              <select name="role">
                <option value="student">{t("师生访客", "Campus visitor")}</option>
                <option value="driver">{t("司机", "Driver")}</option>
                <option value="admin">
                  {t("调度管理员", "Administrator")}
                </option>
              </select>
            </label>
            <label>
              {t("司机编号（司机身份必填）", "Driver ID (driver only)")}
              <input name="driverId" defaultValue="d1" />
            </label>
            <label>
              {t(
                "工作密码（演示环境免填）",
                "Staff password (not required in demo)",
              )}
              <input name="password" type="password" />
            </label>
            <button className="key dark" type="submit">
              {t("进入服务", "Continue")}
              <ArrowRight size={16} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
function schedule(r: any) {
  const a = r.first.split(":").map(Number),
    b = r.last.split(":").map(Number);
  const result = [];
  for (let m = a[0] * 60 + a[1]; m <= b[0] * 60 + b[1]; m += r.interval)
    result.push(
      String(Math.floor(m / 60)).padStart(2, "0") +
        ":" +
        String(m % 60).padStart(2, "0"),
    );
  return result;
}
export function ServiceForm({ en, kind, onSubmit, vehicles }: any) {
  const [busy, B] = useState(false);
  const [err, E] = useState("");
  return (
    <form
      className="service-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        B(true);
        E("");
        try {
          const result = await onSubmit(Object.fromEntries(f));
          if (result !== false) form.reset();
        } catch (x: any) {
          E(x.message);
        } finally {
          B(false);
        }
      }}
    >
      <label>
        {en ? "Title" : "标题"}
        <input
          required
          name="title"
          maxLength={80}
          placeholder={en ? "What happened?" : "简单说说需要帮助的事情"}
        />
      </label>
      {vehicles && (
        <label>
          {en ? "Vehicle" : "车辆"}
          <select name="vehicleId">
            {vehicles.map((v: any) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        {en ? "Stop / location" : "站点 / 地点"}
        <input
          name="place"
          maxLength={100}
          placeholder={en ? "Where did it happen?" : "发生在哪个站点或哪辆车？"}
        />
      </label>
      <label>
        {en ? "Details" : "详细描述"}
        <textarea
          name="content"
          required
          maxLength={2000}
          rows={5}
          placeholder={
            en
              ? "Describe the issue. Contact details are visible only to staff."
              : "请描述时间、事情经过或物品特征。联系方式仅管理人员可见。"
          }
        />
      </label>
      {kind === "lost" && (
        <small>
          {en
            ? "Reports are published after review."
            : "失物信息经管理员审核后发布。"}
        </small>
      )}
      {err && <p className="error">{err}</p>}
      <button disabled={busy} className="key dark" type="submit">
        {busy
          ? en
            ? "Sending…"
            : "正在提交…"
          : en
            ? "Submit request"
            : "提交信息"}
        <ArrowUpRight size={16} />
      </button>
    </form>
  );
}
