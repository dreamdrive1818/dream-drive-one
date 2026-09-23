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

  await prisma.invoiceSeries.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      prefix: "DD/FY2627/",
      fyLabel: "FY2627",
      nextNumber: 1,
    },
  });

  // Operating cities only — public /v1/public/cities filters active: true
  const ranchi = await prisma.city.upsert({
    where: { slug: "ranchi" },
    update: { name: "Ranchi", state: "Jharkhand", active: true },
    create: { name: "Ranchi", slug: "ranchi", state: "Jharkhand", active: true },
  });
  const jamshedpur = await prisma.city.upsert({
    where: { slug: "jamshedpur" },
    update: { name: "Jamshedpur", state: "Jharkhand", active: true },
    create: { name: "Jamshedpur", slug: "jamshedpur", state: "Jharkhand", active: true },
  });
  const kolkata = await prisma.city.upsert({
    where: { slug: "kolkata" },
    update: { name: "Kolkata", state: "West Bengal", active: true },
    create: { name: "Kolkata", slug: "kolkata", state: "West Bengal", active: true },
  });

  // Legacy seed cities — keep rows for FK stability, hide from public dropdown
  const pune = await prisma.city.upsert({
    where: { slug: "pune" },
    update: { active: false },
    create: { name: "Pune", slug: "pune", state: "Maharashtra", active: false },
  });
  const mumbai = await prisma.city.upsert({
    where: { slug: "mumbai" },
    update: { active: false },
    create: { name: "Mumbai", slug: "mumbai", state: "Maharashtra", active: false },
  });
  await prisma.city.updateMany({
    where: { slug: { notIn: ["ranchi", "jamshedpur", "kolkata"] } },
    data: { active: false },
  });

  const ranchiHq = await prisma.branch.upsert({
    where: { id: "seed-ranchi-hq" },
    update: { cityId: ranchi.id, name: "Ranchi HQ", address: "Main Road, Ranchi", active: true },
    create: {
      id: "seed-ranchi-hq",
      cityId: ranchi.id,
      name: "Ranchi HQ",
      address: "Main Road, Ranchi",
    },
  });
  const jamshedpurHq = await prisma.branch.upsert({
    where: { id: "seed-jamshedpur-hq" },
    update: { cityId: jamshedpur.id, name: "Jamshedpur Branch", address: "Bistupur, Jamshedpur", active: true },
    create: {
      id: "seed-jamshedpur-hq",
      cityId: jamshedpur.id,
      name: "Jamshedpur Branch",
      address: "Bistupur, Jamshedpur",
    },
  });
  const kolkataHq = await prisma.branch.upsert({
    where: { id: "seed-kolkata-hq" },
    update: { cityId: kolkata.id, name: "Kolkata Branch", address: "Park Street, Kolkata", active: true },
    create: {
      id: "seed-kolkata-hq",
      cityId: kolkata.id,
      name: "Kolkata Branch",
      address: "Park Street, Kolkata",
    },
  });

  const puneHq = await prisma.branch.upsert({
    where: { id: "seed-pune-hq" },
    update: { active: false },
    create: {
      id: "seed-pune-hq",
      cityId: pune.id,
      name: "Pune HQ",
      address: "Baner, Pune",
      active: false,
    },
  });
  const mumbaiHq = await prisma.branch.upsert({
    where: { id: "seed-mumbai-hq" },
    update: { active: false },
    create: {
      id: "seed-mumbai-hq",
      cityId: mumbai.id,
      name: "Andheri Branch",
      address: "Andheri East, Mumbai",
      active: false,
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
          cityId: cityId ?? ranchi.id,
          branchId: branchScoped ? ranchiHq.id : null,
        },
      });
    }
    return user;
  }

  await ensureUser("admin@dreamdrive.test", "Super Admin", "SUPER_ADMIN");
  await ensureUser("fleet@dreamdrive.test", "Fleet Ops", "FLEET_OPS");
  await ensureUser("finance@dreamdrive.test", "Finance", "FINANCE");
  await ensureUser("branch@dreamdrive.test", "Ranchi Branch Manager", "BRANCH_MANAGER");
  await ensureUser("city@dreamdrive.test", "Ranchi City Manager", "CITY_MANAGER");
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

  const cityFleets = [
    { city: ranchi, branch: ranchiHq, rto: "JH01", slugSuffix: "" },
    { city: jamshedpur, branch: jamshedpurHq, rto: "JH05", slugSuffix: "-jamshedpur" },
    { city: kolkata, branch: kolkataHq, rto: "WB06", slugSuffix: "-kolkata" },
  ];

  const seededVehicles: { id: string; citySlug: string; carSlug: string; registration: string }[] = [];

  for (const fleet of cityFleets) {
    for (const [index, car] of cars.entries()) {
      const modelSlug = `${car.slug}${fleet.slugSuffix}`;
      const model = await prisma.carModel.upsert({
        where: { slug: modelSlug },
        update: {
          published: true,
          featured: car.slug !== "thar",
          cityId: fleet.city.id,
          name: car.name,
          type: car.type,
          seats: car.seats,
          fuel: car.fuel,
          transmission: car.transmission,
        },
        create: {
          slug: modelSlug,
          name: car.name,
          type: car.type,
          seats: car.seats,
          fuel: car.fuel,
          transmission: car.transmission,
          cityId: fleet.city.id,
          published: true,
          featured: car.slug !== "thar",
          displayOrder: index + 1,
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
              under12Paise: Math.round(
                (rentalType === "WITH_DRIVER_LOCAL" ? car.daily * 1.2 : car.daily) * 0.55
              ),
              hourlyPaise: rentalType === "WITH_DRIVER_LOCAL" ? Math.round(car.daily / 8) : null,
              extraKmPaise: 1200,
              depositPaise: rentalType === "SELF_DRIVE" ? car.deposit : 0,
            },
          });
        } else if (existing.under12Paise == null) {
          await prisma.pricingRule.update({
            where: { id: existing.id },
            data: {
              under12Paise: Math.round(existing.dailyPaise * 0.55),
            },
          });
        }
      }

      const reg = `${fleet.rto}${car.slug.slice(0, 2).toUpperCase()}1001`;
      let vehicle = await prisma.vehicle.findUnique({ where: { registration: reg } });
      if (!vehicle) {
        vehicle = await prisma.vehicle.create({
          data: {
            registration: reg,
            carModelId: model.id,
            branchId: fleet.branch.id,
            year: 2023 + (index % 2),
            color: index % 2 === 0 ? "white" : "silver",
            odometerKm: 8000 + index * 1500,
            status: "AVAILABLE",
          },
        });
      } else {
        vehicle = await prisma.vehicle.update({
          where: { id: vehicle.id },
          data: {
            carModelId: model.id,
            branchId: fleet.branch.id,
            status: vehicle.status === "SOLD" ? "AVAILABLE" : vehicle.status,
          },
        });
      }
      seededVehicles.push({
        id: vehicle.id,
        citySlug: fleet.city.slug,
        carSlug: car.slug,
        registration: reg,
      });

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

  // Demo calendar: one blocked vehicle + a few date blocks (available / unavailable / blocked)
  const ranchiThar = seededVehicles.find((v) => v.citySlug === "ranchi" && v.carSlug === "thar");
  if (ranchiThar) {
    await prisma.vehicle.update({
      where: { id: ranchiThar.id },
      data: { status: "BLOCKED" },
    });
  }
  const ranchiSwift = seededVehicles.find((v) => v.citySlug === "ranchi" && v.carSlug === "swift");
  const jsrNexon = seededVehicles.find((v) => v.citySlug === "jamshedpur" && v.carSlug === "nexon");
  const kolInnova = seededVehicles.find((v) => v.citySlug === "kolkata" && v.carSlug === "innova");
  const now = new Date();
  const dayUtc = (offsetDays: number, hour = 0) =>
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offsetDays, hour, 0, 0));
  const demoBlocks = [
    ranchiSwift && {
      vehicleId: ranchiSwift.id,
      startsAt: dayUtc(3, 0),
      endsAt: dayUtc(5, 0),
      reason: "MANUAL:service",
    },
    jsrNexon && {
      vehicleId: jsrNexon.id,
      startsAt: dayUtc(7, 0),
      endsAt: dayUtc(9, 0),
      reason: "MANUAL:partner-hold",
    },
    kolInnova && {
      vehicleId: kolInnova.id,
      startsAt: dayUtc(10, 0),
      endsAt: dayUtc(12, 0),
      reason: "MANUAL:maintenance",
    },
  ].filter(Boolean) as { vehicleId: string; startsAt: Date; endsAt: Date; reason: string }[];
  for (const block of demoBlocks) {
    const exists = await prisma.availabilityBlock.findFirst({
      where: {
        vehicleId: block.vehicleId,
        reason: block.reason,
        startsAt: block.startsAt,
        endsAt: block.endsAt,
      },
    });
    if (!exists) {
      await prisma.availabilityBlock.create({ data: block });
    }
  }

  await prisma.driver.upsert({
    where: { phone: "9876500001" },
    update: { branchId: ranchiHq.id },
    create: { fullName: "Suresh Patil", phone: "9876500001", branchId: ranchiHq.id },
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
    update: { branchId: ranchiHq.id },
    create: { fullName: "Ramesh Jadhav", phone: "9876500002", branchId: ranchiHq.id, active: true },
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

  const { NOTIFICATION_TEMPLATES } = await import("./notification-templates");
  for (const tpl of NOTIFICATION_TEMPLATES) {
    await prisma.notificationTemplate.upsert({
      where: { key: tpl.key },
      update: { channel: tpl.channel, subject: tpl.subject, body: tpl.body },
      create: tpl,
    });
  }

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
    where: { fromCityId_toCityId: { fromCityId: ranchi.id, toCityId: jamshedpur.id } },
    update: { oneWayPaise: 250000 },
    create: { fromCityId: ranchi.id, toCityId: jamshedpur.id, oneWayPaise: 250000 },
  });
  await prisma.cityPairRate.upsert({
    where: { fromCityId_toCityId: { fromCityId: ranchi.id, toCityId: kolkata.id } },
    update: { oneWayPaise: 450000 },
    create: { fromCityId: ranchi.id, toCityId: kolkata.id, oneWayPaise: 450000 },
  });

  await prisma.airportTerminal.upsert({
    where: { cityId_code: { cityId: ranchi.id, code: "IXR" } },
    update: { active: true },
    create: {
      cityId: ranchi.id,
      name: "Birsa Munda Airport",
      code: "IXR",
      freeWaitMinutes: 45,
      waitPaisePerMin: 500,
      nightSurchargePaise: 20000,
      nightStartsHour: 22,
      nightEndsHour: 6,
    },
  });
  await prisma.airportTerminal.upsert({
    where: { cityId_code: { cityId: kolkata.id, code: "CCU" } },
    update: { active: true },
    create: {
      cityId: kolkata.id,
      name: "Netaji Subhas Chandra Bose Intl",
      code: "CCU",
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
      cityId: ranchi.id,
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
      cityId: ranchi.id,
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
    where: { id: "seed-ranchi-workshop" },
    update: { cityId: ranchi.id, active: true },
    create: {
      id: "seed-ranchi-workshop",
      name: "Ranchi HQ workshop",
      address: "Service bay, Main Road, Ranchi",
      phone: "06510000001",
      cityId: ranchi.id,
      active: true,
    },
  });
  await prisma.workshop.upsert({
    where: { id: "seed-kolkata-workshop" },
    update: { cityId: kolkata.id, active: true },
    create: {
      id: "seed-kolkata-workshop",
      name: "Kolkata workshop",
      address: "Service bay, Park Street, Kolkata",
      phone: "03300000001",
      cityId: kolkata.id,
      active: true,
    },
  });
  await prisma.workshop.updateMany({
    where: { id: { in: ["seed-pune-workshop", "seed-mumbai-workshop"] } },
    data: { active: false },
  });

  // Move any leftover seed fleet off inactive Pune/Mumbai branches
  await prisma.vehicle.updateMany({
    where: { branchId: { in: [puneHq.id, mumbaiHq.id] } },
    data: { branchId: ranchiHq.id },
  });
  await prisma.carModel.updateMany({
    where: { cityId: { in: [pune.id, mumbai.id] } },
    data: { cityId: ranchi.id },
  });

  // Retire legacy Maharashtra plate demo units (pre-city-split seed)
  await prisma.vehicle.updateMany({
    where: {
      OR: [
        { registration: { startsWith: "MH12" } },
        { registration: { startsWith: "MH02" } },
        { registration: { startsWith: "MH01" } },
      ],
    },
    data: { status: "SOLD" },
  });

  console.log("Seed complete. Dev logins:");
  console.log("  Bearer dev:admin@dreamdrive.test");
  console.log("  Bearer dev:customer@dreamdrive.test");
  console.log(
    "Cities",
    ranchi.slug,
    jamshedpur.slug,
    kolkata.slug,
    "— cars seeded per city:",
    cars.map((c) => c.slug).join(", ")
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
