import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faArrowRight } from "@fortawesome/free-solid-svg-icons";
import api from "../../api/http";
import { usePageSeoSuppression } from "../../utils/usePageSeoSuppression";
import { FaqSkeleton } from "../Skeleton/Skeleton";
import "./Faq.css";

function parseFaqItems(html) {
  if (!html) return [];
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const nodes = Array.from(doc.body.childNodes);
    const items = [];
    let current = null;

    const flush = () => {
      if (!current) return;
      const answer = current.parts.join("").trim();
      if (current.question) {
        items.push({
          id: `faq-${items.length + 1}`,
          question: current.question,
          answer,
        });
      }
      current = null;
    };

    nodes.forEach((node) => {
      if (node.nodeType !== 1) return;
      const tag = node.tagName?.toLowerCase();
      if (tag === "h1" || tag === "h2" || tag === "h3") {
        flush();
        current = {
          question: (node.textContent || "").trim(),
          parts: [],
        };
        return;
      }
      if (!current) {
        current = { question: "", parts: [] };
      }
      current.parts.push(node.outerHTML || "");
    });
    flush();

    return items.filter((item) => item.question && item.answer);
  } catch {
    return [];
  }
}

export default function Faq() {
  usePageSeoSuppression(true);
  const [page, setPage] = useState(null);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState("");

  useEffect(() => {
    let cancelled = false;
    api
      .get("/v1/public/pages/faq")
      .then(({ data }) => {
        if (!cancelled) setPage(data);
      })
      .catch(() => {
        if (!cancelled) setError("This page is not published yet.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const items = useMemo(
    () => parseFaqItems(page?.body || ""),
    [page?.body]
  );

  useEffect(() => {
    if (items[0]?.id) setOpenId(items[0].id);
  }, [items]);

  if (error) {
    return (
      <section className="faq-page">
        <div className="faq-inner">
          <header className="faq-header">
            <h1>FAQs</h1>
            <p className="faq-lead">{error}</p>
          </header>
        </div>
      </section>
    );
  }

  if (!page) {
    return <FaqSkeleton />;
  }

  return (
    <section className="faq-page" aria-label="Frequently asked questions">
      <Helmet>
        <title>{page.seoTitle || page.title || "FAQs"}</title>
        <meta
          name="description"
          content={page.seoDescription || page.excerpt || ""}
        />
        {page.seoKeywords ? (
          <meta name="keywords" content={page.seoKeywords} />
        ) : null}
        {page.seoOgImage ? (
          <meta property="og:image" content={page.seoOgImage} />
        ) : null}
        <meta property="og:title" content={page.seoTitle || page.title} />
        <meta
          property="og:description"
          content={page.seoDescription || page.excerpt || ""}
        />
      </Helmet>

      <div className="faq-inner">
        <header className="faq-header">
          <p className="faq-eyebrow">Help</p>
          <h1>{page.title || "FAQs"}</h1>
          <p className="faq-lead">
            {page.excerpt ||
              "Quick answers about booking, pickup, documents, and self-drive rentals with Dream Drive."}
          </p>
        </header>

        {items.length > 0 ? (
          <div className="faq-list">
            {items.map((item) => {
              const open = openId === item.id;
              return (
                <div
                  key={item.id}
                  className={`faq-item ${open ? "is-open" : ""}`}
                >
                  <button
                    type="button"
                    className="faq-question"
                    aria-expanded={open}
                    onClick={() =>
                      setOpenId((prev) => (prev === item.id ? "" : item.id))
                    }
                  >
                    <span>{item.question}</span>
                    <FontAwesomeIcon icon={faChevronDown} />
                  </button>
                  {open ? (
                    <div
                      className="faq-answer"
                      dangerouslySetInnerHTML={{ __html: item.answer }}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div
            className="faq-fallback"
            dangerouslySetInnerHTML={{ __html: page.body || "" }}
          />
        )}

        <div className="faq-cta-band">
          <div>
            <h2>Still need help?</h2>
            <p>Message us and we&apos;ll sort it out for your trip.</p>
          </div>
          <Link to="/contact" className="faq-cta">
            Contact us
            <FontAwesomeIcon icon={faArrowRight} />
          </Link>
        </div>
      </div>
    </section>
  );
}
