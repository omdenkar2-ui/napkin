"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getBusinessContext, scrapeWebsite } from "@/lib/api/integrations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { Globe, RefreshCw, Building2 } from "lucide-react";

interface BusinessContextCardProps {
  projectId: string;
}

export function BusinessContextCard({ projectId }: BusinessContextCardProps) {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState("");

  const { data: context, isLoading } = useQuery({
    queryKey: ["business-context", projectId],
    queryFn: () => getBusinessContext(projectId),
  });

  const scrapeMutation = useMutation({
    mutationFn: (targetUrl: string) => scrapeWebsite(projectId, targetUrl),
    onSuccess: () => {
      toast.success("Product context updated");
      setUrl("");
      queryClient.invalidateQueries({
        queryKey: ["business-context", projectId],
      });
    },
    onError: () => {
      toast.error("Failed to scan website");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    scrapeMutation.mutate(trimmed);
  }

  if (isLoading) {
    return (
      <div className="rounded-[12px] bg-card-bg border border-border p-5 flex items-center justify-center">
        <Spinner size="sm" className="text-text-tertiary" />
      </div>
    );
  }

  // No context: show URL input form
  if (!context || !context.product_name) {
    return (
      <div className="rounded-[12px] bg-card-bg border border-border p-5 transition-colors hover:border-border-hover">
        <div className="flex items-center gap-2 mb-3">
          <Globe className="w-4 h-4 text-text-secondary" />
          <h4 className="text-[13px] font-medium text-foreground">
            Product context
          </h4>
        </div>
        <p className="text-[12px] text-text-tertiary mb-3">
          Enter your product URL so Napkin can understand your business.
        </p>
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <Input
            type="url"
            placeholder="https://yourproduct.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1 h-9 text-[13px]"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!url.trim() || scrapeMutation.isPending}
          >
            {scrapeMutation.isPending ? (
              <Spinner size="sm" className="w-3 h-3" />
            ) : (
              "Scan"
            )}
          </Button>
        </form>
      </div>
    );
  }

  // Has context: show product info
  return (
    <div className="rounded-[12px] bg-card-bg border border-border p-5 transition-colors hover:border-border-hover">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-text-secondary" />
          <h4 className="text-[13px] font-medium text-foreground">
            {context.product_name}
          </h4>
        </div>
        <button
          type="button"
          onClick={() => {
            if (context.url) {
              scrapeMutation.mutate(context.url);
            }
          }}
          disabled={scrapeMutation.isPending || !context.url}
          className="text-text-tertiary hover:text-foreground transition-colors p-1 rounded-md hover:bg-[rgba(255,255,255,0.06)]"
          title="Rescan"
        >
          {scrapeMutation.isPending ? (
            <Spinner size="sm" className="w-3.5 h-3.5" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      <div className="space-y-2">
        {context.core_value_prop && (
          <div>
            <span className="text-[11px] uppercase tracking-wide text-text-ghost">
              Value prop
            </span>
            <p className="text-[12px] text-text-secondary leading-relaxed">
              {context.core_value_prop}
            </p>
          </div>
        )}
        {context.target_customer && (
          <div>
            <span className="text-[11px] uppercase tracking-wide text-text-ghost">
              Target customer
            </span>
            <p className="text-[12px] text-text-secondary leading-relaxed">
              {context.target_customer}
            </p>
          </div>
        )}
        {context.pricing_model && (
          <div>
            <span className="text-[11px] uppercase tracking-wide text-text-ghost">
              Pricing
            </span>
            <p className="text-[12px] text-text-secondary leading-relaxed">
              {context.pricing_model}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default BusinessContextCard;
