import { MessageCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { buildAdminWhatsAppLink } from "@/lib/whatsapp";

type HelpAdminButtonProps = {
  context?: string;
  compact?: boolean;
};

export function HelpAdminButton({ context = "pertanyaan umum", compact = false }: HelpAdminButtonProps) {
  const settings = trpc.marketplace.shippingSettings.useQuery();
  const whatsapp = settings.data?.adminWhatsapp;
  const href = buildAdminWhatsAppLink(undefined, undefined, whatsapp, context);
  return (
    <a className={`help-admin-button${compact ? " compact" : ""}`} href={href} target="_blank" rel="noreferrer">
      <MessageCircle size={compact ? 15 : 17} />
      {compact ? "Bantuan Admin" : "Chat Bantuan Admin"}
    </a>
  );
}
