export function statusLabel(s: string, en: boolean) {
  const labels: Record<string, string[]> = {
    pending: ["待审核", "Pending review"],
    published: ["招领中", "Published"],
    open: ["已提交", "Submitted"],
    processing: ["处理中", "In progress"],
    closed: ["已办结", "Closed"],
  };
  return labels[s]?.[en ? 1 : 0] || s;
}
export function PageTitle({ kicker, title, subtitle, right }: any) {
  return (
    <div className="page-title">
      <div>
        <span className="eyebrow">{kicker}</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {right}
    </div>
  );
}
export function Section({ title, note }: any) {
  return (
    <div className="section-title">
      <h3>{title}</h3>
      <span>{note}</span>
    </div>
  );
}
export function CampusMap({ data, en, selected, onStop, stop }: any) {
  const lngs = data.stations.map((s: any) => s.lng),
    lats = data.stations.map((s: any) => s.lat);
  const minLng = Math.min(...lngs),
    maxLng = Math.max(...lngs),
    minLat = Math.min(...lats),
    maxLat = Math.max(...lats);
  const pos = (s: any) => ({
    x: 70 + ((s.lng - minLng) / (maxLng - minLng || 0.01)) * 470,
    y: 360 - ((s.lat - minLat) / (maxLat - minLat || 0.01)) * 270,
  });
  return (
    <div className="campus-map">
      <svg
        viewBox="0 0 640 450"
        role="img"
        aria-label={en ? "Demo campus map" : "演示园区地图"}
      >
        <defs>
          <pattern
            id="grid"
            width="22"
            height="22"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M22 0H0V22"
              fill="none"
              stroke="#cbd0c2"
              strokeWidth=".45"
            />
          </pattern>
        </defs>
        <rect width="640" height="450" fill="#e8ebdf" />
        <rect width="640" height="450" fill="url(#grid)" />
        <path d="M540 -20 Q480 100 570 190T610 450H670V-20" fill="#ccd9cf" />
        <path
          d="M-10 270Q160 210 260 280T570 300"
          stroke="#f7f6ee"
          strokeWidth="28"
          fill="none"
        />
        <path
          d="M170 0L140 450M360 0L390 450"
          stroke="#f7f6ee"
          strokeWidth="22"
          fill="none"
        />
        {[
          [110, 130, 70, 45],
          [210, 95, 100, 65],
          [410, 140, 70, 85],
          [270, 320, 100, 70],
          [40, 310, 55, 75],
          [200, 215, 80, 40],
          [410, 305, 90, 65],
        ].map(([x, y, w, h], i) => (
          <g key={i}>
            <rect
              x={x + 3}
              y={y + 4}
              width={w}
              height={h}
              rx="4"
              fill="#cdd1c1"
            />
            <rect
              x={x}
              y={y}
              width={w}
              height={h}
              rx="4"
              fill="#dde0d2"
              stroke="#c3c9b6"
            />
            <path
              d={`M${x + 8} ${y + 8}h${w - 16}`}
              stroke="#eef0e5"
              strokeWidth="3"
            />
          </g>
        ))}
        <text x="276" y="200" className="map-land-label">
          LI’AN CAMPUS
        </text>
        <text
          x="577"
          y="235"
          transform="rotate(75 577 235)"
          className="map-land-label"
        >
          COASTLINE
        </text>
        {data.routes.map((r: any) => (
          <polyline
            key={r.id}
            points={r.stations
              .map((id: string) => {
                const s = data.stations.find((s: any) => s.id === id);
                if (!s) return "";
                const p = pos(s);
                return `${p.x},${p.y}`;
              })
              .join(" ")}
            fill="none"
            stroke={r.color || "#416854"}
            strokeWidth={r.id === selected ? 5 : 3}
            strokeDasharray={r.id === "r2" ? "7 7" : ""}
            strokeLinejoin="round"
            opacity={r.id === selected ? 1 : 0.5}
          />
        ))}
        {data.stations.map((s: any) => {
          const p = pos(s);
          return (
            <g
              role="button"
              tabIndex={0}
              aria-label={en ? s.en : s.name}
              key={s.id}
              onClick={() => onStop?.(s.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onStop?.(s.id);
              }}
              className="map-stop"
            >
              <circle
                cx={p.x}
                cy={p.y}
                r={s.id === stop ? 13 : 8}
                fill="#f5f3e9"
                stroke="#416854"
                strokeWidth="3"
              />
              {s.id === stop && (
                <circle cx={p.x} cy={p.y} r="5" fill="#416854" />
              )}
              <rect
                x={p.x - 54}
                y={p.y + 18}
                width="108"
                height="26"
                rx="4"
                fill="#f6f4eb"
                stroke="#d0d1c5"
              />
              <text
                x={p.x}
                y={p.y + 35}
                textAnchor="middle"
                className="map-stop-label"
              >
                {en ? s.en : s.name}
              </text>
            </g>
          );
        })}
        {data.vehicles
          .filter((v: any) => v.routeId === selected)
          .map((v: any) => {
            const p = pos(v);
            return (
              <g key={v.id} opacity={v.stale ? 0.45 : 1}>
                <circle cx={p.x} cy={p.y} r="25" fill="#416854" opacity=".12" />
                <rect
                  x={p.x - 15}
                  y={p.y - 15}
                  width="30"
                  height="30"
                  rx="9"
                  fill={v.stale ? "#8b8b7e" : "#345a44"}
                  stroke="white"
                  strokeWidth="2"
                />
                <rect
                  x={p.x - 8}
                  y={p.y - 9}
                  width="16"
                  height="12"
                  rx="2"
                  fill="#ecede3"
                />
                <circle cx={p.x - 5} cy={p.y + 8} r="2" fill="white" />
                <circle cx={p.x + 5} cy={p.y + 8} r="2" fill="white" />
              </g>
            );
          })}
        <g transform="translate(32 36)">
          <path d="M0 20L6 0L12 20L6 15Z" fill="#5b6852" />
          <text x="6" y="-8" textAnchor="middle" fontSize="10" fill="#5b6852">
            N
          </text>
        </g>
        <text x="22" y="431" fontSize="10" fill="#707968">
          {en
            ? "Illustrative layout · not for navigation"
            : "示意布局 · 非实际地理导航"}
        </text>
      </svg>
    </div>
  );
}
