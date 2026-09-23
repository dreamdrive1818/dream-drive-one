import "./Skeleton.css";

/** Single shimmer bone. Pass height/width for exact reserved space. */
export function Skeleton({
  className = "",
  width,
  height,
  radius,
  style,
  ...rest
}) {
  return (
    <span
      className={`dd-skel ${className}`.trim()}
      style={{
        width: width ?? undefined,
        height: height ?? undefined,
        borderRadius: radius ?? undefined,
        ...style,
      }}
      aria-hidden="true"
      {...rest}
    />
  );
}

export function SkeletonText({ lines = 3, lastWidth = "62%" }) {
  return (
    <div className="dd-skel-stack">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="dd-skel-line"
          height={14}
          width={i === lines - 1 ? lastWidth : "100%"}
        />
      ))}
    </div>
  );
}

export function CarDetailSkeleton() {
  return (
    <div
      className="car-detail-page"
      aria-busy="true"
      aria-label="Loading car details"
    >
      <div className="car-detail-inner">
        <Skeleton width={140} height={22} className="dd-skel-mb" />
        <div className="car-detail-layout">
          <section className="car-detail-gallery" aria-hidden="true">
            <div className="car-detail-gallery-main dd-skel-fill" />
            <div className="car-detail-thumbs">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="car-detail-thumb dd-skel-fill" height={54} width={72} />
              ))}
            </div>
          </section>
          <div aria-hidden="true">
            <div className="car-detail-info">
              <Skeleton height={40} width="72%" className="dd-skel-mb" />
              <Skeleton height={18} width="36%" className="dd-skel-mb" />
              <dl className="car-detail-specs">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="car-detail-spec">
                    <Skeleton height={12} width="40%" className="dd-skel-mb-sm" />
                    <Skeleton height={20} width="55%" />
                  </div>
                ))}
              </dl>
            </div>
            <div className="car-detail-panel dd-skel-panel">
              <Skeleton height={26} width="48%" className="dd-skel-mb" />
              {[0, 1, 2].map((i) => (
                <div key={i} className="car-detail-field">
                  <Skeleton height={14} width="30%" className="dd-skel-mb-sm" />
                  <Skeleton height={44} width="100%" radius={8} />
                </div>
              ))}
              <div className="car-detail-calendar dd-skel-cal">
                <Skeleton height={24} width="50%" className="dd-skel-mb" />
                <div className="dd-skel-cal-grid">
                  {Array.from({ length: 35 }).map((_, i) => (
                    <Skeleton key={i} height={36} radius={8} />
                  ))}
                </div>
              </div>
              <Skeleton height={28} width="40%" className="dd-skel-mb" />
              <Skeleton height={48} width="100%" radius={10} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CheckoutSkeleton({ label = "Loading checkout" }) {
  return (
    <div className="checkout-page" aria-busy="true" aria-label={label}>
      <div className="checkout-inner">
        <header className="checkout-intro">
          <div className="checkout-intro-copy">
            <Skeleton height={14} width={180} className="dd-skel-mb-sm" />
            <Skeleton height={36} width="70%" className="dd-skel-mb-sm" />
            <Skeleton height={16} width="55%" />
          </div>
          <Skeleton height={88} width={88} radius={20} />
        </header>
        <div className="dd-skel-steps">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={40} width={90} radius={999} />
          ))}
        </div>
        <div className="checkout-layout">
          <div className="dd-skel-stack" style={{ gap: 16 }}>
            <div className="dd-skel-card">
              <div className="dd-skel-row">
                <Skeleton height={72} width={72} radius={12} />
                <div style={{ flex: 1 }}>
                  <Skeleton height={14} width="30%" className="dd-skel-mb-sm" />
                  <Skeleton height={22} width="60%" className="dd-skel-mb-sm" />
                  <Skeleton height={14} width="40%" />
                </div>
              </div>
            </div>
            <div className="dd-skel-card">
              <Skeleton height={18} width="35%" className="dd-skel-mb" />
              <SkeletonText lines={4} />
            </div>
            <div className="dd-skel-card">
              <Skeleton height={18} width="40%" className="dd-skel-mb" />
              <SkeletonText lines={3} />
            </div>
          </div>
          <aside className="dd-skel-card dd-skel-aside">
            <Skeleton height={20} width="50%" className="dd-skel-mb" />
            <SkeletonText lines={5} />
            <Skeleton height={48} width="100%" radius={10} className="dd-skel-mt" />
          </aside>
        </div>
      </div>
    </div>
  );
}

export function PackagesListSkeleton() {
  return (
    <div className="packages-grid" aria-busy="true" aria-label="Loading packages">
      {[0, 1, 2].map((i) => (
        <article key={i} className="packages-card" aria-hidden="true">
          <div className="packages-card-top">
            <div className="dd-skel-row" style={{ gap: 12, marginBottom: 14 }}>
              <Skeleton height={16} width={70} />
              <Skeleton height={16} width={90} />
              <Skeleton height={16} width={80} />
            </div>
            <Skeleton height={28} width="75%" className="dd-skel-mb" />
            <Skeleton height={32} width="45%" className="dd-skel-mb" />
            <SkeletonText lines={2} lastWidth="80%" />
          </div>
          <Skeleton height={44} width="100%" radius={999} />
        </article>
      ))}
    </div>
  );
}

export function PackageDetailSkeleton() {
  return (
    <section className="packages-page" aria-busy="true" aria-label="Loading package">
      <div className="packages-inner">
        <header className="packages-header">
          <Skeleton height={14} width={80} className="dd-skel-mb-sm" />
          <Skeleton height={40} width="55%" className="dd-skel-mb" />
          <SkeletonText lines={2} lastWidth="70%" />
        </header>
        <div className="dd-skel-card" style={{ minHeight: 420 }}>
          <Skeleton height={22} width="40%" className="dd-skel-mb" />
          <SkeletonText lines={8} />
        </div>
      </div>
    </section>
  );
}

export function SubscriptionsSkeleton() {
  return (
    <div className="subs-grid" aria-busy="true" aria-label="Loading subscription plans">
      {[0, 1, 2].map((i) => (
        <article key={i} className="subs-card" aria-hidden="true">
          <div className="subs-media dd-skel-fill" style={{ minHeight: 180 }} />
          <div className="subs-body">
            <Skeleton height={24} width="70%" className="dd-skel-mb" />
            <Skeleton height={28} width="45%" className="dd-skel-mb" />
            <SkeletonText lines={3} />
            <Skeleton height={44} width="100%" radius={10} className="dd-skel-mt" />
          </div>
        </article>
      ))}
    </div>
  );
}

export function TrackSkeleton() {
  return (
    <section className="track-page" aria-busy="true" aria-label="Loading booking">
      <div className="track-inner">
        <header className="track-header track-header--left">
          <Skeleton height={14} width={90} className="dd-skel-mb-sm" />
          <Skeleton height={36} width="40%" className="dd-skel-mb-sm" />
          <Skeleton height={16} width="30%" />
        </header>
        <div className="dd-skel-card" style={{ marginBottom: 16 }}>
          <div className="dd-skel-row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} height={56} width={100} radius={12} />
            ))}
          </div>
        </div>
        <div className="dd-skel-card" style={{ minHeight: 220 }}>
          <Skeleton height={20} width="35%" className="dd-skel-mb" />
          <SkeletonText lines={6} />
        </div>
      </div>
    </section>
  );
}

export function LegalSkeleton() {
  return (
    <section className="legal-page" aria-busy="true" aria-label="Loading page">
      <div className="legal-inner">
        <header className="legal-header">
          <Skeleton height={14} width={70} className="dd-skel-mb-sm" />
          <Skeleton height={40} width="50%" className="dd-skel-mb" />
          <Skeleton height={16} width="70%" />
        </header>
        <div className="dd-skel-card" style={{ minHeight: 480 }}>
          <SkeletonText lines={12} lastWidth="55%" />
        </div>
      </div>
    </section>
  );
}

export function FaqSkeleton() {
  return (
    <section className="faq-page" aria-busy="true" aria-label="Loading FAQs">
      <div className="faq-inner">
        <header className="faq-header">
          <Skeleton height={40} width={120} className="dd-skel-mb" />
          <Skeleton height={16} width="55%" />
        </header>
        <div className="dd-skel-stack" style={{ gap: 12, marginTop: 24 }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} height={64} width="100%" radius={12} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function BlogsListSkeleton() {
  return (
    <section className="blogs-page" aria-busy="true" aria-label="Loading blogs">
      <div className="blogs-page-inner">
        <header className="blogs-page-header">
          <Skeleton height={14} width={80} className="dd-skel-mb-sm" />
          <Skeleton height={40} width="40%" className="dd-skel-mb" />
          <Skeleton height={16} width="55%" />
        </header>
        <div className="dd-skel-blog-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <article key={i} className="dd-skel-card" style={{ padding: 0, overflow: "hidden" }}>
              <Skeleton height={180} width="100%" radius={0} />
              <div style={{ padding: 16 }}>
                <Skeleton height={20} width="80%" className="dd-skel-mb-sm" />
                <SkeletonText lines={2} />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function BlogPostSkeleton() {
  return (
    <div className="dd-skel-blog-post" aria-busy="true" aria-label="Loading blog">
      <Skeleton height={280} width="100%" radius={16} className="dd-skel-mb" />
      <Skeleton height={36} width="70%" className="dd-skel-mb" />
      <Skeleton height={16} width="40%" className="dd-skel-mb" />
      <SkeletonText lines={10} lastWidth="48%" />
    </div>
  );
}

export function RecentBlogsSkeleton() {
  return (
    <div className="dd-skel-stack" style={{ gap: 14 }} aria-busy="true" aria-label="Loading recent blogs">
      {[0, 1, 2].map((i) => (
        <div key={i} className="dd-skel-row">
          <Skeleton height={72} width={96} radius={10} />
          <div style={{ flex: 1 }}>
            <Skeleton height={16} width="80%" className="dd-skel-mb-sm" />
            <Skeleton height={12} width="45%" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CommentsSkeleton() {
  return (
    <div className="comment-section" aria-busy="true" aria-label="Loading comments">
      <Skeleton height={22} width={140} className="dd-skel-mb" />
      <div className="dd-skel-stack" style={{ gap: 12 }}>
        {[0, 1].map((i) => (
          <div key={i} className="dd-skel-card">
            <Skeleton height={14} width="30%" className="dd-skel-mb-sm" />
            <SkeletonText lines={2} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AccountSkeleton() {
  return (
    <section className="account-page" aria-busy="true" aria-label="Loading account">
      <div className="account-inner">
        <aside className="account-nav">
          <Skeleton height={22} width="70%" className="dd-skel-mb" />
          <Skeleton height={14} width="50%" className="dd-skel-mb" />
          <div className="dd-skel-stack" style={{ gap: 8 }}>
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} height={36} width="100%" radius={8} />
            ))}
          </div>
        </aside>
        <div className="dd-skel-card" style={{ minHeight: 360 }}>
          <Skeleton height={28} width="40%" className="dd-skel-mb" />
          <SkeletonText lines={8} />
        </div>
      </div>
    </section>
  );
}

export function FleetCarouselSkeleton() {
  return (
    <div className="fleet-loading" aria-busy="true" aria-label="Loading fleet">
      {[0, 1, 2].map((i) => (
        <div key={i} className="dd-skel-fleet-row">
          <Skeleton className="dd-skel-fleet-pic" height={132} width={160} radius={12} />
          <div className="dd-skel-fleet-info">
            <Skeleton height={22} width="45%" className="dd-skel-mb-sm" />
            <div className="dd-skel-row" style={{ gap: 10, marginBottom: 10 }}>
              <Skeleton height={16} width={48} />
              <Skeleton height={16} width={48} />
              <Skeleton height={16} width={48} />
            </div>
            <Skeleton height={16} width="30%" />
          </div>
          <Skeleton height={40} width={110} radius={999} />
        </div>
      ))}
    </div>
  );
}

export function RouteSkeleton() {
  return (
    <div className="dd-skel-route" aria-busy="true" aria-label="Loading page">
      <div className="dd-skel-route-inner">
        <Skeleton height={28} width="30%" className="dd-skel-mb" />
        <Skeleton height={16} width="55%" className="dd-skel-mb" />
        <div className="dd-skel-blog-grid">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={220} radius={16} />
          ))}
        </div>
        <div className="dd-skel-card dd-skel-mt" style={{ minHeight: 200 }}>
          <SkeletonText lines={5} />
        </div>
      </div>
    </div>
  );
}

export function AppBootSkeleton() {
  return (
    <div className="dd-skel-boot" aria-busy="true" aria-label="Loading Dream Drive">
      <div className="dd-skel-boot-bar" />
      <div className="dd-skel-boot-body">
        <Skeleton height={48} width={180} className="dd-skel-mb" />
        <Skeleton height={24} width="40%" className="dd-skel-mb" />
        <Skeleton height={320} width="100%" radius={16} className="dd-skel-mb" />
        <div className="dd-skel-blog-grid">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={160} radius={14} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function LoginSkeleton() {
  return (
    <div className="customer-login-page" aria-busy="true" aria-label="Loading sign-in">
      <div className="customer-login-shell">
        <header className="customer-login-header">
          <Skeleton height={14} width={110} className="dd-skel-mb-sm" />
          <Skeleton height={36} width="55%" className="dd-skel-mb-sm" />
          <Skeleton height={16} width="70%" />
        </header>
        <div className="customer-login-card" style={{ minHeight: 360 }}>
          <div className="dd-skel-row" style={{ marginBottom: 20, gap: 8 }}>
            <Skeleton height={40} width="33%" radius={8} />
            <Skeleton height={40} width="33%" radius={8} />
            <Skeleton height={40} width="33%" radius={8} />
          </div>
          <Skeleton height={14} width="25%" className="dd-skel-mb-sm" />
          <Skeleton height={44} width="100%" radius={8} className="dd-skel-mb" />
          <Skeleton height={14} width="30%" className="dd-skel-mb-sm" />
          <Skeleton height={44} width="100%" radius={8} className="dd-skel-mb" />
          <Skeleton height={48} width="100%" radius={10} className="dd-skel-mb" />
          <Skeleton height={44} width="100%" radius={10} />
        </div>
      </div>
    </div>
  );
}
