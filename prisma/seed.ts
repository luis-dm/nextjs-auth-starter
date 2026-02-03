import { PrismaClient } from "./generated/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Create 5 users with hashed passwords
  const users = await Promise.all([
    prisma.user.create({
      data: {
        email: "alice@example.com",
        name: "Alice",
        password: await bcrypt.hash("password123", 10),
      },
    }),
    prisma.user.create({
      data: {
        email: "bob@example.com",
        name: "Bob",
        password: await bcrypt.hash("password123", 10),
      },
    }),
    prisma.user.create({
      data: {
        email: "charlie@example.com",
        name: "Charlie",
        password: await bcrypt.hash("password123", 10),
      },
    }),
    prisma.user.create({
      data: {
        email: "diana@example.com",
        name: "Diana",
        password: await bcrypt.hash("password123", 10),
      },
    }),
    prisma.user.create({
      data: {
        email: "edward@example.com",
        name: "Edward",
        password: await bcrypt.hash("password123", 10),
      },
    }),
  ]);

  const userIdMapping = {
    alice: users[0].id,
    bob: users[1].id,
    charlie: users[2].id,
    diana: users[3].id,
    edward: users[4].id,
  };

  console.log("Seeding completed.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
