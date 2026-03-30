"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createProject, listProjects } from "@/lib/api/projects";

const DEFAULT_PROJECT_KEY = "napkin_default_project_id";

export default function SetupPage() {
  const router = useRouter();
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    listProjects()
      .then((projects) => {
        if (projects.length > 0) {
          router.replace("/");
        } else {
          setChecking(false);
        }
      })
      .catch(() => setChecking(false));
  }, [router]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (productName.trim().length < 2 || loading) return;
    setLoading(true);
    setError(null);
    try {
      const project = await createProject({
        name: productName.trim(),
        description: description.trim() || undefined,
      });
      localStorage.setItem(DEFAULT_PROJECT_KEY, project.id);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  async function handleSkip() {
    if (skipping) return;
    setSkipping(true);
    setError(null);
    try {
      const project = await createProject({ name: "My Product" });
      localStorage.setItem(DEFAULT_PROJECT_KEY, project.id);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setSkipping(false);
    }
  }

  if (checking) return null;

  const canSubmit = productName.trim().length >= 2;

  return (
    <div className="flex flex-col">
      {/* Wordmark */}
      <div className="flex justify-center mb-12">
        <img
          src="/logo_clean_final.png"
          width={32}
          height={32}
          className="object-contain"
          alt="Napkin"
        />
      </div>

      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-[28px] font-semibold text-foreground leading-tight">
          Set up your workspace
        </h1>
        <p className="mt-2 text-[14px] font-sans text-text-secondary">
          Tell us about the product you&apos;re building.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col">
        {/* Product name */}
        <div>
          <label className="block text-[13px] font-medium text-text-secondary mb-1.5">
            Product name
          </label>
          <input
            type="text"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="e.g., Notion, Linear, Figma..."
            autoFocus
            className="w-full h-11 bg-card-bg border border-border rounded-lg px-3 text-[14px] text-foreground placeholder:text-text-tertiary transition-colors focus:outline-none focus:ring-0 focus:border-border-focus"
          />
        </div>

        {/* Description */}
        <div className="mt-5">
          <label className="block text-[13px] font-medium text-text-secondary mb-1.5">
            What does it do?
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A brief description helps Napkin give better recommendations..."
            rows={4}
            className="w-full min-h-[100px] bg-card-bg border border-border rounded-lg px-3 py-2.5 text-[14px] text-foreground placeholder:text-text-tertiary transition-colors focus:outline-none focus:ring-0 focus:border-border-focus resize-none"
          />
        </div>

        {/* Error */}
        {error && (
          <p className="mt-3 text-[13px] text-accent-red">{error}</p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={!canSubmit || loading}
          className="mt-7 w-full h-11 bg-cta-bg text-cta-text rounded-lg text-[14px] font-medium transition-opacity disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
        >
          {loading ? "Setting up..." : "Get started \u2192"}
        </button>
      </form>

      {/* Skip */}
      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={handleSkip}
          disabled={skipping}
          className="text-[13px] text-text-tertiary hover:text-text-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {skipping ? "Setting up..." : "Skip for now"}
        </button>
      </div>
    </div>
  );
}
