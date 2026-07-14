import { Link } from "wouter";
import { motion } from "framer-motion";
import { Shield, Zap, Lock, Globe, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden flex flex-col relative">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-[radial-gradient(ellipse_at_top,rgba(220,38,38,0.18)_0%,transparent_70%)]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[radial-gradient(circle,rgba(185,28,28,0.1)_0%,transparent_70%)]" />
        <div className="absolute inset-0" style={{backgroundImage: 'linear-gradient(rgba(220,38,38,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(220,38,38,0.03) 1px, transparent 1px)', backgroundSize: '60px 60px'}} />
      </div>

      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-8 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="PSYX FORTRESS" className="w-10 h-10 object-contain" />
          <div className="flex flex-col leading-none">
            <span className="font-mono font-bold text-base tracking-tighter text-foreground">PSYX</span>
            <span className="font-mono text-[10px] tracking-[0.3em] text-primary uppercase">FORTRESS</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login">
            <Button variant="ghost" className="font-mono text-sm tracking-widest uppercase text-muted-foreground hover:text-foreground">Login</Button>
          </Link>
          <Link href="/register">
            <Button className="font-mono text-sm tracking-widest uppercase bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
              Initialize
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center relative z-10 px-6 mt-8 mb-24 max-w-7xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center max-w-3xl"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="flex justify-center mb-8"
          >
            <img src="/logo.png" alt="PSYX FORTRESS" className="w-28 h-28 object-contain drop-shadow-[0_0_30px_rgba(220,38,38,0.5)]" />
          </motion.div>

          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 rounded-full border border-primary/30 bg-primary/10 backdrop-blur-md text-primary text-xs font-mono tracking-widest uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            System Online • Secure Transmission
          </div>

          <h1 className="text-5xl md:text-7xl font-bold mb-4 tracking-tight leading-none">
            <span className="text-foreground">PSYX</span>{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-red-400">FORTRESS</span>
          </h1>
          <p className="text-base md:text-lg text-muted-foreground mb-3 font-mono tracking-widest uppercase">
            — Premium Mail System —
          </p>
          <p className="text-base md:text-lg text-muted-foreground/70 mb-10 max-w-2xl mx-auto font-sans">
            Claim your exclusive <span className="text-primary font-mono">@psyx.com</span> address. Send to Gmail, Outlook, and any domain. Impenetrable. Elite. Yours.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="w-full sm:w-auto font-mono text-sm tracking-widest uppercase group bg-primary hover:bg-primary/90 shadow-xl shadow-primary/25">
                Create Account
                <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="w-full sm:w-auto font-mono text-sm tracking-widest uppercase border-primary/40 hover:bg-primary/10 hover:border-primary/70">
                Access Node
              </Button>
            </Link>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
          className="grid grid-cols-1 md:grid-cols-4 gap-4 w-full mt-28"
        >
          {[
            { icon: Shield, title: "End-to-End Security", desc: "JWT-secured sessions and bcrypt-hashed credentials. Your data stays private." },
            { icon: Globe, title: "Cross-Domain Mail", desc: "Send to Gmail, Outlook, Yahoo, or any address worldwide. True open communication." },
            { icon: Zap, title: "Instant Delivery", desc: "Blazing-fast transmission engine. Messages reach their destination in milliseconds." },
            { icon: Lock, title: "Custom @psyx.com", desc: "Claim your exclusive identity on the network. No sharing, no compromise." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-card/50 backdrop-blur-xl border border-card-border p-6 rounded-xl relative overflow-hidden group hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/8 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <Icon className="w-8 h-8 text-primary mb-4" />
              <h3 className="font-mono font-bold text-sm mb-2 tracking-wide uppercase">{title}</h3>
              <p className="text-muted-foreground text-xs leading-relaxed">{desc}</p>
            </div>
          ))}
        </motion.div>
      </main>

      <footer className="relative z-10 w-full border-t border-border/30 py-6 px-6 text-center text-xs text-muted-foreground/50 font-mono">
        <p>PSYX FORTRESS © 2084 · ALL TRANSMISSIONS ENCRYPTED · psyx.com</p>
      </footer>
    </div>
  );
}
