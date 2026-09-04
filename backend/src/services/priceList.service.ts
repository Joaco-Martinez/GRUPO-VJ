import prisma from "../prisma";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { Response } from "express";
import { SaleUnit } from "@prisma/client";

export type PriceListType = "mayorista" | "minorista";

function getUnitPrice(product: any, type: PriceListType): number {
  if (product.saleUnit === SaleUnit.KG) {
    if (type === "mayorista") {
      return Number(product.wholesalePricePerKg ?? product.wholesalePrice ?? 0);
    }
    return Number(product.pricePerKg ?? product.price ?? 0);
  }

  if (type === "mayorista") {
    return Number(product.wholesalePrice ?? 0);
  }
  return Number(product.price ?? 0);
}

function unitLabel(product: any) {
  return product.saleUnit === SaleUnit.KG ? "Kg" : "Unidad";
}

function listTitle(type: PriceListType) {
  return type === "mayorista" ? "Lista de Precios Mayorista" : "Lista de Precios Minorista";
}

async function getActiveProducts() {
  return prisma.product.findMany({
    where: { isActive: true },
    include: { category: true },
    orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
  });
}

export const priceListService = {
  async exportExcel(type: PriceListType) {
    const products = await getActiveProducts();

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(listTitle(type));

    sheet.columns = [
      { header: "SKU", key: "sku", width: 16 },
      { header: "Producto", key: "name", width: 40 },
      { header: "Categoría", key: "category", width: 22 },
      { header: "Unidad", key: "unit", width: 12 },
      { header: "Precio", key: "price", width: 14 },
    ];

    sheet.getRow(1).font = { bold: true };

    products.forEach((product: any) => {
      sheet.addRow({
        sku: product.sku ?? "",
        name: product.name,
        category: product.category?.name ?? "",
        unit: unitLabel(product),
        price: getUnitPrice(product, type),
      });
    });

    sheet.getColumn("price").numFmt = '"$"#,##0.00';

    return workbook.xlsx.writeBuffer();
  },

  async exportPDF(res: Response, type: PriceListType) {
    const products = await getActiveProducts();

    const doc = new PDFDocument({ margin: 40, size: "A4" });

    const filename = type === "mayorista" ? "lista-precios-mayorista.pdf" : "lista-precios-minorista.pdf";
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    res.setHeader("Content-Type", "application/pdf");

    doc.pipe(res);

    doc.fontSize(18).text(listTitle(type), { align: "center" });
    doc.moveDown();
    doc.fontSize(10).fillColor("#666").text(new Date().toLocaleDateString("es-AR"), { align: "center" });
    doc.fillColor("#000");
    doc.moveDown(1.5);

    let currentCategory: string | null = null;

    products.forEach((product: any) => {
      const categoryName = product.category?.name ?? "Sin categoría";

      if (categoryName !== currentCategory) {
        currentCategory = categoryName;
        doc.moveDown(0.5);
        doc.fontSize(13).fillColor("#111").text(categoryName, { underline: true });
        doc.fillColor("#000");
        doc.moveDown(0.2);
      }

      const price = getUnitPrice(product, type);
      const priceText = price.toLocaleString("es-AR", {
        style: "currency",
        currency: "ARS",
      });

      doc
        .fontSize(11)
        .text(`${product.name}${product.sku ? ` (${product.sku})` : ""} — ${priceText} / ${unitLabel(product)}`);
    });

    doc.end();
  },
};
