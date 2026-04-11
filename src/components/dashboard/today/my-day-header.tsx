import { HeroBanner } from "./hero-banner";

interface MyDayHeaderProps {
  name: string;
  role: string;
  subtitle?: string;
}

/** Thin wrapper kept for existing call sites; delegates to <HeroBanner/>. */
export function MyDayHeader(props: MyDayHeaderProps) {
  return <HeroBanner {...props} />;
}
