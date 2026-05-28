import prisma from "../prisma";
import { Role } from "@prisma/client";
import bcrypt from "bcryptjs"; // o bcrypt
export const userService = {
  async getAll() {
    return prisma.user.findMany();
  },

  async getById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },

 async create(data: { email: string; password: string; name: string; role: Role }) {
  // 🔒 hashear la contraseña antes de guardar
  const hashedPassword = await bcrypt.hash(data.password, 10); // 10 = salt rounds

  return prisma.user.create({
    data: {
      email: data.email,
      password: hashedPassword, // guardamos hash en DB
      name: data.name,
      role: data.role,
    },
  });
},

  async update(id: string, data: Partial<{ email: string; password: string; name: string; role: Role }>) {
    return prisma.user.update({ where: { id }, data });
  },

  async delete(id: string) {
    return prisma.user.delete({ where: { id } });
  },
};
