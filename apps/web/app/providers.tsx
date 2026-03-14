"use client";

import { Databuddy } from "@databuddy/sdk/react";
import { ThemeProvider } from "next-themes";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        {children}
      </ThemeProvider>
      <Databuddy
        clientId="a6084218-0c31-4378-8cc8-bfb258bd6347"
        trackErrors
        trackWebVitals
      />
    </>
  );
}
