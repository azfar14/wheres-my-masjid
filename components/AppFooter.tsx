"use client";

import { useEffect, useState } from "react";

export function AppFooter() {
  const [year, setYear] = useState(() => new Date().getFullYear());

  useEffect(() => {
    const refreshYear = () => setYear(new Date().getFullYear());
    refreshYear();
    const interval = window.setInterval(refreshYear, 60 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <footer className="app-footer" aria-label="Copyright and credits">
      <p>© {year}. All rights reserved.
      </p>
      <p>
        An initiative by{ " "}
        <a href="https://wannaapps.com/about-us/" target="_blank" rel="noreferrer">
          Wannaapps Technologies
        </a>
        . Developed by{ " "}
        <a href="https://github.com/azfar14" target="_blank" rel="noreferrer">
          Thameem Azfar Ansari
        </a>
        .
      </p>
    </footer>
  );
}
