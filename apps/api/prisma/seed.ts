import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

// Load apps/api/.env when running locally; ignored when absent (Docker sets the variables directly).
try {
  process.loadEnvFile(fileURLToPath(new URL("../.env", import.meta.url)));
} catch {
  // rely on the process environment
}

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.greeting.count();
  if (count > 0) {
    console.log(`Database already seeded (${count} greetings). Skipping.`);
    return;
  }

  await prisma.greeting.createMany({
    data: [
      { message: "Hello, World!" },
      { message: "Hello from SQLite via Prisma" },
      { message: "Hello from the GraphQL API" },
    ],
  });

  await prisma.savedView.createMany({
    data: [
      {
        name: "South Asia population in 2000",
        indicator: "SP.POP.TOTL",
        year: 2000,
        countries: "IND,PAK,BGD,LKA,NPL",
        order: "DESC",
        region: "South Asia",
      },
      {
        name: "Lowest life expectancy, Sub-Saharan Africa",
        indicator: "SP.DYN.LE00.IN",
        countries: "NGA,ETH,KEN,ZAF,COD",
        order: "ASC",
        region: "Sub-Saharan Africa",
      },
      {
        name: "G7 GDP per capita",
        indicator: "NY.GDP.PCAP.CD",
        countries: "CAN,FRA,DEU,ITA,JPN,GBR,USA",
        order: "DESC",
      },
    ],
  });

  console.log("Seeded 3 greetings and 3 saved views.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
