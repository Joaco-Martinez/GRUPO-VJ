import prisma from "../prisma";

export const cbteCounterService = {
  async peekNext(ptoVta: number, cbteTipo: number): Promise<number> {
    const counter = await prisma.cbteCounter.findUnique({
      where: { ptoVta_cbteTipo: { ptoVta, cbteTipo } },
    });

    // Si no existe, el “último” es 0
    const last = counter?.lastNumber ?? 0;
    return last + 1;
  },

  async commitUsed(ptoVta: number, cbteTipo: number, usedNumber: number) {
    await prisma.cbteCounter.upsert({
      where: { ptoVta_cbteTipo: { ptoVta, cbteTipo } },
      create: { ptoVta, cbteTipo, lastNumber: usedNumber },
      update: { lastNumber: usedNumber },
    });
  },
};
