import logoUrl from "../assets/logo.svg";

/** The app's logo: a black cat on a dumbbell. */
export function Logo({ size = 44 }: { size?: number }) {
  return <img src={logoUrl} width={size} height={size} alt="CDT Gym Tracker logo" />;
}

/** The logo and the app's name, at the top of the home screen. */
export function Brand() {
  return (
    <div className="brand">
      <Logo />
      <span className="brand-t">CDT Gym Tracker</span>
    </div>
  );
}
