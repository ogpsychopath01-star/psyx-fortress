import { useTheme, THEMES, type Theme } from "@/lib/theme";
import { Palette } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground"
          title="Change theme"
        >
          <Palette className="w-5 h-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 p-3 border-border bg-card/95 backdrop-blur-xl">
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2 px-1">
          Color Theme
        </p>
        <div className="grid grid-cols-3 gap-2">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id as Theme)}
              className={cn(
                "flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-all hover:scale-105 active:scale-95",
                theme === t.id
                  ? "border-primary ring-1 ring-primary/50 bg-primary/10"
                  : "border-border/50 hover:border-border bg-card/30"
              )}
              title={t.label}
            >
              <span
                className="w-7 h-7 rounded-full border-2 border-white/20 shadow-sm"
                style={{ background: t.swatch }}
              />
              <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider leading-none">
                {t.label}
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
