# Este es el ejemplo de la definicion de schema y su tipo exportado.

| El modelo del ejemplo no es parte de este proyecto, solamente es un ejemplo.

nombre del archivo: user.model.ts

```typescript
import z from 'zod';
export const UserSchema = z.object({
  name: z.string(),
  last_name: z.string(),
  username: z.string(),
  password: z.string(),
  email: z.string().optional(),
});

export type TUser = z.infer<typeof UserSchema>;
```

La idea es tener un arhcivo como este para cada una de las tablas en base de datos.
