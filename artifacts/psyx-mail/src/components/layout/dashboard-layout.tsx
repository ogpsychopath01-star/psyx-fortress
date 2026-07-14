import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Inbox, Send, File, ShieldAlert, Trash2, Star,
  Menu, Bell, Search, User as UserIcon, LogOut,
  Shield, Settings, Activity, X, PenSquare,
} from "lucide-react";
import ThemeSwitcher from "@/components/theme-switcher";

import { useAuth } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRealtimeNotifications } from "@/hooks/use-realtime-notifications";
import {
  useGetEmailStats,
  useGetUserStorage,
  useLogoutUser,
  useListNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const [notifOpen, setNotifOpen] = useState(false);

  // Sidebar: open by default on desktop, closed on mobile
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.innerWidth >= 768 : true
  );

  // Sync sidebar with screen-size changes
  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  // Wire WS navigate into router
  const { navigateRef } = useRealtimeNotifications(user?.id);
  navigateRef.current = setLocation;

  const { data: stats } = useGetEmailStats();
  const { data: storage } = useGetUserStorage();
  const logoutMutation = useLogoutUser();
  const { data: notificationsData, refetch: refetchNotifs } = useListNotifications({ unreadOnly: true });
  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();

  const notifications = notificationsData || [];
  const unreadCount = notifications.length;
  const hasUnread = unreadCount > 0;

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        localStorage.removeItem("psyx_token");
        setLocation("/");
      },
    });
  };

  /** Navigate and close sidebar on mobile */
  const go = (href: string) => {
    setLocation(href);
    if (isMobile) setSidebarOpen(false);
  };

  /** Open email from notification */
  const openEmailFromNotif = (emailId: number, notifId: number, isRead: boolean) => {
    setNotifOpen(false);
    if (!isRead) {
      markReadMutation.mutate({ id: notifId }, { onSuccess: () => refetchNotifs() });
    }
    setLocation(`/dashboard/email/${emailId}`);
    if (isMobile) setSidebarOpen(false);
  };

  const navItems = [
    { icon: Inbox,       label: "Inbox",   href: "/dashboard",                 count: stats?.inbox  || 0 },
    { icon: Star,        label: "Starred", href: "/dashboard?folder=starred",  count: stats?.starred || 0 },
    { icon: Send,        label: "Sent",    href: "/dashboard?folder=sent",     count: 0 },
    { icon: File,        label: "Drafts",  href: "/dashboard?folder=drafts",   count: stats?.drafts || 0 },
    { icon: ShieldAlert, label: "Spam",    href: "/dashboard?folder=spam",     count: stats?.spam   || 0 },
    { icon: Trash2,      label: "Trash",   href: "/dashboard?folder=trash",    count: 0 },
  ];

  const sidebarContent = (
    <>
      {/* Logo + close button (mobile) */}
      <div className="p-5 flex items-center gap-3">
        <img src="/logo.png" alt="PSYX FORTRESS" className="w-9 h-9 object-contain" />
        <div className="flex flex-col leading-none flex-1">
          <span className="font-mono font-bold text-sm tracking-tighter text-sidebar-foreground">PSYX</span>
          <span className="font-mono text-[9px] tracking-[0.3em] text-primary uppercase">FORTRESS</span>
        </div>
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            className="text-sidebar-foreground/60 hover:text-sidebar-foreground h-8 w-8"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Compose button */}
      <div className="px-4 pb-4">
        <button
          onClick={() => go("/dashboard/compose")}
          className="w-full flex items-center justify-start gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-mono uppercase tracking-wider text-xs h-12 px-4 rounded-md transition-colors"
        >
          <span className="text-lg leading-none">+</span> New Transmission
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-3 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.label}
            onClick={() => go(item.href)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-md hover:bg-sidebar-accent cursor-pointer group transition-colors"
          >
            <div className="flex items-center gap-3 text-sidebar-foreground/80 group-hover:text-sidebar-foreground">
              <item.icon className="w-4 h-4" />
              <span className="text-sm font-medium">{item.label}</span>
            </div>
            {item.count > 0 && (
              <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 font-mono text-[10px] px-1.5 h-5">
                {item.count}
              </Badge>
            )}
          </button>
        ))}

        {(user?.role === "admin" || user?.role === "owner") && (
          <>
            <div className="my-4 border-t border-sidebar-border/50 mx-3" />
            <div className="px-3 pb-2 text-xs font-mono text-sidebar-foreground/40 uppercase tracking-widest">Clearance</div>
            <button
              onClick={() => go("/admin")}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-sidebar-accent cursor-pointer text-sidebar-foreground/80 transition-colors"
            >
              <Shield className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium">Admin Terminal</span>
            </button>
            {user?.role === "owner" && (
              <button
                onClick={() => go("/owner")}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-sidebar-accent cursor-pointer text-sidebar-foreground/80 transition-colors"
              >
                <Activity className="w-4 h-4 text-destructive" />
                <span className="text-sm font-medium">Owner Override</span>
              </button>
            )}
          </>
        )}
      </nav>

      {/* Storage + User */}
      <div className="p-4 border-t border-sidebar-border bg-sidebar/50 shrink-0">
        {storage && (
          <div className="mb-4">
            <div className="flex justify-between text-xs mb-1 font-mono text-sidebar-foreground/60">
              <span>Storage</span>
              <span>{storage.percentage.toFixed(1)}%</span>
            </div>
            <Progress value={storage.percentage} className="h-1.5 bg-sidebar-accent" />
          </div>
        )}

        <button
          onClick={() => go("/profile")}
          className="w-full flex items-center gap-3 cursor-pointer hover:bg-sidebar-accent p-2 rounded-md transition-colors -mx-2"
        >
          <Avatar className="h-9 w-9 border border-sidebar-border shrink-0">
            <AvatarImage src={user?.avatarUrl || ""} />
            <AvatarFallback className="bg-primary/20 text-primary font-mono">
              {user?.displayName?.charAt(0) || user?.username?.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-medium truncate text-sidebar-foreground">
              {user?.displayName || user?.username}
            </p>
            <p className="text-xs text-sidebar-foreground/60 truncate font-mono">{user?.email}</p>
          </div>
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden selection:bg-primary/30">

      {/* ── Mobile backdrop ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {isMobile && sidebarOpen && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {sidebarOpen && (
          <motion.aside
            key="sidebar"
            initial={isMobile ? { x: -290, opacity: 0 } : { width: 0, opacity: 0 }}
            animate={isMobile ? { x: 0, opacity: 1 } : { width: 260, opacity: 1 }}
            exit={isMobile ? { x: -290, opacity: 0 } : { width: 0, opacity: 0 }}
            transition={{ type: "tween", duration: 0.22, ease: "easeInOut" }}
            className={`h-full bg-sidebar border-r border-sidebar-border flex flex-col z-50 ${
              isMobile
                ? "fixed inset-y-0 left-0 w-[280px] shadow-2xl shadow-black/40"
                : "relative flex-shrink-0"
            }`}
            style={isMobile ? {} : {}}
          >
            {sidebarContent}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 bg-background/50 relative overflow-hidden">

        {/* Top Header */}
        <header className="h-14 md:h-16 border-b border-border flex items-center justify-between px-3 md:px-4 bg-background/80 backdrop-blur-md sticky top-0 z-10 shrink-0">
          <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
            {/* Hamburger */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-muted-foreground hover:text-foreground shrink-0 h-9 w-9"
            >
              <Menu className="w-5 h-5" />
            </Button>

            {/* Logo text on mobile when sidebar closed */}
            {isMobile && !sidebarOpen && (
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-mono font-bold text-sm text-foreground">PSYX</span>
                <span className="font-mono text-[9px] tracking-[0.2em] text-primary uppercase">FORTRESS</span>
              </div>
            )}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1 md:gap-2 shrink-0">
            <ThemeSwitcher />

            {/* Bell — RED when unread */}
            <Popover open={notifOpen} onOpenChange={setNotifOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`relative h-9 w-9 transition-all duration-200 ${
                    hasUnread
                      ? "text-red-500 hover:text-red-400 hover:bg-red-500/10 ring-1 ring-red-500/30 rounded-md"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title={hasUnread ? `${unreadCount} unread alert${unreadCount > 1 ? "s" : ""}` : "Alerts"}
                >
                  <Bell className="w-5 h-5" />
                  {hasUnread && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 animate-pulse shadow-lg shadow-red-500/30">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0 border-border bg-card/95 backdrop-blur-xl">
                <div className="flex items-center justify-between p-4 border-b border-border/50">
                  <div className="flex items-center gap-2">
                    <h4 className="font-mono font-bold text-sm tracking-wider uppercase">Alerts</h4>
                    {hasUnread && (
                      <span className="bg-red-500/10 text-red-500 text-[10px] font-mono px-1.5 py-0.5 rounded-full border border-red-500/20">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  {hasUnread && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto text-xs text-muted-foreground p-0 hover:bg-transparent hover:text-foreground"
                      onClick={() => markAllReadMutation.mutate(undefined, { onSuccess: () => refetchNotifs() })}
                    >
                      Clear All
                    </Button>
                  )}
                </div>
                <ScrollArea className="h-72">
                  {notifications.length > 0 ? (
                    <div className="flex flex-col divide-y divide-border/50">
                      {notifications.map((n) => {
                        const emailId: number | null = (n as any).emailId ?? null;
                        const isMailNotif = n.type === "new_mail" && !!emailId;
                        return (
                          <div
                            key={n.id}
                            className={`p-4 transition-colors group ${
                              isMailNotif
                                ? "cursor-pointer hover:bg-red-500/5 active:bg-red-500/10"
                                : "hover:bg-accent/5"
                            }`}
                            onClick={() => isMailNotif && emailId && openEmailFromNotif(emailId, n.id, n.isRead)}
                          >
                            <div className="flex justify-between items-start mb-1">
                              <div className="flex items-center gap-1.5">
                                {!n.isRead && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 mt-0.5" />
                                )}
                                <p className="text-sm font-medium leading-tight">{n.title}</p>
                              </div>
                              {isMailNotif && (
                                <span className="text-[9px] font-mono text-red-400 border border-red-500/20 px-1 rounded shrink-0 ml-2">
                                  OPEN →
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mb-2 pl-3">{n.message}</p>
                            <div className="flex justify-between items-center pl-3">
                              <span className="text-[10px] text-muted-foreground/60 font-mono">
                                {new Date(n.createdAt).toLocaleDateString()}
                              </span>
                              {!n.isRead && !isMailNotif && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 px-2 text-[10px] opacity-0 group-hover:opacity-100 font-mono"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    markReadMutation.mutate({ id: n.id }, { onSuccess: () => refetchNotifs() });
                                  }}
                                >
                                  Mark Read
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-muted-foreground flex flex-col items-center">
                      <Bell className="w-8 h-8 mb-2 opacity-20" />
                      <p className="text-sm font-mono">No active alerts</p>
                    </div>
                  )}
                </ScrollArea>
              </PopoverContent>
            </Popover>

            {/* User dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full ml-1">
                  <Avatar className="h-9 w-9 border border-border">
                    <AvatarImage src={user?.avatarUrl || ""} />
                    <AvatarFallback className="bg-card text-foreground font-mono">
                      {user?.displayName?.charAt(0) || user?.username?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 font-mono">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user?.displayName || user?.username}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer" onClick={() => go("/profile")}>
                  <UserIcon className="mr-2 h-4 w-4" />
                  <span>Identity Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>System Config</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Disconnect</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-background/50">
          {children}
        </main>

        {/* ── Mobile Bottom Navigation ──────────────────────────────────── */}
        {isMobile && (
          <nav className="shrink-0 border-t border-border bg-background/90 backdrop-blur-md flex items-center justify-around px-2 h-14 z-10">
            <button
              onClick={() => go("/dashboard")}
              className="flex flex-col items-center gap-1 px-4 py-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Inbox className="w-5 h-5" />
              <span className="text-[10px] font-mono">Inbox</span>
            </button>
            <button
              onClick={() => go("/dashboard/compose")}
              className="flex flex-col items-center gap-1 px-4 py-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <PenSquare className="w-5 h-5" />
              <span className="text-[10px] font-mono">Compose</span>
            </button>
            <button
              onClick={() => go("/dashboard?folder=starred")}
              className="flex flex-col items-center gap-1 px-4 py-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Star className="w-5 h-5" />
              <span className="text-[10px] font-mono">Starred</span>
            </button>
            <button
              onClick={() => go("/profile")}
              className="flex flex-col items-center gap-1 px-4 py-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <UserIcon className="w-5 h-5" />
              <span className="text-[10px] font-mono">Profile</span>
            </button>
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex flex-col items-center gap-1 px-4 py-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Menu className="w-5 h-5" />
              <span className="text-[10px] font-mono">More</span>
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}
