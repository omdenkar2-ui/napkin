export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[--background] flex items-center justify-center relative">
      {/* Logo */}
      <div className="absolute top-6 left-6">
        <img
          src="/logo_clean_final.png"
          className="w-7 h-7 object-contain"
          alt="Napkin"
        />
      </div>
      <div className="w-full max-w-[560px] px-6">{children}</div>
    </div>
  );
}
