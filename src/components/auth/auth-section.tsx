import Image from "next/image";

// Matches the live login/registration layout: dark section, directory logo
// on the left and the form on the right.
export function AuthSection({ children }: { children: React.ReactNode }) {
  return (
    <section className="bg-[#131a1d] px-5 pt-[180px] pb-[100px] text-white">
      <div className="mx-auto grid max-w-[1200px] items-center gap-12 md:grid-cols-2 md:gap-8">
        <div className="flex justify-center px-5">
          <Image
            src="/brand/automotive-directory.png"
            alt="Malta’s Automotive Directory"
            width={1100}
            height={495}
            priority
            className="h-auto w-full max-w-[544px]"
          />
        </div>
        <div className="px-5">{children}</div>
      </div>
    </section>
  );
}

export function AuthTitle({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="text-[28px] leading-[28px] font-black text-white">
      {children}
    </h1>
  );
}
