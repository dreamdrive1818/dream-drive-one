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
      await prisma.staffScope.create({
        data: { userId: user.id, cityId: cityId ?? pune.id, branchId: puneHq.id },
      });
    }
    return user;
  }

  await ensureUser("admin@dreamdrive.test", "Super Admin", "SUPER_ADMIN");
  await ensureUser("fleet@dreamdrive.test", "Fleet Ops", "FLEET_OPS");
  await ensureUser("finance@dreamdrive.test", "Finance", "FINANCE");
  await ensureUser("customer@dreamdrive.test", "Demo Customer", "CUSTOMER");

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
  }

  await prisma.driver.upsert({
    where: { phone: "9876500001" },
    update: {},
    create: { fullName: "Suresh Patil", phone: "9876500001", branchId: puneHq.id },
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

  await prisma.cmsPage.upsert({
    where: { slug: "terms" },
    update: {},
    create: {
      slug: "terms",
      title: "Terms and Conditions",
      body: "<p>Standard Dream-Drive hire terms.</p>",
      published: true,
    },
  });
  await prisma.banner.upsert({
    where: { id: "seed-banner-1" },
    update: {},
    create: {
      id: "seed-banner-1",
      title: "Self-drive Pune",
      imageUrl: "https://placehold.co/1200x400/0a0/fff?text=Dream-Drive",
      link: "/cars",
      active: true,
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

  await prisma.tourPackage.upsert({
    where: { slug: "ashtavinayak" },
    update: {},
    create: {
      slug: "ashtavinayak",
      name: "Ashtavinayak Darshan",
      days: 2,
      pricePaise: 1200000,
      published: true,
      daysDetail: {
        create: [
          { dayNumber: 1, title: "Pune to Ozar / Lenyadri" },
          { dayNumber: 2, title: "Ranjangaon return" },
        ],
      },
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
