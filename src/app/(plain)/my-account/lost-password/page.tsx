import { Container } from "@/components/layout/container";
import { ResetPasswordForm } from "@/components/auth/password-forms";
import { codePageMetadata } from "@/lib/seo";

export function generateMetadata() {
  return codePageMetadata("my-account", "Lost password", { noindex: true });
}

export default function Page() {
  return (
    <Container className="pt-[60px] pb-[120px]">
      <h1 className="section-title mb-12">Lost password</h1>
      <ResetPasswordForm />
    </Container>
  );
}
