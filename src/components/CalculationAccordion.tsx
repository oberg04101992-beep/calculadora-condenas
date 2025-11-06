// src/components/CalculationAccordion.tsx
import React, { PropsWithChildren, useState } from "react";

interface Props { title: string; defaultOpen?: boolean; }

export default function CalculationAccordion({ title, defaultOpen = false, children }: PropsWithChildren<Props>) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="calc-accordion" aria-label={title}>
      <button
        type="button"
        className="w-full text-left py-2 px-3 border rounded-md mb-2"
        aria-expanded={open}
        onClick={() => setOpen((s) => !s)}
      >
        <span className="font-semibold">{title}</span>
        <span className="float-right">{open ? "▲" : "▼"}</span>
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </section>
  );
}
