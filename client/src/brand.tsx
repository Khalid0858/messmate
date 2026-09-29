import { Link } from "react-router-dom";
import { UtensilsCrossed } from "lucide-react";
export function Brand({ to = "/" }: { to?: string }) {
  return (
    <Link className="brand" to={to} onClick={() => window.scrollTo(0, 0)}>
      <span>
        <UtensilsCrossed size={22} />
      </span>
      messmate<span className="brand-period">.</span>
    </Link>
  );
}
