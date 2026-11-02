import { Container } from "@/components/layout/container";
import { UpdatePasswordForm } from "@/components/auth/password-forms";
import { codePageMetadata } from "@/lib/seo";

export function generateMetadata() {
  return codePageMetadata("my-account", "Reset password", { noindex: true });
}

// Opened from the password reset email (the link signs the user in first).
export default function Page() {
  return (
    <Container className="pt-[60px] pb-[120px]">
      <h1 className="section-title mb-12">Reset password</h1>
      <UpdatePasswordForm />
    </Container>
  );
}
