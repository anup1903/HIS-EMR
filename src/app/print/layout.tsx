/**
 * Minimal layout for printable pages — no sidebar, no header, no toasts.
 * Fits on A4 / Letter and uses the root providers only.
 */
export default function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white text-slate-900 print:bg-white">
      {children}
    </div>
  );
}
