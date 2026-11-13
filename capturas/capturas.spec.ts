import { test, expect, devices, type Page } from "@playwright/test";
import path from "node:path";

const DESTINO = path.resolve(__dirname, "..", "..", "entregables", "evidencias");
const foto = (page: Page, nombre: string, completa = true) => page.screenshot({ path: path.join(DESTINO, `${nombre}.png`), fullPage: completa });

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

test.describe.configure({ mode: "serial" });

test("01-04 Portal público, voluntariado, donación e ingreso", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await foto(page, "01_portal_publico_inicio");

  await page.locator("#vol-nombre").fill("Natalia Bermúdez");
  await page.locator("#vol-email").fill("natalia.b@correo-ejemplo.co");
  await page.locator("#vol-telefono").fill("3014445566");
  await page.locator("#vol-consentimiento").check();
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.locator(".mensaje-ok")).toBeVisible();
  await page.locator("#voluntariado").screenshot({ path: path.join(DESTINO, "02_portal_formulario_voluntariado.png") });

  await page.goto("/donar");
  await page.locator("#don-nombre").fill("Jorge Peña");
  await page.locator("#don-email").fill("jorge.pena@correo-ejemplo.co");
  await page.locator("#don-sugerencias").selectOption("50000");
  await page.locator("#don-consentimiento").check();
  await page.getByRole("button", { name: "Simular pago aprobado" }).click();
  await expect(page.getByText(/PRUEBA-/)).toBeVisible();
  await foto(page, "03_donacion_en_linea_modo_pruebas");

  await page.goto("/ingreso");
  await foto(page, "04_ingreso_del_personal");
});

test("05-06 Control de visitas", async ({ page }) => {
  await ingresar(page, "recepcionista");
  await expect(page.getByRole("heading", { name: "Control de visitas" })).toBeVisible();
  await foto(page, "05_visitas_panel_recepcion");

  await page.getByLabel("Documento de identidad").fill("1098765432");
  await page.getByRole("button", { name: "Registrar entrada" }).click();
  await page.getByLabel("Nombres").fill("Rosa Elena");
  await page.getByLabel("Apellidos").fill("Quintero");
  await page.getByLabel("Tipo", { exact: true }).selectOption("beneficiario");
  await page.getByLabel(/autoriza el tratamiento/).check();
  await page.getByRole("button", { name: "Guardar y registrar entrada" }).click();
  await expect(page.getByAltText("Código QR de Rosa Elena")).toBeVisible();
  await foto(page, "06_visitas_registro_persona_nueva_con_qr");
});

test("07-09 Inventario de donativos", async ({ page }) => {
  await ingresar(page, "almacenista");
  await expect(page.getByRole("heading", { name: "Inventario de donativos" })).toBeVisible();
  await foto(page, "07_inventario_panel_almacen");

  const articulo = page.locator("#item_id");
  await page.locator("#tipo-mov").selectOption("salida");
  await articulo.selectOption({ label: (await articulo.locator("option", { hasText: "Camiseta adulto" }).textContent())! });
  await page.getByLabel("Cantidad").fill("60");
  await page.getByLabel("Beneficiario o destino").fill("Jornada madrugada · Soacha centro");
  await page.getByRole("button", { name: "Guardar movimiento" }).click();
  await expect(page.locator(".mensaje-error")).toContainText("Stock insuficiente");
  await page.locator("section", { has: page.getByRole("heading", { name: "Registrar movimiento" }) }).screenshot({
    path: path.join(DESTINO, "08_inventario_bloqueo_salida_sin_existencias.png"),
  });

  await page.getByLabel("Cantidad").fill("15");
  await page.getByLabel("Beneficiario o destino").fill("Jornada madrugada · Soacha centro");
  await page.getByRole("button", { name: "Guardar movimiento" }).click();
  await expect(page.getByText(/Salida guardada/)).toBeVisible();
  await foto(page, "09_inventario_salida_peps_y_libro_movimientos");
});

test("10-12 Reportes, usuarios y donante", async ({ page }) => {
  await ingresar(page, "administrador");
  await expect(page.getByRole("heading", { name: "Reportes", exact: true })).toBeVisible();
  await foto(page, "10_reportes_administrador");

  await page.goto("/panel/usuarios");
  await expect(page.getByRole("heading", { name: "Personal con acceso" })).toBeVisible();
  await foto(page, "11_usuarios_gestion_roles");

  await page.context().clearCookies();
  await ingresar(page, "donante");
  await expect(page.getByRole("heading", { name: "Mis donaciones" })).toBeVisible();
  await foto(page, "12_panel_donante_mis_donaciones");
});

test("13 Portal en celular (diseño responsivo)", async ({ browser }) => {
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await foto(page, "13_portal_vista_celular", false);
  await ctx.close();
});
