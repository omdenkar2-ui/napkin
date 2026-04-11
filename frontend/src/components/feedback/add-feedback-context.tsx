"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { AddFeedbackModal } from "./add-feedback-modal";

interface AddFeedbackContextType {
  isOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
}

const AddFeedbackContext = createContext<AddFeedbackContextType | null>(null);

export function useAddFeedback() {
  const ctx = useContext(AddFeedbackContext);
  if (!ctx) throw new Error("useAddFeedback must be used within AddFeedbackProvider");
  return ctx;
}

export function AddFeedbackProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const openModal = useCallback(() => setIsOpen(true), []);
  const closeModal = useCallback(() => setIsOpen(false), []);

  // Global "N" shortcut (only when no input focused and palette not open)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "n" && e.key !== "N") return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;

      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if ((document.activeElement as HTMLElement)?.isContentEditable) return;

      // Check if command palette is open (it renders a fixed overlay with z-50)
      if (document.querySelector("[data-command-palette]")) return;

      e.preventDefault();
      openModal();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [openModal]);

  return (
    <AddFeedbackContext.Provider value={{ isOpen, openModal, closeModal }}>
      {children}
      <AddFeedbackModal open={isOpen} onClose={closeModal} />
    </AddFeedbackContext.Provider>
  );
}
