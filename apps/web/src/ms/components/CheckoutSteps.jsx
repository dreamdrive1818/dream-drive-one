import { Link } from "react-router-dom";

/**
 * Clickable booking stepper.
 * @param {Array<{ key: string, label: string, to?: string, onClick?: () => void }>} steps
 * @param {string} current — step.key of the active step
 */
export default function CheckoutSteps({ steps = [], current }) {
  const currentIndex = Math.max(
    0,
    steps.findIndex((step) => step.key === current)
  );

  return (
    <ol className="checkout-steps" aria-label="Booking steps">
      {steps.map((step, index) => {
        const done = index < currentIndex;
        const isCurrent = index === currentIndex;
        const clickable = Boolean(step.to || step.onClick);
        const className = [
          done ? "is-done" : "",
          isCurrent ? "is-current" : "",
          clickable ? "is-clickable" : "",
        ]
          .filter(Boolean)
          .join(" ");

        const body = (
          <>
            <span className="checkout-step-dot" aria-hidden="true">
              {index + 1}
            </span>
            <span className="checkout-step-label">{step.label}</span>
          </>
        );

        let content = <span className="checkout-step-static">{body}</span>;
        if (step.to) {
          content = (
            <Link
              to={step.to}
              className="checkout-step-link"
              aria-current={isCurrent ? "step" : undefined}
            >
              {body}
            </Link>
          );
        } else if (step.onClick) {
          content = (
            <button
              type="button"
              className="checkout-step-link"
              onClick={step.onClick}
              aria-current={isCurrent ? "step" : undefined}
            >
              {body}
            </button>
          );
        }

        return (
          <li
            key={step.key}
            className={className}
            aria-current={!clickable && isCurrent ? "step" : undefined}
          >
            {content}
          </li>
        );
      })}
    </ol>
  );
}
