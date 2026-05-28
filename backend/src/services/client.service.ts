import prisma from "../prisma";

export const clientService = {
  async createClient(data: {
    nombre: string;
    apellido: string;
    dni: string;
    category: "Mayorista" | "Cliente";
    telefono?: string | null;
    gmail?: string | null;
    creditLimit?: number | null;
    isAccountEnabled?: boolean;
  }) {
    return prisma.client.create({
      data: {
        nombre: data.nombre,
        apellido: data.apellido,
        dni: data.dni,
        category: data.category,
        telefono: data.telefono ?? null,
        gmail: data.gmail ?? null,
        creditLimit: data.creditLimit ?? null,
        isAccountEnabled: data.isAccountEnabled ?? true,
      },
    });
  },

  async getClients() {
    return prisma.client.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            sales: true,
            accountMovements: true,
          },
        },
      },
    });
  },

  async getClientById(id: string) {
    return prisma.client.findUnique({
      where: { id },
      include: {
        sales: {
          orderBy: { createdAt: "desc" },
          include: {
            payments: true,
            items: {
              include: { product: true },
            },
          },
        },
        accountMovements: {
          orderBy: { date: "desc" },
          include: {
            sale: {
              select: { id: true, total: true, status: true, createdAt: true },
            },
          },
        },
      },
    });
  },

  async updateClient(
    id: string,
    data: Partial<{
      nombre: string;
      apellido: string;
      dni: string;
      telefono: string | null;
      gmail: string | null;
      category: "Mayorista" | "Cliente";
      creditLimit: number | null;
      isAccountEnabled: boolean;
    }>
  ) {
    const cleanData: any = {};

    if (data.nombre !== undefined) cleanData.nombre = data.nombre;
    if (data.apellido !== undefined) cleanData.apellido = data.apellido;
    if (data.dni !== undefined) cleanData.dni = data.dni;
    if (data.telefono !== undefined) cleanData.telefono = data.telefono;
    if (data.gmail !== undefined) cleanData.gmail = data.gmail;
    if (data.category !== undefined) cleanData.category = data.category;
    if (data.creditLimit !== undefined) cleanData.creditLimit = data.creditLimit;
    if (data.isAccountEnabled !== undefined) cleanData.isAccountEnabled = data.isAccountEnabled;

    return prisma.client.update({
      where: { id },
      data: cleanData,
    });
  },

  async deleteClient(id: string) {
    const client = await prisma.client.findUnique({
      where: { id },
      select: {
        id: true,
        currentBalance: true,
        _count: { select: { sales: true, accountMovements: true } },
      },
    });

    if (!client) throw new Error("Cliente no encontrado");

    if (client.currentBalance > 0) {
      throw new Error("No se puede eliminar un cliente con saldo deudor");
    }

    if (client._count.sales > 0 || client._count.accountMovements > 0) {
      throw new Error("No se puede eliminar un cliente con historial de ventas o cuenta corriente");
    }

    return prisma.client.delete({ where: { id } });
  },
};
