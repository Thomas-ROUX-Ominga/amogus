"use client";

export default function OrganizerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-[100dvh] overflow-hidden bg-black font-mono flex flex-col">
      {/* Main Content */}
      <main className="flex-1 relative z-10 overflow-hidden">
        {children}
      </main>
      
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--primary)_0%,transparent_70%)] opacity-20" />
      </div>
    </div>
  );
}
