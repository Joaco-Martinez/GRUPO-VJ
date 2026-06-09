import prisma from "../prisma";
import bcrypt from "bcryptjs";
import { CategoryClient, Role } from "@prisma/client";

type ClientCategory = "Price" | "Cliente" | "Mayorista";

function normalizeCategory(value?: string | null): CategoryClient {
  if (value === "Mayorista") return CategoryClient.Mayorista;

  // Si llega "Cliente" desde algún frontend viejo, ahora lo tratamos como minorista.
  return CategoryClient.Price;
}

function cleanEmail(value?: string | null) {
  const email = String(value || "").trim().toLowerCase();
  return email || null;
}

function cleanString(value?: string | null) {
  const text = String(value || "").trim();
  return text || null;
}

type ClientAddressData = {
  addressStreet?: string | null;
  addressNumber?: string | null;
  addressFloor?: string | null;
  addressApartment?: string | null;
  addressCity?: string | null;
  addressProvince?: string | null;
  addressPostalCode?: string | null;
  addressNotes?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

function buildAddressData(data: ClientAddressData) {
  const cleanData: any = {};

  if (data.addressStreet !== undefined) {
    cleanData.addressStreet = cleanString(data.addressStreet);
  }

  if (data.addressNumber !== undefined) {
    cleanData.addressNumber = cleanString(data.addressNumber);
  }

  if (data.addressFloor !== undefined) {
    cleanData.addressFloor = cleanString(data.addressFloor);
  }

  if (data.addressApartment !== undefined) {
    cleanData.addressApartment = cleanString(data.addressApartment);
  }

  if (data.addressCity !== undefined) {
    cleanData.addressCity = cleanString(data.addressCity);
  }

  if (data.addressProvince !== undefined) {
    cleanData.addressProvince = cleanString(data.addressProvince);
  }

  if (data.addressPostalCode !== undefined) {
    cleanData.addressPostalCode = cleanString(data.addressPostalCode);
  }

  if (data.addressNotes !== undefined) {
    cleanData.addressNotes = cleanString(data.addressNotes);
  }

  if (data.latitude !== undefined) {
    cleanData.latitude = data.latitude ?? null;
  }

  if (data.longitude !== undefined) {
    cleanData.longitude = data.longitude ?? null;
  }

  return cleanData;
}

export const clientService = {
  async createClient(data: {
    nombre: string;
    apellido: string;
    dni: string;
    category?: ClientCategory;
    telefono?: string | null;
    gmail?: string | null;
    creditLimit?: number | null;
    isAccountEnabled?: boolean;

    addressStreet?: string | null;
    addressNumber?: string | null;
    addressFloor?: string | null;
    addressApartment?: string | null;
    addressCity?: string | null;
    addressProvince?: string | null;
    addressPostalCode?: string | null;
    addressNotes?: string | null;
    latitude?: number | null;
    longitude?: number | null;

    createUser?: boolean;
    password?: string;
  }) {
    const nombre = String(data.nombre || "").trim();
    const apellido = String(data.apellido || "").trim();
    const dni = String(data.dni || "").trim();
    const gmail = cleanEmail(data.gmail);

    if (!nombre) throw new Error("El nombre es obligatorio");
    if (!apellido) throw new Error("El apellido es obligatorio");
    if (!dni) throw new Error("El DNI/CUIT es obligatorio");

    if (data.createUser && !gmail) {
      throw new Error("Para crear login, el email es obligatorio");
    }

    if (data.createUser && (!data.password || data.password.length < 6)) {
      throw new Error("La contraseña debe tener al menos 6 caracteres");
    }

    const category = normalizeCategory(data.category);
    const addressData = buildAddressData(data);

    return prisma.$transaction(async (tx) => {
      let userId: string | null = null;

      if (data.createUser) {
        const existingUser = await tx.user.findUnique({
          where: { email: gmail! },
        });

        if (existingUser) {
          throw new Error("Ya existe un usuario con ese email");
        }

        const hashedPassword = await bcrypt.hash(data.password!, 10);

        const user = await tx.user.create({
          data: {
            email: gmail!,
            password: hashedPassword,
            name: `${nombre} ${apellido}`.trim(),
            role: Role.CLIENTE,
            isActive: true,
          },
        });

        userId = user.id;
      }

      return tx.client.create({
        data: {
          nombre,
          apellido,
          dni,
          category,
          telefono: data.telefono ?? null,
          gmail,
          creditLimit: data.creditLimit ?? null,
          isAccountEnabled: data.isAccountEnabled ?? false,
          userId,
          ...addressData,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              isActive: true,
            },
          },
          _count: {
            select: {
              sales: true,
              accountMovements: true,
            },
          },
        },
      });
    });
  },

  async getClients() {
    return prisma.client.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
          },
        },
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
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
          },
        },
        sales: {
          orderBy: { createdAt: "desc" },
          include: {
            payments: true,
            businessLocation: true,
            items: {
              include: { product: true },
            },
          },
        },
        accountMovements: {
          orderBy: { date: "desc" },
          include: {
            sale: {
              select: {
                id: true,
                total: true,
                status: true,
                createdAt: true,
              },
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
      category: ClientCategory;
      creditLimit: number | null;
      isAccountEnabled: boolean;

      addressStreet: string | null;
      addressNumber: string | null;
      addressFloor: string | null;
      addressApartment: string | null;
      addressCity: string | null;
      addressProvince: string | null;
      addressPostalCode: string | null;
      addressNotes: string | null;
      latitude: number | null;
      longitude: number | null;

      createUser: boolean;
      password: string;
      unlinkUser: boolean;
    }>
  ) {
    const existing = await prisma.client.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!existing) throw new Error("Cliente no encontrado");

    const cleanData: any = {};

    if (data.nombre !== undefined) cleanData.nombre = String(data.nombre).trim();
    if (data.apellido !== undefined) cleanData.apellido = String(data.apellido).trim();
    if (data.dni !== undefined) cleanData.dni = String(data.dni).trim();
    if (data.telefono !== undefined) cleanData.telefono = cleanString(data.telefono);
    if (data.gmail !== undefined) cleanData.gmail = cleanEmail(data.gmail);
    if (data.category !== undefined) cleanData.category = normalizeCategory(data.category);
    if (data.creditLimit !== undefined) cleanData.creditLimit = data.creditLimit;
    if (data.isAccountEnabled !== undefined) cleanData.isAccountEnabled = data.isAccountEnabled;

    Object.assign(cleanData, buildAddressData(data));

    return prisma.$transaction(async (tx) => {
      if (data.unlinkUser === true && existing.userId) {
        cleanData.userId = null;
      }

      if (data.createUser === true && !existing.userId) {
        const email = cleanEmail(data.gmail ?? existing.gmail);

        if (!email) {
          throw new Error("Para crear login, el email es obligatorio");
        }

        if (!data.password || data.password.length < 6) {
          throw new Error("La contraseña debe tener al menos 6 caracteres");
        }

        const existingUser = await tx.user.findUnique({
          where: { email },
        });

        if (existingUser) {
          throw new Error("Ya existe un usuario con ese email");
        }

        const nombre = cleanData.nombre ?? existing.nombre;
        const apellido = cleanData.apellido ?? existing.apellido;

        const hashedPassword = await bcrypt.hash(data.password, 10);

        const user = await tx.user.create({
          data: {
            email,
            password: hashedPassword,
            name: `${nombre} ${apellido}`.trim(),
            role: Role.CLIENTE,
            isActive: true,
          },
        });

        cleanData.userId = user.id;
        cleanData.gmail = email;
      }

      return tx.client.update({
        where: { id },
        data: cleanData,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              isActive: true,
            },
          },
          _count: {
            select: {
              sales: true,
              accountMovements: true,
            },
          },
        },
      });
    });
  },

  async deleteClient(id: string) {
    const client = await prisma.client.findUnique({
      where: { id },
      select: {
        id: true,
        currentBalance: true,
        userId: true,
        _count: {
          select: {
            sales: true,
            accountMovements: true,
          },
        },
      },
    });

    if (!client) throw new Error("Cliente no encontrado");

    if (client.currentBalance > 0) {
      throw new Error("No se puede eliminar un cliente con saldo deudor");
    }

    if (client._count.sales > 0 || client._count.accountMovements > 0) {
      throw new Error(
        "No se puede eliminar un cliente con historial de ventas o cuenta corriente"
      );
    }

    return prisma.client.delete({ where: { id } });
  },
};