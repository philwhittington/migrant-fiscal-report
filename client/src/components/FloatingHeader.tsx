import { useEffect, useState } from "react";

export function FloatingHeader({ title }: { title: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > 200);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`floating-header ${visible ? "visible" : ""}`}>
      <span className="font-sans text-xs font-medium text-steel tracking-wide truncate max-w-xl block">
        {title}
      </span>
    </header>
  );
}
