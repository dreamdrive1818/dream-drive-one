import "dotenv/config";
import { PrismaClient, RentalType, RoleName } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const roles: RoleName[] = [
    "CUSTOMER",
    "SUPPORT",
    "SALES",
    "FLEET_OPS",
    "FINANCE",
    "BRANCH_MANAGER",
    "CITY_MANAGER",
    "SUPER_ADMIN",
  ];
  for (const name of roles) {
    await prisma.role.upsert({ where: { name }, update: {}, create: { name } });
  }

  await prisma.catalogSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default", bufferHours: 3, maxRentalDays: 30 },
  });

  const pune = await prisma.city.upsert({
    where: { slug: "pune" },
    update: {},
    create: { name: "Pune", slug: "pune", state: "Maharashtra", active: true },
  });
  const mumbai = await prisma.city.upsert({
    where: { slug: "mumbai" },
    update: {},
    create: { name: "Mumbai", slug: "mumbai", state: "Maharashtra", active: true },
  });

  const puneHq = await prisma.branch.upsert({
    where: { id: "seed-pune-hq" },
    update: {},
    create: {
      id: "seed-pune-hq",
      cityId: pune.id,
      name: "Pune HQ",
      address: "Baner, Pune",
    },
  });
  const mumbaiHq = await prisma.branch.upsert({
    where: { id: "seed-mumbai-hq" },
    update: {},
    create: {
      id: "seed-mumbai-hq",
      cityId: mumbai.id,
      name: "Andheri Branch",
      address: "Andheri East, Mumbai",
    },
  });

  async function ensureUser(
    email: string,
    fullName: string,
    role: RoleName,
    cityId?: string
  ) {
    const firebaseUid = `dev:${email}`;
    const roleRow = await prisma.role.findUniqueOrThrow({ where: { name: role } });
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        firebaseUid,
        email,
        status: "ACTIVE",
        profile: { create: { fullName } },
        wallet: { create: { balancePaise: 0 } },
        loyalty: { create: { points: 0 } },
      },
    });
    await prisma.userRole.deleteMany({ where: { userId: user.id } });
    await prisma.userRole.create({ data: { userId: user.id, roleId: roleRow.id } });
    if (role !== "CUSTOMER") {
      await prisma.staffScope.deleteMany({ where: { userId: user.id } });
      const branchScoped = role === "BRANCH_MANAGER" || role === "FLEET_OPS";
      await prisma.staffScope.create({
        data: {
          userId: user.id,
          cityId: cityId ?? pune.id,
          branchId: branchScoped ? puneHq.id : null,
        },
      });
    }
    return user;
  }

  await ensureUser("admin@dreamdrive.test", "Super Admin", "SUPER_ADMIN");
  await ensureUser("fleet@dreamdrive.test", "Fleet Ops", "FLEET_OPS");
  await ensureUser("finance@dreamdrive.test", "Finance", "FINANCE");
  await ensureUser("branch@dreamdrive.test", "Pune Branch Manager", "BRANCH_MANAGER");
  await ensureUser("city@dreamdrive.test", "Pune City Manager", "CITY_MANAGER");
  const customer = await ensureUser("customer@dreamdrive.test", "Demo Customer", "CUSTOMER");
  await prisma.user.update({
    where: { id: customer.id },
    data: { phone: "9876543210" },
  }).catch(() => undefined);

  const cars = [
    { slug: "swift", name: "Maruti Swift", type: "hatchback", seats: 5, fuel: "petrol", transmission: "manual", daily: 180000, deposit: 500000 },
    { slug: "nexon", name: "Tata Nexon", type: "suv", seats: 5, fuel: "petrol", transmission: "automatic", daily: 280000, deposit: 800000 },
    { slug: "innova", name: "Toyota Innova Crysta", type: "mpv", seats: 7, fuel: "diesel", transmission: "automatic", daily: 450000, deposit: 1500000 },
    { slug: "thar", name: "Mahindra Thar", type: "suv", seats: 4, fuel: "diesel", transmission: "manual", daily: 400000, deposit: 1500000 },
  ];

  for (const car of cars) {
    const model = await prisma.carModel.upsert({
      where: { slug: car.slug },
      update: { published: true, featured: car.slug !== "thar" },
      create: {
        slug: car.slug,
        name: car.name,
        type: car.type,
        seats: car.seats,
        fuel: car.fuel,
        transmission: car.transmission,
        cityId: pune.id,
        published: true,
        featured: car.slug !== "thar",
        images: {
          create: [
            {
              url: `https://placehold.co/800x500/111/fff?text=${encodeURIComponent(car.name)}`,
              sortOrder: 0,
            },
          ],
        },
      },
    });
    const types: RentalType[] = ["SELF_DRIVE", "WITH_DRIVER_LOCAL", "WITH_DRIVER_INTERCITY"];
    for (const rentalType of types) {
      const existing = await prisma.pricingRule.findFirst({
        where: { carModelId: model.id, rentalType },
      });
      if (!existing) {
        await prisma.pricingRule.create({
          data: {
            carModelId: model.id,
            rentalType,
            dailyPaise: rentalType === "WITH_DRIVER_LOCAL" ? Math.round(car.daily * 1.2) : car.daily,
            hourlyPaise: rentalType === "WITH_DRIVER_LOCAL" ? Math.round(car.daily / 8) : null,
            extraKmPaise: 1200,
            depositPaise: rentalType === "SELF_DRIVE" ? car.deposit : 0,
          },
        });
      }
    }
    const reg = `MH12${car.slug.slice(0, 2).toUpperCase()}1001`;
    const found = await prisma.vehicle.findUnique({ where: { registration: reg } });
    if (!found) {
      await prisma.vehicle.create({
        data: {
          registration: reg,
          carModelId: model.id,
          branchId: puneHq.id,
          year: 2023,
          color: "white",
          odometerKm: 12000,
        },
      });
    }
    const vehicle = await prisma.vehicle.findUnique({ where: { registration: reg } });
    if (vehicle) {
      const docs = [
        { kind: "RC", expiresAt: new Date("2030-12-31T23:59:59.000Z") },
        { kind: "INSURANCE", expiresAt: new Date("2027-12-31T23:59:59.000Z") },
        { kind: "PUC", expiresAt: new Date("2027-06-30T23:59:59.000Z") },
        { kind: "PERMIT", expiresAt: new Date("2028-12-31T23:59:59.000Z") },
      ];
      for (const doc of docs) {
        const exists = await prisma.vehicleDocument.findFirst({
          where: { vehicleId: vehicle.id, kind: doc.kind },
        });
        if (!exists) {
          await prisma.vehicleDocument.create({
            data: {
              vehicleId: vehicle.id,
              kind: doc.kind,
              url: `https://example.invalid/fleet/${reg}-${doc.kind}.pdf`,
              expiresAt: doc.expiresAt,
            },
          });
        }
      }
    }
  }

  await prisma.driver.upsert({
    where: { phone: "9876500001" },
    update: {},
    create: { fullName: "Suresh Patil", phone: "9876500001", branchId: puneHq.id },
  });
  const suresh = await prisma.driver.findUnique({ where: { phone: "9876500001" } });
  if (suresh) {
    const dl = await prisma.driverDocument.findFirst({ where: { driverId: suresh.id, kind: "DL" } });
    if (!dl) {
      await prisma.driverDocument.create({
        data: {
          driverId: suresh.id,
          kind: "DL",
          url: "https://example.invalid/drivers/suresh-dl.pdf",
          expiresAt: new Date("2028-12-31T23:59:59.000Z"),
        },
      });
    }
  }
  await prisma.driver.upsert({
    where: { phone: "9876500002" },
    update: {},
    create: { fullName: "Ramesh Jadhav", phone: "9876500002", branchId: puneHq.id, active: true },
  });

  await prisma.offer.upsert({
    where: { code: "WELCOME10" },
    update: {},
    create: {
      code: "WELCOME10",
      type: "PERCENT",
      value: 10,
      startsAt: new Date("2024-01-01"),
      endsAt: new Date("2027-12-31"),
      maxRedemptions: 1000,
    },
  });

  async function upsertPage(input: {
    slug: string;
    title: string;
    body: string;
    excerpt?: string;
    kind: "LEGAL" | "FAQ" | "LANDING" | "CUSTOM";
    metaTitle: string;
    metaDescription: string;
    sortOrder?: number;
  }) {
    const page = await prisma.cmsPage.upsert({
      where: { slug: input.slug },
      update: {
        title: input.title,
        body: input.body,
        excerpt: input.excerpt,
        kind: input.kind,
        published: true,
        sortOrder: input.sortOrder ?? 0,
      },
      create: {
        slug: input.slug,
        title: input.title,
        body: input.body,
        excerpt: input.excerpt,
        kind: input.kind,
        published: true,
        sortOrder: input.sortOrder ?? 0,
      },
    });
    await prisma.pageMetadata.upsert({
      where: { pageId: page.id },
      update: { title: input.metaTitle, description: input.metaDescription },
      create: {
        pageId: page.id,
        title: input.metaTitle,
        description: input.metaDescription,
      },
    });
    return page;
  }

  await upsertPage({
    slug: "home",
    title: "Dream Drive | Ranchi’s Trusted Self-Drive Car Rentals",
    excerpt: "Book SUVs and hatchbacks with flexible packages and doorstep delivery.",
    kind: "LANDING",
    body: "<p>Welcome to Dream Drive – Ranchi’s top choice for self-drive car rentals.</p>",
    metaTitle: "Dream Drive | Ranchi’s Trusted Self-Drive Car Rentals",
    metaDescription:
      "Welcome to Dream Drive – Ranchi’s top choice for self-drive car rentals. Book SUVs like Nexon & Compass with flexible packages, 24x7 support, and doorstep delivery.",
  });
  await upsertPage({
    slug: "terms",
    title: "Terms and Conditions",
    excerpt: "Standard Dream-Drive hire terms.",
    kind: "LEGAL",
    body: `<h2>1. General Terms</h2>
<p>This agreement is made between Dream Drive and the Customer renting the vehicle.</p>
<h2>2. Vehicle Usage</h2>
<ul>
<li>Only verified drivers are permitted to operate the vehicle.</li>
<li>A valid driving licence is mandatory.</li>
<li>GPS tracking is mandatory; tampering is considered theft.</li>
</ul>
<h2>3. Return of Vehicle</h2>
<p>The vehicle must be returned in clean and proper condition.</p>`,
    metaTitle: "Terms and Conditions | Dream Drive",
    metaDescription: "Hire terms for Dream Drive self-drive and chauffeur car rentals in Ranchi.",
    sortOrder: 1,
  });
  await upsertPage({
    slug: "privacy",
    title: "Privacy Policy",
    excerpt: "How Dream Drive uses customer data.",
    kind: "LEGAL",
    body: `<p>Dream Drive collects contact details and booking data to fulfil rentals, KYC, and support. We do not sell personal data.</p>
<p>Contact us to request a copy or deletion of your records.</p>`,
    metaTitle: "Privacy Policy | Dream Drive",
    metaDescription: "How Dream Drive collects, uses, and stores customer information.",
    sortOrder: 2,
  });
  await upsertPage({
    slug: "faq",
    title: "Frequently Asked Questions",
    excerpt: "Booking, deposits, KYC, and delivery answers.",
    kind: "FAQ",
    body: `<h2>What documents do I need?</h2>
<p>A valid driving licence, government ID, and a local address proof for self-drive bookings.</p>
<h2>Is there a security deposit?</h2>
<p>Yes, for self-drive trips. The amount depends on the car and is shown before you pay.</p>
<h2>Do you deliver the car?</h2>
<p>Doorstep delivery is available in Ranchi for most bookings.</p>
<h2>Can I book a chauffeur?</h2>
<p>Yes. Choose with-driver local or intercity when you search.</p>`,
    metaTitle: "FAQs | Dream Drive car rentals",
    metaDescription: "Answers about Dream Drive bookings, deposits, KYC, and car delivery in Ranchi.",
    sortOrder: 3,
  });

  await prisma.banner.upsert({
    where: { id: "seed-banner-1" },
    update: {
      title: "Self-drive Ranchi",
      placement: "HERO",
      ctaText: "Browse cars",
      link: "/fleet",
      active: true,
    },
    create: {
      id: "seed-banner-1",
      title: "Self-drive Ranchi",
      body: "Flexible packages, 24×7 support, doorstep delivery.",
      imageUrl: "https://placehold.co/1200x400/0a0/fff?text=Dream-Drive",
      link: "/fleet",
      ctaText: "Browse cars",
      placement: "HERO",
      active: true,
      sortOrder: 0,
    },
  });
  await prisma.banner.upsert({
    where: { id: "seed-banner-strip" },
    update: {
      title: "Monsoon Sale",
      body: "Self-drive deals live now — rain or shine, save on selected cars.",
      ctaText: "Grab Offers",
      link: "/fleet",
      placement: "STRIP",
      active: true,
    },
    create: {
      id: "seed-banner-strip",
      title: "Monsoon Sale",
      body: "Self-drive deals live now — rain or shine, save on selected cars.",
      imageUrl: "https://placehold.co/1200x200/0e7c86/fff?text=Monsoon+Sale",
      link: "/fleet",
      ctaText: "Grab Offers",
      placement: "STRIP",
      active: true,
      sortOrder: 0,
    },
  });
  await prisma.banner.upsert({
    where: { id: "seed-banner-promo" },
    update: {
      title: "Monsoon deals are live",
      placement: "HOME_PROMO",
      active: true,
    },
    create: {
      id: "seed-banner-promo",
      title: "Monsoon deals are live",
      body: "Save on selected self-drive cars this season.",
      imageUrl: "https://placehold.co/800x500/111/fff?text=Monsoon+Deals",
      link: "/fleet",
      ctaText: "See deals",
      placement: "HOME_PROMO",
      active: true,
      sortOrder: 0,
    },
  });

  const guides = await prisma.blogCategory.upsert({
    where: { slug: "guides" },
    update: { name: "Guides" },
    create: {
      slug: "guides",
      name: "Guides",
      description: "Self-drive tips and Ranchi trip ideas.",
      metaTitle: "Car rental guides | Dream Drive",
      metaDescription: "Tips for self-drive trips, KYC, and exploring Ranchi with Dream Drive.",
    },
  });

  await prisma.blogPost.upsert({
    where: { slug: "self-drive-ranchi-checklist" },
    update: { published: true },
    create: {
      slug: "self-drive-ranchi-checklist",
      title: "Self-drive checklist for Ranchi",
      excerpt: "Licence, deposit, fuel, and handover tips before you pick up the car.",
      body: `<h2>Before you book</h2>
<p>Keep a valid driving licence and ID ready. Self-drive bookings need KYC before the car is handed over.</p>
<h2>On pickup</h2>
<p>Photograph the car, note the odometer, and confirm fuel. Call support if anything looks off.</p>`,
      coverUrl: "https://placehold.co/800x500/111/fff?text=Self-drive+checklist",
      author: "Dream Drive",
      published: true,
      publishedAt: new Date("2026-08-01"),
      metaTitle: "Self-drive checklist for Ranchi | Dream Drive",
      metaDescription: "Licence, deposit, fuel, and handover tips before you pick up a Dream Drive car in Ranchi.",
      categoryId: guides.id,
    },
  });
  await prisma.blogPost.upsert({
    where: { slug: "weekend-drives-from-ranchi" },
    update: { published: true },
    create: {
      slug: "weekend-drives-from-ranchi",
      title: "Weekend drives from Ranchi",
      excerpt: "Netarhat, Patratu, and Hundru with a self-drive SUV.",
      body: `<h2>Patratu Valley</h2>
<p>A short scenic drive, ideal for a day trip in a compact SUV.</p>
<h2>Netarhat</h2>
<p>Plan an overnight stay and start early. Book a with-driver option if you prefer not to drive hills at night.</p>`,
      coverUrl: "https://placehold.co/800x500/0e7c86/fff?text=Weekend+drives",
      author: "Dream Drive",
      published: true,
      publishedAt: new Date("2026-08-12"),
      metaTitle: "Weekend drives from Ranchi | Dream Drive",
      metaDescription: "Patratu, Hundru, and Netarhat trip ideas with Dream Drive self-drive cars.",
      categoryId: guides.id,
    },
  });

  await prisma.testimonial.upsert({
    where: { id: "seed-testimonial-1" },
    update: { active: true },
    create: {
      id: "seed-testimonial-1",
      name: "Ankit Sharma",
      body: "Clean Nexon, on-time delivery, and no surprise charges. Will book again.",
      city: "Ranchi",
      rating: 5,
      active: true,
      sortOrder: 0,
    },
  });
  await prisma.testimonial.upsert({
    where: { id: "seed-testimonial-2" },
    update: { active: true },
    create: {
      id: "seed-testimonial-2",
      name: "Priya Das",
      body: "Chauffeur for our Ranchi airport run was punctual and polite.",
      city: "Ranchi",
      rating: 5,
      active: true,
      sortOrder: 1,
    },
  });

  await prisma.notificationTemplate.upsert({
    where: { key: "otp" },
    update: {},
    create: {
      key: "otp",
      channel: "email",
      subject: "Your Dream-Drive OTP",
      body: "Your verification code is {{code}}",
    },
  });
  await prisma.notificationTemplate.upsert({
    where: { key: "booking_confirmed" },
    update: {},
    create: {
      key: "booking_confirmed",
      channel: "email",
      subject: "Booking {{publicId}} confirmed",
      body: "Your Dream-Drive booking {{publicId}} is confirmed.",
    },
  });
  await prisma.notificationTemplate.upsert({
    where: { key: "kyc_decision" },
    update: {},
    create: {
      key: "kyc_decision",
      channel: "email",
      subject: "KYC {{status}}",
      body: "Your Dream Drive KYC is {{status}}. {{notes}}",
    },
  });
  await prisma.notificationTemplate.upsert({
    where: { key: "vehicle_doc_expiry" },
    update: {
      subject: "Fleet document expiring: {{registration}} {{kind}}",
      body: "{{kind}} for {{registration}} ({{model}}) at {{city}} / {{branch}} expires on {{expires}}.",
    },
    create: {
      key: "vehicle_doc_expiry",
      channel: "email",
      subject: "Fleet document expiring: {{registration}} {{kind}}",
      body: "{{kind}} for {{registration}} ({{model}}) at {{city}} / {{branch}} expires on {{expires}}.",
    },
  });

  await prisma.agreementTemplate.upsert({
    where: { id: "seed-agreement" },
    update: {},
    create: {
      id: "seed-agreement",
      name: "Self-drive standard",
      rentalType: "SELF_DRIVE",
      html: `<h1>Dream-Drive Self-Drive Agreement</h1>
<p>Booking {{publicId}}</p>
<p>Hirer: {{customer}}</p>
<p>From {{startsAt}} to {{endsAt}}</p>
<p>Rental INR {{amount}}</p>
<p>The hirer confirms a valid driving licence and agrees to the vehicle condition on handover.</p>`,
    },
  });

  await prisma.cityPairRate.upsert({
    where: { fromCityId_toCityId: { fromCityId: pune.id, toCityId: mumbai.id } },
    update: { oneWayPaise: 350000 },
    create: { fromCityId: pune.id, toCityId: mumbai.id, oneWayPaise: 350000 },
  });

  await prisma.airportTerminal.upsert({
    where: { cityId_code: { cityId: pune.id, code: "PNQ" } },
    update: {},
    create: {
      cityId: pune.id,
      name: "Pune Airport",
      code: "PNQ",
      freeWaitMinutes: 45,
      waitPaisePerMin: 500,
      nightSurchargePaise: 20000,
      nightStartsHour: 22,
      nightEndsHour: 6,
    },
  });
  await prisma.airportTerminal.upsert({
    where: { cityId_code: { cityId: mumbai.id, code: "BOM" } },
    update: {},
    create: {
      cityId: mumbai.id,
      name: "Mumbai CSIA T2",
      code: "BOM",
      freeWaitMinutes: 60,
      waitPaisePerMin: 800,
      nightSurchargePaise: 30000,
      nightStartsHour: 22,
      nightEndsHour: 6,
    },
  });

  const extras = [
    { code: "EXTRA_KM", label: "Extra kilometre", unit: "km", defaultPaise: 1200 },
    { code: "EXTRA_HOUR", label: "Extra hour", unit: "hour", defaultPaise: 25000 },
    { code: "WAIT", label: "Airport wait", unit: "minute", defaultPaise: 500 },
    { code: "NIGHT", label: "Night surcharge", unit: "trip", defaultPaise: 20000 },
    { code: "DRIVER_ALLOWANCE", label: "Driver allowance", unit: "night", defaultPaise: 30000 },
  ];
  for (const extra of extras) {
    await prisma.tripExtra.upsert({
      where: { code: extra.code },
      update: extra,
      create: extra,
    });
  }

  await prisma.tourPackage.upsert({
    where: { slug: "ashtavinayak" },
    update: {
      cityId: pune.id,
      carClass: "suv",
      inclusions: "Driver, tolls, parking. Extra km billed on return.",
      depositPaise: 500000,
    },
    create: {
      slug: "ashtavinayak",
      name: "Ashtavinayak Darshan",
      days: 2,
      pricePaise: 1200000,
      depositPaise: 500000,
      cityId: pune.id,
      carClass: "suv",
      inclusions: "Driver, tolls, parking. Extra km billed on return.",
      published: true,
      daysDetail: {
        create: [
          { dayNumber: 1, title: "Pune to Ozar / Lenyadri", description: "Pickup after breakfast, darshan at Ozar and Lenyadri." },
          { dayNumber: 2, title: "Ranjangaon return", description: "Morning darshan, return to Pune by evening." },
        ],
      },
    },
  });

  await prisma.workshop.upsert({
    where: { id: "seed-pune-workshop" },
    update: { cityId: pune.id, active: true },
    create: {
      id: "seed-pune-workshop",
      name: "Pune HQ workshop",
      address: "Service bay, Baner, Pune",
      phone: "02000000001",
      cityId: pune.id,
      active: true,
    },
  });
  await prisma.workshop.upsert({
    where: { id: "seed-mumbai-workshop" },
    update: { cityId: mumbai.id, active: true },
    create: {
      id: "seed-mumbai-workshop",
      name: "Andheri workshop",
      address: "Service bay, Andheri East, Mumbai",
      phone: "02200000001",
      cityId: mumbai.id,
      active: true,
    },
  });

  console.log("Seed complete. Dev logins:");
  console.log("  Bearer dev:admin@dreamdrive.test");
  console.log("  Bearer dev:customer@dreamdrive.test");
  console.log("Cities", pune.slug, mumbai.slug, "branches", puneHq.name, mumbaiHq.name);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
