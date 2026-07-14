import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Mail, ArrowRight, Loader2, Check, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRegisterUser, checkUsername } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription
} from "@/components/ui/form";
import { toast } from "sonner";
import { useDebounce } from "@/hooks/use-debounce";

const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 chars").max(32, "Max 32 chars"),
  password: z.string().min(8, "Password must be at least 8 chars"),
  displayName: z.string().optional(),
  captchaToken: z.string().min(1, "Verify identity"),
});

export default function Register() {
  const [, setLocation] = useLocation();
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const registerMutation = useRegisterUser();

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      password: "",
      displayName: "",
      captchaToken: "",
    },
  });

  const watchUsername = form.watch("username");
  const debouncedUsername = useDebounce(watchUsername, 500);

  const { data: usernameCheck, isFetching: checkingUsername } = useQuery({
    queryKey: ["check-username", debouncedUsername],
    queryFn: () => checkUsername({ username: debouncedUsername }),
    enabled: debouncedUsername.length >= 3,
  });

  function onSubmit(values: z.infer<typeof registerSchema>) {
    if (usernameCheck && !usernameCheck.available) {
      form.setError("username", { message: "Username unavailable" });
      return;
    }
    
    registerMutation.mutate(
      { data: values },
      {
        onSuccess: (data) => {
          localStorage.setItem("psyx_token", data.token);
          toast.success("Identity established. Welcome to PSYX.");
          setLocation("/dashboard");
        },
        onError: (error) => {
          toast.error(error.message || "Registration failed.");
        },
      }
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.1)_0%,transparent_70%)] pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md bg-card/60 backdrop-blur-2xl border border-border p-8 rounded-2xl shadow-2xl relative z-10 my-8"
      >
        <div className="flex flex-col items-center mb-8">
          <Mail className="w-12 h-12 text-accent mb-4" />
          <h1 className="text-2xl font-bold font-mono tracking-widest uppercase">Identity_Creation</h1>
          <p className="text-muted-foreground text-sm mt-2">Establish your presence on the network</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-mono text-xs tracking-wider uppercase text-muted-foreground">Desired Alias</FormLabel>
                  <div className="relative">
                    <FormControl>
                      <Input placeholder="agent007" className="bg-background/50 font-mono pr-24" {...field} />
                    </FormControl>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-sm pointer-events-none">
                      @psyx.com
                    </div>
                  </div>
                  {debouncedUsername.length >= 3 && (
                    <div className="mt-1 flex items-center text-xs font-mono">
                      {checkingUsername ? (
                        <span className="text-muted-foreground flex items-center"><Loader2 className="w-3 h-3 animate-spin mr-1"/> Verifying availability...</span>
                      ) : usernameCheck?.available ? (
                        <span className="text-green-500 flex items-center"><Check className="w-3 h-3 mr-1"/> Alias available</span>
                      ) : (
                        <span className="text-destructive flex items-center"><X className="w-3 h-3 mr-1"/> Alias occupied</span>
                      )}
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-mono text-xs tracking-wider uppercase text-muted-foreground">Public Identifier (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" className="bg-background/50 font-sans" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-mono text-xs tracking-wider uppercase text-muted-foreground">Passcode</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" className="bg-background/50 font-mono tracking-widest" {...field} />
                  </FormControl>
                  <FormDescription className="text-[10px] uppercase tracking-wider font-mono">Min 8 characters required</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="captchaToken"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 bg-background/30 p-4 rounded-lg border border-border/50">
                  <FormControl>
                    <Checkbox
                      checked={captchaVerified}
                      onCheckedChange={(checked) => {
                        setCaptchaVerified(checked as boolean);
                        field.onChange(checked ? "verified_token_8841" : "");
                      }}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="font-mono text-sm cursor-pointer">
                      Verify organic entity status
                    </FormLabel>
                  </div>
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full font-mono tracking-widest uppercase group bg-accent hover:bg-accent/90" disabled={registerMutation.isPending || (usernameCheck && !usernameCheck.available)}>
              {registerMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Initialize
              {!registerMutation.isPending && <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />}
            </Button>
          </form>
        </Form>

        <div className="mt-8 text-center border-t border-border/50 pt-6">
          <p className="text-xs text-muted-foreground font-mono">
            EXISTING IDENTITY?{" "}
            <Link href="/login">
              <span className="text-accent hover:text-accent/80 cursor-pointer uppercase tracking-wider font-bold ml-2">Access Node</span>
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
