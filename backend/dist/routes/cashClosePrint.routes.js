"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const cashClosePrint_controller_1 = require("../controllers/cashClosePrint.controller");
const router = (0, express_1.Router)();
// POST /cash-close/print
router.post("/print", cashClosePrint_controller_1.printCashCloseController);
exports.default = router;
//# sourceMappingURL=cashClosePrint.routes.js.map