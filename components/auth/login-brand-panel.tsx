function WeightPlateGraphic() {
  return (
    <svg
      viewBox="0 0 640 480"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-[min(520px,150%)] w-[min(720px,165%)] max-w-none"
      aria-hidden="true"
    >
      <line
        x1="72"
        y1="240"
        x2="620"
        y2="240"
        stroke="#2A2C29"
        strokeWidth="1.5"
      />
      {/* Left cluster */}
      <circle cx="156" cy="240" r="78" stroke="#2A2C29" strokeWidth="1.5" />
      <circle cx="156" cy="240" r="54" stroke="#2A2C29" strokeWidth="1.5" />
      <circle
        cx="156"
        cy="240"
        r="22"
        stroke="#BDDE63"
        strokeOpacity="0.55"
        strokeWidth="1.5"
      />
      {/* Center cluster */}
      <circle cx="348" cy="240" r="118" stroke="#2A2C29" strokeWidth="1.5" />
      <circle cx="348" cy="240" r="84" stroke="#2A2C29" strokeWidth="1.5" />
      <circle
        cx="348"
        cy="240"
        r="32"
        stroke="#BDDE63"
        strokeOpacity="0.35"
        strokeWidth="1.5"
      />
      {/* Right cluster — bleeds off the panel edge */}
      <circle cx="552" cy="240" r="96" stroke="#2A2C29" strokeWidth="1.5" />
      <circle cx="552" cy="240" r="68" stroke="#2A2C29" strokeWidth="1.5" />
      <circle
        cx="552"
        cy="240"
        r="26"
        stroke="#BDDE63"
        strokeOpacity="0.55"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function LoginBrandPanel() {
  return (
    <aside className="relative isolate flex h-80 w-full shrink-0 flex-col overflow-hidden bg-panel lg:h-svh lg:w-[44%]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, rgba(242,242,236,0.05) 0px, rgba(242,242,236,0.05) 1px, transparent 1px, transparent 14px)",
        }}
        aria-hidden="true"
      />

      <div className="pointer-events-none absolute top-1/2 right-0 z-0 -translate-y-1/2 translate-x-[18%] lg:translate-x-[12%]">
        <WeightPlateGraphic />
      </div>

      <div className="relative z-10 flex items-center gap-2 px-6 pt-5 lg:px-10 lg:pt-8">
        <span className="size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
        <span className="font-display text-[15px] font-bold tracking-tight text-foreground">
          Gym SaaS
        </span>
      </div>

      <div className="relative z-10 flex flex-1 flex-col justify-center px-6 py-6 lg:px-10 lg:py-10">
        <h1 className="font-display max-w-[13em] text-[clamp(1.875rem,4.2vw,2.625rem)] leading-[1.08] font-black tracking-[-0.01em] text-foreground">
        Run the gym floor.<br/> Not the spreadsheet.
        </h1>
        <p className="mt-4 max-w-[38ch] text-[15.5px] leading-relaxed font-normal text-muted-foreground">
          Sign in to manage your gym&apos;s members, subscriptions, and
          equipment from one place.
        </p>
      </div>

      <p className="relative z-10 hidden border-t border-border-soft px-10 py-5 text-[13px] text-faint lg:block">
        Built with gym owners in Lahore and Dubai.
      </p>
    </aside>
  );
}
