"use client";
import Link from "next/link";
import { useState } from "react";
import { formatPrice } from "@/lib/format";
import { useCart } from "./cart";
import { lineDetails, shippingCost, type Shipping } from "./cart-page";
import { WooNotice } from "./woo-notice";

const input =
  "focus:border-brand w-full border border-[#d1d5db] px-4 py-2.5 text-base font-normal focus:outline-none placeholder:text-[#94a3b8]";
const labelText = "mb-2 block text-sm font-black";

type Fields = Record<string, string>;

function Field({
  name,
  label,
  required = true,
  type = "text",
  placeholder,
  autoComplete,
  prefix,
  values,
  onChange,
  className = "",
}: {
  name: string;
  label?: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  prefix: string;
  values: Fields;
  onChange: (name: string, value: string) => void;
  className?: string;
}) {
  const id = `${prefix}_${name}`;
  return (
    <p className={`mb-5 ${className}`}>
      {label && (
        <label htmlFor={id} className={labelText}>
          {label}{" "}
          {required ? (
            <span className="text-coral">*</span>
          ) : (
            <span>(optional)</span>
          )}
        </label>
      )}
      <input
        id={id}
        type={type}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-label={label ? undefined : placeholder}
        value={values[name] ?? ""}
        onChange={(e) => onChange(name, e.target.value)}
        className={input}
      />
    </p>
  );
}

function AddressFields({
  prefix,
  values,
  onChange,
  email = false,
}: {
  prefix: string;
  values: Fields;
  onChange: (name: string, value: string) => void;
  email?: boolean;
}) {
  const props = { prefix, values, onChange };
  return (
    <>
      {email && (
        <Field
          {...props}
          name="email"
          type="email"
          label="Email address"
          autoComplete="email"
        />
      )}
      <div className="grid gap-x-12 sm:grid-cols-2">
        <Field
          {...props}
          name="first_name"
          label="First name"
          autoComplete="given-name"
        />
        <Field
          {...props}
          name="last_name"
          label="Last name"
          autoComplete="family-name"
        />
      </div>
      <Field
        {...props}
        name="company"
        label="Company name"
        required={false}
        autoComplete="organization"
      />
      <div className="mb-5">
        <p className={labelText}>
          Country / Region <span className="text-coral">*</span>
        </p>
        <p className="text-sm font-black">Malta</p>
      </div>
      <Field
        {...props}
        name="address_1"
        label="Street address"
        placeholder="House number and street name"
        autoComplete="address-line1"
        className="mb-3"
      />
      <Field
        {...props}
        name="address_2"
        required={false}
        placeholder="Apartment, suite, unit, etc. (optional)"
        autoComplete="address-line2"
      />
      <Field
        {...props}
        name="city"
        label="Town / City"
        autoComplete="address-level2"
      />
      <Field
        {...props}
        name="postcode"
        label="Postcode / ZIP"
        autoComplete="postal-code"
      />
      {email && (
        <Field
          {...props}
          name="phone"
          type="tel"
          label="Phone"
          autoComplete="tel"
        />
      )}
    </>
  );
}

// WooCommerce checkout: billing details (and an optional delivery address)
// on the left, "Your order" with totals and "Place order" on the right.
// Placing the order reserves the stock and opens Stripe for the card payment.
export function CheckoutForm({
  shipping,
  email,
}: {
  shipping: Shipping;
  email?: string;
}) {
  const { items } = useCart();
  const [billing, setBilling] = useState<Fields>({ email: email ?? "" });
  const [delivery, setDelivery] = useState<Fields>({});
  const [elsewhere, setElsewhere] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const subtotal = items.reduce((n, i) => n + i.price * i.quantity, 0);
  const shippingCents = shippingCost(shipping, subtotal);

  if (!items.length)
    return (
      <>
        <WooNotice tone="info">Your cart is currently empty.</WooNotice>
        <Link href="/shop-batteries-and-accessories/" className="shop-button">
          Return to shop
        </Link>
      </>
    );

  async function placeOrder(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/checkout/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({
            productId: i.productId,
            variantId: i.variantId,
            quantity: i.quantity,
            options: i.options,
            addons: (i.addons ?? []).map((a) => a.id),
          })),
          details: {
            billing,
            shipping: delivery,
            ship_elsewhere: elsewhere,
            note,
          },
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      window.location.assign(result.url);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Checkout failed. Please try again.",
      );
      setBusy(false);
    }
  }

  const row = "border-line flex justify-between gap-4 border-b py-4";
  return (
    <form
      onSubmit={placeOrder}
      className="grid gap-12 lg:grid-cols-[1fr_480px] lg:gap-[60px]"
    >
      <div>
        <h3 className="border-line mb-8 border-b pb-4 text-2xl font-black">
          Billing details
        </h3>
        <AddressFields
          prefix="billing"
          values={billing}
          onChange={(k, v) => setBilling({ ...billing, [k]: v })}
          email
        />
        <label className="border-line mt-6 flex items-center gap-2 border-b pb-6 text-sm">
          <input
            type="checkbox"
            checked={elsewhere}
            onChange={(e) => setElsewhere(e.target.checked)}
          />
          Ship to a different address?
        </label>
        {elsewhere && (
          <div className="mt-6">
            <AddressFields
              prefix="shipping"
              values={delivery}
              onChange={(k, v) => setDelivery({ ...delivery, [k]: v })}
            />
          </div>
        )}
        <p className="mt-6">
          <label htmlFor="order_comments" className={labelText}>
            Order notes <span>(optional)</span>
          </label>
          <textarea
            id="order_comments"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Notes about your order, e.g. special notes for delivery."
            className={input}
          />
        </p>
      </div>

      <section className="border-line self-start border-2 px-8 py-10">
        <h3 className="mb-8 text-2xl font-black">Your order</h3>
        <div className="text-[15px]">
          <p className={`${row} font-black`}>
            <span>Product</span>
            <span>Subtotal</span>
          </p>
          {items.map((i) => (
            <div
              key={`${i.productId}${i.variantId}${JSON.stringify(i.options)}${(i.addons ?? []).map((a) => a.id)}`}
              className={row}
            >
              <span>
                {i.name}
                {lineDetails(i).map((d) => (
                  <span key={d} className="text-muted block text-sm">
                    {d}
                  </span>
                ))}
                <span className="block">× {i.quantity}</span>
              </span>
              <span>{formatPrice(i.price * i.quantity)}</span>
            </div>
          ))}
          <p className={row}>
            <span>Subtotal</span>
            <span>{formatPrice(subtotal)}</span>
          </p>
          <p className={row}>
            <span>Shipping</span>
            <span className="text-right">
              {shippingCents === 0
                ? "Free Delivery (Malta & Gozo)"
                : `Malta & Gozo: ${formatPrice(shippingCents)}`}
            </span>
          </p>
          <p className={`${row} font-black`}>
            <span>Total</span>
            <span>{formatPrice(subtotal + shippingCents)}</span>
          </p>
        </div>
        <p className="mt-6 text-sm">
          Credit / Debit Card. You will enter your card details on the next
          step, secured by Stripe.
        </p>
        <p className="mt-6">
          Your personal data will be used to process your order, support your
          experience throughout this website, and for other purposes described
          in our privacy policy.
        </p>
        <button
          type="submit"
          disabled={busy}
          className="bg-brand hover:bg-brand-dark mt-4 w-full rounded-lg py-2.5 text-[22px] text-white transition-colors disabled:opacity-60"
        >
          {busy ? "Processing…" : "Place order"}
        </button>
        {error && (
          <p role="alert" className="text-coral mt-4">
            {error}
          </p>
        )}
      </section>
    </form>
  );
}
