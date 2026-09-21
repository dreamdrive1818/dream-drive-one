import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faThumbsUp,
  faLightbulb,
  faLeaf,
  faStar,
  faChartLine,
  faUsers,
  faMedal,
  faCarOn,
} from "@fortawesome/free-solid-svg-icons";
import AnimateOnScroll from "../../assets/Animation/AnimateOnScroll";
import "./Achievement.css";

const achievements = [
  {
    icon: faThumbsUp,
    title: "Customer Choice Award",
    tone: "mint",
    blurb: "Chosen by riders who value comfort and care.",
  },
  {
    icon: faCarOn,
    title: "Safety Drive Excellence",
    tone: "blue",
    blurb: "Well-maintained cars, ready for every trip.",
  },
  {
    icon: faLightbulb,
    title: "Innovation Champion",
    tone: "amber",
    blurb: "Simple booking and smoother self-drive journeys.",
  },
  {
    icon: faLeaf,
    title: "Sustainable Travel Partner",
    tone: "green",
    blurb: "Thoughtful travel choices for Ranchi roads.",
  },
  {
    icon: faStar,
    title: "Best Customer Support",
    tone: "lavender",
    blurb: "Help when you need it — before and during your ride.",
  },
  {
    icon: faChartLine,
    title: "Business Growth Milestone",
    tone: "mint",
    blurb: "Growing with every trusted booking in Ranchi.",
  },
  {
    icon: faUsers,
    title: "Community Engagement",
    tone: "blue",
    blurb: "Built around local travellers and everyday trips.",
  },
  {
    icon: faMedal,
    title: "Industry Leadership",
    tone: "amber",
    blurb: "Setting a clear standard for self-drive service.",
  },
];

const Achievements = () => {
  const featured = achievements[0];
  const rest = achievements.slice(1);

  return (
    <section className="achievements" aria-label="Achievements">
      <div className="achievements-shell">
        <AnimateOnScroll className="achievements-intro delay-2">
          <p className="achievements-eyebrow">Achievements</p>
          <h2 className="achievements-heading">
            Milestones we’re
            <br />
            <span>proud of</span>
          </h2>
          <p className="achievements-lead">
            Recognition that reflects how we care for every ride — safety,
            service, and trust on the road in Ranchi.
          </p>
        </AnimateOnScroll>

        <AnimateOnScroll className="achievements-board delay-3">
          <article
            className={`achievement-featured achievement-tone--${featured.tone}`}
          >
            <span className="achievement-featured-icon" aria-hidden="true">
              <FontAwesomeIcon icon={featured.icon} />
            </span>
            <div className="achievement-featured-copy">
              <p className="achievement-featured-label">Highlight</p>
              <h3>{featured.title}</h3>
              <p>{featured.blurb}</p>
            </div>
          </article>

          <ul className="achievements-grid">
            {rest.map((item) => (
              <li
                className={`achievement-card achievement-tone--${item.tone}`}
                key={item.title}
              >
                <span className="achievement-card-icon" aria-hidden="true">
                  <FontAwesomeIcon icon={item.icon} />
                </span>
                <h3>{item.title}</h3>
                <p>{item.blurb}</p>
              </li>
            ))}
          </ul>
        </AnimateOnScroll>
      </div>
    </section>
  );
};

export default Achievements;
