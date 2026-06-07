"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const finance_controller_1 = require("../controllers/finance.controller");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// CRUD básico
router.get("/", auth_1.authMiddleware, finance_controller_1.financeController.getAll);
router.post("/", auth_1.authMiddleware, finance_controller_1.financeController.create);
// Estadísticas simples
router.get("/income/month", auth_1.authMiddleware, finance_controller_1.financeController.getIncomeByMonth);
router.get("/income/year", auth_1.authMiddleware, finance_controller_1.financeController.getIncomeByYear);
router.get("/income/week", auth_1.authMiddleware, finance_controller_1.financeController.getIncomeByWeek);
router.post("/register-credit-note", auth_1.authMiddleware, finance_controller_1.financeController.registerCreditNote);
// Estadísticas extendidas
router.get("/income/category", auth_1.authMiddleware, finance_controller_1.financeController.getIncomeByCategory);
router.get("/products/top", auth_1.authMiddleware, finance_controller_1.financeController.getTopProducts);
router.get("/products/worst", auth_1.authMiddleware, finance_controller_1.financeController.getWorstProducts);
router.get("/products/top-range", auth_1.authMiddleware, finance_controller_1.financeController.getTopProductsInRange);
// Mejor producto de un mes específico
router.get("/products/best-month", finance_controller_1.financeController.getBestProductMonth);
// Peor producto de un mes específico
router.get("/products/worst-month", finance_controller_1.financeController.getWorstProductMonth);
// Exportaciones
router.get("/export/excel", auth_1.authMiddleware, finance_controller_1.financeController.exportExcel);
router.get("/export/pdf", auth_1.authMiddleware, finance_controller_1.financeController.exportPDF);
// Editar / eliminar
router.put("/:id", auth_1.authMiddleware, finance_controller_1.financeController.update);
router.patch("/:id", auth_1.authMiddleware, finance_controller_1.financeController.update);
router.delete("/:id", auth_1.authMiddleware, finance_controller_1.financeController.remove);
exports.default = router;
//# sourceMappingURL=finance.routes.js.map