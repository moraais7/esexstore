import React from "react";
import { MessageCircle } from "lucide-react";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { whatsappLink } from "@/lib/format";

export default function WhatsAppButton() {
  const { settings } = useStoreSettings();
  const link = whatsappLink(settings.whatsapp_number, settings.whatsapp_message);
  if (!link) return null;

  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className="cine-btn cine-btn-fill fixed bottom-5 right-5 z-40 h-12 gap-2 !rounded-full px-5 max-sm:bottom-4 max-sm:right-4 max-sm:px-4"
      aria-label="Falar com a loja pelo WhatsApp"
    >
      <MessageCircle className="h-4 w-4" strokeWidth={1.8} />
      <span className="max-sm:hidden">Falar no WhatsApp</span>
    </a>
  );
}