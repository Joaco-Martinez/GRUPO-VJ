import prisma from "../prisma";

function cleanString(value?: string | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

type ProviderInput = {
  razonSocial?: string | null;
  nombreFantasia?: string | null;
  cuit?: string | null;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
  contactoNombre?: string | null;
  notas?: string | null;
};

function buildProviderData(data: ProviderInput) {
  const cleanData: any = {};

  if (data.razonSocial !== undefined) cleanData.razonSocial = cleanString(data.razonSocial);
  if (data.nombreFantasia !== undefined) cleanData.nombreFantasia = cleanString(data.nombreFantasia);
  if (data.cuit !== undefined) cleanData.cuit = cleanString(data.cuit);
  if (data.telefono !== undefined) cleanData.telefono = cleanString(data.telefono);
  if (data.email !== undefined) cleanData.email = cleanString(data.email);
  if (data.direccion !== undefined) cleanData.direccion = cleanString(data.direccion);
  if (data.contactoNombre !== undefined) cleanData.contactoNombre = cleanString(data.contactoNombre);
  if (data.notas !== undefined) cleanData.notas = cleanString(data.notas);

  return cleanData;
}

export const providerService = {
  async getAll(options?: { includeInactive?: boolean }) {
    const where = options?.includeInactive ? {} : { isActive: true };

    return prisma.provider.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { purchases: true } },
      },
    });
  },

  async getById(id: string) {
    return prisma.provider.findUnique({
      where: { id },
      include: {
        purchases: {
          orderBy: { date: "desc" },
          take: 50,
        },
        _count: { select: { purchases: true } },
      },
    });
  },

  async create(data: ProviderInput) {
    return prisma.provider.create({
      data: buildProviderData(data),
    });
  },

  async update(id: string, data: ProviderInput) {
    const existing = await prisma.provider.findUnique({ where: { id } });
    if (!existing) throw new Error("Proveedor no encontrado");

    return prisma.provider.update({
      where: { id },
      data: buildProviderData(data),
    });
  },

  async remove(id: string) {
    const provider = await prisma.provider.findUnique({
      where: { id },
      select: { id: true, _count: { select: { purchases: true } } },
    });

    if (!provider) throw new Error("Proveedor no encontrado");

    if (provider._count.purchases > 0) {
      throw new Error("No se puede eliminar un proveedor con compras asociadas");
    }

    return prisma.provider.delete({ where: { id } });
  },

  async deactivate(id: string) {
    const existing = await prisma.provider.findUnique({ where: { id } });
    if (!existing) throw new Error("Proveedor no encontrado");
    if (!existing.isActive) throw new Error("El proveedor ya está desactivado");

    return prisma.provider.update({
      where: { id },
      data: { isActive: false },
    });
  },

  async activate(id: string) {
    const existing = await prisma.provider.findUnique({ where: { id } });
    if (!existing) throw new Error("Proveedor no encontrado");
    if (existing.isActive) throw new Error("El proveedor ya está activo");

    return prisma.provider.update({
      where: { id },
      data: { isActive: true },
    });
  },
};
