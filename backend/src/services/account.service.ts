import prisma from "../prisma";
import {
  AccountMovementType,
  CategoryFinance,
  FinanceType,
  PaymentMethod,
  SaleStatus,
} from "@prisma/client";
import { ACCOUNT_PAYMENT_MARKER } from "../utils/accountPayment";

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function assertPositiveAmount(amount: number) {
  const value = Number(amount);

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("El monto debe ser mayor a 0");
  }

  return round2(value);
}

export const accountService = {
  async getClientAccount(clientId: string) {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: {
        accountMovements: {
          orderBy: {
            date: "desc",
          },
          include: {
            sale: {
              select: {
                id: true,
                total: true,
                status: true,
                createdAt: true,
              },
            },
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!client) {
      throw new Error("Cliente no encontrado");
    }

    return {
      client: {
        id: client.id,
        nombre: client.nombre,
        apellido: client.apellido,
        dni: client.dni,
        telefono: client.telefono,
        gmail: client.gmail,
        category: client.category,
        currentBalance: client.currentBalance,
        creditLimit: client.creditLimit,
        isAccountEnabled: client.isAccountEnabled,
      },
      balance: client.currentBalance,
      movements: client.accountMovements,
      salesWithDebt: await prisma.sale.findMany({
        where: {
          clientId,
          status: { not: SaleStatus.CANCELLED },
          accountDebtAmount: { gt: 0 },
        },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          createdAt: true,
          status: true,
          total: true,
          accountDebtAmount: true,
        },
      }),
    };
  },

  async getMovements(filters?: {
    clientId?: string;
    type?: AccountMovementType;
    fromDate?: Date;
    toDate?: Date;
  }) {
    const date: any = {};

    if (filters?.fromDate) date.gte = filters.fromDate;
    if (filters?.toDate) date.lte = filters.toDate;

    return prisma.accountMovement.findMany({
      where: {
        clientId: filters?.clientId,
        type: filters?.type,
        ...(Object.keys(date).length > 0 ? { date } : {}),
      },
      include: {
        client: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            dni: true,
            telefono: true,
            gmail: true,
            currentBalance: true,
          },
        },
        sale: {
          select: {
            id: true,
            total: true,
            status: true,
            createdAt: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        date: "desc",
      },
    });
  },

  async getDebtors() {
    return prisma.client.findMany({
      where: {
        currentBalance: {
          gt: 0,
        },
      },
      orderBy: {
        currentBalance: "desc",
      },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        dni: true,
        telefono: true,
        gmail: true,
        category: true,
        currentBalance: true,
        creditLimit: true,
        isAccountEnabled: true,
      },
    });
  },

  async addDebt(data: {
    clientId: string;
    amount: number;
    saleId?: string | null;
    userId?: string | null;
    description?: string | null;
    reference?: string | null;
  }) {
    const amount = assertPositiveAmount(data.amount);

    return prisma.$transaction(async (tx) => {
      const client = await tx.client.findUnique({
        where: {
          id: data.clientId,
        },
        select: {
          id: true,
          currentBalance: true,
          isAccountEnabled: true,
          creditLimit: true,
        },
      });

      if (!client) {
        throw new Error("Cliente no encontrado");
      }

      if (!client.isAccountEnabled) {
        throw new Error("La cuenta corriente de este cliente está deshabilitada");
      }

      const previousBalance = round2(client.currentBalance);
      const newBalance = round2(previousBalance + amount);

      if (
        client.creditLimit !== null &&
        client.creditLimit !== undefined &&
        client.creditLimit > 0 &&
        newBalance > client.creditLimit
      ) {
        throw new Error(
          `La deuda supera el límite de crédito del cliente. Límite: ${client.creditLimit}`
        );
      }

      await tx.client.update({
        where: {
          id: data.clientId,
        },
        data: {
          currentBalance: newBalance,
        },
      });

      return tx.accountMovement.create({
        data: {
          clientId: data.clientId,
          saleId: data.saleId ?? null,
          userId: data.userId ?? null,
          type: AccountMovementType.DEBT,
          amount,
          previousBalance,
          newBalance,
          paymentMethod: null,
          reference: data.reference ?? null,
          description: data.description ?? "Deuda generada por venta",
        },
        include: {
          client: true,
          sale: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
    });
  },

  async registerPayment(data: {
    clientId: string;
    amount: number;
    method: PaymentMethod;
    userId?: string | null;
    reference?: string | null;
    description?: string | null;
    createFinance?: boolean;
    saleId?: string | null;
  }) {
    const amount = assertPositiveAmount(data.amount);

    if (data.method === PaymentMethod.CUENTA_CORRIENTE) {
      throw new Error("Un abono no puede pagarse con CUENTA_CORRIENTE");
    }

    const reference = data.reference?.trim() || null;
    const description = data.description?.trim() || null;

    return prisma.$transaction(async (tx) => {
      const client = await tx.client.findUnique({
        where: {
          id: data.clientId,
        },
        select: {
          id: true,
          nombre: true,
          apellido: true,
          currentBalance: true,
        },
      });

      if (!client) {
        throw new Error("Cliente no encontrado");
      }

      // El abono se aplica a las ventas con deuda del cliente (la elegida
      // primero, después de la más vieja a la más nueva), para que la venta
      // refleje el pago igual que si se hubiera cargado desde el historial.
      const salesWithDebt = await tx.sale.findMany({
        where: {
          clientId: data.clientId,
          status: { not: SaleStatus.CANCELLED },
          accountDebtAmount: { gt: 0 },
        },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          total: true,
          accountDebtAmount: true,
          paymentMethod: true,
          _count: { select: { payments: true } },
        },
      });

      if (data.saleId) {
        const index = salesWithDebt.findIndex((sale) => sale.id === data.saleId);

        if (index === -1) {
          throw new Error("La venta elegida no es de este cliente o no tiene deuda");
        }

        salesWithDebt.unshift(...salesWithDebt.splice(index, 1));
      }

      let remaining = amount;
      let balance = round2(client.currentBalance);
      let firstMovement: any = null;

      const createMovement = async (movementAmount: number, saleId: string | null) => {
        const previousBalance = balance;
        balance = round2(Math.max(previousBalance - movementAmount, 0));

        const movement = await tx.accountMovement.create({
          data: {
            clientId: data.clientId,
            userId: data.userId ?? null,
            saleId,
            type: AccountMovementType.PAYMENT,
            amount: movementAmount,
            previousBalance,
            newBalance: balance,
            paymentMethod: data.method,
            reference,
            description:
              description ??
              (saleId
                ? `Abono de cuenta corriente - venta #${saleId.slice(-8)}`
                : "Abono de cuenta corriente"),
          },
          include: {
            client: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        });

        firstMovement ??= movement;
      };

      for (const sale of salesWithDebt) {
        if (remaining <= 0) break;

        const debt = round2(sale.accountDebtAmount);
        const applied = round2(Math.min(remaining, debt));
        const newDebt = round2(debt - applied);
        const alreadyPaid = round2(Number(sale.total) - debt);

        const paymentsToCreate: any[] = [];

        // Venta sin líneas de pago pero con una parte ya cobrada: se deja
        // explícita esa parte para que al recalcular (total - pagos) la
        // deuda siga dando lo mismo.
        if (
          sale._count.payments === 0 &&
          alreadyPaid > 0 &&
          sale.paymentMethod !== PaymentMethod.CUENTA_CORRIENTE
        ) {
          paymentsToCreate.push({ method: sale.paymentMethod, amount: alreadyPaid });
        }

        paymentsToCreate.push({
          method: data.method,
          amount: applied,
          reference,
          notes: `${ACCOUNT_PAYMENT_MARKER} Abono desde Cuentas Corrientes`,
        });

        await tx.sale.update({
          where: { id: sale.id },
          data: {
            accountDebtAmount: newDebt,
            isAccountSale: newDebt > 0,
            payments: { create: paymentsToCreate },
          },
        });

        await createMovement(applied, sale.id);
        remaining = round2(remaining - applied);
      }

      // Lo que no se aplicó a ninguna venta (deuda cargada por ajuste, o un
      // pago mayor a la deuda de las ventas) baja el saldo igual que antes.
      if (remaining > 0) {
        await createMovement(remaining, null);
      }

      await tx.client.update({
        where: { id: data.clientId },
        data: { currentBalance: balance },
      });

      if (data.createFinance !== false) {
        await tx.finance.create({
          data: {
            type: FinanceType.INGRESO,
            amount,
            category: CategoryFinance.COBRANZA,
            paymentMethod: data.method,
            description:
              description ??
              `Abono cuenta corriente cliente ${client.nombre} ${client.apellido}`,
            date: new Date(),
          },
        });
      }

      return firstMovement;
    });
  },

  async createAdjustment(data: {
    clientId: string;
    type: "POSITIVE" | "NEGATIVE";
    amount: number;
    userId?: string | null;
    reference?: string | null;
    description?: string | null;
  }) {
    const amount = assertPositiveAmount(data.amount);

    return prisma.$transaction(async (tx) => {
      const client = await tx.client.findUnique({
        where: {
          id: data.clientId,
        },
        select: {
          id: true,
          currentBalance: true,
        },
      });

      if (!client) {
        throw new Error("Cliente no encontrado");
      }

      const previousBalance = round2(client.currentBalance);

      const isPositive = data.type === "POSITIVE";
      const newBalance = isPositive
        ? round2(previousBalance + amount)
        : round2(Math.max(previousBalance - amount, 0));

      await tx.client.update({
        where: {
          id: data.clientId,
        },
        data: {
          currentBalance: newBalance,
        },
      });

      return tx.accountMovement.create({
        data: {
          clientId: data.clientId,
          userId: data.userId ?? null,
          saleId: null,
          type: isPositive
            ? AccountMovementType.ADJUSTMENT_POSITIVE
            : AccountMovementType.ADJUSTMENT_NEGATIVE,
          amount,
          previousBalance,
          newBalance,
          paymentMethod: null,
          reference: data.reference ?? null,
          description:
            data.description ??
            (isPositive
              ? "Ajuste positivo de cuenta corriente"
              : "Ajuste negativo de cuenta corriente"),
        },
        include: {
          client: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
    });
  },

  async updateClientAccountConfig(
    clientId: string,
    data: {
      creditLimit?: number | null;
      isAccountEnabled?: boolean;
    }
  ) {
    const client = await prisma.client.findUnique({
      where: {
        id: clientId,
      },
    });

    if (!client) {
      throw new Error("Cliente no encontrado");
    }

    const updateData: any = {};

    if (data.creditLimit !== undefined) {
      updateData.creditLimit =
        data.creditLimit === null ? null : Number(data.creditLimit);
    }

    if (data.isAccountEnabled !== undefined) {
      updateData.isAccountEnabled = data.isAccountEnabled;
    }

    return prisma.client.update({
      where: {
        id: clientId,
      },
      data: updateData,
      select: {
        id: true,
        nombre: true,
        apellido: true,
        dni: true,
        telefono: true,
        gmail: true,
        currentBalance: true,
        creditLimit: true,
        isAccountEnabled: true,
      },
    });
  },
};