import { useEffect, useState } from "react";
import { store } from "@/api/storeClient";

export const DEFAULT_SETTINGS = {
  key: "main",
  store_name: "Esex Store",
  tagline: "Boutique de bem-estar íntimo",
  announcement: "",
  whatsapp_number: "",
  whatsapp_message: "Olá! Vim pelo site da Esex Store e gostaria de ajuda com um produto.",
  contact_email: "",
  instagram: "",
  address: "",
  about_short: "",
  logo_url: "/media/logo.webp",
  payments_configured: false,
  payments_note: "O meio de pagamento ainda não está configurado: os pedidos ficam aguardando a definição do pagamento.",
  shipping_configured: false,
  shipping_provider: "melhor_envio",
  shipping_origin_postal_code: "32241340",
  shipping_sandbox: false,
  shipping_fixed_price: null,
  shipping_fixed_days: null,
  shipping_note: "Calcule as opções de entrega pelo CEP no carrinho ou no checkout.",
  demo_mode: false,
};

export function useStoreSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    store.entities.SiteSettings.filter({ key: "main" }, { limit: 1 })
      .then(({ items }) => {
        if (active && items && items[0]) setSettings({ ...DEFAULT_SETTINGS, ...items[0] });
      })
      .catch(() => {
        /* mantém os valores padrão se a configuração ainda não existir */
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { settings, loading };
}