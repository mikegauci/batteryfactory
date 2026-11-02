import Image from "next/image";
import Link from "next/link";
import { ContactForm } from "@/components/contact-form";
import { Container } from "@/components/layout/container";
import { ManagedPageContent } from "@/components/managed-page-content";
import { OrderedSections } from "@/components/ordered-sections";
import { RichLine } from "@/components/rich-line";
import { mediaUrl } from "@/lib/media";
import { codePageMetadata } from "@/lib/seo";
import { getPageFields } from "@/lib/static-pages";

export function generateMetadata() {
  return codePageMetadata("", "Custom Lithium Batteries & EV Conversions", {
    description:
      "Battery Factory builds and repairs lithium batteries in Malta. From e-bikes to forklifts to EV conversions – safe, reliable, and custom power solutions.",
  });
}

// The live homepage: one long Spectra page whose sections are the menu's
// anchors (#about-us, #services, #faqs, #contact).
export default async function Home() {
  const f = await getPageFields("");
  const values = [1, 2, 3].map((n) => ({
    title: f[`value${n}Title`],
    text: f[`value${n}Text`],
  }));
  const services = [1, 2, 3, 4, 5].map((n) => ({
    icon: f[`service${n}Icon`],
    title: f[`service${n}Title`],
    text: f[`service${n}Text`],
    url: f[`service${n}Url`],
  }));
  const faqs = f.faqs
    .split(/\n\s*\n/)
    .map((block) => block.trim().split("\n"))
    .filter(([q]) => q)
    .map(([question, ...answer]) => ({ question, answer: answer.join("\n") }));
  // Two columns, filled top to bottom like the live Spectra grid.
  const half = Math.ceil(faqs.length / 2);
  const hours = f.contactHours
    .split("\n")
    .map((line) => line.split("|").map((s) => s.trim()))
    .filter(([day]) => day);

  return (
    <ManagedPageContent path="">
      <section className="relative min-h-[520px] overflow-hidden bg-[#1b2a4a] pt-[110px] pb-10 text-white md:pt-[183px]">
        <Image
          src={mediaUrl(f.heroImage)}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-black/60" />
        <Container className="relative grid items-start gap-8 max-md:text-center md:grid-cols-[2fr_1fr]">
          <div>
            <h1 className="text-[28px] leading-[1.4] font-black md:text-4xl">
              <span className="text-brand">{f.heroHeading}</span>
              <br />
              {f.heroHeading2}
            </h1>
            <p className="mt-6 text-[22px] leading-[1.3] font-medium md:text-[30px]">
              {f.heroSubheading}
            </p>
          </div>
          <div className="md:mt-[60px]">
            <Link href={f.heroButtonUrl} className="bf-button">
              {f.heroButton}
            </Link>
          </div>
        </Container>
      </section>

      <OrderedSections order={f.homeOrder}>
        <section data-cms-section="about" id="about-us" className="py-10">
          <Container>
            <h2 className="section-title">{f.aboutHeading}</h2>
            <div className="mt-10 space-y-2">
              {f.aboutText
                .split("\n")
                .filter(Boolean)
                .map((p, i) => (
                  <p key={i}>
                    <RichLine text={p} />
                  </p>
                ))}
            </div>
            <div className="mt-14 grid gap-12 md:grid-cols-3 md:gap-8">
              {values.map((v) => (
                <div key={v.title} className="flex gap-6">
                  <Image
                    src="/brand/bolt.svg"
                    alt=""
                    width={42}
                    height={98}
                    className="h-[98px] w-[42px] shrink-0"
                  />
                  <div>
                    <h3 className="text-ink text-[32px] leading-[1.3] font-black md:text-[42px]">
                      {v.title}
                    </h3>
                    <p className="text-brand mt-1">
                      <RichLine text={v.text} />
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Container>
        </section>

        <section
          data-cms-section="services"
          id="services"
          className="relative overflow-hidden py-[60px] text-white"
        >
          <Image
            src={mediaUrl(f.servicesImage)}
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-black/70" />
          <Container className="relative">
            <h2 className="section-title border-white">{f.servicesHeading}</h2>
            <div className="mt-[60px] grid gap-10 sm:grid-cols-2 lg:grid-cols-5 lg:gap-6">
              {services.map((s) => {
                // The icon artwork includes its green circle.
                const icon = (
                  <Image
                    src={mediaUrl(s.icon)}
                    alt=""
                    width={135}
                    height={135}
                    className="size-[135px]"
                  />
                );
                return (
                  <div key={s.title}>
                    {s.url ? (
                      <Link
                        href={s.url}
                        aria-label={s.title.replace("\n", " ")}
                      >
                        {icon}
                      </Link>
                    ) : (
                      icon
                    )}
                    <h3 className="mt-[30px] text-2xl leading-[1.3] font-black">
                      <RichLine text={s.title} />
                    </h3>
                    <p className="mt-9">
                      <RichLine text={s.text} />
                    </p>
                  </div>
                );
              })}
            </div>
          </Container>
        </section>

        <section data-cms-section="shop" id="shop" className="py-10">
          <Container>
            <div className="flex flex-wrap items-center gap-x-[50px] gap-y-4">
              <h2 className="section-title">{f.shopHeading}</h2>
              <Link href={f.shopButtonUrl} className="bf-button">
                {f.shopButton}
              </Link>
            </div>
            <p className="mt-12">
              <RichLine text={f.shopText} />
            </p>
          </Container>
        </section>

        <section data-cms-section="plushbike" id="plushbike" className="p-2.5">
          <Link href={f.bannerUrl} className="block">
            <picture>
              <source
                media="(max-width: 767px)"
                srcSet={mediaUrl(f.bannerImageMobile)}
              />
              <img
                src={mediaUrl(f.bannerImage)}
                alt="Plushbike – Life can be easier! Turn your bicycle electric today"
                className="mx-auto h-auto w-full max-w-[1440px]"
                loading="lazy"
              />
            </picture>
          </Link>
        </section>

        <section data-cms-section="faqs" id="faqs" className="py-10">
          <Container>
            <h2 className="section-title">{f.faqHeading}</h2>
            <div className="mt-12 grid gap-x-6 md:grid-cols-2">
              {[faqs.slice(0, half), faqs.slice(half)].map((column, i) => (
                <div key={i}>
                  {column.map((faq) => (
                    <div key={faq.question} className="mb-14">
                      <h3 className="text-brand text-[30px] leading-[1.3] font-extralight">
                        {faq.question}
                      </h3>
                      <p className="mt-4 text-[34px] leading-[1.3] font-black">
                        <RichLine text={faq.answer} />
                      </p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </Container>
        </section>

        <section
          data-cms-section="contact"
          id="contact"
          className="bg-panel py-[60px]"
        >
          <Container>
            <h2 className="section-title">{f.contactHeading}</h2>
            <p className="mt-12 text-sm font-black">
              <RichLine text={f.contactText} />
            </p>
            <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_456px] lg:gap-[120px]">
              <ContactForm />
              <aside className="bg-[#424242] px-[54px] py-[60px] text-lg leading-[1.8] font-extralight text-white">
                <h3 className="text-brand font-black">Contact Info</h3>
                <p>Phone: {f.contactPhone}</p>
                <p>
                  Email:{" "}
                  <a href={`mailto:${f.contactEmail}`} className="underline">
                    {f.contactEmail}
                  </a>
                </p>
                <h3 className="text-brand mt-8 font-black">Address</h3>
                <p>
                  <RichLine text={f.contactAddress} />
                </p>
                <h3 className="text-brand mt-8 font-black">Business Hours</h3>
                <dl className="grid grid-cols-[174px_1fr]">
                  {hours.map(([day, time]) => (
                    <div key={day} className="contents">
                      <dt>{day}</dt>
                      <dd>{time}</dd>
                    </div>
                  ))}
                </dl>
              </aside>
            </div>
          </Container>
        </section>
      </OrderedSections>
    </ManagedPageContent>
  );
}
