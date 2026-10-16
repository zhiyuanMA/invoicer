import Link from "next/link";

const links = [
  { href: "/", label: "Invoices" },
  { href: "/invoices/new", label: "New invoice" },
  { href: "/customers", label: "Customers" },
  { href: "/sellers", label: "Sellers" },
];

export function AppNav() {
  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur">
      <nav className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
        <span className="text-lg font-semibold text-zinc-900">Invoicer</span>
        <div className="flex gap-4 text-sm">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="text-zinc-600 hover:text-zinc-900">
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
