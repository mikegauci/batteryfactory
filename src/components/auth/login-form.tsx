"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { signIn } from "@/lib/auth/actions";
import {
  AccountBox,
  AuthInput,
  FormMessage,
  SubmitButton,
} from "@/components/auth/fields";

// WooCommerce's "Login" form on My account.
export function LoginForm() {
  const params = useSearchParams();
  const [state, action] = useActionState(signIn, undefined);
  const linkError =
    params.get("error") === "link"
      ? { error: "That link is invalid or has expired." }
      : undefined;

  return (
    <>
      <h2 className="mt-12 mb-10 text-3xl font-black">Login</h2>
      <AccountBox>
        <form
          key={state?.fields?.identifier}
          action={action}
          className="space-y-5"
        >
          <input type="hidden" name="next" value={params.get("next") ?? ""} />
          <AuthInput
            label="Username or email address"
            name="identifier"
            defaultValue={state?.fields?.identifier}
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={254}
            required
          />
          <AuthInput
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
          <label className="flex items-center gap-1.5 text-sm font-black">
            <input type="checkbox" name="remember" defaultChecked={false} />
            Remember me
          </label>
          <SubmitButton>Log in</SubmitButton>
          <FormMessage state={state ?? linkError} />
          <p>
            <Link
              href="/my-account/lost-password/"
              className="text-brand hover:underline"
            >
              Lost your password?
            </Link>
          </p>
        </form>
      </AccountBox>
    </>
  );
}
