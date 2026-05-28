import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Receipt, Wallet, TrendingUp, Users } from "lucide-react";

const items = [
  { to: "/", icon: LayoutDashboard, label: "Início" },
  { to: "/transactions", icon: Receipt, label: "Lançar" },
  { to: "/accounts", icon: Wallet, label: "Contas" },
  { to: "/investments", icon: TrendingUp, label: "Invest." },
  { to: "/partnership", icon: Users, label: "Casal" },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 border-t border-white/5 bg-background/80 backdrop-blur-xl pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2"
      aria-label="Navegação principal"
    >
      <ul className="grid grid-cols-5 max-w-md mx-auto px-2">
        {items.map((it) => {
          const active = it.to === "/" ? pathname === "/" : pathname.startsWith(it.to);
          const Icon = it.icon;
          return (
            <li key={it.to} className="flex justify-center">
              <Link
                to={it.to}
                className={`flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl transition-all ${
                  active ? "text-primary" : "text-muted-foreground active:scale-95"
                }`}
              >
                <span
                  className={`grid place-items-center size-9 rounded-xl transition-all ${
                    active
                      ? "bg-primary/15 ring-1 ring-primary/30 shadow-[0_0_18px_-6px_oklch(0.68_0.22_305/0.7)]"
                      : ""
                  }`}
                >
                  <Icon className="size-[18px]" strokeWidth={active ? 2.25 : 1.75} />
                </span>
                <span className={`text-[10px] font-medium ${active ? "text-primary" : ""}`}>{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
