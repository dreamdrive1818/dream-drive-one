"use client";

import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft,
  faArrowRight,
  faCalendarCheck,
  faCalendarDays,
  faCarSide,
  faCheck,
  faCircleInfo,
  faHeadset,
  faLocationDot,
  faRoute,
  faShieldHalved,
  faTag,
} from "@fortawesome/free-solid-svg-icons";
import { api } from "../api";
import { formatInr } from "../fleetSearch";
import {
  PackagesListSkeleton,
  PackageDetailSkeleton,
} from "../../components/Skeleton/Skeleton";
import "./Packages.css";

const EASE = [0.22, 1, 0.36, 1];

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

const rise = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
};

const HIGHLIGHTS = [
  { icon: faTag, tone: "teal", title: "Fixed package price", text: "One price for the whole trip." },
  { icon: faRoute, tone: "amber", title: "Day-by-day plan", text: "Know every stop before you go." },
  { icon: faCalendarCheck, tone: "blue", title: "Book online", text: "Pick your car and dates in minutes." },
];

const STEPS = [
  { title: "Pick a package", text: "Compare itineraries, duration, and the fixed price." },
  { title: "Choose car and dates", text: "Select an available car in the package class." },
  { title: "Confirm at checkout", text: "Review the total and pay securely online." },
];

function useMotionProps() {
  const reduce = useReducedMotion();
  return reduce ? { initial: "show", animate: "show" } : { initial: "hidden", animate: "show" };
}

function carClassLabel(value) {
  if (!value) return "Any car class";
  const text = String(value).trim();
  return text.length <= 3 ? text.toUpperCase() : text[0].toUpperCase() + text.slice(1);
}

function dayLabel(n) {
  return `${n} day${n === 1 ? "" : "s"}`;
}

function splitInclusions(text) {
  const raw = String(text || "").trim();
  if (!raw) return { items: [], note: "" };
  const sentences = raw.split(/\.\s+/).map((s) => s.trim()).filter(Boolean);
  const first = sentences[0].replace(/\.$/, "");
  const items = first
    .split(/,|\band\b/i)
    .map((s) => s.trim())
    .filter(Boolean);
  if (items.length < 2 || items.some((s) => s.length > 32)) return { items: [], note: raw };
  const note = sentences.slice(1).join(". ").replace(/\.?$/, sentences.length > 1 ? "." : "");
  return { items: items.map((s) => s[0].toUpperCase() + s.slice(1)), note };
}

function fleetLinkFor(pack) {
  const params = new URLSearchParams({ rentalType: "TOUR_PACKAGE", packageId: pack.id });
  if (pack.cityId) params.set("cityId", pack.cityId);
  if (pack.carClass) params.set("type", pack.carClass);
  return `/fleet?${params.toString()}`;
}

export default function Packages() {
  const { slug } = useParams();
  if (slug) return <PackageDetail slug={slug} />;
  return <PackageList />;
}

function Eyebrow({ children }) {
  return <p className="pk-eyebrow">{children}</p>;
}

function RouteArt({ days }) {
  const stops = Math.min(Math.max(days || 1, 1), 6) + 1;
  const points = Array.from({ length: stops }, (_, i) => {
    const t = stops === 1 ? 0 : i / (stops - 1);
    return { x: 14 + t * 172, y: 62 + Math.sin(t * Math.PI * 1.6) * -26 };
  });
  const d = points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  return (
    <svg className="pk-route-art" viewBox="0 0 200 100" aria-hidden="true">
      <path d={d} />
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={i === 0 || i === points.length - 1 ? 5.5 : 4}
          className={i === points.length - 1 ? "is-end" : ""}
        />
      ))}
    </svg>
  );
}

function CustomTripCta() {
  return (
    <motion.aside className="pk-custom" variants={rise}>
      <span className="pk-custom-icon" aria-hidden="true">
        <FontAwesomeIcon icon={faHeadset} />
      </span>
      <div className="pk-custom-copy">
        <h2>Planning a different trip?</h2>
        <p>
          Airport transfers, outstation, and one-way trips are quoted from the car page. Tell us
          your plan and we&apos;ll help you pick the right option.
        </p>
      </div>
      <div className="pk-custom-actions">
        <Link to="/contact" className="pk-btn pk-btn--light">
          Talk to us
        </Link>
        <Link to="/fleet" className="pk-btn pk-btn--ghost">
          Browse fleet
          <FontAwesomeIcon icon={faArrowRight} />
        </Link>
      </div>
    </motion.aside>
  );
}

function PackageList() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const motionProps = useMotionProps();

  useEffect(() => {
    api("/v1/public/packages")
      .then(setRows)
      .catch((e) => setError(e.message || "Could not load packages"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="packages-page" aria-labelledby="pk-title">
      <div className="pk-hero-bg" aria-hidden="true" />
      <motion.div className="packages-inner" variants={stagger} {...motionProps}>
        <motion.header className="packages-header pk-hero" variants={rise}>
          <nav className="pk-crumbs" aria-label="Breadcrumb">
            <Link to="/">Home</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">Packages</span>
          </nav>
          <Eyebrow>Tour packages</Eyebrow>
          <h1 id="pk-title">
            Tours &amp; <span>chauffeur trips</span>
          </h1>
          <p className="pk-lead">
            Packaged itineraries at a fixed price. Airport transfers, outstation, and one-way trips
            are quoted from the car page.
          </p>
        </motion.header>

        <motion.ul className="pk-highlights" variants={rise}>
          {HIGHLIGHTS.map((h) => (
            <li key={h.title} className="pk-highlight">
              <span className={`pk-tile pk-tile--${h.tone}`} aria-hidden="true">
                <FontAwesomeIcon icon={h.icon} />
              </span>
              <span>
                <strong>{h.title}</strong>
                <small>{h.text}</small>
              </span>
            </li>
          ))}
        </motion.ul>

        <div className="pk-list-head">
          <h2>Available packages</h2>
          {!loading && rows.length ? (
            <p>
              {rows.length} package{rows.length === 1 ? "" : "s"}
            </p>
          ) : null}
        </div>

        {loading ? <PackagesListSkeleton /> : null}

        {error ? <p className="packages-err">{error}</p> : null}

        {!loading && !rows.length && !error ? (
          <div className="pk-empty">
            <span className="pk-tile pk-tile--teal" aria-hidden="true">
              <FontAwesomeIcon icon={faRoute} />
            </span>
            <h3>No tour packages published yet</h3>
            <p>New itineraries are on the way. Meanwhile, you can book any car for your own trip.</p>
            <Link to="/fleet" className="pk-btn pk-btn--primary">
              Browse fleet
              <FontAwesomeIcon icon={faArrowRight} />
            </Link>
          </div>
        ) : null}

        {rows.length ? (
          <div className="pk-list">
            {rows.map((p) => (
              <PackageCard key={p.id} pack={p} />
            ))}
          </div>
        ) : null}

        <motion.section className="pk-steps" aria-labelledby="pk-steps-title" variants={rise}>
          <h2 id="pk-steps-title">How booking a package works</h2>
          <ol>
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <span className="pk-step-num">{i + 1}</span>
                <strong>{s.title}</strong>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </motion.section>

        <CustomTripCta />
      </motion.div>
    </section>
  );
}

function PackageCard({ pack }) {
  const days = pack.daysDetail || [];
  const preview = days.slice(0, 3);
  const { items, note } = splitInclusions(pack.inclusions);
  const detailHref = `/packages/${pack.slug}`;
  const motionProps = useMotionProps();

  return (
    <motion.article className="pk-card" variants={rise} {...motionProps}>
      <div className="pk-card-visual">
        <p className="pk-card-visual-kicker">Tour package</p>
        <p className="pk-card-days">
          <strong>{pack.days}</strong>
          <span>{pack.days === 1 ? "Day" : "Days"}</span>
        </p>
        <RouteArt days={pack.days} />
        {pack.city?.name ? (
          <p className="pk-card-visual-city">
            <FontAwesomeIcon icon={faLocationDot} />
            From {pack.city.name}
          </p>
        ) : null}
      </div>

      <div className="pk-card-body">
        <ul className="pk-meta">
          <li>
            <FontAwesomeIcon icon={faCalendarDays} />
            {dayLabel(pack.days)}
          </li>
          <li>
            <FontAwesomeIcon icon={faCarSide} />
            {carClassLabel(pack.carClass)}
          </li>
          {pack.city?.name ? (
            <li>
              <FontAwesomeIcon icon={faLocationDot} />
              {pack.city.name}
            </li>
          ) : null}
        </ul>

        <h3>
          <Link to={detailHref}>{pack.name}</Link>
        </h3>

        {items.length ? (
          <ul className="pk-incl">
            {items.map((item) => (
              <li key={item}>
                <FontAwesomeIcon icon={faCheck} />
                {item}
              </li>
            ))}
          </ul>
        ) : null}
        {note ? <p className="pk-note">{note}</p> : null}

        {preview.length ? (
          <ol className="pk-mini-route" aria-label="Itinerary preview">
            {preview.map((d) => (
              <li key={d.id || d.dayNumber}>
                <span>Day {d.dayNumber}</span>
                <strong>{d.title}</strong>
              </li>
            ))}
            {days.length > 3 ? (
              <li className="pk-mini-more">
                <span>+{days.length - 3}</span>
                <strong>more day{days.length - 3 === 1 ? "" : "s"}</strong>
              </li>
            ) : null}
          </ol>
        ) : null}
      </div>

      <div className="pk-card-aside">
        <p className="pk-price-label">Fixed package price</p>
        <p className="pk-price">{formatInr(pack.pricePaise)}</p>
        {pack.depositPaise > 0 ? (
          <p className="pk-deposit">
            <FontAwesomeIcon icon={faShieldHalved} />
            Security deposit {formatInr(pack.depositPaise)}
          </p>
        ) : null}
        <div className="pk-card-actions">
          <Link to={detailHref} className="pk-btn pk-btn--primary">
            View itinerary
            <FontAwesomeIcon icon={faArrowRight} />
          </Link>
          <Link to={fleetLinkFor(pack)} className="pk-text-link">
            Choose car &amp; dates
          </Link>
        </div>
      </div>
    </motion.article>
  );
}

function PackageDetail({ slug }) {
  const [pack, setPack] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const motionProps = useMotionProps();

  useEffect(() => {
    api(`/v1/public/packages/${slug}`)
      .then(setPack)
      .catch((e) => setError(e.message || "Package not found"))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return <PackageDetailSkeleton />;
  }

  if (error || !pack) {
    return (
      <section className="packages-page">
        <div className="packages-inner">
          <div className="pk-empty">
            <span className="pk-tile pk-tile--amber" aria-hidden="true">
              <FontAwesomeIcon icon={faCircleInfo} />
            </span>
            <h3>{error || "Package not found"}</h3>
            <p>This package may have been removed or renamed.</p>
            <Link to="/packages" className="pk-btn pk-btn--primary">
              <FontAwesomeIcon icon={faArrowLeft} />
              All packages
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const days = pack.daysDetail || [];
  const { items, note } = splitInclusions(pack.inclusions);
  const facts = [
    { icon: faCalendarDays, label: "Duration", value: dayLabel(pack.days) },
    { icon: faCarSide, label: "Car class", value: carClassLabel(pack.carClass) },
    pack.city?.name ? { icon: faLocationDot, label: "Starts from", value: pack.city.name } : null,
    pack.depositPaise > 0
      ? { icon: faShieldHalved, label: "Security deposit", value: formatInr(pack.depositPaise) }
      : null,
  ].filter(Boolean);

  return (
    <section className="packages-page packages-page--detail" aria-labelledby="pk-detail-title">
      <div className="pk-hero-bg" aria-hidden="true" />
      <motion.div className="packages-inner" variants={stagger} {...motionProps}>
        <motion.nav className="pk-crumbs pk-crumbs--left" aria-label="Breadcrumb" variants={rise}>
          <Link to="/">Home</Link>
          <span aria-hidden="true">/</span>
          <Link to="/packages">Packages</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{pack.name}</span>
        </motion.nav>

        <div className="pk-detail">
          <div className="pk-detail-main">
            <motion.header className="pk-detail-head" variants={rise}>
              <Eyebrow>Tour package</Eyebrow>
              <h1 id="pk-detail-title">{pack.name}</h1>
            </motion.header>

            <motion.dl className="pk-facts" variants={rise}>
              {facts.map((f) => (
                <div key={f.label}>
                  <span className="pk-tile pk-tile--teal" aria-hidden="true">
                    <FontAwesomeIcon icon={f.icon} />
                  </span>
                  <dt>{f.label}</dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
            </motion.dl>

            {days.length ? (
              <motion.section className="pk-panel" aria-labelledby="pk-itin-title" variants={rise}>
                <div className="pk-panel-head">
                  <h2 id="pk-itin-title">Itinerary</h2>
                  <p>{dayLabel(days.length)} planned</p>
                </div>
                <ol className="pk-timeline">
                  {days.map((d) => (
                    <li key={d.id || d.dayNumber}>
                      <span className="pk-timeline-dot" aria-hidden="true">
                        {d.dayNumber}
                      </span>
                      <div className="pk-timeline-body">
                        <span className="pk-timeline-day">Day {d.dayNumber}</span>
                        <strong>{d.title}</strong>
                        {d.description ? <p>{d.description}</p> : null}
                      </div>
                    </li>
                  ))}
                </ol>
              </motion.section>
            ) : null}

            {items.length || note ? (
              <motion.section className="pk-panel" aria-labelledby="pk-incl-title" variants={rise}>
                <div className="pk-panel-head">
                  <h2 id="pk-incl-title">What&apos;s included</h2>
                </div>
                {items.length ? (
                  <ul className="pk-incl pk-incl--grid">
                    {items.map((item) => (
                      <li key={item}>
                        <FontAwesomeIcon icon={faCheck} />
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {note ? (
                  <p className="pk-callout">
                    <FontAwesomeIcon icon={faCircleInfo} />
                    {note}
                  </p>
                ) : null}
              </motion.section>
            ) : null}
          </div>

          <motion.aside className="pk-book" variants={rise} aria-label="Book this package">
            <p className="pk-price-label">Fixed package price</p>
            <p className="pk-price pk-price--lg">{formatInr(pack.pricePaise)}</p>
            <p className="pk-book-sub">for {dayLabel(pack.days)}</p>
            {pack.depositPaise > 0 ? (
              <p className="pk-deposit">
                <FontAwesomeIcon icon={faShieldHalved} />
                Security deposit {formatInr(pack.depositPaise)}
              </p>
            ) : null}
            <Link className="pk-btn pk-btn--primary pk-btn--block" to={fleetLinkFor(pack)}>
              Choose a car and dates
              <FontAwesomeIcon icon={faArrowRight} />
            </Link>
            <Link className="pk-btn pk-btn--outline pk-btn--block" to="/contact">
              Ask a question
            </Link>
            <ol className="pk-book-steps">
              {STEPS.map((s, i) => (
                <li key={s.title}>
                  <span>{i + 1}</span>
                  {s.title}
                </li>
              ))}
            </ol>
          </motion.aside>
        </div>

        <motion.div variants={rise}>
          <Link to="/packages" className="pk-back">
            <FontAwesomeIcon icon={faArrowLeft} />
            All packages
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}
