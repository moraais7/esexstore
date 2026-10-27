import React from "react";
import { Outlet } from "react-router-dom";
import Header from "@/components/store/Header";
import Footer from "@/components/store/Footer";
import WhatsAppButton from "@/components/store/WhatsAppButton";
import useStoreTheme from "@/hooks/useStoreTheme";

export default function StoreLayout() {
  const [theme, setTheme] = useStoreTheme();

  return (
    <div
      className={`flex min-h-screen flex-col bg-background text-foreground ${theme === "light" ? "store-cine store-light" : "store-cine"}`}
    >
      <Header theme={theme} onToggleTheme={() => setTheme(theme === "light" ? "dark" : "light")} />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
}