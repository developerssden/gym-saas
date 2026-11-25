"use client";

import { useState } from "react";
import axios from "axios";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { WhatsAppIcon } from "@/components/common/whatsapp-icon";
import { useGymCurrency } from "@/hooks/useGymCurrency";
import { formatCurrency } from "@/lib/currency";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { filenameFromDisposition } from "@/lib/download-filename";
import {
  buildFeeReminderMessage,
  buildReceiptMessage,
  buildWhatsAppUrl,
  toWhatsAppNumber,
} from "@/lib/whatsapp";

/* Everything here opens the gym owner's own WhatsApp; Kettlio never sends messages itself. */

type FeeReminderProps = {
  memberName: string;
  phone: string | null | undefined;
  gymName?: string | null;
  /** Gym country (alpha-2/alpha-3) for currency and local phone numbers. Defaults to the selected gym. */
  gymCountry?: string | null;
  price: number;
  endDate: Date | string;
  isExpired: boolean;
  /** Extra classes for the button (e.g. a taller tap target). */
  className?: string;
};

function useFeeReminderUrl(props: FeeReminderProps): string | null {
  const gymCurrency = useGymCurrency();
  const country = props.gymCountry ?? gymCurrency.countryCode;
  const number = toWhatsAppNumber(props.phone, country);
  if (!number) return null;

  const amount = props.gymCountry
    ? formatCurrency(props.price, { countryCode: props.gymCountry })
    : gymCurrency.format(props.price);

  return buildWhatsAppUrl(
    number,
    buildFeeReminderMessage({
      memberName: props.memberName,
      gymName: props.gymName,
      amount,
      endDate: props.endDate,
      isExpired: props.isExpired,
    })
  );
}

/** "Send WhatsApp reminder" for a row's actions menu. */
export function WhatsAppReminderMenuItem(props: FeeReminderProps) {
  const url = useFeeReminderUrl(props);

  if (!url) {
    return (
      <DropdownMenuItem disabled>
        <WhatsAppIcon className="mr-2 size-4 text-muted-foreground" />
        No WhatsApp number
      </DropdownMenuItem>
    );
  }

  return (
    <DropdownMenuItem asChild>
      <a href={url} target="_blank" rel="noopener noreferrer">
        <WhatsAppIcon className="mr-2 size-4" />
        Send WhatsApp reminder
      </a>
    </DropdownMenuItem>
  );
}

/** Compact button version, for tables that show actions inline. */
export function WhatsAppReminderButton(props: FeeReminderProps) {
  const url = useFeeReminderUrl(props);
  const label = `Send WhatsApp reminder to ${props.memberName}`;

  if (!url) {
    return (
      <Button size="sm" variant="outline" disabled title="No phone number saved for this member" className={props.className}>
        <WhatsAppIcon className="size-4 text-muted-foreground" />
        <span className="sr-only sm:not-sr-only">Remind</span>
      </Button>
    );
  }

  return (
    <Button asChild size="sm" variant="outline" title={label} className={props.className}>
      <a href={url} target="_blank" rel="noopener noreferrer" aria-label={label}>
        <WhatsAppIcon className="size-4" />
        <span className="sr-only sm:not-sr-only">Remind</span>
      </a>
    </Button>
  );
}

type ShareReceiptProps = {
  paymentId: string;
  memberName: string;
  phone: string | null | undefined;
  gymName?: string | null;
  gymCountry?: string | null;
  amount: number;
  paymentDate: Date | string;
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Generates the PDF receipt and opens the phone's share sheet with it attached,
 * so the owner can pick WhatsApp and the member. Where sharing files isn't
 * supported (most desktops), it downloads the PDF and opens the member's chat.
 */
function useShareReceipt(props: ShareReceiptProps) {
  const [busy, setBusy] = useState(false);

  const share = async () => {
    setBusy(true);
    const amount = formatCurrency(props.amount, { countryCode: props.gymCountry });
    const message = buildReceiptMessage({
      memberName: props.memberName,
      gymName: props.gymName,
      amount,
      paymentDate: props.paymentDate,
    });
    try {
      const response = await axios.post(
        "/api/payments/generateinvoice",
        { payment_id: props.paymentId },
        { responseType: "blob" }
      );
      const blob = new Blob([response.data], { type: "application/pdf" });
      const filename = filenameFromDisposition(response.headers["content-disposition"], `Receipt - ${props.memberName}.pdf`);
      const file = new File([blob], filename, { type: "application/pdf" });

      if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text: message });
          return;
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") return; // owner closed the sheet
          // Otherwise (e.g. the browser blocked it): fall through to download + chat.
        }
      }

      downloadBlob(blob, filename);
      // Opened from the toast button: after the await, a direct window.open is
      // usually blocked as a popup because it no longer follows the click.
      const chatUrl = buildWhatsAppUrl(toWhatsAppNumber(props.phone, props.gymCountry), message);
      toast.success("Receipt downloaded. Open WhatsApp and attach it to the chat.", {
        duration: 15000,
        action: {
          label: "Open WhatsApp",
          onClick: () => window.open(chatUrl, "_blank", "noopener,noreferrer"),
        },
      });
    } catch (err) {
      toast.error(getErrorMessage(err) || "Couldn't create the receipt");
    } finally {
      setBusy(false);
    }
  };

  return { share, busy };
}

export function ShareReceiptMenuItem(props: ShareReceiptProps) {
  const { share, busy } = useShareReceipt(props);
  return (
    <DropdownMenuItem
      disabled={busy}
      onSelect={(e) => {
        e.preventDefault();
        void share();
      }}
    >
      {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <WhatsAppIcon className="mr-2 size-4" />}
      Share receipt on WhatsApp
    </DropdownMenuItem>
  );
}

type ButtonLook = {
  className?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
};

/** Same as ShareReceiptMenuItem, as a button (e.g. right after a payment, or on a payment row with `label="WhatsApp"`). */
export function ShareReceiptButton({
  className,
  variant,
  size,
  label = "Send receipt on WhatsApp",
  ...props
}: ShareReceiptProps & ButtonLook & { label?: string }) {
  const { share, busy } = useShareReceipt(props);
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={() => void share()}
      loading={busy}
      aria-label={label === "Send receipt on WhatsApp" ? undefined : `Send ${props.memberName}'s receipt on WhatsApp`}
    >
      {!busy && <WhatsAppIcon className="size-4" />}
      {label}
    </Button>
  );
}

/** Downloads a payment's PDF receipt. */
export function ReceiptDownloadButton({
  paymentId,
  className,
  variant = "outline",
  size = "sm",
  label = "Receipt",
}: { paymentId: string; label?: string } & ButtonLook) {
  const [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true);
    try {
      const response = await axios.post("/api/payments/generateinvoice", { payment_id: paymentId }, { responseType: "blob" });
      downloadBlob(
        new Blob([response.data], { type: "application/pdf" }),
        filenameFromDisposition(response.headers["content-disposition"], "Receipt.pdf"),
      );
      toast.success("Receipt downloaded");
    } catch (err) {
      toast.error(getErrorMessage(err) || "Couldn't create the receipt");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button type="button" variant={variant} size={size} className={className} onClick={() => void download()} loading={busy}>
      {!busy && <FileDown className="size-4" />}
      {label}
    </Button>
  );
}
