import { getTranslations } from "next-intl/server";
import { getStoreSettings } from "@/lib/data/settings";

// Floating "chat with us" button. Renders nothing until the owner enters a
// WhatsApp number in Admin > Settings.
export async function WhatsAppButton() {
  const [settings, t] = await Promise.all([getStoreSettings(), getTranslations("Whatsapp")]);
  if (!settings.whatsapp_number) return null;

  const href = `https://wa.me/${settings.whatsapp_number}?text=${encodeURIComponent(t("message"))}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("label")}
      className="fixed bottom-5 end-5 z-30 flex h-14 items-center gap-2 rounded-full bg-[#25D366] px-4 text-white shadow-lg transition-transform hover:scale-105 motion-reduce:transition-none"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 fill-current">
        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2Zm5.8 14.12c-.25.69-1.44 1.32-1.98 1.37-.5.05-1.13.07-1.82-.11-.42-.13-.96-.31-1.65-.6-2.9-1.25-4.8-4.17-4.94-4.37-.14-.2-1.18-1.57-1.18-3s.75-2.13 1.02-2.42c.27-.29.58-.36.78-.36h.56c.18 0 .42-.07.66.5.25.6.85 2.07.92 2.22.07.15.12.32.02.52-.1.2-.15.32-.3.5-.15.17-.31.39-.45.52-.15.15-.3.31-.13.6.17.3.77 1.27 1.65 2.05 1.13 1 2.09 1.32 2.39 1.47.3.15.47.12.65-.07.17-.2.75-.87.95-1.17.2-.3.4-.25.67-.15.27.1 1.72.81 2.02.96.3.15.5.22.57.35.07.12.07.72-.18 1.4Z" />
      </svg>
      <span className="hidden text-sm font-semibold sm:inline">{t("label")}</span>
    </a>
  );
}
