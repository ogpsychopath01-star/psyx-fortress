import { useAuth } from "@/lib/auth";
import {
  useGetUserProfile,
  useUpdateUserProfile,
  useChangePassword,
  useGetUserStorage,
  useGetUserActivity,
} from "@workspace/api-client-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Shield, HardDrive, Key, User as UserIcon, Activity, Palette } from "lucide-react";
import { format } from "date-fns";
import { useEffect } from "react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTheme, THEMES, type Theme } from "@/lib/theme";

const profileSchema = z.object({
  displayName: z.string().optional(),
  recoveryEmail: z.union([z.string().email("Invalid email"), z.literal(""), z.undefined()]),
  avatarUrl: z.union([z.string().url("Invalid URL"), z.literal(""), z.undefined()]),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password required"),
    newPassword: z.string().min(8, "Passcode must be at least 8 chars"),
    confirmPassword: z.string(),
  })
  .refine(data => data.newPassword === data.confirmPassword, {
    message: "Passcodes do not match",
    path: ["confirmPassword"],
  });

export default function Profile() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();

  const { data: profile, refetch: refetchProfile } = useGetUserProfile();
  const { data: storage } = useGetUserStorage();
  const { data: activityData } = useGetUserActivity();

  const updateProfileMutation = useUpdateUserProfile();
  const changePasswordMutation = useChangePassword();

  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { displayName: "", recoveryEmail: "", avatarUrl: "" },
  });

  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (profile) {
      profileForm.reset({
        displayName: profile.displayName || "",
        recoveryEmail: profile.recoveryEmail || "",
        avatarUrl: profile.avatarUrl || "",
      });
    }
  }, [profile]);

  const onUpdateProfile = (values: z.infer<typeof profileSchema>) => {
    updateProfileMutation.mutate(
      { data: values },
      {
        onSuccess: () => {
          toast.success("Identity profile updated.");
          refetchProfile();
        },
        onError: err => toast.error((err as any).message || "Update failed."),
      }
    );
  };

  const onChangePassword = (values: z.infer<typeof passwordSchema>) => {
    changePasswordMutation.mutate(
      { data: { currentPassword: values.currentPassword, newPassword: values.newPassword } },
      {
        onSuccess: () => {
          toast.success("Passcode updated.");
          passwordForm.reset();
        },
        onError: err => toast.error((err as any).message || "Failed to update passcode."),
      }
    );
  };

  // Persist theme to DB as well as local
  const handleThemeChange = (t: Theme) => {
    setTheme(t);
    updateProfileMutation.mutate({ data: { theme: t } });
  };

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto h-full overflow-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-mono tracking-widest uppercase flex items-center gap-3 text-primary">
          <UserIcon className="w-8 h-8" /> Identity Profile
        </h1>
        <p className="text-muted-foreground mt-2 font-mono text-sm">Manage your presence on the network</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left column */}
        <div className="md:col-span-1 space-y-6">
          {/* Avatar card */}
          <Card className="bg-card/50 backdrop-blur border-border/50 text-center flex flex-col items-center p-6">
            <Avatar className="h-28 w-28 border-4 border-card mb-4 shadow-xl">
              <AvatarImage src={profile?.avatarUrl || ""} />
              <AvatarFallback className="bg-primary/20 text-primary font-mono text-4xl">
                {profile?.displayName?.charAt(0) || profile?.username?.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <h2 className="text-xl font-bold font-mono">{profile?.displayName || profile?.username}</h2>
            <p className="text-muted-foreground font-mono text-sm mt-0.5">{profile?.email}</p>
            <div className="mt-3 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary font-mono text-[10px] uppercase tracking-widest">
              Clearance: {profile?.role}
            </div>
          </Card>

          {/* Storage */}
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-mono flex items-center gap-2 uppercase tracking-widest">
                <HardDrive className="w-4 h-4 text-accent" /> Storage
              </CardTitle>
            </CardHeader>
            <CardContent>
              {storage ? (
                <>
                  <div className="flex justify-between text-xs mb-2 font-mono text-muted-foreground mt-2">
                    <span>{(storage.used / 1024 / 1024).toFixed(2)} MB used</span>
                    <span>{(storage.limit / 1024 / 1024).toFixed(0)} MB limit</span>
                  </div>
                  <Progress value={storage.percentage} className="h-2" />
                  <p className="text-xs text-right mt-1.5 text-primary font-mono">{storage.percentage.toFixed(1)}%</p>
                </>
              ) : (
                <div className="h-10 animate-pulse bg-card rounded mt-2" />
              )}
            </CardContent>
          </Card>

          {/* ── THEME SWITCHER ── */}
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-mono flex items-center gap-2 uppercase tracking-widest">
                <Palette className="w-4 h-4 text-accent" /> Color Theme
              </CardTitle>
              <CardDescription className="font-mono text-xs">Choose your interface colour</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2.5 mt-1">
                {THEMES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleThemeChange(t.id)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 transition-all hover:scale-105 active:scale-95",
                      theme === t.id
                        ? "border-primary ring-2 ring-primary/30 bg-primary/10"
                        : "border-border/40 hover:border-border bg-card/30"
                    )}
                    title={t.label}
                  >
                    <span
                      className="w-8 h-8 rounded-full border-2 border-white/20 shadow-md"
                      style={{ background: t.swatch }}
                    />
                    <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest leading-none">
                      {t.label}
                    </span>
                    {theme === t.id && (
                      <span className="text-[8px] font-mono text-primary uppercase tracking-widest">Active</span>
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="md:col-span-2 space-y-8">
          {/* Profile update */}
          <Card className="bg-card/30 border-border/50">
            <CardHeader>
              <CardTitle className="font-mono text-lg uppercase tracking-widest flex items-center gap-2">
                <UserIcon className="w-5 h-5" /> Modify Parameters
              </CardTitle>
              <CardDescription className="font-mono text-xs">Update public details and recovery vectors</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...profileForm}>
                <form onSubmit={profileForm.handleSubmit(onUpdateProfile)} className="space-y-4">
                  <FormField control={profileForm.control} name="displayName" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-xs uppercase">Public Identifier</FormLabel>
                      <FormControl><Input className="bg-background/50 font-sans" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={profileForm.control} name="recoveryEmail" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-xs uppercase">Recovery Email (External)</FormLabel>
                      <FormControl><Input className="bg-background/50 font-mono" {...field} value={field.value ?? ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={profileForm.control} name="avatarUrl" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-xs uppercase">Avatar URL</FormLabel>
                      <FormControl><Input className="bg-background/50 font-mono text-xs" placeholder="https://..." {...field} value={field.value ?? ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" className="font-mono uppercase tracking-widest text-xs" disabled={updateProfileMutation.isPending}>
                    Update Identity
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Password */}
          <Card className="bg-card/30 border-border/50">
            <CardHeader>
              <CardTitle className="font-mono text-lg uppercase tracking-widest flex items-center gap-2">
                <Key className="w-5 h-5" /> Security Overrides
              </CardTitle>
              <CardDescription className="font-mono text-xs">Establish new authentication passcode</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...passwordForm}>
                <form onSubmit={passwordForm.handleSubmit(onChangePassword)} className="space-y-4">
                  <FormField control={passwordForm.control} name="currentPassword" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-xs uppercase">Current Passcode</FormLabel>
                      <FormControl><Input type="password" className="bg-background/50 font-mono tracking-widest" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={passwordForm.control} name="newPassword" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-xs uppercase">New Passcode</FormLabel>
                        <FormControl><Input type="password" className="bg-background/50 font-mono tracking-widest" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={passwordForm.control} name="confirmPassword" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-xs uppercase">Confirm</FormLabel>
                        <FormControl><Input type="password" className="bg-background/50 font-mono tracking-widest" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <Button type="submit" variant="destructive" className="font-mono uppercase tracking-widest text-xs" disabled={changePasswordMutation.isPending}>
                    Change Passcode
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Activity */}
          <Card className="bg-card/30 border-border/50">
            <CardHeader>
              <CardTitle className="font-mono text-lg uppercase tracking-widest flex items-center gap-2">
                <Activity className="w-5 h-5" /> Connection Logs
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activityData && activityData.length > 0 ? (
                <div className="space-y-3">
                  {activityData.map(act => (
                    <div key={act.id} className="flex justify-between items-center p-3 bg-card/50 rounded-lg border border-border/30">
                      <div>
                        <p className="font-mono text-sm uppercase text-primary">{act.action}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">{act.userAgent}</p>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <p className="font-mono text-xs">{act.ipAddress}</p>
                        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                          {format(new Date(act.createdAt), "yy-MM-dd HH:mm:ss")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground font-mono">No activity recorded.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
