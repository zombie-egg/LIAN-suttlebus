import { useEffect, useState } from "react";
import {
  Plus,
  Download,
  RefreshCw,
  X,
  Trash2,
  Pencil,
  AlertTriangle,
} from "lucide-react";
import { api, send } from "./api";
import { PageTitle, Section, CampusMap, statusLabel } from "./common";
const schemas: Record<string, any[]> = {
  stations: [
    ["name", "中文站名"],
    ["en", "英文站名"],
    ["lat", "纬度", "number"],
    ["lng", "经度", "number"],
  ],
  routes: [
    ["name", "中文线路名"],
    ["en", "英文线路名"],
    ["stations", "站点顺序（逗号分隔 ID，环线首尾相同）"],
    ["first", "首班时间", "time"],
    ["last", "末班时间", "time"],
    ["interval", "发车间隔（分钟）", "number"],
    ["color", "线路色", "color"],
    ["enabled", "是否启用", "boolean"],
  ],
  vehicles: [
    ["name", "车辆名"],
    ["deviceId", "北斗终端编号"],
    ["routeId", "线路", "routes"],
    ["driverId", "司机", "drivers"],
    ["lat", "初始纬度", "number"],
    ["lng", "初始经度", "number"],
    ["status", "状态：running / standby / fault"],
  ],
  drivers: [
    ["name", "司机姓名"],
    ["phone", "工作电话"],
    ["enabled", "是否启用", "boolean"],
  ],
  tasks: [
    ["title", "中文任务"],
    ["en", "英文任务"],
    ["driverId", "司机", "drivers"],
    ["vehicleId", "车辆", "vehicles"],
    ["routeId", "线路", "routes"],
    ["date", "任务日期（北京时间）", "date"],
    ["time", "发车时间", "time"],
  ],
  notices: [
    ["title", "中文标题"],
    ["en", "英文标题"],
    ["content", "中文内容", "textarea"],
    ["contentEn", "英文内容", "textarea"],
  ],
};
export function Admin({ onToast }: any) {
  const [data, D] = useState<any>(null);
  const [tab, T] = useState("overview");
  const [edit, E] = useState<any>(null);
  const [error, Err] = useState("");
  const [busy, B] = useState(false);
  const load = async () => {
    try {
      D(await api("/admin"));
      Err("");
    } catch (e: any) {
      Err(e.message);
    }
  };
  useEffect(() => {
    load();
    const i = setInterval(load, 10000);
    return () => clearInterval(i);
  }, []);
  const act = async (f: () => Promise<any>) => {
    try {
      await f();
      await load();
    } catch (e: any) {
      onToast(e.message);
    }
  };
  const labels: Record<string, string> = {
    overview: "运行总览",
    stations: "站点",
    routes: "线路",
    vehicles: "车辆",
    drivers: "司机",
    tasks: "发车任务",
    notices: "公告",
    lost: "失物招领",
    claims: "认领申请",
    feedback: "服务反馈",
    reports: "异常上报",
  };
  const empty: Record<string, any> = {
    stations: { name: "", en: "", lat: 18.435, lng: 110.04 },
    routes: {
      name: "",
      en: "",
      stations: [],
      first: "07:00",
      last: "22:00",
      interval: 10,
      color: "#416854",
      enabled: true,
    },
    vehicles: {
      name: "",
      deviceId: "",
      lat: 18.435,
      lng: 110.04,
      status: "standby",
    },
    drivers: { name: "", enabled: true },
    tasks: {
      title: "",
      en: "",
      date: new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Shanghai",
      }).format(new Date()),
      time: "08:00",
    },
    notices: { title: "", en: "", content: "", contentEn: "" },
  };
  return (
    <>
      <PageTitle
        kicker="OPERATIONS / 管理调度"
        title="每一程，都看得见。"
        subtitle="车辆运行、资料维护与服务处理工作台"
        right={
          <button
            className="key"
            onClick={() =>
              act(async () => {
                const r = await fetch("/api/admin/export", {
                  headers: { Authorization: "Bearer " + sessionStorage.token },
                });
                if (!r.ok) throw Error("导出失败");
                const url = URL.createObjectURL(await r.blob());
                const a = document.createElement("a");
                a.href = url;
                a.download = "黎安运营统计.csv";
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              })
            }
          >
            <Download size={16} />
            导出运营数据
          </button>
        }
      />
      {error && <p className="error">{error}</p>}
      {!data ? null : (
        <>
          <div className="admin-tabs">
            {Object.entries(labels).map(([id, n]) => (
              <button
                key={id}
                className={tab === id ? "selected" : ""}
                onClick={() => T(id)}
              >
                {n}
              </button>
            ))}
          </div>
          {tab === "overview" ? (
            <>
              <div className="stats-grid">
                {[
                  ["配置车辆", data.stats.vehicles, "辆"],
                  ["在线运行", data.stats.running, "辆"],
                  ["待处理反馈", data.stats.feedback, "条"],
                  ["已完成任务", data.stats.completedTasks, "次"],
                ].map(([n, v, u]) => (
                  <div className="stat" key={n}>
                    <span>{n}</span>
                    <b>
                      {v}
                      <small>{u}</small>
                    </b>
                  </div>
                ))}
              </div>
              <div className="two-columns">
                <section className="map-panel">
                  <CampusMap
                    data={data}
                    selected={data.routes[0]?.id}
                    en={false}
                  />
                </section>
                <section className="panel">
                  <Section title="运行预警" note="ALERTS" />
                  {data.stats.alerts.length ? (
                    data.stats.alerts.map((a: any) => (
                      <div key={a.vehicle} className="alert">
                        <AlertTriangle size={18} />
                        <span>
                          <b>{a.vehicle}</b>
                          <p>{a.reason}</p>
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="muted">当前暂无运行预警</p>
                  )}
                  {data.demo && (
                    <button
                      className="key"
                      onClick={() => act(() => send("/demo/refresh", {}))}
                    >
                      <RefreshCw size={15} />
                      刷新演示定位时间
                    </button>
                  )}
                  <p className="footnote">
                    车辆故障、运营车辆定位超过90秒未更新将自动预警。系统不虚构乘客量等没有采集来源的指标。
                  </p>
                </section>
              </div>
              <section className="panel">
                <Section title="最近操作记录" note="AUDIT LOG" />
                {data.events
                  .slice(-8)
                  .reverse()
                  .map((x: any) => (
                    <div className="audit" key={x.id}>
                      <code>{x.kind}</code>
                      <span>{x.userId}</span>
                      <small>{new Date(x.createdAt).toLocaleString()}</small>
                    </div>
                  ))}
              </section>
            </>
          ) : (
            <section className="panel">
              <div className="section-line">
                <Section
                  title={labels[tab]}
                  note={`${data[tab]?.length || 0} RECORDS`}
                />
                {schemas[tab] && (
                  <button
                    className="key dark"
                    onClick={() =>
                      E({ ...empty[tab], id: crypto.randomUUID() })
                    }
                  >
                    <Plus size={16} />
                    新增{labels[tab]}
                  </button>
                )}
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>编号 / 名称</th>
                      <th>详情</th>
                      <th>状态 / 时间</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data[tab]?.map((x: any) => (
                      <tr key={x.id}>
                        <td>
                          <b>{x.name || x.title}</b>
                          <small>{x.id}</small>
                        </td>
                        <td>
                          {x.en || x.content || x.deviceId || x.phone || "—"}
                          {x.stations && (
                            <small>{x.stations.join(" → ")}</small>
                          )}
                          {x.routeId && (
                            <small>
                              线路 {x.routeId} · 司机 {x.driverId || "—"}
                              {x.vehicleId && " · 车辆 " + x.vehicleId}
                            </small>
                          )}
                          {x.lat != null && (
                            <small>
                              {x.lat}, {x.lng}
                            </small>
                          )}
                          {x.reply && <blockquote>回复：{x.reply}</blockquote>}
                        </td>
                        <td>
                          {x.status
                            ? statusLabel(x.status, false)
                            : typeof x.enabled === "boolean"
                              ? x.enabled
                                ? "启用"
                                : "停用"
                              : "—"}
                          <small>
                            {x.time || (x.first && x.first + " — " + x.last)}
                            {x.updatedAt
                              ? new Date(x.updatedAt).toLocaleString()
                              : ""}
                          </small>
                        </td>
                        <td>
                          <div className="table-actions">
                            {schemas[tab] ? (
                              <>
                                <button
                                  className="key icon"
                                  title="编辑"
                                  onClick={() => E(x)}
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  className="key icon"
                                  title="删除"
                                  onClick={() => {
                                    if (
                                      confirm(
                                        "确定删除这条资料？关联中的资料不能删除。",
                                      )
                                    )
                                      act(() =>
                                        api("/admin/" + tab + "/" + x.id, {
                                          method: "DELETE",
                                        }),
                                      );
                                  }}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            ) : (
                              <>
                                {(tab === "lost"
                                  ? ["published", "closed"]
                                  : ["processing", "closed"]
                                ).map((status) => (
                                  <button
                                    className="key"
                                    key={status}
                                    onClick={() => {
                                      const reply = prompt(
                                        "填写处理回复（可留空）",
                                        x.reply || "",
                                      );
                                      if (reply !== null) {
                                        const body: any = { status, reply };
                                        if (
                                          tab === "lost" &&
                                          status === "published"
                                        ) {
                                          const publicTitle = prompt(
                                            "公开标题（请去除个人信息）",
                                            x.publicTitle || x.title,
                                          );
                                          if (!publicTitle) return;
                                          const publicContent = prompt(
                                            "公开描述（仅物品特征，请去除电话等个人信息）",
                                            x.publicContent || "",
                                          );
                                          if (!publicContent) return;
                                          body.publicTitle = publicTitle;
                                          body.publicContent = publicContent;
                                          body.publicPlace =
                                            prompt(
                                              "公开地点（请去除个人信息，可留空）",
                                              x.publicPlace || x.place || "",
                                            ) || "";
                                          body.en =
                                            prompt(
                                              "英文标题（可留空）",
                                              x.en || "",
                                            ) || "";
                                          body.contentEn =
                                            prompt(
                                              "英文描述（可留空）",
                                              x.contentEn || "",
                                            ) || "";
                                        }
                                        act(() =>
                                          send(
                                            "/admin/" + tab + "/" + x.id,
                                            body,
                                            "PATCH",
                                          ),
                                        );
                                      }
                                    }}
                                  >
                                    {statusLabel(status, false)}
                                  </button>
                                ))}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!data[tab]?.length && <div className="empty">暂无记录</div>}
              </div>
            </section>
          )}
        </>
      )}
      {edit && (
        <div className="modal-backdrop">
          <form
            className="modal admin-modal"
            onSubmit={async (e) => {
              e.preventDefault();
              B(true);
              const f = new FormData(e.currentTarget);
              const b: any = {};
              for (const [k, , type] of schemas[tab]) {
                const v = f.get(k);
                b[k] =
                  type === "number"
                    ? Number(v)
                    : type === "boolean"
                      ? v === "true"
                      : k === "stations"
                        ? String(v)
                            .split(",")
                            .map((x) => x.trim())
                            .filter(Boolean)
                        : v;
              }
              try {
                await send("/admin/" + tab + "/" + edit.id, b, "PUT");
                E(null);
                load();
              } catch (e: any) {
                onToast(e.message);
              } finally {
                B(false);
              }
            }}
          >
            <button
              className="modal-close"
              type="button"
              onClick={() => E(null)}
            >
              <X />
            </button>
            <span className="eyebrow">CONFIGURATION</span>
            <h2>维护{labels[tab]}</h2>
            {schemas[tab].map(([k, label, type]) => (
              <label key={k}>
                {label}
                {type === "boolean" ? (
                  <select name={k} defaultValue={String(edit[k] ?? true)}>
                    <option value="true">启用</option>
                    <option value="false">停用</option>
                  </select>
                ) : ["routes", "drivers", "vehicles"].includes(type) ? (
                  <select name={k} defaultValue={edit[k]} required>
                    <option value="">请选择</option>
                    {data[type].map((x: any) => (
                      <option key={x.id} value={x.id}>
                        {x.name} / {x.id}
                      </option>
                    ))}
                  </select>
                ) : type === "textarea" ? (
                  <textarea
                    name={k}
                    required
                    maxLength={2000}
                    defaultValue={edit[k]}
                  />
                ) : (
                  <input
                    required={k !== "phone"}
                    name={k}
                    type={type || "text"}
                    step="any"
                    maxLength={k === "stations" ? 1000 : 120}
                    defaultValue={
                      Array.isArray(edit[k]) ? edit[k].join(",") : edit[k]
                    }
                  />
                )}
              </label>
            ))}
            {tab === "routes" && (
              <small>
                站点编号：
                {data.stations.map((s: any) => s.id + "=" + s.name).join("；")}
              </small>
            )}
            <button className="key dark" disabled={busy}>
              {busy ? "保存中…" : "保存资料"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
