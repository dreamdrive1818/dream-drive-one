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
  { icon: faThumbsUp, title: "Customer Choice Award" },
  { icon: faCarOn, title: "Safety Drive Excellence" },
  { icon: faLightbulb, title: "Innovation Champion" },
  { icon: faLeaf, title: "Sustainable Travel Partner" },
  { icon: faStar, title: "Best Customer Support" },
  { icon: faChartLine, title: "Business Growth Milestone" },
  { icon: faUsers, title: "Community Engagement" },
  { icon: faMedal, title: "Industry Leadership" },
];

const Achievements = () => {
  return (
    <section className="achievements">
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

        <AnimateOnScroll className="achievements-grid-wrap delay-3">
          <ul className="achievements-grid">
            {achievements.map((item) => (
              <li className="achievement-item" key={item.title}>
                <span className="achievement-icon" aria-hidden="true">
                  <FontAwesomeIcon icon={item.icon} />
                </span>
                <p>{item.title}</p>
              </li>
            ))}
          </ul>
        </AnimateOnScroll>
      </div>
    </section>
  );
};

export default Achievements;
