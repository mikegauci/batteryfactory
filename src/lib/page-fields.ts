// Editable text and images of the pages laid out in code. Defaults are the
// live site's content. In text fields, *words* are highlighted in green and
// **words** are bold, as on the WordPress page.
export const PAGE_FIELDS: Record<
  string,
  Record<
    string,
    { label: string; value: string; kind?: "image" | "order" | "select" }
  >
> = {
  "": {
    homeOrder: {
      label: "Homepage section order",
      value: "about,services,shop,plushbike,faqs,contact",
      kind: "order",
    },
    heroImage: {
      label: "Hero background",
      value: "wp/2025/09/hero-section-batteries.webp",
      kind: "image",
    },
    heroHeading: {
      label: "Hero heading (green)",
      value: "Powering the Future",
    },
    heroHeading2: {
      label: "Hero heading (white)",
      value: "One Battery at a Time",
    },
    heroSubheading: {
      label: "Hero subheading",
      value: "Reliable. Custom. Built for You.",
    },
    heroButton: { label: "Hero button", value: "Shop Now" },
    heroButtonUrl: {
      label: "Hero button URL",
      value: "/shop-batteries-and-accessories/",
    },
    aboutHeading: { label: "About heading", value: "Our journey & values" },
    aboutText: {
      label: "About text (one paragraph per line)",
      value: [
        "Battery Factory *over 15 years ago* with a university thesis – a complete conversion of an internal combustion car to electric.",
        "That project sparked a *passion* that grew into a *profession*.",
        "Two years ago, we turned this passion into a full-time business, and today, Battery Factory is *Malta’s specialist in lithium battery manufacturing, repair, and EV conversions.*",
        "We serve both *individuals* and *businesses*, offering everything from a single e-bike battery to large industrial packs for forklifts, solar storage and backup systems.",
      ].join("\n"),
    },
    value1Title: { label: "Value 1 title", value: "Innovation" },
    value1Text: {
      label: "Value 1 text",
      value: "We constantly explore better battery designs and technologies.",
    },
    value2Title: { label: "Value 2 title", value: "Reliability" },
    value2Text: {
      label: "Value 2 text",
      value: "Our builds are tested and\ntrusted in the field.",
    },
    value3Title: { label: "Value 3 title", value: "Sustainability" },
    value3Text: {
      label: "Value 3 text",
      value:
        "We believe in practical steps toward a cleaner, electric-powered future.",
    },
    servicesImage: {
      label: "Services background",
      value: "wp/2025/09/what-we-do.webp",
      kind: "image",
    },
    servicesHeading: { label: "Services heading", value: "What we do" },
    service1Icon: {
      label: "Service 1 icon",
      value: "wp/2025/09/custom-battery-manufacturing-icon.webp",
      kind: "image",
    },
    service1Title: {
      label: "Service 1 title",
      value: "Custom Battery Manufacturing",
    },
    service1Text: {
      label: "Service 1 text",
      value:
        "From 1 to 32 cells in series, we build lithium battery packs tailored to your needs. Perfect for e-bikes, electric motorcycles, EV conversions, solar storage, and industrial applications.",
    },
    service1Url: {
      label: "Service 1 icon link",
      value: "/custom-battery-manufacturing/",
    },
    service2Icon: {
      label: "Service 2 icon",
      value: "wp/2025/09/battery-repair-and-refurbishment.webp",
      kind: "image",
    },
    service2Title: {
      label: "Service 2 title",
      value: "Battery Repair & Refurbishment",
    },
    service2Text: {
      label: "Service 2 text",
      value:
        "Bring your old batteries back to life. We replace faulty cells, repair connections, and balance packs to restore performance and extend lifespan.",
    },
    service2Url: { label: "Service 2 icon link", value: "" },
    service3Icon: {
      label: "Service 3 icon",
      value: "wp/2025/09/EV-conversions.webp",
      kind: "image",
    },
    service3Title: { label: "Service 3 title", value: "EV\nConversions" },
    service3Text: {
      label: "Service 3 text",
      value:
        "Turn your petrol or diesel vehicle into a clean, quiet, electric machine. We design and install complete conversion systems for cars, bikes, and small utility vehicles. Government Grants apply.",
    },
    service3Url: { label: "Service 3 icon link", value: "" },
    service4Icon: {
      label: "Service 4 icon",
      value: "wp/2025/09/B2B-battery-solutions.webp",
      kind: "image",
    },
    service4Title: {
      label: "Service 4 title",
      value: "B2B Battery\nSolutions",
    },
    service4Text: {
      label: "Service 4 text",
      value:
        "We provide reliable power solutions for businesses – from bulk battery supply to forklift and pallet jack battery services.",
    },
    service4Url: { label: "Service 4 icon link", value: "" },
    service5Icon: {
      label: "Service 5 icon",
      value: "wp/2025/09/diagnostics-health-testing.webp",
      kind: "image",
    },
    service5Title: {
      label: "Service 5 title",
      value: "Diagnostics & Health Testing",
    },
    service5Text: {
      label: "Service 5 text",
      value:
        "We use advanced equipment to measure internal resistance, capacity, and safety performance, helping you understand your battery’s health and predict it’s lifespan.",
    },
    service5Url: { label: "Service 5 icon link", value: "" },
    shopHeading: {
      label: "Shop heading",
      value: "Shop batteries & accessories",
    },
    shopButton: { label: "Shop button", value: "Shop Now" },
    shopButtonUrl: {
      label: "Shop button URL",
      value: "/shop-batteries-and-accessories/",
    },
    shopText: {
      label: "Shop text",
      value:
        "Browse our selection of high-quality lithium batteries, charges, and accessories. All our products are built with safety and performance in mind.",
    },
    bannerImage: {
      label: "Plushbike banner (desktop)",
      value: "wp/2025/09/life-can-be-easier-banner.webp",
      kind: "image",
    },
    bannerImageMobile: {
      label: "Plushbike banner (mobile)",
      value: "wp/2025/09/life-can-be-easier-banner-mobile.webp",
      kind: "image",
    },
    bannerUrl: { label: "Plushbike banner link", value: "/product/plushbike/" },
    faqHeading: { label: "FAQs heading", value: "FAQs" },
    faqs: {
      label:
        "FAQs (a question line, then its answer line; leave a blank line between FAQs)",
      value: [
        "How long does it take to build a custom battery?",
        "Most builds take 1-3 weeks, depending on complexity and component availability.",
        "",
        "Do you offer warranties?",
        "Yes, all our batteries come with a warranty that varies by product and application",
        "",
        "Can you repair any lithium battery?",
        "In most cases, yes – but some sealed packs may not be repairable. We’ll assess and advise before starting work.",
        "",
        "Do you ship internationally?",
        "Currently, we mainly serve Malta, but we can arrange shipping on a case-by-case basis.",
        "",
        "Can you waterproof my battery?",
        "Yes – we can build or modify packs with waterproof enclosues for extra protection.",
      ].join("\n"),
    },
    contactHeading: {
      label: "Contact heading",
      value: "Let’s power your next project",
    },
    contactText: {
      label: "Contact text",
      value:
        "We’d love to hear from you. Whether you need a quote, a repair, or advice on your next project, our team is ready to help",
    },
    contactPhone: { label: "Phone", value: "+356 77950536" },
    contactEmail: { label: "Email", value: "info@batteryfactory.mt" },
    contactAddress: {
      label: "Address",
      value: "Battery Factory\nB13b, Bulebel Industrial Estate\nZejtun ZTN3000",
    },
    contactHours: {
      label: "Business hours (Day | Hours, one per line)",
      value: [
        "Monday | 9AM – 5PM",
        "Tuesday | 9AM – 5PM",
        "Wednesday | 9AM – 5PM",
        "Thursday | 11AM – 7PM",
        "Friday | 9AM – 5PM",
      ].join("\n"),
    },
  },
  "shop-batteries-and-accessories": {
    heading: { label: "Heading", value: "Shop batteries & accessories" },
  },
};
