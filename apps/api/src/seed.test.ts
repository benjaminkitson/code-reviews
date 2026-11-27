import { execSync } from "node:child_process";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "./db.js";

function runSeed() {
  execSync("npx tsx prisma/seed.ts");
}

beforeEach(async () => {
  await prisma.savedView.deleteMany();
  await prisma.greeting.deleteMany();
});

describe("seeding", () => {
  describe("when the database is EMPTY", () => {
    beforeEach(() => {
      runSeed();
    });

    it("adds three example views", async () => {
      expect(await prisma.savedView.count()).toBe(3);
    });
  });

  describe("when greetings ALREADY EXIST but there are no views", () => {
    beforeEach(async () => {
      await prisma.greeting.create({ data: { message: "Hello" } });
      runSeed();
    });

    it("adds NO example views", async () => {
      expect(await prisma.savedView.count()).toBe(0);
    });

    it("keeps the one existing greeting", async () => {
      expect(await prisma.greeting.count()).toBe(1);
    });
  });

  describe("when the seed runs TWICE", () => {
    beforeEach(() => {
      runSeed();
      runSeed();
    }, 30_000);

    it("keeps three example views", async () => {
      expect(await prisma.savedView.count()).toBe(3);
    });
  });
});
