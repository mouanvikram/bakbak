import "dotenv/config";
import { prisma } from "@sealchat/db";

async function main() {
  const users = await prisma.user.create({
    data: {
      email: "vikram@example.com",
      username: "vikram",
      passwordHash: "abcd",
      isEmailVerified: false,
    },
  });
}

main()
  .catch((e) => {
    console.log(e);
  })
  .finally(() => {
    return prisma.$disconnect();
  });
