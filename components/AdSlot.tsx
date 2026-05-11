"use client";

type AdPlacement =
  | "home-after-nearest"
  | "nearby-feed"
  | "masjid-profile"
  | "saved-feed";

type AdSlotProps = {
  placement: AdPlacement;
  compact?: boolean;
};

const defaultCopy: Record<AdPlacement, { title: string; body: string }> = {
  "home-after-nearest": {
    title: "Community sponsor",
    body: "A respectful space for local halal businesses or masjid services that support verified jamaat updates."
  },
  "nearby-feed": {
    title: "Sponsored space",
    body: "Keep this app free while helping users discover useful local services."
  },
  "masjid-profile": {
    title: "Support this masjid network",
    body: "Use this slot for ethical sponsors, Ramadan services, local halal shops, or community announcements."
  },
  "saved-feed": {
    title: "Sponsor jamaat accuracy",
    body: "A small, non-intrusive ad slot that helps fund verified prayer-time data."
  }
};

function safeUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function AdSlot({ placement, compact = false }: AdSlotProps) {
  const enabled = process.env.NEXT_PUBLIC_SHOW_ADS !== "false";
  if (!enabled) return null;

  const copy = defaultCopy[placement];
  const label = process.env.NEXT_PUBLIC_AD_LABEL || "Sponsored";
  const headline = process.env.NEXT_PUBLIC_AD_HEADLINE || copy.title;
  const body = process.env.NEXT_PUBLIC_AD_BODY || copy.body;
  const cta = process.env.NEXT_PUBLIC_AD_CTA || "Learn more";
  const href = safeUrl(process.env.NEXT_PUBLIC_AD_URL);

  const content = (
    <>
      <div className="ad-slot-topline">
        <span>{label}</span>
        <small>Ad</small>
      </div>
      <div className="ad-slot-content">
        <div>
          <strong>{headline}</strong>
          <p>{body}</p>
        </div>
        <span className="ad-slot-cta">{href ? cta : "Reserved"}</span>
      </div>
    </>
  );

  if (href) {
    return (
      <a
        className={compact ? "ad-slot compact" : "ad-slot"}
        href={href}
        target="_blank"
        rel="noreferrer sponsored"
        data-placement={placement}
        aria-label={`${label}: ${headline}`}
      >
        {content}
      </a>
    );
  }

  return (
    <aside className={compact ? "ad-slot compact" : "ad-slot"} data-placement={placement} aria-label={`${label} placeholder`}>
      {content}
    </aside>
  );
}
