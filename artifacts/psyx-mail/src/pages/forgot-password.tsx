import { Link } from "wouter";
import { motion } from "framer-motion";
import { Mail, ArrowLeft, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForgotPassword } from "@workspace/api-client-react";

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
import { useState } from "react";

const forgotSchema = z.object({
  email: z.string().email("Invalid identity format"),
});

export default function ForgotPassword() {
  const mutation = useForgotPassword();
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<z.infer<typeof forgotSchema>>({
    resolver: zodResolver(forgotSchema),
    defaultValues: {
      email: "",
    },
  });

  function onSubmit(values: z.infer<typeof forgotSchema>) {
    mutation.mutate(
      { data: values },
      {
        onSuccess: () => {
          setSubmitted(true);
        },
        onError: (error) => {
          toast.error(error.message || "Failed to initiate recovery.");
        },
      }
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.05)_0%,transparent_70%)] pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-card/60 backdrop-blur-2xl border border-border p-8 rounded-2xl shadow-2xl relative z-10"
      >
        <div className="flex flex-col items-center mb-8">
          <Mail className="w-12 h-12 text-primary mb-4" />
          <h1 className="text-2xl font-bold font-mono tracking-widest uppercase">Identity_Recovery</h1>
          <p className="text-muted-foreground text-sm mt-2 text-center">Initiate protocol to restore access</p>
        </div>

        {submitted ? (
          <div className="text-center space-y-6">
            <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg">
              <p className="text-primary font-mono text-sm">Recovery transmission dispatched.</p>
              <p className="text-muted-foreground text-xs mt-2">Check secondary comms channel for reset parameters.</p>
            </div>
            <Link href="/login">
              <Button variant="outline" className="w-full font-mono uppercase tracking-widest">
                Return to Access Node
              </Button>
            </Link>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono text-xs tracking-wider uppercase text-muted-foreground">Recovery Target (Email)</FormLabel>
                    <FormControl>
                      <Input placeholder="agent@psyx.com" className="bg-background/50 font-mono" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full font-mono tracking-widest uppercase" disabled={mutation.isPending}>
                {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Transmit Recovery Signal
              </Button>
            </form>
          </Form>
        )}

        <div className="mt-8 text-center border-t border-border/50 pt-6">
          <Link href="/login" className="inline-flex items-center text-xs text-muted-foreground hover:text-primary font-mono uppercase tracking-widest transition-colors">
            <ArrowLeft className="w-3 h-3 mr-2" />
            Abort Recovery
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
