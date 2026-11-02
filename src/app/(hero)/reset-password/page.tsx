import { AuthSection, AuthTitle } from "@/components/auth/auth-section";
import { ResetPasswordForm } from "@/components/auth/password-forms";
import { codePageMetadata } from "@/lib/seo";

export function generateMetadata() {
  return codePageMetadata("reset-password", "Reset Password");
}

export default function ResetPasswordPage() {
  return (
    <AuthSection>
      <AuthTitle>Reset Password</AuthTitle>
      <ResetPasswordForm />
    </AuthSection>
  );
}
