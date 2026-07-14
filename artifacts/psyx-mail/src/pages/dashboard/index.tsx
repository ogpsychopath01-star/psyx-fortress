import { useState, useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import { 
  useListEmails, 
  useBulkEmailAction, 
  useEmailAction,
  getListEmailsQueryKey, 
  getGetEmailStatsQueryKey,
  ListEmailsFolder 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Star, MoreVertical, Trash2, ShieldAlert, ArchiveRestore, Check, RefreshCw, Search, X } from "lucide-react";
import { format } from "date-fns";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export default function DashboardInbox() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const folder = (new URLSearchParams(searchString).get("folder") || "inbox") as ListEmailsFolder;
  const page = Number(new URLSearchParams(searchString).get("page") || "1");

  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const { data, isLoading, refetch, isFetching } = useListEmails({
    folder,
    page,
    limit: 20,
    search: searchQuery || undefined,
  });
  const emails = data?.emails || [];

  const bulkAction = useBulkEmailAction();
  const singleAction = useEmailAction();

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetEmailStatsQueryKey() });
  }, [queryClient]);

  const toggleSelectAll = () => {
    if (selectedIds.size === emails.length && emails.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(emails.map(e => e.id)));
    }
  };

  const toggleSelect = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleBulkAction = (action: string) => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    bulkAction.mutate(
      { data: { ids: Array.from(selectedIds), action } },
      {
        onSuccess: () => {
          setSelectedIds(new Set());
          invalidate();
          toast.success(`Applied to ${count} message${count > 1 ? "s" : ""}.`);
        },
        onError: () => toast.error("Action failed. Try again."),
      }
    );
  };

  // FIX: Star a single email using the dedicated action endpoint (not bulk)
  const handleStarToggle = (e: React.MouseEvent, emailId: number, isStarred: boolean) => {
    e.stopPropagation();
    singleAction.mutate(
      { id: emailId, data: { action: isStarred ? "unstar" : "star" } },
      {
        onSuccess: () => invalidate(),
        onError: () => toast.error("Failed to update star."),
      }
    );
  };

  const openEmail = (id: number) => setLocation(`/dashboard/email/${id}`);

  const folderTitle = folder.charAt(0).toUpperCase() + folder.slice(1);

  return (
    <div className="h-full flex flex-col relative">
      {/* Toolbar */}
      <div className="h-14 border-b border-border/50 flex items-center px-4 gap-3 sticky top-0 bg-background/95 backdrop-blur z-10">
        {/* Select all + bulk actions */}
        <div className="flex items-center gap-2 shrink-0">
          <Checkbox
            checked={emails.length > 0 && selectedIds.size === emails.length}
            onCheckedChange={toggleSelectAll}
            className="border-muted-foreground/50 data-[state=checked]:bg-primary"
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" disabled={selectedIds.size === 0}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="font-mono text-xs">
              <DropdownMenuItem onClick={() => handleBulkAction("read")}>
                <Check className="mr-2 h-4 w-4" /> Mark as Read
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleBulkAction("unread")}>
                <RefreshCw className="mr-2 h-4 w-4" /> Mark as Unread
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleBulkAction("star")}>
                <Star className="mr-2 h-4 w-4" /> Star All
              </DropdownMenuItem>
              {folder !== "trash" && (
                <DropdownMenuItem onClick={() => handleBulkAction("trash")} className="text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" /> Move to Trash
                </DropdownMenuItem>
              )}
              {folder !== "spam" && (
                <DropdownMenuItem onClick={() => handleBulkAction("spam")} className="text-destructive">
                  <ShieldAlert className="mr-2 h-4 w-4" /> Report Spam
                </DropdownMenuItem>
              )}
              {(folder === "trash" || folder === "spam") && (
                <DropdownMenuItem onClick={() => handleBulkAction("restore")}>
                  <ArchiveRestore className="mr-2 h-4 w-4" /> Restore
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Search bar */}
        <AnimatePresence mode="wait">
          {showSearch ? (
            <motion.div
              key="search"
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "100%" }}
              exit={{ opacity: 0, width: 0 }}
              className="flex-1 flex items-center gap-2"
            >
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  autoFocus
                  placeholder="Search messages..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-sm font-mono bg-card/50 border-border/50 focus-visible:ring-primary/30"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground shrink-0"
                onClick={() => { setShowSearch(false); setSearchQuery(""); }}
              >
                <X className="h-4 w-4" />
              </Button>
            </motion.div>
          ) : (
            <motion.div key="title" className="ml-auto flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                onClick={() => setShowSearch(true)}
              >
                <Search className="h-4 w-4" />
              </Button>
              <span className="font-mono text-xs text-muted-foreground tracking-widest uppercase">
                {folderTitle}
                {data?.total ? ` · ${data.total}` : ""}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Email List */}
      <div className="flex-1 overflow-auto p-2">
        {isLoading || isFetching ? (
          <div className="space-y-1">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex items-center gap-4 p-3 border-b border-border/10">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-4 rounded-full" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        ) : emails.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-40 py-24">
            <ArchiveRestore className="w-14 h-14 mb-4" />
            <p className="font-mono uppercase tracking-widest text-sm">
              {searchQuery ? "No results found" : "Sector Empty"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            <AnimatePresence>
              {emails.map((email, index) => (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15, delay: index * 0.02 }}
                  key={email.id}
                  onClick={() => openEmail(email.id)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all border group
                    ${!email.isRead ? "bg-card/30 border-primary/10 font-semibold" : "bg-transparent border-transparent opacity-80"}
                    ${selectedIds.has(email.id) ? "!bg-primary/8 !border-primary/25" : "hover:bg-card/40 hover:border-border/30"}
                  `}
                >
                  {/* Checkbox + Star */}
                  <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(email.id)}
                      onCheckedChange={() => toggleSelect(email.id, { stopPropagation: () => {} } as React.MouseEvent)}
                      className="border-muted-foreground/30 data-[state=checked]:bg-primary"
                    />
                    <button
                      onClick={e => handleStarToggle(e, email.id, email.isStarred)}
                      className="text-muted-foreground/40 hover:text-accent focus:outline-none transition-colors"
                      title={email.isStarred ? "Unstar" : "Star"}
                    >
                      <Star className={`w-4 h-4 transition-colors ${email.isStarred ? "fill-accent text-accent" : "hover:fill-accent/30"}`} />
                    </button>
                  </div>

                  {/* Sender */}
                  <div className={`w-44 shrink-0 truncate text-sm ${!email.isRead ? "text-foreground font-semibold" : "text-foreground/70"}`}>
                    {folder === "sent" || folder === "drafts"
                      ? `→ ${email.toAddress.split("@")[0]}`
                      : email.fromAddress.split("@")[0]}
                  </div>

                  {/* Subject + Preview */}
                  <div className="flex-1 truncate flex items-baseline gap-2 min-w-0">
                    <span className={`text-sm truncate ${!email.isRead ? "text-foreground" : "text-foreground/80"}`}>
                      {email.subject || "(No Subject)"}
                    </span>
                    <span className="text-muted-foreground text-xs truncate hidden sm:inline">
                      — {email.body.replace(/<[^>]+>/g, "").slice(0, 60)}
                    </span>
                  </div>

                  {/* Unread dot + timestamp */}
                  <div className="flex items-center gap-2 shrink-0">
                    {!email.isRead && (
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    )}
                    <span className="font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                      {format(new Date(email.createdAt), "MMM d, HH:mm")}
                    </span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Pagination */}
      {data && data.total > 20 && (
        <div className="border-t border-border/30 px-4 py-2.5 flex items-center justify-between">
          <span className="text-xs font-mono text-muted-foreground">
            {data.total} total · Page {page} of {Math.ceil(data.total / 20)}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 font-mono text-xs"
              disabled={page <= 1}
              onClick={() => setLocation(`/dashboard?folder=${folder}&page=${page - 1}`)}
            >
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 font-mono text-xs"
              disabled={page >= Math.ceil(data.total / 20)}
              onClick={() => setLocation(`/dashboard?folder=${folder}&page=${page + 1}`)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
