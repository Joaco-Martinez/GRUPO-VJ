export type Role = 'ADMIN' | 'EMPLEADO';
export type ProductType = 'SIMPLE' | 'COMPUESTO';
export type SaleUnit = 'UNIT' | 'KG';
export type ReceiptType = 'TICKET' | 'FACTURA';
export type PaymentMethod = 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' | 'QR' | 'DEBITO' | 'CREDITO' | 'QR_NACION' | 'QR_MERCADOPAGO' | 'TARJETA_DEBITO' | 'TARJETA_CREDITO' | 'CUENTA_CORRIENTE';
export type SaleStatus = 'COMPLETED' | 'PENDING' | 'CANCELLED';
export type DiscountType = 'PERCENTAGE' | 'FIXED';
export type ClientCategory = 'Cliente' | 'Mayorista';
export type MovementType = 'TRANSFER' | 'INGRESS' | 'ADJUSTMENT' | 'SALE' | 'SALE_CANCEL';
export type MovementLocation = 'LOCAL' | 'DEPOSITO';
export type AccountMovementType = 'DEBT' | 'PAYMENT' | 'ADJUSTMENT_POSITIVE' | 'ADJUSTMENT_NEGATIVE' | 'CREDIT_NOTE';

export interface User { id: string; email: string; name: string; role: Role; }

export interface ProductCategory { id: string; name: string; slug: string; description?: string | null; isActive: boolean; _count?: { products: number }; }

export interface ProductComponent { id?: string; compositeId?: string; componentId: string; quantity?: number | null; quantityKg?: number | null; component?: Product; }

export interface Product {
  id: string;
  name: string;
  sku?: string | null;
  type: ProductType;
  categoryId?: string | null;
  category?: ProductCategory | string | null;
  price: number;
  clientPrice: number;
  wholesalePrice: number;
  pricePerKg?: number | null;
  clientPricePerKg?: number | null;
  wholesalePricePerKg?: number | null;
  stockLocal: number;
  stockDeposito: number;
  minStock?: number | null;
  stockLocalKg?: number;
  stockDepositoKg?: number;
  minStockKg?: number | null;
  saleUnit: SaleUnit;
  imageUrl?: string | null;
  imageId?: string | null;
  isActive?: boolean;
  components?: ProductComponent[];
  usedIn?: ProductComponent[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Client {
  id: string;
  nombre: string;
  apellido: string;
  dni: string;
  telefono?: string | null;
  gmail?: string | null;
  category: ClientCategory;
  currentBalance: number;
  creditLimit?: number | null;
  isAccountEnabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SaleItem {
  id: string;
  saleId?: string;
  productId: string;
  product?: Product;
  quantity: number;
  quantityKg?: number | null;
  price: number;
  subtotal?: number;
  productNameSnapshot?: string | null;
  productSkuSnapshot?: string | null;
  boxContents?: { id: string; productId: string; product?: Product; quantity?: number | null; quantityKg?: number | null }[];
}

export interface SalePayment { id?: string; method: PaymentMethod; amount: number; reference?: string | null; notes?: string | null; createdAt?: string; }

export interface Sale {
  id: string;
  subtotal: number;
  total: number;
  receiptType: ReceiptType;
  paymentMethod: PaymentMethod;
  status: SaleStatus;
  discountType?: DiscountType | null;
  discountValue?: number | null;
  isAccountSale?: boolean;
  accountDebtAmount?: number;
  items: SaleItem[];
  payments?: SalePayment[];
  clientId?: string | null;
  client?: Client | null;
  userId?: string | null;
  user?: User | null;
  createdAt: string;
  invoice?: { cae?: string; pdfUrl?: string | null };
  invoiceAfip?: { cae?: string; pdfUrl?: string | null };
  pdfUrl?: string | null;
}

export interface StockMovement { id: string; productId: string; product?: Product; user?: User; type: MovementType; from?: MovementLocation | null; to?: MovementLocation | null; quantity?: number | null; quantityKg?: number | null; reason?: string | null; reference?: string | null; createdAt: string; }

export interface Alert { id: string; productId: string; product?: Product; message?: string; resolved?: boolean; createdAt: string; stockLocal?: number; minStock?: number; productName?: string; }

export interface FinanceEntry { id: string; type: 'INGRESO' | 'EGRESO'; amount: number; description?: string | null; category: string; paymentMethod?: PaymentMethod | null; date: string; createdAt: string; }

export interface AccountMovement { id: string; clientId: string; client?: Client; saleId?: string | null; sale?: Sale | null; userId?: string | null; user?: User | null; type: AccountMovementType; amount: number; previousBalance: number; newBalance: number; paymentMethod?: PaymentMethod | null; reference?: string | null; description?: string | null; date: string; createdAt: string; }

export interface CartItem { product: Product; quantity: number; quantityKg?: number; priceType: 'price' | 'clientPrice' | 'wholesalePrice'; }
