# Configuración ARCA — Grupo VJ

Este módulo es para el ERP/POS de Grupo VJ. No maneja tenants.

## Flujo correcto

1. El administrador de Grupo VJ entra a ARCA con clave fiscal propia.
2. Habilita Web Services y punto de venta.
3. Genera/asocia certificado digital.
4. Carga CUIT, razón social, ambiente, certificado y private key en este panel.
5. El backend obtiene token/sign por WSAA y lo cachea cifrado.
6. El módulo de facturación usa esos datos para WSFEv1.

## No se guarda

- Usuario ARCA.
- Clave fiscal ARCA.

## Sí se guarda cifrado

- Certificado.
- Private key.
- Token WSAA.
- Sign WSAA.
