"use client";

import { useState } from "react";

export default function Collapsible({
  title,
  defaultOpen = false,
  children,
}: {
  title: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="collapsible">
      <button type="button" className="collapsible-toggle" onClick={() => setOpen((v) => !v)}>
        <span className={"collapsible-chevron" + (open ? " open" : "")}>▸</span>
        {title}
      </button>
      {open && <div className="collapsible-body">{children}</div>}
    </div>
  );
}
