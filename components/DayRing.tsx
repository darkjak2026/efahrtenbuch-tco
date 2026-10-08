// Tagespunkt der Wochenansicht mit Ladering (v2.39.00, Mockup vom 08.10.2026):
// gelb von oben bis zum Ladestand vor dem Laden, grün das Geladene, ein weißer
// Strich am Startpunkt. Bei 100 % ist der Ring geschlossen. Zwei Ladevorgänge an
// einem Tag ergeben zwei Ringe ineinander (außen der erste); mehr zeigt nur die Zahl.

const S = 20;
const W = 2;
const GAP = 1;

export type Stand = { vor: number; nach: number | null };

export default function DayRing({ staende, count, className }: { staende: (Stand | null)[]; count: number; className: string }) {
  const ringe = staende.slice(0, 2);
  const c = S / 2;
  return (
    <span className={className}>
      {count > 0 && (
        <svg className="wk-ring" viewBox={`0 0 ${S} ${S}`} width={S} height={S} aria-hidden="true">
          {ringe.map((st, i) => {
            const r = S / 2 - W / 2 - i * (W + GAP);
            const u = 2 * Math.PI * r;
            const seg = (cls: string, von: number, bis: number) =>
              bis > von ? (
                <circle className={cls} cx={c} cy={c} r={r} strokeWidth={W} strokeDasharray={`${(u * (bis - von)) / 100} ${u}`} strokeDashoffset={(-u * von) / 100} />
              ) : null;
            const a = st ? (st.vor / 100) * 2 * Math.PI : 0;
            return (
              <g key={i}>
                <circle className="wk-ring-spur" cx={c} cy={c} r={r} strokeWidth={W} />
                {st && seg("wk-ring-vor", 0, st.vor)}
                {st && st.nach !== null && seg("wk-ring-gel", st.vor, st.nach)}
                {st && st.nach !== null && st.nach > st.vor && (
                  <line className="wk-ring-start" x1={c + (r - W) * Math.cos(a)} y1={c + (r - W) * Math.sin(a)} x2={c + (r + W) * Math.cos(a)} y2={c + (r + W) * Math.sin(a)} />
                )}
              </g>
            );
          })}
        </svg>
      )}
      <span className={"wk-dot-kern" + (ringe.length > 1 ? " zwei" : "")}>{count || ""}</span>
    </span>
  );
}
