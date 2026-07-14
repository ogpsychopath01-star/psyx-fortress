import { useLocation, useParams } from "wouter";
import { useGetEmail, useEmailAction, getListEmailsQueryKey, getGetEmailStatsQueryKey, useDeleteEmail } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Reply, Trash2, Star, ArchiveRestore, ShieldAlert, Paperclip, Forward } from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function EmailView() {
  const [, setLocation] = useLocation();
  const { id } = useParams<{ id: string }>();
  const emailId = parseInt(id || "0", 10);
  const queryClient = useQueryClient();

  const { data: email, isLoading } = useGetEmail(emailId, {
    query: { enabled: !!emailId } as any,
  });

  const actionMutation = useEmailAction();
  const deleteMutation = useDeleteEmail();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetEmailStatsQueryKey() });
  };

  const handleAction = (action: string) => {
    actionMutation.mutate(
      { id: emailId, data: { action } },
      {
        onSuccess: () => {
          invalidate();
          if (action === "trash") {
            toast.success("Moved to Trash.");
            setLocation("/dashboard");
          } else if (action === "spam") {
            toast.success("Marked as Spam.");
            setLocation("/dashboard");
          } else if (action === "restore") {
            toast.success("Restored to Inbox.");
            setLocation("/dashboard");
          } else if (action === "star") {
            toast.success("Starred.");
          } else if (action === "unstar") {
            toast.success("Unstarred.");
          }
        },
        onError: () => toast.error("Action failed."),
      }
    );
  };

  const handleDelete = () => {
    deleteMutation.mutate(
      { id: emailId },
      {
        onSuccess: () => {
          invalidate();
          toast.success("Permanently deleted.");
          setLocation("/dashboard");
        },
        onError: () => toast.error("Delete failed."),
      }
    );
  };

  if (isLoading) {
    return (
      <div className="p-8 space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-3/4" />
        <div className="flex items-center gap-4">
          <Skeleton className="w-12 h-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
        <div className="space-y-3 pt-8">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-4 w-full" />)}
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    );
  }

  if (!email) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground opacity-40 p-8 h-full">
        <ArchiveRestore className="w-16 h-16 mb-4" />
        <p className="font-mono uppercase tracking-widest text-sm">Transmission Not Found</p>
      </div>
    );
  }

  // FIX: Detect if body is HTML and render accordingly; strip tags for plain text fallback
  const isHtml = /<[a-z][\s\S]*>/i.test(email.body);

  return (
    <div className="h-full flex flex-col relative bg-background/50">
      {/* Toolbar */}
      <div className="h-14 border-b border-border/50 flex items-center px-4 gap-2 sticky top-0 bg-background/95 backdrop-blur z-10">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => window.history.back()}
          className="text-muted-foreground hover:text-foreground mr-1"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>

        <div className="flex items-center gap-1 ml-auto">
          <Button
            variant="ghost"
            size="icon"
            title={email.isStarred ? "Unstar" : "Star"}
            onClick={() => handleAction(email.isStarred ? "unstar" : "star")}
          >
            <Star className={`w-4 h-4 ${email.isStarred ? "fill-accent text-accent" : "text-muted-foreground"}`} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Reply"
            onClick={() => setLocation(`/dashboard/compose?replyTo=${email.id}`)}
          >
            <Reply className="w-4 h-4 text-muted-foreground" />
          </Button>
          {email.folder === "trash" || email.folder === "spam" ? (
            <Button variant="ghost" size="icon" title="Restore" onClick={() => handleAction("restore")}>
              <ArchiveRestore className="w-4 h-4 text-muted-foreground" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              title="Mark as spam"
              onClick={() => handleAction("spam")}
            >
              <ShieldAlert className="w-4 h-4 text-muted-foreground" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            title={email.folder === "trash" ? "Delete permanently" : "Move to trash"}
            onClick={() => email.folder === "trash" ? handleDelete() : handleAction("trash")}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="p-6 lg:p-10 max-w-4xl mx-auto w-full">
          {/* Subject */}
          <h1 className="text-2xl font-bold mb-6 font-sans leading-tight">{email.subject || "(No Subject)"}</h1>

          {/* Sender info */}
          <div className="flex items-start justify-between gap-4 mb-8 pb-6 border-b border-border/30">
            <div className="flex items-center gap-4">
              <Avatar className="h-11 w-11 border border-primary/20 shrink-0">
                <AvatarFallback className="bg-primary/10 text-primary font-mono text-lg">
                  {email.fromAddress.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium text-sm flex flex-wrap items-center gap-1.5">
                  <span className="text-foreground font-semibold">{email.fromAddress.split("@")[0]}</span>
                  <span className="text-muted-foreground text-xs opacity-60">&lt;{email.fromAddress}&gt;</span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                  to <span className="text-foreground/70">{email.toAddress}</span>
                  {email.ccAddress && <span> · cc {email.ccAddress}</span>}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <div className="text-xs text-muted-foreground font-mono bg-card/60 px-3 py-1.5 rounded-full border border-border/50 whitespace-nowrap">
                {format(new Date(email.createdAt), "MMM d, yyyy · HH:mm")}
              </div>
              <Badge variant="outline" className="text-[10px] font-mono capitalize border-border/40 text-muted-foreground">
                {email.folder}
              </Badge>
            </div>
          </div>

          {/* Body — FIX: render HTML emails as HTML, plain text as text */}
          <div className="bg-card/20 rounded-xl border border-border/30 overflow-hidden">
            {isHtml ? (
              <div
                className="p-6 lg:p-8 prose prose-sm max-w-none text-foreground/90
                  prose-headings:text-foreground prose-a:text-primary prose-strong:text-foreground
                  prose-code:text-primary prose-code:bg-primary/10 prose-code:rounded prose-code:px-1
                  dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: email.body }}
              />
            ) : (
              <div className="p-6 lg:p-8 font-sans text-foreground/90 leading-relaxed whitespace-pre-wrap text-sm">
                {email.body}
              </div>
            )}
          </div>

          {/* Attachments */}
          {email.attachments && email.attachments.length > 0 && (
            <div className="mt-6 pt-6 border-t border-border/40">
              <h3 className="text-xs font-mono tracking-widest uppercase text-muted-foreground mb-3">
                Attachments ({email.attachments.length})
              </h3>
              <div className="flex flex-wrap gap-3">
                {email.attachments.map((att: { id: number; filename: string; size: number; url?: string }) => (
                  <a
                    key={att.id}
                    href={att.url || "#"}
                    download={att.filename}
                    className="flex items-center gap-3 bg-card border border-border p-3 rounded-xl hover:border-primary/50 cursor-pointer transition-colors w-60 group"
                  >
                    <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0">
                      <Paperclip className="w-4 h-4" />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-sm font-medium truncate">{att.filename}</p>
                      <p className="text-xs text-muted-foreground font-mono">{(att.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Reply quick-action */}
          <div className="mt-8">
            <Button
              variant="outline"
              className="font-mono text-xs uppercase tracking-widest gap-2 border-border/50"
              onClick={() => setLocation(`/dashboard/compose?replyTo=${email.id}`)}
            >
              <Reply className="w-4 h-4" /> Reply to {email.fromAddress.split("@")[0]}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
