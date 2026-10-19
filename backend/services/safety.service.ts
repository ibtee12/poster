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

export async function checkTextAgainstBlocklist(textValues?: Record<string, any>): Promise<void> {
  if (!textValues || typeof textValues !== "object") return;

  const { words } = await getBlocklist();
  if (!words || words.length === 0) return;

  const textToScan: string[] = [];
  for (const val of Object.values(textValues)) {
    if (typeof val === "string") {
      textToScan.push(val.toLowerCase());
    } else if (val && typeof val === "object") {
      for (const nested of Object.values(val)) {
        if (typeof nested === "string") {
          textToScan.push(nested.toLowerCase());
        }
      }
    }
  }

  const combined = textToScan.join(" ");
  for (const blocked of words) {
    const cleanWord = blocked.trim().toLowerCase();
    if (!cleanWord) continue;

    const regex = new RegExp(`\\b${cleanWord}\\b`, "i");
    if (regex.test(combined) || combined.includes(cleanWord)) {
      throw new Error(`Text contains blocked word: "${blocked}"`);
    }
  }
}
