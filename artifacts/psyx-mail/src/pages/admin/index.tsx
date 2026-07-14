import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { 
  useAdminGetStats, 
  useAdminListUsers, 
  useAdminUserAction, 
  useAdminBroadcastAnnouncement,
  useAdminListReservedUsernames,
  useAdminAddReservedUsername,
  useAdminGetAuditLogs,
  getAdminListUsersQueryKey,
  getAdminListReservedUsernamesQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Users, ShieldAlert, Ban, Radio, Search, Plus, Shield } from "lucide-react";
import { format } from "date-fns";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const broadcastSchema = z.object({
  title: z.string().min(1, "Title required"),
  message: z.string().min(1, "Message required"),
});

const reservedSchema = z.object({
  username: z.string().min(1, "Username required"),
  reason: z.string().min(1, "Reason required"),
});

export default function AdminPanel() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  if (!user || (user.role !== 'admin' && user.role !== 'owner')) {
    setLocation("/dashboard");
    return null;
  }

  const { data: stats } = useAdminGetStats();
  const [search, setSearch] = useState("");
  const { data: usersData, refetch: refetchUsers } = useAdminListUsers({ page: 1, limit: 50, search });
  const { data: reservedData, refetch: refetchReserved } = useAdminListReservedUsernames();
  const { data: logsData } = useAdminGetAuditLogs({ page: 1, limit: 50 });

  const userActionMutation = useAdminUserAction();
  const broadcastMutation = useAdminBroadcastAnnouncement();
  const addReservedMutation = useAdminAddReservedUsername();

  const handleUserAction = (userId: number, action: any) => {
    userActionMutation.mutate(
      { id: userId, data: { action } },
      {
        onSuccess: () => {
          toast.success(`Action '${action}' executed successfully.`);
          refetchUsers();
        }
      }
    );
  };

  const broadcastForm = useForm<z.infer<typeof broadcastSchema>>({
    resolver: zodResolver(broadcastSchema),
    defaultValues: { title: "", message: "" }
  });

  const onBroadcast = (values: z.infer<typeof broadcastSchema>) => {
    broadcastMutation.mutate(
      { data: values },
      {
        onSuccess: () => {
          toast.success("Broadcast dispatched to all units.");
          broadcastForm.reset();
        }
      }
    );
  };

  const reservedForm = useForm<z.infer<typeof reservedSchema>>({
    resolver: zodResolver(reservedSchema),
    defaultValues: { username: "", reason: "" }
  });

  const onAddReserved = (values: z.infer<typeof reservedSchema>) => {
    addReservedMutation.mutate(
      { data: values },
      {
        onSuccess: () => {
          toast.success("Identifier reserved.");
          reservedForm.reset();
          refetchReserved();
        }
      }
    );
  };

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto h-full overflow-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-mono tracking-widest uppercase flex items-center gap-3">
          <Shield className="w-8 h-8 text-primary" /> Admin Terminal
        </h1>
        <p className="text-muted-foreground mt-2 font-mono">System monitoring and user management</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card/50 backdrop-blur border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-mono text-muted-foreground uppercase">Total Entities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono">{stats?.totalUsers || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-mono text-muted-foreground uppercase">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono text-primary">{stats?.activeUsers || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-mono text-muted-foreground uppercase">Suspended</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono text-accent">{stats?.suspendedUsers || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-mono text-muted-foreground uppercase">Banned</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono text-destructive">{stats?.bannedUsers || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="bg-card/50 border border-border/50">
          <TabsTrigger value="users" className="font-mono text-xs uppercase">Users</TabsTrigger>
          <TabsTrigger value="broadcast" className="font-mono text-xs uppercase">Broadcast</TabsTrigger>
          <TabsTrigger value="reserved" className="font-mono text-xs uppercase">Reserved IDs</TabsTrigger>
          <TabsTrigger value="audit" className="font-mono text-xs uppercase">Audit Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search entities..." 
                className="pl-9 bg-card/50 font-mono text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="bg-card/30 rounded-xl border border-border/50 overflow-hidden">
            <table className="w-full text-sm font-mono text-left">
              <thead className="bg-card/80 border-b border-border/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Identity</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Storage</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {usersData?.users.map(u => (
                  <tr key={u.id} className="hover:bg-card/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{u.username}</div>
                      <div className="text-muted-foreground text-xs">{u.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={`
                        ${u.status === 'active' ? 'border-primary text-primary' : ''}
                        ${u.status === 'suspended' ? 'border-accent text-accent' : ''}
                        ${u.status === 'banned' ? 'border-destructive text-destructive' : ''}
                      `}>
                        {u.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">{u.role}</td>
                    <td className="px-4 py-3">{(u.storageUsed / 1024 / 1024).toFixed(1)} MB</td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreVertical className="h-4 w-4"/></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="font-mono text-xs">
                          {u.status !== 'active' && <DropdownMenuItem onClick={() => handleUserAction(u.id, 'activate')}>Activate</DropdownMenuItem>}
                          {u.status !== 'suspended' && <DropdownMenuItem onClick={() => handleUserAction(u.id, 'suspend')}>Suspend</DropdownMenuItem>}
                          {u.status !== 'banned' && <DropdownMenuItem onClick={() => handleUserAction(u.id, 'ban')} className="text-destructive">Ban</DropdownMenuItem>}
                          {u.status === 'banned' && <DropdownMenuItem onClick={() => handleUserAction(u.id, 'unban')}>Unban</DropdownMenuItem>}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="broadcast" className="mt-6">
          <Card className="bg-card/30 border-border/50 max-w-2xl">
            <CardHeader>
              <CardTitle className="font-mono text-lg uppercase tracking-widest">Global Broadcast</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...broadcastForm}>
                <form onSubmit={broadcastForm.handleSubmit(onBroadcast)} className="space-y-4">
                  <FormField
                    control={broadcastForm.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-xs uppercase">Transmission Header</FormLabel>
                        <FormControl><Input className="bg-background/50 font-mono" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={broadcastForm.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-xs uppercase">Payload</FormLabel>
                        <FormControl><Textarea className="bg-background/50 font-mono min-h-[150px]" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="font-mono uppercase tracking-widest">
                    <Radio className="w-4 h-4 mr-2" /> Transmit to All Units
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reserved" className="mt-6 space-y-6">
          <Card className="bg-card/30 border-border/50 max-w-2xl">
            <CardHeader>
              <CardTitle className="font-mono text-lg uppercase tracking-widest">Reserve Identifier</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...reservedForm}>
                <form onSubmit={reservedForm.handleSubmit(onAddReserved)} className="flex gap-4 items-end">
                  <FormField
                    control={reservedForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel className="font-mono text-xs uppercase">Alias</FormLabel>
                        <FormControl><Input className="bg-background/50 font-mono" placeholder="admin" {...field} /></FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={reservedForm.control}
                    name="reason"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel className="font-mono text-xs uppercase">Reason</FormLabel>
                        <FormControl><Input className="bg-background/50 font-mono" placeholder="System reserved" {...field} /></FormControl>
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="mb-[2px]"><Plus className="w-4 h-4" /></Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <div className="bg-card/30 rounded-xl border border-border/50 overflow-hidden max-w-2xl">
            <table className="w-full text-sm font-mono text-left">
              <thead className="bg-card/80 border-b border-border/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Identifier</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {reservedData?.map(r => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 font-medium text-primary">{r.username}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.reason}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(r.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="audit" className="mt-6">
          <div className="bg-card/30 rounded-xl border border-border/50 overflow-hidden">
            <table className="w-full text-sm font-mono text-left">
              <thead className="bg-card/80 border-b border-border/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Admin</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {logsData?.logs.map(log => (
                  <tr key={log.id} className="hover:bg-card/40 transition-colors text-xs">
                    <td className="px-4 py-3 text-muted-foreground">{format(new Date(log.createdAt), 'yy-MM-dd HH:mm:ss')}</td>
                    <td className="px-4 py-3 text-primary">{log.adminUsername || `ID:${log.adminId}`}</td>
                    <td className="px-4 py-3">{log.action}</td>
                    <td className="px-4 py-3">{log.targetType} {log.targetId ? `#${log.targetId}` : ''}</td>
                    <td className="px-4 py-3 text-muted-foreground truncate max-w-xs">{log.details}</td>
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
