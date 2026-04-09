"use client";

import {
  type EmojiPickerListCategoryHeaderProps,
  type EmojiPickerListEmojiProps,
  type EmojiPickerListRowProps,
  EmojiPicker as EmojiPickerPrimitive,
} from "frimousse";
import { LoaderIcon, SearchIcon } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";

function EmojiPicker({ className, ...props }: React.ComponentProps<typeof EmojiPickerPrimitive.Root>) {
  return (
    <EmojiPickerPrimitive.Root
      className={cn("bg-[--surface-elevated] text-[--text-primary] isolate flex h-full w-fit flex-col overflow-hidden rounded-xl border border-[--border]", className)}
      {...props}
    />
  );
}

function EmojiPickerSearch({ className, ...props }: React.ComponentProps<typeof EmojiPickerPrimitive.Search>) {
  return (
    <div className={cn("flex items-center gap-2 px-3 mx-2 mt-2 mb-1 rounded-lg bg-[--surface-hover]", className)}>
      <SearchIcon className="size-4 shrink-0 text-[--text-muted]" />
      <EmojiPickerPrimitive.Search
        className="outline-none outline-0 border-0 border-none ring-0 ring-offset-0 focus:outline-none focus:outline-0 focus:border-0 focus:border-none focus:ring-0 focus:ring-offset-0 [&:focus]:outline-none [&:focus-visible]:outline-none [&:focus-visible]:ring-0 shadow-none appearance-none placeholder:text-[--text-disabled] flex h-9 w-full bg-transparent text-[13px] text-[--text-primary] disabled:cursor-not-allowed"
        placeholder="Search emoji..."
        style={{ outline: "none", border: "none", boxShadow: "none" }}
        {...props}
      />
    </div>
  );
}

function EmojiPickerRow({ children, ...props }: EmojiPickerListRowProps) {
  return <div {...props} className="scroll-my-1 px-1">{children}</div>;
}

function EmojiPickerEmoji({ emoji, className, ...props }: EmojiPickerListEmojiProps) {
  return (
    <button
      {...props}
      className={cn("data-[active]:bg-[--surface-active] flex size-8 items-center justify-center rounded-lg text-base hover:bg-[--surface-hover] transition-colors", className)}
    >
      {emoji.emoji}
    </button>
  );
}

function EmojiPickerCategoryHeader({ category, ...props }: EmojiPickerListCategoryHeaderProps) {
  return (
    <div {...props} className="bg-[--surface-elevated] text-[--text-muted] px-3 pb-1.5 pt-3 text-[11px] uppercase tracking-wider leading-none">
      {category.label}
    </div>
  );
}

function EmojiPickerContent({ className, ...props }: React.ComponentProps<typeof EmojiPickerPrimitive.Viewport>) {
  return (
    <EmojiPickerPrimitive.Viewport className={cn("outline-none relative flex-1", className)} {...props}>
      <EmojiPickerPrimitive.Loading className="absolute inset-0 flex items-center justify-center text-[--text-muted]">
        <LoaderIcon className="size-4 animate-spin" />
      </EmojiPickerPrimitive.Loading>
      <EmojiPickerPrimitive.Empty className="absolute inset-0 flex items-center justify-center text-[--text-muted] text-[13px]">
        No emoji found.
      </EmojiPickerPrimitive.Empty>
      <EmojiPickerPrimitive.List
        className="select-none pb-1"
        components={{ Row: EmojiPickerRow, Emoji: EmojiPickerEmoji, CategoryHeader: EmojiPickerCategoryHeader }}
      />
    </EmojiPickerPrimitive.Viewport>
  );
}

export { EmojiPicker, EmojiPickerSearch, EmojiPickerContent };
