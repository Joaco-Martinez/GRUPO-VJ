import { Request, Response, NextFunction } from "express";
import { saleService } from "../services/sale.service";
import { PaymentMethod, SaleStatus } from "@prisma/client";

const toNumber = (v: any) =>
  v === undefined || v === null || v === "" ? undefined : Number(v);

export const saleController = {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const sales = await saleService.getAll();
      res.json(sales);
    } catch (err) {
      next(err);
    }
  },

  async getPending(req: Request, res: Response, next: NextFunction) {
    try {
      const sales = await saleService.getPending();
      res.json(sales);
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const sale = await saleService.getById(req.params.id);

      if (!sale) {
        return res.status(404).json({
          message: "Venta no encontrada",
        });
      }

      res.json(sale);
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const body = req.body;

      const items = Array.isArray(body.items)
        ? body.items.map((item: any) => ({
            productId: item.productId,
            quantity: toNumber(item.quantity) ?? 0,
            quantityKg: toNumber(item.quantityKg),
            price: toNumber(item.price),

            boxContents: Array.isArray(item.boxContents)
              ? item.boxContents.map((box: any) => ({
                  productId: box.productId,
                  quantity: toNumber(box.quantity),
                  quantityKg: toNumber(box.quantityKg),
                }))
              : undefined,
          }))
        : [];

      const payload = {
        ...body,
        discountValue: toNumber(body.discountValue),
        items,
        payments: Array.isArray(body.payments)
          ? body.payments.map((payment: any) => ({
              method: payment.method as PaymentMethod,
              amount: Number(payment.amount),
              reference: payment.reference,
              notes: payment.notes,
            }))
          : undefined,
      };

      const newSale = await saleService.create(payload);

      res.status(201).json(newSale);
    } catch (err) {
      next(err);
    }
  },

  async bulkUpdate(req: Request, res: Response, next: NextFunction) {
    try {
      const { action } = req.body;

      if (!["COMPLETE", "CANCEL"].includes(action)) {
        return res.status(400).json({
          message: "Acción inválida. Usá COMPLETE o CANCEL",
        });
      }

      const mapped = action === "COMPLETE" ? "COMPLETED" : "CANCELLED";
      const updated = await saleService.bulkUpdatePending(mapped);

      res.json(updated);
    } catch (err) {
      next(err);
    }
  },

  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { status } = req.body as {
        status: SaleStatus;
      };

      if (!status || !Object.values(SaleStatus).includes(status)) {
        return res.status(400).json({
          message: "Estado de venta inválido",
        });
      }

      const updated = await saleService.updateStatus(req.params.id, status);

      res.json(updated);
    } catch (err) {
      next(err);
    }
  },

  async updatePaymentMethod(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { paymentMethod } = req.body as {
        paymentMethod: PaymentMethod;
      };

      if (!paymentMethod) {
        return res.status(400).json({
          message: "paymentMethod es requerido",
        });
      }

      const updated = await saleService.updatePaymentMethod(id, paymentMethod);

      res.json(updated);
    } catch (err) {
      next(err);
    }
  },

  async updatePayments(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { payments, setAsPrimary } = req.body as {
        payments: {
          method: PaymentMethod;
          amount: number;
          reference?: string;
          notes?: string;
        }[];
        setAsPrimary?: boolean;
      };

      if (!Array.isArray(payments) || payments.length === 0) {
        return res.status(400).json({
          message: "payments debe ser un array con al menos 1 pago",
        });
      }

      const normalizedPayments = payments.map((payment) => ({
        method: payment.method,
        amount: Number(payment.amount),
        reference: payment.reference,
        notes: payment.notes,
      }));

      const updated = await saleService.updatePayments(
        id,
        normalizedPayments,
        !!setAsPrimary
      );

      res.json(updated);
    } catch (err) {
      next(err);
    }
  },

  async generarNotaPedido(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await saleService.generarNotaPedido(id);

      res.json({
        ok: true,
        message: "Nota de pedido generada e impresa",
        result,
      });
    } catch (err) {
      next(err);
    }
  },
};