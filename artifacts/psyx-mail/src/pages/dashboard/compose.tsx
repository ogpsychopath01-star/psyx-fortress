import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Send, Save, Globe, Loader2, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useComposeEmail, useGetEmail } from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

// ── Validation ───────────────────────────────────────────────────────────────

/** Lenient: only recipient required — used for Save Draft */
const draftSchema = z.object({
  toAddress:  z.string().email("Invalid recipient address"),
  ccAddress:  z.union([z.string().email("Invalid CC"), z.literal(""), z.undefined()]),
  subject:    z.string().optional(),
  body:       z.string().optional(),
  replyToId:  z.number().optional().nullable(),
});

/** Strict: all fields required — used for Dispatch */
const sendSchema = z.object({
  toAddress:  z.string().email("Invalid recipient address"),
  ccAddress:  z.union([z.string().email("Invalid CC"), z.literal(""), z.undefined()]),
  subject:    z.string().min(1, "Subject is required to send"),
  body:       z.string().min(1, "Message body is required to send"),
  replyToId:  z.number().optional().nullable(),
});

type ComposeValues = z.infer<typeof sendSchema>;

// ── Component ────────────────────────────────────────────────────────────────

export default function ComposeEmail() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const replyToIdStr = params.get("replyTo");
  const replyToId = replyToIdStr ? parseInt(replyToIdStr, 10) : null;

  const mutation = useComposeEmail();
  const [smtpStatus, setSmtpStatus] = useState<"idle" | "sent" | "queued" | "failed">("idle");

  const { data: originalEmail } = useGetEmail(replyToId ?? 0, {
    query: { enabled: !!replyToId } as any,
  });

  const form = useForm<ComposeValues>({
    resolver: zodResolver(sendSchema),
    defaultValues: { toAddress: "", ccAddress: "", subject: "", body: "", replyToId: null },
    mode: "onSubmit",
  });

  const toAddress = form.watch("toAddress");
  const isExternal =
    toAddress && !toAddress.toLowerCase().endsWith("@psyx.com") && toAddress.includes("@");

  // Pre-fill reply fields
  useEffect(() => {
    if (originalEmail && replyToId) {
      form.reset({
        toAddress: originalEmail.fromAddress,
        subject:   originalEmail.subject.startsWith("Re:")
          ? originalEmail.subject
          : `Re: ${originalEmail.subject}`,
        body: `\n\n--- Original from ${originalEmail.fromAddress} ---\n${originalEmail.body.replace(/<[^>]+>/g, "")}`,
        replyToId: originalEmail.id,
        ccAddress: "",
      });
    }
  }, [originalEmail, replyToId]);

  function submitWith(isDraft: boolean) {
    const schema = isDraft ? draftSchema : sendSchema;
    const values = form.getValues();
    const parsed = schema.safeParse(values);

    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message || "Please fill in required fields.");
      if (!isDraft) form.trigger();
      return;
    }

    mutation.mutate(
      {
        data: {
          toAddress:  parsed.data.toAddress,
          ccAddress:  parsed.data.ccAddress || undefined,
          subject:    parsed.data.subject || "(no subject)",
          body:       parsed.data.body || "",
          isDraft,
          replyToId:  parsed.data.replyToId ?? undefined,
        },
      },
      {
        onSuccess: (response: any) => {
          if (isDraft) {
            toast.success("Draft saved.");
            setLocation("/dashboard");
            return;
          }

          // Check delivery status for external mail
          const delivery = response?.externalDelivery;
          if (delivery?.success === true) {
            toast.success("📤 Message dispatched to external domain!");
          } else if (delivery?.success === false) {
            if (delivery.reason === "smtp_not_configured") {
              setSmtpStatus("queued");
              toast.warning(
                "Email saved — external SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS in server environment to deliver external mail.",
                { duration: 10_000 }
              );
              return; // stay on page so user sees the banner
            } else {
              toast.error(`External delivery failed: ${delivery.reason}`);
            }
          } else {
            toast.success("Message sent!");
          }
          setLocation("/dashboard");
        },
        onError: (error) => {
          toast.error((error as any).message || "Transmission failed.");
        },
      }
    );
  }

  return (
    <div className="h-full flex flex-col bg-background/50 relative overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="h-14 border-b border-border/50 flex items-center px-4 gap-4 sticky top-0 bg-background/95 backdrop-blur z-10">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/dashboard")}
          className="text-muted-foreground hover:text-foreground shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="font-mono text-sm tracking-widest uppercase truncate">
            {replyToId ? "Reply" : "New Transmission"}
          </span>
          {isExternal && (
            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 font-mono text-[10px] gap-1 shrink-0">
              <Globe className="w-3 h-3" /> External
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            className="font-mono text-xs uppercase gap-2 hidden sm:flex"
            onClick={() => submitWith(true)}
            disabled={mutation.isPending}
          >
            <Save className="w-4 h-4" /> Draft
          </Button>
          <Button
            className="bg-primary hover:bg-primary/90 font-mono text-xs uppercase tracking-widest group shadow-lg shadow-primary/20 gap-2"
            onClick={() => submitWith(false)}
            disabled={mutation.isPending}
          >
            {mutation.isPending
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />}
            Dispatch
          </Button>
        </div>
      </div>

      {/* ── External-domain info banners ───────────────────────────────── */}
      {isExternal && smtpStatus === "idle" && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4 mt-3 px-4 py-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-xs font-mono text-blue-300 flex items-start gap-2.5"
        >
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
          <div>
            <p className="font-semibold text-blue-300 mb-0.5">Sending to external domain</p>
            <p className="text-blue-400/80">
              External delivery requires SMTP credentials set in the server environment:
              <span className="text-blue-300"> SMTP_HOST · SMTP_PORT · SMTP_USER · SMTP_PASS</span>.
              Without them the email is recorded but not delivered externally.
            </p>
          </div>
        </motion.div>
      )}

      {smtpStatus === "queued" && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4 mt-3 px-4 py-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-xs font-mono text-yellow-300 flex items-start gap-2.5"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-yellow-400" />
          <div>
            <p className="font-semibold text-yellow-300 mb-1">SMTP not configured — message saved locally</p>
            <p className="text-yellow-400/80 mb-2">
              Set these in your server <code className="bg-yellow-500/10 px-1 rounded">.env</code> to enable real external delivery:
            </p>
            <div className="bg-black/30 rounded p-2 space-y-0.5 font-mono text-yellow-300/90 text-[11px]">
              <div>SMTP_HOST=smtp.gmail.com</div>
              <div>SMTP_PORT=587</div>
              <div>SMTP_USER=your@gmail.com</div>
              <div>SMTP_PASS=your-app-password</div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="mt-2 h-7 text-xs text-yellow-400 hover:text-yellow-300 px-2"
              onClick={() => setLocation("/dashboard")}
            >
              Back to Inbox
            </Button>
          </div>
        </motion.div>
      )}

      {/* ── Compose form ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-4 md:p-6 max-w-4xl mx-auto w-full">
        <Form {...form}>
          <form className="space-y-0">
            <div className="bg-card/30 backdrop-blur border border-border/50 rounded-xl shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-0.5 h-full bg-primary/60" />
              <div className="divide-y divide-border/30">

                <FormField
                  control={form.control}
                  name="toAddress"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-4 space-y-0 px-4 md:px-6 py-3">
                      <FormLabel className="w-10 md:w-14 font-mono text-xs text-muted-foreground uppercase text-right shrink-0">To:</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="recipient@gmail.com or user@psyx.com"
                          className="flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 font-mono text-sm"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="ccAddress"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-4 space-y-0 px-4 md:px-6 py-3">
                      <FormLabel className="w-10 md:w-14 font-mono text-xs text-muted-foreground uppercase text-right shrink-0">Cc:</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="optional@domain.com"
                          className="flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 font-mono text-sm"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-4 space-y-0 px-4 md:px-6 py-3">
                      <FormLabel className="w-10 md:w-14 font-mono text-xs text-muted-foreground uppercase text-right shrink-0">Subj:</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Subject"
                          className="flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 font-semibold text-base"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="body"
                  render={({ field }) => (
                    <FormItem className="px-4 md:px-6 py-4">
                      <FormControl>
                        <Textarea
                          placeholder="Write your message here..."
                          className="min-h-[300px] md:min-h-[360px] border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 resize-none font-sans leading-relaxed text-sm"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

              </div>
            </div>

            {/* Mobile Save Draft button (hidden on desktop where it's in the header) */}
            <div className="mt-4 flex sm:hidden">
              <Button
                variant="outline"
                className="w-full font-mono text-xs uppercase gap-2"
                onClick={() => submitWith(true)}
                disabled={mutation.isPending}
              >
                <Save className="w-4 h-4" /> Save Draft
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
