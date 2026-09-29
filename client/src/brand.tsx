import { Link } from "react-router-dom";
import { UtensilsCrossed } from "lucide-react";
export function Brand({ to = "/", onNavigate }: { to?: string; onNavigate?: () => void }) {
  return (
    <Link className="brand" to={to} onClick={() => { window.scrollTo(0, 0); onNavigate?.(); }}>
      <span>
        <UtensilsCrossed size={22} />
      </span>
      messmate<span className="brand-period">.</span>
    </Link>
  );
}
