"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";

export default function CallbackPage() {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const handleCallback = async () => {
      const { error } = await supabase.auth.exchangeCodeForSession(
        window.location.href,
      );
      if (error) {
        console.error("Auth callback error:", error);
        router.push("/login");
        return;
      }
      router.push("/dashboard");
    };

    handleCallback();
  }, [router, supabase]);

  return (
    <div className="flex flex-col items-center gap-4">
      <Spinner size="lg" />
      <p className="text-muted text-sm">Signing you in...</p>
    </div>
  );
}
