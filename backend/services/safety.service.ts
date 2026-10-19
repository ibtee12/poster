import { prisma } from "../db/prisma";

export async function getBlocklist() {
  const list = await prisma.blocklistWord.findMany({
    orderBy: { word: "asc" },
    select: { id: true, word: true, category: true, createdAt: true },
  });

  return {
    words: list.map((item) => item.word),
    items: list,
  };
}

export async function addBlocklistWord(word: string, category = "misuse") {
  const cleanWord = word.trim().toLowerCase();

  return await prisma.blocklistWord.upsert({
    where: { word: cleanWord },
    update: { category },
    create: { word: cleanWord, category },
  });
}

export async function deleteBlocklistWord(word: string) {
  const cleanWord = word.trim().toLowerCase();

  return await prisma.blocklistWord.deleteMany({
    where: { word: cleanWord },
  });
}
