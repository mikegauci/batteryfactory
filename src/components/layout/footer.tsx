import { getSiteSettings } from "@/lib/site-settings";
import Image from "next/image";
import { Container } from "@/components/layout/container";
import { FACEBOOK_URL } from "@/lib/navigation";

// Astra "below footer" row: logo, Facebook link and the address line.
export async function Footer() {
  const settings = await getSiteSettings();
  const address =
    settings.footer_address ||
    "Battery Factory | B13b, Bulebel Industrial Estate | Zejtun ZTN3000";
  return (
    <footer className="border-line border-t bg-white py-5">
      <Container className="grid min-h-[100px] items-center gap-6 py-4 text-center md:grid-cols-[1fr_1fr_2fr] md:gap-0">
        <div className="flex justify-center">
          <Image
            src="/brand/logo.svg"
            alt="Battery Factory"
            width={177}
            height={37}
            className="h-auto w-[180px]"
          />
        </div>
        <p>
          <a
            href={settings.facebook_url || FACEBOOK_URL}
            className="text-brand underline"
            target="_blank"
            rel="noopener"
          >
            Follow us on Facebook
          </a>
        </p>
        <p className="font-black md:text-left">
          {address.split("|").map((part, i) => (
            <span key={i}>
              {i > 0 && <span className="font-medium"> | </span>}
              {part.trim()}
            </span>
          ))}
        </p>
      </Container>
    </footer>
  );
}
