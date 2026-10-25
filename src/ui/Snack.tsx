import { useEffect } from "react";
import { Icon } from "./icons";

/** A short success message at the bottom of the screen. Hides itself after 4 seconds, or on "OK". */
export function Snack({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  return (
    <div className="snack" role="status">
      <Icon name="check" />
      <span>{message}</span>
      <button onClick={onClose}>OK</button>
    </div>
  );
}
