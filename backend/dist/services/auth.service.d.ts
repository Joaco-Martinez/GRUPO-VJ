import { Response, Request } from "express";
export declare const authService: {
    register(data: {
        email: string;
        password: string;
        nombre?: string;
        apellido?: string;
        name?: string;
        dni: string;
        telefono?: string | null;
    }): Promise<{
        id: any;
        email: any;
        role: any;
        name: any;
        isActive: any;
        mustChangePassword: any;
        client: any;
        defaultStockLocation: any;
        defaultPriceCategory: any;
    }>;
    login(email: string, password: string, res: Response): Promise<{
        user: {
            id: any;
            email: any;
            role: any;
            name: any;
            isActive: any;
            mustChangePassword: any;
            client: any;
            defaultStockLocation: any;
            defaultPriceCategory: any;
        };
    }>;
    changePassword(userId: string, currentPasswordValue: string, newPasswordValue: string, res?: Response): Promise<{
        message: string;
        user: {
            id: any;
            email: any;
            role: any;
            name: any;
            isActive: any;
            mustChangePassword: any;
            client: any;
            defaultStockLocation: any;
            defaultPriceCategory: any;
        };
    }>;
    logout(res: Response): Promise<{
        message: string;
    }>;
    me(req: Request): Promise<{
        id: any;
        email: any;
        role: any;
        name: any;
        isActive: any;
        mustChangePassword: any;
        client: any;
        defaultStockLocation: any;
        defaultPriceCategory: any;
    }>;
    getMe(token: string): Promise<{
        id: any;
        email: any;
        role: any;
        name: any;
        isActive: any;
        mustChangePassword: any;
        client: any;
        defaultStockLocation: any;
        defaultPriceCategory: any;
    }>;
    deleteUser(id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        isActive: boolean;
        email: string;
        passwordResetToken: string | null;
        password: string;
        role: import("@prisma/client").$Enums.Role;
        passwordResetExpires: Date | null;
        mustChangePassword: boolean;
        defaultStockLocation: import("@prisma/client").$Enums.Location | null;
        defaultPriceCategory: string | null;
    }>;
};
//# sourceMappingURL=auth.service.d.ts.map