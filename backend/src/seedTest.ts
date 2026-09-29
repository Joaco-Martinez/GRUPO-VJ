// Datos de prueba para el flujo "cliente modifica pedido / local lo pone en
// preparación". SOLO corre contra una base local (ver scripts/test-db.mjs).
//
//   npm run seed:test
//
// Es idempotente: se puede correr varias veces; recrea los pedidos de prueba.
import {
  CategoryClient,
  DeliveryStatus,
  PaymentMethod,
  ReceiptType,
  Role,
  SaleStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import prisma from "./prisma";
import { saleService } from "./services/sale.service";

function assertLocalDatabase() {
  const url = process.env.DATABASE_URL ?? "";
  let host = "";

  try {
    host = new URL(url).hostname;
  } catch {
    // URL inválida: se rechaza abajo.
  }

  if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
    console.error(
      `❌ seed:test solo corre contra una base local. DATABASE_URL apunta a "${host || "?"}".`
    );
    process.exit(1);
  }
}

async function upsertUser(email: string, name: string, role: Role, password: string) {
  const hashed = await bcrypt.hash(password, 10);

  return prisma.user.upsert({
    where: { email },
    update: { name, role, password: hashed, isActive: true, mustChangePassword: false },
    create: { email, name, role, password: hashed },
  });
}

async function upsertProduct(data: {
  sku: string;
  name: string;
  price: number;
  clientPrice: number;
  wholesalePrice: number;
  categoryId: string;
}) {
  const stock = { stockLocal: 50, stockDeposito: 50 };

  return prisma.product.upsert({
    where: { sku: data.sku },
    update: { ...data, ...stock, isActive: true, isVisibleToPublic: true },
    create: { ...data, ...stock, purchasePrice: Math.round(data.price * 0.6) },
  });
}

async function main() {
  assertLocalDatabase();

  console.log("🌱 Cargando datos de prueba...");

  await upsertUser("admin@test.com", "Admin Test", Role.ADMIN, "admin123");
  const vendedor = await upsertUser("vendedor@test.com", "Vendedor Test", Role.EMPLEADO, "vendedor123");
  const clienteUser = await upsertUser("cliente@test.com", "Cliente Test", Role.CLIENTE, "cliente123");

  const client = await prisma.client.upsert({
    where: { userId: clienteUser.id },
    update: { isActive: true, category: CategoryClient.Price },
    create: {
      nombre: "Cliente",
      apellido: "Test",
      gmail: "cliente@test.com",
      telefono: "1122334455",
      category: CategoryClient.Price,
      userId: clienteUser.id,
      addressStreet: "Av. Corrientes",
      addressNumber: "1234",
      addressCity: "CABA",
      addressProvince: "Buenos Aires",
    },
  });

  const category = await prisma.productCategory.upsert({
    where: { slug: "test-almacen" },
    update: {},
    create: { name: "Almacén (test)", slug: "test-almacen" },
  });

  const products = await Promise.all([
    upsertProduct({ sku: "TEST-YERBA", name: "Yerba 1kg (test)", price: 4500, clientPrice: 4200, wholesalePrice: 3800, categoryId: category.id }),
    upsertProduct({ sku: "TEST-AZUCAR", name: "Azúcar 1kg (test)", price: 1800, clientPrice: 1700, wholesalePrice: 1500, categoryId: category.id }),
    upsertProduct({ sku: "TEST-FIDEOS", name: "Fideos 500g (test)", price: 1200, clientPrice: 1100, wholesalePrice: 950, categoryId: category.id }),
    upsertProduct({ sku: "TEST-ACEITE", name: "Aceite 900ml (test)", price: 3200, clientPrice: 3000, wholesalePrice: 2700, categoryId: category.id }),
  ]);
  const [yerba, azucar, fideos] = products;

  // Borrar pedidos de prueba anteriores devolviendo su stock (cancelar
  // revierte stock/deuda) para que correr el seed dos veces no lo descuente
  // de más.
  const previous = await prisma.sale.findMany({
    where: { clientId: client.id },
    select: { id: true, status: true },
  });

  for (const sale of previous) {
    if (sale.status !== SaleStatus.CANCELLED) {
      await saleService.updateStatus(sale.id, SaleStatus.CANCELLED);
    }
  }

  await prisma.sale.deleteMany({ where: { clientId: client.id } });

  // Mismo camino que el checkout de la tienda: venta web pendiente que
  // descuenta DEPÓSITO para clientes minoristas.
  const webOrder = {
    userId: clienteUser.id,
    clientId: client.id,
    paymentMethod: PaymentMethod.TRANSFERENCIA,
    receiptType: ReceiptType.TICKET,
    status: SaleStatus.PENDING,
    stockLocation: "DEPOSITO" as const,
    isWebSale: true,
  };

  const editable: any = await saleService.create({
    ...webOrder,
    items: [
      { productId: yerba.id, quantity: 2 },
      { productId: azucar.id, quantity: 3 },
    ],
  });

  const preparing: any = await saleService.create({
    ...webOrder,
    items: [{ productId: fideos.id, quantity: 5 }],
  });

  const preparingId = preparing.sale?.id ?? preparing.id;
  await saleService.updateDeliveryStatus(preparingId, DeliveryStatus.PREPARING);

  const editableId = editable.sale?.id ?? editable.id;

  console.log("");
  console.log("✅ Listo. Usuarios (email / contraseña):");
  console.log("   Admin     admin@test.com / admin123");
  console.log(`   Vendedor  vendedor@test.com / vendedor123   (${vendedor.role})`);
  console.log("   Cliente   cliente@test.com / cliente123     (tienda)");
  console.log("");
  console.log("📦 Pedidos web del cliente:");
  console.log(`   #${editableId.slice(-8)}  PENDIENTE  -> el cliente lo puede modificar`);
  console.log(`   #${preparingId.slice(-8)}  EN PREPARACIÓN -> bloqueado para el cliente`);
  console.log("");
}

main()
  .catch((error) => {
    console.error("❌ Error cargando datos de prueba:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
