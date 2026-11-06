import { useState } from "react";
export function FaqDrawer({ en = false }: { en?: boolean }) {
  const [open, setOpen] = useState(0);
  const cards = en
    ? [
        [
          "Arrival",
          "How accurate is the arrival estimate?",
          "Estimates use the ordered route and last reported speed. They disappear if positioning is over 90 seconds old. Actual conditions may change.",
        ],
        [
          "Reminder",
          "Will I get a reminder in the background?",
          "Keep this page open to receive an arrival alert. Audio requires permission and playback support. This is not a background or subscription notification.",
        ],
        [
          "Service",
          "How do I report a lost item?",
          "Open Services, submit the item description and stop, then track progress in My requests. Personal details are never published.",
        ],
      ]
    : [
        [
          "到站预测",
          "还有多久可以上车？",
          "根据车辆最新定位、线路行进顺序及速度估算。定位超过 90 秒未更新时停止预测；到站时间受路况影响，请以现场为准。",
        ],
        [
          "候车提醒",
          "开启提醒后可以关闭页面吗？",
          "请保持页面在前台。到站提醒采用页面弹窗和语音；音频需设备允许播放。本期不提供后台持续提醒或订阅消息。",
        ],
        [
          "失物招领",
          "东西落在摆渡车上怎么办？",
          "在便民服务中提交失物信息，写明乘车时间、站点和物品特征。管理人员处理后，可在“我的记录”查看进展。",
        ],
      ];
  return (
    <section className="faq-cabinet">
      <div className="faq-tray">
        {cards.map((c, i) => (
          <div key={i} className={"file-card " + (open === i ? "open" : "")}>
            <span className="file-tab" style={{ left: `${i * 30 + 3}%` }}>
              {c[0]}
            </span>
            <button
              onClick={() => setOpen(open === i ? -1 : i)}
              aria-expanded={open === i}
            >
              <small>Q.0{i + 1}</small>
              <span>{c[1]}</span>
              <b>{open === i ? "−" : "+"}</b>
            </button>
            {open === i && <p>{c[2]}</p>}
          </div>
        ))}
      </div>
      <div className="cabinet-front">
        <span>LI’AN · {en ? "TRAVEL GUIDE" : "出行指南"}</span>
        <i />
      </div>
    </section>
  );
}
