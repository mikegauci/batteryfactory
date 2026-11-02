import Link from "next/link";
import { Suspense } from "react";
import { AuthSection, AuthTitle } from "@/components/auth/auth-section";
import { codePageMetadata } from "@/lib/seo";
import { LoginForm } from "@/components/auth/login-form";

export function generateMetadata() {
  return codePageMetadata("login", "Login");
}

export default function LoginPage() {
  return (
    <AuthSection>
      <AuthTitle>Log in</AuthTitle>
      <p className="mt-2 text-base">
        or{" "}
        <Link
          href="/user-registration/"
          className="text-brand font-semibold hover:underline"
        >
          create an account
        </Link>
      </p>
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthSection>
  );
}
