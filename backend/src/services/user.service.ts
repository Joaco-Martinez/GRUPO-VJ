import prisma from "../prisma";
import bcrypt from "bcryptjs";
import { CategoryClient, Role } from "@prisma/client";

type ClientCategory = "Price" | "Cliente" | "Mayorista";

function normalizeRole(value: string): Role {
  if (value === "ADMIN") return Role.ADMIN;
  if (value === "EMPLEADO") return Role.EMPLEADO;
  if (value === "CLIENTE") return Role.CLIENTE;
  throw new Error("Rol inválido");
}

function normalizeCategory(value?: string | null): CategoryClient {
  if (value === "Mayorista") return CategoryClient.Mayorista;

  // Compatibilidad: si algo viejo manda "Cliente", ahora lo tratamos como minorista.
  if (value === "Cliente") return CategoryClient.Price;

  return CategoryClient.Price;
}

function cleanEmail(value?: string | null) {
  const email = String(value || "").trim().toLowerCase();
  return email || null;
}

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  client: true,
};

export const userService = {
  async getAll() {
    return prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: userSelect,
    });
  },

  async getById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });
  },

  async create(data: {
    email: string;
    password: string;
    name: string;
    role: Role | string;
    isActive?: boolean;

    nombre?: string;
    apellido?: string;
    dni?: string;
    telefono?: string | null;
    category?: ClientCategory;
    creditLimit?: number | null;
    isAccountEnabled?: boolean;
  }) {
    const email = cleanEmail(data.email);
    const password = String(data.password || "");
    const role = normalizeRole(String(data.role || ""));
    const name = String(data.name || "").trim();

    if (!email) throw new Error("El email es obligatorio");
    if (!name) throw new Error("El nombre es obligatorio");
    if (!password || password.length < 6) {
      throw new Error("La contraseña debe tener al menos 6 caracteres");
    }

    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) throw new Error("Ya existe un usuario con ese email");

    const hashedPassword = await bcrypt.hash(password, 10);

    if (role !== Role.CLIENTE) {
      return prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          role,
          isActive: data.isActive ?? true,
        },
        select: userSelect,
      });
    }

    const nombre = String(data.nombre || name.split(" ")[0] || name).trim();
    const apellido = String(
      data.apellido || name.split(" ").slice(1).join(" ") || ""
    ).trim();
    const dni = String(data.dni || "").trim();

    if (!dni) {
      throw new Error("Para crear un usuario cliente, el DNI/CUIT es obligatorio");
    }

    const existingClient = await prisma.client.findUnique({
      where: { dni },
    });

    if (existingClient) {
      throw new Error("Ya existe un cliente con ese DNI/CUIT");
    }

    return prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: Role.CLIENTE,
        isActive: data.isActive ?? true,
        client: {
          create: {
            nombre,
            apellido,
            dni,
            telefono: data.telefono ?? null,
            gmail: email,
            category: normalizeCategory(data.category),
            creditLimit: data.creditLimit ?? null,
            isAccountEnabled: data.isAccountEnabled ?? false,
          },
        },
      },
      select: userSelect,
    });
  },

  async update(
    id: string,
    data: Partial<{
      email: string;
      password: string;
      name: string;
      role: Role | string;
      isActive: boolean;
    }>
  ) {
    const cleanData: any = {};

    if (data.email !== undefined) {
      cleanData.email = cleanEmail(data.email);
    }

    if (data.name !== undefined) {
      cleanData.name = String(data.name).trim();
    }

    if (data.role !== undefined) {
      cleanData.role = normalizeRole(String(data.role));
    }

    if (data.isActive !== undefined) {
      cleanData.isActive = data.isActive;
    }

    if (data.password !== undefined && data.password !== "") {
      if (data.password.length < 6) {
        throw new Error("La contraseña debe tener al menos 6 caracteres");
      }

      cleanData.password = await bcrypt.hash(data.password, 10);
    }

    return prisma.user.update({
      where: { id },
      data: cleanData,
      select: userSelect,
    });
  },

  async delete(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      include: { client: true },
    });

    if (!user) throw new Error("Usuario no encontrado");

    if (user.role === Role.ADMIN) {
      const adminCount = await prisma.user.count({
        where: {
          role: Role.ADMIN,
          isActive: true,
        },
      });

      if (adminCount <= 1) {
        throw new Error("No podés eliminar el último usuario ADMIN activo");
      }
    }

    return prisma.user.delete({
      where: { id },
    });
  },
};