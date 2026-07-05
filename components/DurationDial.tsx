"use client";

import { useRef } from "react";

const MAX_HOURS = 14;
const MAX_MINUTES = 90;
const SIZE = 110;
const CENTER = SIZE / 2;
const OUTER_R = 47;
const INNER_R = 27;
const STROKE = 8;
const HANDLE_R = 5;

function angleFromPoint(x: number, y: number): number {
  const dx = x - CENTER;
  const dy = y - CENTER;
  let deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return deg;
}

function pointFromAngle(angleDeg: number, r: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CENTER + r * Math.sin(rad), y: CENTER - r * Math.cos(rad) };
}

export default function DurationDial({
  hours,
  minutes,
  onChange,
}: {
  hours: number;
  minutes: number;
  onChange: (hours: number, minutes: number) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const draggingRing = useRef<"hours" | "minutes" | null>(null);

  const toLocal = (clientX: number, clientY: number) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const scale = SIZE / rect.width;
    return { x: (clientX - rect.left) * scale, y: (clientY - rect.top) * scale };
  };

  const ringAt = (x: number, y: number): "hours" | "minutes" | null => {
    const dist = Math.hypot(x - CENTER, y - CENTER);
    if (dist > OUTER_R - STROKE && dist < OUTER_R + STROKE) return "minutes";
    if (dist > INNER_R - STROKE && dist < INNER_R + STROKE) return "hours";
    return null;
  };

  const applyAngle = (ring: "hours" | "minutes", x: number, y: number) => {
    const angle = angleFromPoint(x, y);
    if (ring === "hours") {
      onChange(Math.min(MAX_HOURS, Math.round((angle / 360) * MAX_HOURS)), minutes);
    } else {
      onChange(hours, Math.min(MAX_MINUTES, Math.round((angle / 360) * MAX_MINUTES)));
    }
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const { x, y } = toLocal(e.clientX, e.clientY);
    const ring = ringAt(x, y);
    if (!ring) return;
    draggingRing.current = ring;
    e.currentTarget.setPointerCapture(e.pointerId);
    applyAngle(ring, x, y);
  };
  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!draggingRing.current) return;
    const { x, y } = toLocal(e.clientX, e.clientY);
    applyAngle(draggingRing.current, x, y);
  };
  const stopDragging = () => {
    draggingRing.current = null;
  };

  const minutesHandle = pointFromAngle((minutes / MAX_MINUTES) * 360, OUTER_R);
  const hoursHandle = pointFromAngle((Math.min(hours, MAX_HOURS) / MAX_HOURS) * 360, INNER_R);
  const outerCirc = 2 * Math.PI * OUTER_R;
  const innerCirc = 2 * Math.PI * INNER_R;

  return (
    <div className="duration-dial-block">
      <svg
        ref={svgRef}
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="duration-dial"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
      >
        <circle cx={CENTER} cy={CENTER} r={OUTER_R} fill="none" stroke="var(--line)" strokeWidth={STROKE} />
        <circle
          cx={CENTER}
          cy={CENTER}
          r={OUTER_R}
          fill="none"
          stroke="var(--glacier-deep)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={outerCirc}
          strokeDashoffset={outerCirc * (1 - Math.min(minutes, MAX_MINUTES) / MAX_MINUTES)}
          transform={`rotate(-90 ${CENTER} ${CENTER})`}
        />
        <circle cx={CENTER} cy={CENTER} r={INNER_R} fill="none" stroke="var(--line)" strokeWidth={STROKE} />
        <circle
          cx={CENTER}
          cy={CENTER}
          r={INNER_R}
          fill="none"
          stroke="var(--plum)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={innerCirc}
          strokeDashoffset={innerCirc * (1 - Math.min(hours, MAX_HOURS) / MAX_HOURS)}
          transform={`rotate(-90 ${CENTER} ${CENTER})`}
        />
        <circle cx={minutesHandle.x} cy={minutesHandle.y} r={HANDLE_R} fill="var(--glacier-deep)" stroke="#fff" strokeWidth={1.5} />
        <circle cx={hoursHandle.x} cy={hoursHandle.y} r={HANDLE_R} fill="var(--plum)" stroke="#fff" strokeWidth={1.5} />
        <text x={CENTER} y={CENTER + 4} textAnchor="middle" className="duration-dial-value">
          {hours}h {minutes}m
        </text>
      </svg>
      <div className="duration-dial-legend">
        <span>
          <i className="legend-dot hours" /> Std (innen)
        </span>
        <span>
          <i className="legend-dot minutes" /> Min (außen)
        </span>
      </div>
    </div>
  );
}
