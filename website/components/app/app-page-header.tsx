export function AppPageHeading({ children }: { children: React.ReactNode }) {
  return (
    <header
      data-slot="page-navbar"
      className="sticky top-0 z-10 order-first -mx-5 shrink-0 border-b border-transparent bg-background px-5 py-3.5 transition-[border-color] data-[scrolled=true]:border-border md:-mx-8 md:px-8"
    >
      {children}
    </header>
  );
}
