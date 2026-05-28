import { PrismaClient, ProductType, SaleUnit, Role, CategoryClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function seedUsers() {
  const password = await bcrypt.hash("admin123", 10);

  const admin = await prisma.user.upsert({
    where: {
      email: "admin@grupovj.com",
    },
    update: {
      name: "Administrador",
      role: Role.ADMIN,
    },
    create: {
      email: "admin@grupovj.com",
      password,
      name: "Administrador",
      role: Role.ADMIN,
    },
  });

  const empleadoPassword = await bcrypt.hash("empleado123", 10);

  const empleado = await prisma.user.upsert({
    where: {
      email: "empleado@grupovj.com",
    },
    update: {
      name: "Empleado",
      role: Role.EMPLEADO,
    },
    create: {
      email: "empleado@grupovj.com",
      password: empleadoPassword,
      name: "Empleado",
      role: Role.EMPLEADO,
    },
  });

  return {
    admin,
    empleado,
  };
}

async function seedCategories() {
  const names = [
    "Bombones",
    "Alfajores",
    "Cajas",
    "Chocolates",
    "Peluches",
    "Cervezas",
    "Promociones",
    "Bebidas",
    "Kiosco",
    "Productos por KG",
  ];

  const categories: Record<string, Awaited<ReturnType<typeof prisma.productCategory.upsert>>> = {};

  for (const name of names) {
    const slug = slugify(name);

    const category = await prisma.productCategory.upsert({
      where: {
        slug,
      },
      update: {
        name,
        isActive: true,
      },
      create: {
        name,
        slug,
        isActive: true,
        description: `Categoría ${name}`,
      },
    });

    categories[name] = category;
  }

  return categories;
}

async function seedClients() {
  const cliente = await prisma.client.upsert({
    where: {
      dni: "11111111",
    },
    update: {
      nombre: "Cliente",
      apellido: "Mostrador",
      telefono: "3410000000",
      gmail: "cliente@demo.com",
      category: CategoryClient.Cliente,
      currentBalance: 0,
      creditLimit: 50000,
      isAccountEnabled: true,
    },
    create: {
      nombre: "Cliente",
      apellido: "Mostrador",
      dni: "11111111",
      telefono: "3410000000",
      gmail: "cliente@demo.com",
      category: CategoryClient.Cliente,
      currentBalance: 0,
      creditLimit: 50000,
      isAccountEnabled: true,
    },
  });

  const mayorista = await prisma.client.upsert({
    where: {
      dni: "22222222",
    },
    update: {
      nombre: "Cliente",
      apellido: "Mayorista",
      telefono: "3411111111",
      gmail: "mayorista@demo.com",
      category: CategoryClient.Mayorista,
      currentBalance: 0,
      creditLimit: 200000,
      isAccountEnabled: true,
    },
    create: {
      nombre: "Cliente",
      apellido: "Mayorista",
      dni: "22222222",
      telefono: "3411111111",
      gmail: "mayorista@demo.com",
      category: CategoryClient.Mayorista,
      currentBalance: 0,
      creditLimit: 200000,
      isAccountEnabled: true,
    },
  });

  return {
    cliente,
    mayorista,
  };
}

async function seedProducts(categories: Record<string, any>) {
  const bebidas = categories["Bebidas"];
  const promos = categories["Promociones"];
  const chocolates = categories["Chocolates"];
  const kg = categories["Productos por KG"];
  const cajas = categories["Cajas"];

  const coca = await prisma.product.upsert({
    where: {
      sku: "COCA-225",
    },
    update: {
      name: "Coca-Cola 2.25L",
      type: ProductType.SIMPLE,
      categoryId: bebidas.id,
      saleUnit: SaleUnit.UNIT,
      price: 6000,
      clientPrice: 6000,
      wholesalePrice: 5200,
      stockLocal: 20,
      stockDeposito: 50,
      minStock: 5,
      isActive: true,
    },
    create: {
      name: "Coca-Cola 2.25L",
      sku: "COCA-225",
      type: ProductType.SIMPLE,
      categoryId: bebidas.id,
      saleUnit: SaleUnit.UNIT,
      price: 6000,
      clientPrice: 6000,
      wholesalePrice: 5200,
      stockLocal: 20,
      stockDeposito: 50,
      minStock: 5,
      isActive: true,
    },
  });

  const fernet = await prisma.product.upsert({
    where: {
      sku: "FERNET-750",
    },
    update: {
      name: "Fernet 750ml",
      type: ProductType.SIMPLE,
      categoryId: bebidas.id,
      saleUnit: SaleUnit.UNIT,
      price: 10000,
      clientPrice: 10000,
      wholesalePrice: 9000,
      stockLocal: 10,
      stockDeposito: 30,
      minStock: 3,
      isActive: true,
    },
    create: {
      name: "Fernet 750ml",
      sku: "FERNET-750",
      type: ProductType.SIMPLE,
      categoryId: bebidas.id,
      saleUnit: SaleUnit.UNIT,
      price: 10000,
      clientPrice: 10000,
      wholesalePrice: 9000,
      stockLocal: 10,
      stockDeposito: 30,
      minStock: 3,
      isActive: true,
    },
  });

  const alfajor = await prisma.product.upsert({
    where: {
      sku: "ALFAJOR-DEMO",
    },
    update: {
      name: "Alfajor Demo",
      type: ProductType.SIMPLE,
      categoryId: categories["Alfajores"].id,
      saleUnit: SaleUnit.UNIT,
      price: 1200,
      clientPrice: 1200,
      wholesalePrice: 900,
      stockLocal: 100,
      stockDeposito: 200,
      minStock: 20,
      isActive: true,
    },
    create: {
      name: "Alfajor Demo",
      sku: "ALFAJOR-DEMO",
      type: ProductType.SIMPLE,
      categoryId: categories["Alfajores"].id,
      saleUnit: SaleUnit.UNIT,
      price: 1200,
      clientPrice: 1200,
      wholesalePrice: 900,
      stockLocal: 100,
      stockDeposito: 200,
      minStock: 20,
      isActive: true,
    },
  });

  const bombon = await prisma.product.upsert({
    where: {
      sku: "BOMBON-DEMO",
    },
    update: {
      name: "Bombón Demo",
      type: ProductType.SIMPLE,
      categoryId: chocolates.id,
      saleUnit: SaleUnit.UNIT,
      price: 800,
      clientPrice: 800,
      wholesalePrice: 650,
      stockLocal: 150,
      stockDeposito: 300,
      minStock: 30,
      isActive: true,
    },
    create: {
      name: "Bombón Demo",
      sku: "BOMBON-DEMO",
      type: ProductType.SIMPLE,
      categoryId: chocolates.id,
      saleUnit: SaleUnit.UNIT,
      price: 800,
      clientPrice: 800,
      wholesalePrice: 650,
      stockLocal: 150,
      stockDeposito: 300,
      minStock: 30,
      isActive: true,
    },
  });

  const chocolateKg = await prisma.product.upsert({
    where: {
      sku: "CHOCOLATE-KG",
    },
    update: {
      name: "Chocolate por KG",
      type: ProductType.SIMPLE,
      categoryId: kg.id,
      saleUnit: SaleUnit.KG,

      price: 0,
      clientPrice: 0,
      wholesalePrice: 0,
      stockLocal: 0,
      stockDeposito: 0,

      pricePerKg: 18000,
      clientPricePerKg: 18000,
      wholesalePricePerKg: 15000,
      stockLocalKg: 25,
      stockDepositoKg: 100,
      minStockKg: 5,
      isActive: true,
    },
    create: {
      name: "Chocolate por KG",
      sku: "CHOCOLATE-KG",
      type: ProductType.SIMPLE,
      categoryId: kg.id,
      saleUnit: SaleUnit.KG,

      price: 0,
      clientPrice: 0,
      wholesalePrice: 0,
      stockLocal: 0,
      stockDeposito: 0,

      pricePerKg: 18000,
      clientPricePerKg: 18000,
      wholesalePricePerKg: 15000,
      stockLocalKg: 25,
      stockDepositoKg: 100,
      minStockKg: 5,
      isActive: true,
    },
  });

  const cajaBombones = await prisma.product.upsert({
    where: {
      sku: "CAJA-BOMBONES-X6",
    },
    update: {
      name: "Caja Bombones x6",
      type: ProductType.COMPUESTO,
      categoryId: cajas.id,
      saleUnit: SaleUnit.UNIT,
      price: 4200,
      clientPrice: 4200,
      wholesalePrice: 3600,
      stockLocal: 0,
      stockDeposito: 0,
      minStock: 0,
      isActive: true,
    },
    create: {
      name: "Caja Bombones x6",
      sku: "CAJA-BOMBONES-X6",
      type: ProductType.COMPUESTO,
      categoryId: cajas.id,
      saleUnit: SaleUnit.UNIT,
      price: 4200,
      clientPrice: 4200,
      wholesalePrice: 3600,
      stockLocal: 0,
      stockDeposito: 0,
      minStock: 0,
      isActive: true,
    },
  });

  await prisma.productComponent.deleteMany({
    where: {
      compositeId: cajaBombones.id,
    },
  });

  await prisma.productComponent.createMany({
    data: [
      {
        compositeId: cajaBombones.id,
        componentId: bombon.id,
        quantity: 6,
        quantityKg: null,
      },
    ],
  });

  const promoFernetCoca = await prisma.product.upsert({
    where: {
      sku: "PROMO-FERNET-COCA",
    },
    update: {
      name: "Promo Fernet + Coca",
      type: ProductType.COMPUESTO,
      categoryId: promos.id,
      saleUnit: SaleUnit.UNIT,
      price: 12000,
      clientPrice: 12000,
      wholesalePrice: 12000,
      stockLocal: 0,
      stockDeposito: 0,
      minStock: 0,
      isActive: true,
    },
    create: {
      name: "Promo Fernet + Coca",
      sku: "PROMO-FERNET-COCA",
      type: ProductType.COMPUESTO,
      categoryId: promos.id,
      saleUnit: SaleUnit.UNIT,
      price: 12000,
      clientPrice: 12000,
      wholesalePrice: 12000,
      stockLocal: 0,
      stockDeposito: 0,
      minStock: 0,
      isActive: true,
    },
  });

  await prisma.productComponent.deleteMany({
    where: {
      compositeId: promoFernetCoca.id,
    },
  });

  await prisma.productComponent.createMany({
    data: [
      {
        compositeId: promoFernetCoca.id,
        componentId: fernet.id,
        quantity: 1,
        quantityKg: null,
      },
      {
        compositeId: promoFernetCoca.id,
        componentId: coca.id,
        quantity: 1,
        quantityKg: null,
      },
    ],
  });

  return {
    coca,
    fernet,
    alfajor,
    bombon,
    chocolateKg,
    cajaBombones,
    promoFernetCoca,
  };
}

async function cleanDemoDataIfNeeded() {
  // Lo dejo vacío a propósito.
  // Como usamos upsert + deleteMany solo de componentes de los productos demo,
  // el seed se puede correr varias veces sin duplicar datos importantes.
}

async function main() {
  console.log("🌱 Iniciando seed...");

  await cleanDemoDataIfNeeded();

  const users = await seedUsers();
  console.log("✅ Usuarios creados/actualizados");

  const categories = await seedCategories();
  console.log("✅ Categorías creadas/actualizadas");

  const clients = await seedClients();
  console.log("✅ Clientes creados/actualizados");

  const products = await seedProducts(categories);
  console.log("✅ Productos creados/actualizados");

  console.log("");
  console.log("✅ Seed finalizado correctamente");
  console.log("");
  console.log("🔐 Usuario admin:");
  console.log("Email: admin@grupovj.com");
  console.log("Password: admin123");
  console.log("");
  console.log("👤 Usuario empleado:");
  console.log("Email: empleado@grupovj.com");
  console.log("Password: empleado123");
  console.log("");
  console.log("🧪 Productos de prueba:");
  console.log(`Coca: ${products.coca.sku}`);
  console.log(`Fernet: ${products.fernet.sku}`);
  console.log(`Promo: ${products.promoFernetCoca.sku}`);
  console.log("");
  console.log("🧪 Flujo para probar:");
  console.log("Vender 1 PROMO-FERNET-COCA + 1 COCA-225");
  console.log("Resultado esperado: Fernet -1 y Coca -2");
}

main()
  .catch((error) => {
    console.error("❌ Error ejecutando seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });