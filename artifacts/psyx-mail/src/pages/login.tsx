import { Link, useLocation } from "wouter";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLoginUser } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { toast } from "sonner";

const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Min 8 characters"),
  captchaToken: z.string().min(1, "Verify identity"),
  rememberMe: z.boolean().default(false),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const loginMutation = useLoginUser();

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", captchaToken: "", rememberMe: false },
  });

  const fillDemo = (role: "user" | "admin" | "owner") => {
    const accounts = {
      user: { email: "mayank@psyx.com", password: "User@1234!" },
      admin: { email: "psyxadmin@psyx.com", password: "Admin@1234!" },
      owner: { email: "psyxowner@psyx.com", password: "Owner@1234!" },
    };
    form.setValue("email", accounts[role].email);
    form.setValue("password", accounts[role].password);
    setCaptchaVerified(true);
    form.setValue("captchaToken", "verified_token_8841");
  };

  function onSubmit(values: z.infer<typeof loginSchema>) {
    loginMutation.mutate({ data: values }, {
      onSuccess: (data) => {
        localStorage.setItem("psyx_token", data.token);
        toast.success("Access granted. Welcome to PSYX FORTRESS.");
        setLocation("/dashboard");
      },
      onError: () => {
        toast.error("Authentication failed. Check credentials.");
      },
    });
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-[radial-gradient(ellipse_at_top,rgba(220,38,38,0.15)_0%,transparent_70%)]" />
        <div className="absolute inset-0" style={{backgroundImage: 'linear-gradient(rgba(220,38,38,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(220,38,38,0.02) 1px, transparent 1px)', backgroundSize: '60px 60px'}} />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md bg-card/60 backdrop-blur-2xl border border-card-border p-8 rounded-2xl shadow-2xl shadow-black/50 relative z-10"
      >
        <div className="flex flex-col items-center mb-8">
          <img src="/logo.png" alt="PSYX FORTRESS" className="w-16 h-16 object-contain mb-4 drop-shadow-[0_0_20px_rgba(220,38,38,0.4)]" />
          <h1 className="text-2xl font-bold font-mono tracking-widest">SYSTEM_ACCESS</h1>
          <p className="text-muted-foreground text-sm mt-1 font-mono">PSYX FORTRESS · Authenticate</p>
        </div>

        {/* Demo quick-fill */}
        <div className="mb-6 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <p className="text-xs font-mono text-muted-foreground mb-2 uppercase tracking-wider">Demo Accounts</p>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" className="flex-1 font-mono text-[10px] h-7 border-border/50" onClick={() => fillDemo("user")}>User</Button>
            <Button type="button" size="sm" variant="outline" className="flex-1 font-mono text-[10px] h-7 border-border/50" onClick={() => fillDemo("admin")}>Admin</Button>
            <Button type="button" size="sm" variant="outline" className="flex-1 font-mono text-[10px] h-7 border-border/50" onClick={() => fillDemo("owner")}>Owner</Button>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel className="font-mono text-xs tracking-wider uppercase text-muted-foreground">Email Address</FormLabel>
                <FormControl>
                  <Input placeholder="agent@psyx.com" className="bg-input/50 font-mono border-border/60" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="password" render={({ field }) => (
              <FormItem>
                <div className="flex justify-between items-center">
                  <FormLabel className="font-mono text-xs tracking-wider uppercase text-muted-foreground">Password</FormLabel>
                  <Link href="/forgot-password">
                    <span className="text-xs font-mono text-primary hover:text-primary/80 cursor-pointer">Forgot?</span>
                  </Link>
                </div>
                <FormControl>
                  <Input type="password" placeholder="••••••••" className="bg-input/50 font-mono tracking-widest border-border/60" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="captchaToken" render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-3 space-y-0 bg-input/20 px-4 py-3 rounded-lg border border-border/40">
                <FormControl>
                  <Checkbox checked={captchaVerified} onCheckedChange={(checked) => {
                    setCaptchaVerified(checked as boolean);
                    field.onChange(checked ? "verified_token_8841" : "");
                  }} className="border-primary/50 data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                </FormControl>
                <FormLabel className="font-mono text-sm cursor-pointer">I am human</FormLabel>
                {captchaVerified && <span className="ml-auto text-xs font-mono text-primary">✓ Verified</span>}
              </FormItem>
            )} />

            <FormField control={form.control} name="rememberMe" render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} className="border-border/50 data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                </FormControl>
                <FormLabel className="font-mono text-xs text-muted-foreground cursor-pointer">Keep me signed in</FormLabel>
              </FormItem>
            )} />

            <Button type="submit" className="w-full font-mono tracking-widest uppercase group bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Authenticate
              {!loginMutation.isPending && <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />}
            </Button>
          </form>
        </Form>

        <div className="mt-6 text-center border-t border-border/30 pt-5">
          <p className="text-xs text-muted-foreground font-mono">
            No account?{" "}
            <Link href="/register">
              <span className="text-primary hover:text-primary/80 cursor-pointer uppercase tracking-wider font-bold ml-1">Request Access</span>
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
