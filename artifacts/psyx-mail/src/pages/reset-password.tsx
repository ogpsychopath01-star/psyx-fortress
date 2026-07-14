import { Link, useLocation, useSearch } from "wouter";
import { motion } from "framer-motion";
import { Mail, Loader2, ArrowRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useResetPassword } from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "sonner";
import { useMemo } from "react";

const resetSchema = z.object({
  password: z.string().min(8, "Passcode must be at least 8 chars"),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passcodes do not match",
  path: ["confirmPassword"],
});

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const token = useMemo(() => new URLSearchParams(searchString).get("token") || "", [searchString]);
  
  const mutation = useResetPassword();

  const form = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  function onSubmit(values: z.infer<typeof resetSchema>) {
    if (!token) {
      toast.error("Missing recovery token.");
      return;
    }
    
    mutation.mutate(
      { data: { token, password: values.password } },
      {
        onSuccess: () => {
          toast.success("Passcode reset successfully.");
          setLocation("/login");
        },
        onError: (error) => {
          toast.error(error.message || "Failed to reset passcode.");
        },
      }
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center p-8 bg-card border border-destructive/50 rounded-xl">
          <p className="text-destructive font-mono uppercase tracking-widest mb-4">Invalid Access</p>
          <p className="text-muted-foreground text-sm font-mono mb-6">No recovery token provided.</p>
          <Link href="/login">
            <Button variant="outline" className="font-mono">Return</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.05)_0%,transparent_70%)] pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-card/60 backdrop-blur-2xl border border-border p-8 rounded-2xl shadow-2xl relative z-10"
      >
        <div className="flex flex-col items-center mb-8">
          <Mail className="w-12 h-12 text-primary mb-4" />
          <h1 className="text-2xl font-bold font-mono tracking-widest uppercase">New_Passcode</h1>
          <p className="text-muted-foreground text-sm mt-2 text-center">Establish new authentication credentials</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-mono text-xs tracking-wider uppercase text-muted-foreground">New Passcode</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" className="bg-background/50 font-mono tracking-widest" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-mono text-xs tracking-wider uppercase text-muted-foreground">Confirm Passcode</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" className="bg-background/50 font-mono tracking-widest" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full font-mono tracking-widest uppercase group" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirm Overwrite
              {!mutation.isPending && <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />}
            </Button>
          </form>
        </Form>
      </motion.div>
    </div>
  );
}
