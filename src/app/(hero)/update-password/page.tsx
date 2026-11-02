import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthSection, AuthTitle } from "@/components/auth/auth-section";
import { UpdatePasswordForm } from "@/components/auth/password-forms";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Set a New Password",
  robots: { index: false },
};

// Reads the session on every request, so skip instant-navigation validation.
export const instant = false;

// Reached from the password reset email (and by migrated users on first login).
export default function UpdatePasswordPage() {
  return (
    <AuthSection>
      <AuthTitle>Set a new password</AuthTitle>
      <Suspense>
        <SignedInOnly>
          <UpdatePasswordForm />
        </SignedInOnly>
      </Suspense>
    </AuthSection>
  );
}

async function SignedInOnly({ children }: { children: React.ReactNode }) {
  await requireUser("/update-password/");
  return children;
}
