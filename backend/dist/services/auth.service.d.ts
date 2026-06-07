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
        client: any;
    }>;
    login(email: string, password: string, res: Response): Promise<{
        user: {
            id: any;
            email: any;
            role: any;
            name: any;
            isActive: any;
            client: any;
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
        client: any;
    }>;
    getMe(token: string): Promise<{
        id: any;
        email: any;
        role: any;
        name: any;
        isActive: any;
        client: any;
    }>;
    deleteUser(id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        isActive: boolean;
        email: string;
        password: string;
        role: import("@prisma/client").$Enums.Role;
    }>;
};
//# sourceMappingURL=auth.service.d.ts.map