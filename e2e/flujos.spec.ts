import { test, expect, type Page } from "@playwright/test";

const USUARIOS = {
  administrador: ["admin@trigoyajonjoli.org", "Admin-Trigo-2026"],
  recepcionista: ["recepcion@trigoyajonjoli.org", "Recepcion-2026"],
  almacenista: ["almacen@trigoyajonjoli.org", "Almacen-2026!"],
  donante: ["donante@correo-ejemplo.co", "Donante-2026!"],
} as const;

async function ingresar(page: Page, rol: keyof typeof USUARIOS) {
  await page.goto("/ingreso");
  await page.getByLabel("Correo").fill(USUARIOS[rol][0]);
  await page.getByLabel("Contraseña").fill(USUARIOS[rol][1]);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(/\/panel\//);
}

test.describe("Portal público", () => {
  test("muestra la misión, la foto, los datos de la fundación y la lista de necesidades del inventario", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Transformar la vida de los habitantes de la calle");
    await expect(page.getByAltText(/jornada nocturna de entrega/)).toBeVisible();
    await expect(page.getByText("Nequi: 350 803 3677")).toBeVisible();
    await expect(page.getByRole("link", { name: "Síguenos en Facebook" })).toHaveAttribute("href", /facebook\.com/);
    await expect(page.locator(".pendiente")).toHaveCount(0);
    await expect(page.getByText("Lo que más necesitamos hoy:")).toBeVisible();
    await expect(page.getByText("La lista se actualiza según el inventario")).toBeVisible();
  });

  test("permite inscribirse como voluntario con autorización de datos", async ({ page }) => {
    await page.goto("/#voluntariado");
    await page.locator("#vol-nombre").fill("Valentina Prueba E2E");
    await page.locator("#vol-email").fill("valentina.e2e@correo-ejemplo.co");
    await page.locator("#vol-consentimiento").check();
    await page.getByRole("button", { name: "Enviar" }).click();
    await expect(page.locator(".mensaje-ok")).toBeVisible();
  });

  test("simula una donación aprobada en modo de pruebas", async ({ page }) => {
    await page.goto("/donar");
    await expect(page.getByText(/MODO DE PRUEBAS/).first()).toBeVisible();
    await page.locator("#don-nombre").fill("Marta Ruiz");
    await page.locator("#don-email").fill("donante@correo-ejemplo.co");
    await page.locator("#don-monto").fill("25000");
    await page.locator("#don-consentimiento").check();
    await page.getByRole("button", { name: "Simular pago aprobado" }).click();
    await expect(page.getByText(/PRUEBA-/)).toBeVisible();
  });
});

test.describe("Seguridad y roles", () => {
  test("la API rechaza peticiones sin sesión", async ({ request }) => {
    const r = await request.get("/api/reportes?desde=2026-11-01&hasta=2026-11-30");
    expect(r.status()).toBe(401);
  });

  test("rechaza credenciales incorrectas", async ({ page }) => {
    await page.goto("/ingreso");
    await page.getByLabel("Correo").fill("recepcion@trigoyajonjoli.org");
    await page.getByLabel("Contraseña").fill("incorrecta");
    await page.getByRole("button", { name: "Ingresar" }).click();
    // (Next.js añade su propio role="alert" para anunciar rutas, por eso se filtra por la clase del mensaje)
    await expect(page.locator(".mensaje-error")).toContainText("Correo o contraseña incorrectos");
  });

  test("al desactivar un usuario pierde el acceso de inmediato (sesión revocada)", async ({ page, browser }) => {
    await ingresar(page, "recepcionista");
    const admin = await (await browser.newContext()).newPage();
    await ingresar(admin, "administrador");
    await admin.goto("/panel/usuarios");
    await admin.getByRole("button", { name: "Desactivar a Laura Gómez" }).click();
    await expect(admin.getByRole("button", { name: "Activar a Laura Gómez" })).toBeVisible();
    await page.goto("/panel/visitas");
    await expect(page).toHaveURL(/\/ingreso/);
    // Se deja como estaba para las demás pruebas
    await admin.getByRole("button", { name: "Activar a Laura Gómez" }).click();
    await expect(admin.getByRole("button", { name: "Desactivar a Laura Gómez" })).toBeVisible();
  });

  test("la recepcionista no puede entrar al inventario", async ({ page }) => {
    await ingresar(page, "recepcionista");
    await page.goto("/panel/inventario");
    await expect(page).toHaveURL(/\/panel\/visitas/);
  });
});

test.describe("Módulo de visitas", () => {
  test("registra entrada y salida de una persona existente", async ({ page }) => {
    await ingresar(page, "recepcionista");
    await expect(page.getByRole("heading", { name: "Control de visitas" })).toBeVisible();
    const aforo = Number(await page.getByTestId("aforo").textContent());
    await page.getByLabel("Documento de identidad").fill("79563214");
    await page.getByRole("button", { name: "Registrar entrada" }).click();
    await expect(page.getByText("Entrada registrada: Hernando Vargas")).toBeVisible();
    await expect(page.getByTestId("aforo")).toHaveText(String(aforo + 1));
    await page.getByRole("button", { name: "Registrar salida de Hernando Vargas" }).click();
    await expect(page.getByTestId("aforo")).toHaveText(String(aforo));
  });

  test("registra a una persona nueva con autorización de datos y genera su carné QR", async ({ page }) => {
    await ingresar(page, "recepcionista");
    await page.getByLabel("Documento de identidad").fill("1099888777");
    await page.getByRole("button", { name: "Registrar entrada" }).click();
    await expect(page.getByRole("heading", { name: "Registrar persona nueva" })).toBeVisible();
    await page.getByLabel("Nombres").fill("Rosa Elena");
    await page.getByLabel("Apellidos").fill("Quintero");
    await page.getByLabel(/autoriza el tratamiento/).check();
    await page.getByRole("button", { name: "Guardar y registrar entrada" }).click();
    await expect(page.getByAltText("Código QR de Rosa Elena")).toBeVisible();
    await expect(page.getByText("Entrada registrada: Rosa Elena Quintero")).toBeVisible();
  });
});

test.describe("Módulo de inventario", () => {
  test("registra un donativo, bloquea una salida mayor al stock y aplica PEPS", async ({ page }) => {
    await ingresar(page, "almacenista");
    await expect(page.getByRole("heading", { name: "Inventario de donativos" })).toBeVisible();
    const articulo = page.locator("#item_id");

    // Entrada: lote nuevo de 10 cuadernos
    await articulo.selectOption({ label: (await articulo.locator("option", { hasText: "Cuaderno" }).textContent())! });
    await page.getByLabel("Cantidad").fill("10");
    await page.getByRole("button", { name: "Guardar movimiento" }).click();
    await expect(page.getByText(/Entrada guardada en el lote L-/)).toBeVisible();

    // Salida mayor al stock → rechazada
    await page.locator("#tipo-mov").selectOption("salida");
    await articulo.selectOption({ label: (await articulo.locator("option", { hasText: "Kit escolar" }).textContent())! });
    await page.getByLabel("Cantidad").fill("999");
    await page.getByLabel("Beneficiario o destino").fill("Jornada de prueba");
    await page.getByRole("button", { name: "Guardar movimiento" }).click();
    await expect(page.locator(".mensaje-error")).toContainText(/Stock insuficiente/);

    // Salida válida con PEPS automático
    await page.getByLabel("Cantidad").fill("2");
    await page.getByLabel("Beneficiario o destino").fill("Jornada de prueba");
    await page.getByRole("button", { name: "Guardar movimiento" }).click();
    await expect(page.getByText(/Salida guardada: 2 del lote L-/)).toBeVisible();
  });
});

test.describe("Reportes, usuarios y donante", () => {
  test("el administrador ve reportes y la gestión de usuarios", async ({ page }) => {
    await ingresar(page, "administrador");
    await expect(page.getByRole("heading", { name: "Reportes", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Entradas y salidas del/ })).toBeVisible();
    await page.getByRole("link", { name: "Usuarios" }).click();
    await expect(page.getByRole("heading", { name: "Personal con acceso" })).toBeVisible();
  });

  test("el donante ve su historial de donaciones", async ({ page }) => {
    await ingresar(page, "donante");
    await expect(page.getByRole("heading", { name: "Mis donaciones" })).toBeVisible();
    await expect(page.getByRole("cell", { name: /aprobada/ }).first()).toBeVisible();
  });
});
