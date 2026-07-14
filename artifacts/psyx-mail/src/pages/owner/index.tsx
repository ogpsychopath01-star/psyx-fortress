import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import {
  useOwnerGetStats,
  useOwnerGetSystemLogs,
  useOwnerListAdmins,
  useOwnerCreateAdmin,
  useOwnerRemoveAdmin,
  useOwnerGetMaintenanceMode,
  useOwnerSetMaintenanceMode,
  useOwnerGetAllEmails,
  useOwnerGrantAdminByEmail,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity, Server, Database, Trash2, ShieldPlus, Users, Mail,
  Clock, HardDrive, Layers, Search, ChevronLeft, ChevronRight,
  Shield, UserCog, Terminal, RefreshCw, UserX, UserCheck,
  Ban, Eye, CheckCircle2, XCircle, AlertTriangle,
} from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";

// ─── helpers ─────────────────────────────────────────────────────────────────
const grantByEmailSchema = z.object({ email: z.string().email("Valid email required") });
const grantByIdSchema = z.object({ userId: z.coerce.number().min(1, "User ID required") });

function formatUptime(secs: number) {
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

function formatBytes(b: number) {
  if (b >= 1e9) return `${(b / 1e9).toFixed(1)} GB`;
  if (b >= 1e6) return `${(b / 1e6).toFixed(1)} MB`;
  if (b >= 1e3) return `${(b / 1e3).toFixed(1)} KB`;
  return `${b} B`;
}

const statusBadge = (status: string) => {
  if (status === "active")   return <Badge className="bg-green-500/15 text-green-400 border-green-500/30 font-mono text-[10px]">Active</Badge>;
  if (status === "banned")   return <Badge className="bg-destructive/15 text-destructive border-destructive/30 font-mono text-[10px]">Banned</Badge>;
  if (status === "suspended") return <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30 font-mono text-[10px]">Suspended</Badge>;
  return <Badge variant="outline" className="font-mono text-[10px]">{status}</Badge>;
};

const roleBadge = (role: string) => {
  if (role === "owner") return <Badge className="bg-primary/20 text-primary border-primary/40 font-mono text-[10px]">Owner</Badge>;
  if (role === "admin") return <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 font-mono text-[10px]">Admin</Badge>;
  return <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">{role}</Badge>;
};

// ─── component ────────────────────────────────────────────────────────────────
export default function OwnerPanel() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // Search / pagination state
  const [emailSearch, setEmailSearch] = useState("");
  const [emailPage, setEmailPage] = useState(1);
  const [userSearch, setUserSearch] = useState("");
  const [userPage, setUserPage] = useState(1);
  const [logLevel, setLogLevel] = useState<"info" | "warn" | "error" | undefined>(undefined);

  if (!user || user.role !== "owner") {
    setLocation("/dashboard");
    return null;
  }

  // Data hooks
  const { data: stats, refetch: refetchStats } = useOwnerGetStats();
  const { data: logsData } = useOwnerGetSystemLogs({ level: logLevel, page: 1 });
  const { data: admins, refetch: refetchAdmins } = useOwnerListAdmins();
  const { data: maintenance, refetch: refetchMaint } = useOwnerGetMaintenanceMode();
  const { data: allEmails, refetch: refetchEmails } = useOwnerGetAllEmails({
    page: emailPage,
    limit: 50,
    search: emailSearch || undefined,
  });

  // Mutations
  const createAdminMutation = useOwnerCreateAdmin();
  const removeAdminMutation = useOwnerRemoveAdmin();
  const setMaintMutation = useOwnerSetMaintenanceMode();
  const grantByEmailMutation = useOwnerGrantAdminByEmail();

  const emailForm = useForm<z.infer<typeof grantByEmailSchema>>({
    resolver: zodResolver(grantByEmailSchema),
    defaultValues: { email: "" },
  });
  const idForm = useForm<z.infer<typeof grantByIdSchema>>({
    resolver: zodResolver(grantByIdSchema),
    defaultValues: { userId: 0 },
  });

  const onGrantByEmail = (v: z.infer<typeof grantByEmailSchema>) => {
    grantByEmailMutation.mutate({ data: v }, {
      onSuccess: () => { toast.success(`Admin granted to ${v.email}`); emailForm.reset(); refetchAdmins(); },
      onError: (e: any) => toast.error(e?.message || "User not found"),
    });
  };

  const onGrantById = (v: z.infer<typeof grantByIdSchema>) => {
    createAdminMutation.mutate({ data: v }, {
      onSuccess: () => { toast.success("Admin access granted"); idForm.reset(); refetchAdmins(); },
      onError: (e: any) => toast.error(e?.message || "Failed"),
    });
  };

  const onRevoke = (id: number) => {
    removeAdminMutation.mutate({ id }, {
      onSuccess: () => { toast.success("Admin revoked"); refetchAdmins(); },
      onError: () => toast.error("Failed to revoke admin"),
    });
  };

  const toggleMaint = (enabled: boolean) => {
    setMaintMutation.mutate({ data: { enabled, message: "System undergoing maintenance." } }, {
      onSuccess: () => { toast.success(`Maintenance mode ${enabled ? "ON" : "OFF"}`); refetchMaint(); },
    });
  };

  const refreshAll = () => {
    refetchStats(); refetchEmails(); refetchAdmins(); refetchMaint();
    queryClient.invalidateQueries();
    toast.success("Data refreshed.");
  };

  const emailTotalPages = allEmails ? Math.ceil(allEmails.total / 50) : 1;

  const statCards = [
    { icon: Users,    label: "Total Users",       value: stats?.totalUsers ?? "—",       color: "text-primary" },
    { icon: Mail,     label: "Total Emails",       value: stats?.totalEmails ?? "—",      color: "text-primary" },
    { icon: Activity, label: "Active Sessions",    value: stats?.activeSessions ?? "—",   color: "text-green-400" },
    { icon: Clock,    label: "Uptime",             value: formatUptime(stats?.uptimeSeconds ?? 0), color: "text-yellow-400" },
    { icon: Mail,     label: "Emails Today",       value: stats?.emailsToday ?? "—",      color: "text-primary" },
    { icon: Users,    label: "New Users Today",    value: stats?.newUsersToday ?? "—",    color: "text-green-400" },
    { icon: Mail,     label: "This Week",          value: stats?.emailsThisWeek ?? "—",   color: "text-primary" },
    { icon: HardDrive,"label": "Storage Used",     value: formatBytes(stats?.totalStorage ?? 0), color: "text-yellow-400" },
  ] as const;

  return (
    <div className="p-6 lg:p-10 max-w-screen-2xl mx-auto h-full overflow-auto space-y-8">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold font-mono tracking-widest uppercase flex items-center gap-3 text-primary">
            <Layers className="w-8 h-8" /> Owner Override
          </h1>
          <p className="text-muted-foreground mt-1 font-mono text-sm">
            Full system control · All data visible · PSYX FORTRESS
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="font-mono text-xs gap-1.5" onClick={refreshAll}>
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          {maintenance && (
            <div className="flex items-center gap-3 bg-card/60 px-4 py-2.5 rounded-xl border border-border">
              <div>
                <p className="text-[10px] font-mono font-bold uppercase tracking-wider">Maintenance</p>
                <p className="text-xs text-muted-foreground font-mono">{maintenance.enabled ? "ENGAGED" : "OFF"}</p>
              </div>
              <Switch
                checked={maintenance.enabled}
                onCheckedChange={toggleMaint}
                className="data-[state=checked]:bg-destructive"
              />
            </div>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map(({ icon: Icon, label, value, color }) => (
          <Card key={label} className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-[10px] font-mono text-muted-foreground uppercase flex items-center gap-1.5">
                <Icon className={`w-3.5 h-3.5 ${color}`} /> {label}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className={`text-2xl font-bold font-mono ${color}`}>{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="users" className="w-full">
        <TabsList className="bg-card/50 border border-border/50 flex-wrap h-auto gap-1 p-1 w-full">
          <TabsTrigger value="users" className="font-mono text-xs uppercase gap-1.5">
            <Users className="w-3.5 h-3.5" /> All Accounts
          </TabsTrigger>
          <TabsTrigger value="emails" className="font-mono text-xs uppercase gap-1.5">
            <Mail className="w-3.5 h-3.5" /> All Emails
          </TabsTrigger>
          <TabsTrigger value="admins" className="font-mono text-xs uppercase gap-1.5">
            <Shield className="w-3.5 h-3.5" /> Admin Registry
          </TabsTrigger>
          <TabsTrigger value="logs" className="font-mono text-xs uppercase gap-1.5">
            <Terminal className="w-3.5 h-3.5" /> System Logs
          </TabsTrigger>
        </TabsList>

        {/* ── ALL ACCOUNTS TAB ──────────────────────────────────────────────── */}
        <TabsContent value="users" className="mt-6 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search username, email, display name…"
                value={userSearch}
                onChange={e => { setUserSearch(e.target.value); setUserPage(1); }}
                className="pl-9 bg-card/50 font-mono text-sm"
              />
            </div>
            <span className="text-xs font-mono text-muted-foreground">
              {stats?.totalUsers ?? "?"} total accounts
            </span>
          </div>

          <AdminUserTable
            search={userSearch}
            page={userPage}
            setPage={setUserPage}
            onAction={(userId, action) => {
              // Call admin action endpoint
              fetch(`/api/admin/users/${userId}/action`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${localStorage.getItem("psyx_token")}`,
                },
                body: JSON.stringify({ action }),
              })
                .then(r => r.json())
                .then(() => { toast.success(`User ${action}d.`); queryClient.invalidateQueries(); })
                .catch(() => toast.error("Action failed."));
            }}
          />
        </TabsContent>

        {/* ── ALL EMAILS TAB ────────────────────────────────────────────────── */}
        <TabsContent value="emails" className="mt-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search subject, sender, recipient…"
                value={emailSearch}
                onChange={e => { setEmailSearch(e.target.value); setEmailPage(1); }}
                className="pl-9 bg-card/50 font-mono text-sm"
              />
            </div>
            <Badge variant="outline" className="font-mono text-xs border-primary/40 text-primary shrink-0">
              {allEmails?.total ?? 0} total
            </Badge>
          </div>

          <div className="bg-card/30 rounded-xl border border-border/50 overflow-x-auto">
            <table className="w-full text-sm font-mono text-left">
              <thead className="bg-card/80 border-b border-border/50 text-[10px] uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Account</th>
                  <th className="px-4 py-3">From → To</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Folder</th>
                  <th className="px-4 py-3 whitespace-nowrap">Date</th>
                  <th className="px-4 py-3 text-center">Read</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {allEmails?.emails.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground text-xs">No emails found</td></tr>
                )}
                {allEmails?.emails.map(email => (
                  <tr key={email.id} className="hover:bg-card/40 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground text-xs">#{email.id}</td>
                    <td className="px-4 py-3 text-primary text-xs font-medium">{email.username}</td>
                    <td className="px-4 py-3 text-xs">
                      <div className="truncate max-w-[160px]">{email.fromEmail}</div>
                      <div className="text-muted-foreground truncate max-w-[160px]">→ {email.toEmail}</div>
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <div className="truncate font-medium">{email.subject || "(no subject)"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-[10px] capitalize border-border/50 text-muted-foreground">{email.folder}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(email.createdAt), "MMM d, HH:mm")}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {email.isRead
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground mx-auto" />
                        : <span className="w-2 h-2 rounded-full bg-primary block mx-auto" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {emailTotalPages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-muted-foreground">
                Page {emailPage} of {emailTotalPages} · {allEmails?.total} emails
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="font-mono text-xs h-7 gap-1" disabled={emailPage <= 1} onClick={() => setEmailPage(p => p - 1)}>
                  <ChevronLeft className="w-3 h-3" /> Prev
                </Button>
                <Button variant="outline" size="sm" className="font-mono text-xs h-7 gap-1" disabled={emailPage >= emailTotalPages} onClick={() => setEmailPage(p => p + 1)}>
                  Next <ChevronRight className="w-3 h-3" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── ADMIN REGISTRY TAB ───────────────────────────────────────────── */}
        <TabsContent value="admins" className="mt-6 space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="bg-card/30 border-border/50">
              <CardHeader>
                <CardTitle className="font-mono text-sm uppercase tracking-widest text-primary flex items-center gap-2">
                  <UserCog className="w-4 h-4" /> Grant by Email
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...emailForm}>
                  <form onSubmit={emailForm.handleSubmit(onGrantByEmail)} className="flex gap-3 items-end">
                    <FormField control={emailForm.control} name="email" render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Email Address</FormLabel>
                        <FormControl>
                          <Input placeholder="user@psyx.com" className="bg-background/50 font-mono text-sm" {...field} />
                        </FormControl>
                      </FormItem>
                    )} />
                    <Button type="submit" className="font-mono text-xs uppercase gap-1.5" disabled={grantByEmailMutation.isPending}>
                      <ShieldPlus className="w-4 h-4" /> Grant
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            <Card className="bg-card/30 border-border/50">
              <CardHeader>
                <CardTitle className="font-mono text-sm uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Shield className="w-4 h-4" /> Grant by User ID
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...idForm}>
                  <form onSubmit={idForm.handleSubmit(onGrantById)} className="flex gap-3 items-end">
                    <FormField control={idForm.control} name="userId" render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel className="font-mono text-xs uppercase text-muted-foreground">User ID</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="42" className="bg-background/50 font-mono text-sm" {...field} />
                        </FormControl>
                      </FormItem>
                    )} />
                    <Button type="submit" variant="outline" className="font-mono text-xs uppercase border-border/60" disabled={createAdminMutation.isPending}>
                      Elevate
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>

          <div className="bg-card/30 rounded-xl border border-border/50 overflow-hidden">
            <div className="px-4 py-3 border-b border-border/30">
              <span className="font-mono text-xs uppercase text-muted-foreground">Active Admins ({admins?.length ?? 0})</span>
            </div>
            <table className="w-full text-sm font-mono text-left">
              <thead className="border-b border-border/30 text-[10px] uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Identity</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Since</th>
                  <th className="px-4 py-3 text-right">Revoke</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {!admins?.length && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-xs">No admins assigned</td></tr>
                )}
                {admins?.map(a => (
                  <tr key={a.id} className="hover:bg-card/40 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground text-xs">#{a.id}</td>
                    <td className="px-4 py-3 font-medium">{a.displayName || a.username}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{a.email}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{format(new Date(a.createdAt), "MMM d, yyyy")}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 h-7 w-7" onClick={() => onRevoke(a.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ── SYSTEM LOGS TAB ──────────────────────────────────────────────── */}
        <TabsContent value="logs" className="mt-6 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-muted-foreground uppercase">Filter:</span>
            {(["all", "info", "warn", "error"] as const).map(l => (
              <Button
                key={l}
                size="sm"
                variant={logLevel === (l === "all" ? undefined : l) ? "default" : "outline"}
                className={`font-mono text-xs h-7 ${l === "error" ? "hover:bg-destructive hover:text-destructive-foreground" : ""}`}
                onClick={() => setLogLevel(l === "all" ? undefined : l)}
              >
                {l === "error" && <XCircle className="w-3 h-3 mr-1 text-destructive" />}
                {l === "warn"  && <AlertTriangle className="w-3 h-3 mr-1 text-yellow-400" />}
                {l.toUpperCase()}
              </Button>
            ))}
          </div>
          <div className="bg-card/30 rounded-xl border border-border/50 overflow-x-auto">
            <table className="w-full text-sm font-mono text-left">
              <thead className="bg-card/80 border-b border-border/50 text-[10px] uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 whitespace-nowrap">Timestamp</th>
                  <th className="px-4 py-3">Level</th>
                  <th className="px-4 py-3">Message</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {!logsData?.logs.length && (
                  <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground text-xs">No logs yet</td></tr>
                )}
                {logsData?.logs.map(log => (
                  <tr key={log.id} className="hover:bg-card/40 transition-colors text-xs">
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.createdAt), "yy-MM-dd HH:mm:ss")}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={
                        log.level === "error" ? "border-destructive/60 text-destructive" :
                        log.level === "warn"  ? "border-yellow-500/60 text-yellow-400" :
                        "border-primary/40 text-primary"
                      }>{log.level}</Badge>
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">{log.message}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Admin User Table ─────────────────────────────────────────────────────────
// Uses the admin /admin/users endpoint (accessible to owners too)
function AdminUserTable({
  search,
  page,
  setPage,
  onAction,
}: {
  search: string;
  page: number;
  setPage: (p: number) => void;
  onAction: (userId: number, action: "ban" | "unban" | "suspend" | "unsuspend") => void;
}) {
  // We call the API directly here since the generated hook may not exist for owner-level user list
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Fetch users on mount + when search/page changes
  useState(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "50", ...(search ? { search } : {}) });
    fetch(`/api/admin/users?${params}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("psyx_token")}` },
    })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  });

  const totalPages = data ? Math.ceil(data.total / 50) : 1;

  if (loading) {
    return (
      <div className="space-y-2">
        {[1,2,3,4,5].map(i => (
          <div key={i} className="h-10 rounded-lg bg-card/30 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="bg-card/30 rounded-xl border border-border/50 overflow-x-auto">
        <table className="w-full text-sm font-mono text-left">
          <thead className="bg-card/80 border-b border-border/50 text-[10px] uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3">Email Address</th>
              <th className="px-4 py-3 text-center">Role</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 whitespace-nowrap">Storage</th>
              <th className="px-4 py-3 whitespace-nowrap">Joined</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {(!data?.users?.length) && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground text-xs">No accounts found</td></tr>
            )}
            {data?.users?.map((u: any) => (
              <tr key={u.id} className="hover:bg-card/40 transition-colors">
                <td className="px-4 py-3 text-muted-foreground text-xs">#{u.id}</td>
                <td className="px-4 py-3">
                  <div className="font-semibold text-sm">{u.username}</div>
                  {u.displayName && <div className="text-[10px] text-muted-foreground">{u.displayName}</div>}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3 text-center">{roleBadge(u.role)}</td>
                <td className="px-4 py-3 text-center">{statusBadge(u.status)}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                  {formatBytes(u.storageUsed || 0)}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                  {u.createdAt ? format(new Date(u.createdAt), "MMM d, yyyy") : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-1">
                    {u.status === "active" ? (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-yellow-400 hover:bg-yellow-400/10"
                          title="Suspend"
                          onClick={() => onAction(u.id, "suspend")}
                        >
                          <UserX className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          title="Ban"
                          onClick={() => onAction(u.id, "ban")}
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-green-400 hover:bg-green-400/10"
                        title="Restore"
                        onClick={() => onAction(u.id, u.status === "banned" ? "unban" : "unsuspend")}
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-muted-foreground">
            Page {page} of {totalPages} · {data?.total} accounts
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="font-mono text-xs h-7 gap-1" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="w-3 h-3" /> Prev
            </Button>
            <Button variant="outline" size="sm" className="font-mono text-xs h-7 gap-1" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              Next <ChevronRight className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
