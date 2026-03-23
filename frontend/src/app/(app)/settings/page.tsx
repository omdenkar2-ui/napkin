"use client";

import { useAuth } from "@/providers/auth-provider";
import { Card, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  const { user, signOut } = useAuth();

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="font-serif text-2xl text-foreground mb-6">Settings</h1>

      <div className="space-y-6">
        <Card>
          <CardTitle>Profile</CardTitle>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs text-muted">Email</label>
              <p className="text-sm text-foreground">{user?.email}</p>
            </div>
            <div>
              <label className="text-xs text-muted">Name</label>
              <p className="text-sm text-foreground">
                {user?.user_metadata?.full_name || "Not set"}
              </p>
            </div>
            <div>
              <label className="text-xs text-muted">User ID</label>
              <p className="text-xs text-muted font-mono">{user?.id}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardTitle>Account</CardTitle>
          <CardContent>
            <Button variant="destructive" onClick={signOut}>
              Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
