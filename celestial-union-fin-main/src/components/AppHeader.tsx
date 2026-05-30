import { useStore } from "@/lib/store";

interface Props {
  view: "unified" | "individual";
  onViewChange: (v: "unified" | "individual") => void;
  rightSlot?: React.ReactNode;
  title?: string;
  hideToggle?: boolean;
}

const FALLBACK_MEMBER = {
  name: "Aguardando parceiro",
  initial: "+",
  avatarColor: "from-slate-600 to-slate-700",
};

export function AppHeader({ view, onViewChange, rightSlot, title, hideToggle }: Props) {
  const { state } = useStore();
  const m1 = state.members[0] ?? FALLBACK_MEMBER;
  const m2 = state.members[1] ?? FALLBACK_MEMBER;

  return (
    <header className="flex flex-col gap-3 animate-fade-up">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex -space-x-2.5 shrink-0">
            <div className={`size-9 rounded-full ring-2 ring-background grid place-items-center text-xs font-semibold text-white bg-gradient-to-br ${m1.avatarColor}`}>
              {m1.initial}
            </div>
            <div className={`size-9 rounded-full ring-2 ring-background grid place-items-center text-xs font-semibold text-white bg-gradient-to-br ${m2.avatarColor}`}>
              {m2.initial}
            </div>
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-medium tracking-tight truncate">
              {title ?? (
                <>
                  {m1.name} <span className="text-muted-foreground">&</span> {m2.name}
                </>
              )}
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="relative flex size-1.5">
                <span className="absolute inset-0 rounded-full bg-emerald animate-ping opacity-60" />
                <span className="relative rounded-full size-1.5 bg-emerald" />
              </span>
              <span className="text-[11px] text-muted-foreground">Sincronia <span className="text-foreground/80">94%</span></span>
            </div>
          </div>
        </div>
        {rightSlot}
      </div>

      {!hideToggle && (
        <div className="p-1 bg-white/5 rounded-xl flex ring-1 ring-white/5 w-full">
          <button
            onClick={() => onViewChange("unified")}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
              view === "unified" ? "bg-primary/20 text-primary ring-1 ring-primary/30" : "text-muted-foreground"
            }`}
          >
            Unificada
          </button>
          <button
            onClick={() => onViewChange("individual")}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
              view === "individual" ? "bg-primary/20 text-primary ring-1 ring-primary/30" : "text-muted-foreground"
            }`}
          >
            Individual
          </button>
        </div>
      )}
    </header>
  );
}
