import { expect, test, type Page } from "@playwright/test";

const fixture = "tests/fixtures/sample.m3u";

async function importFixture(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Carga tu lista y a ver tele" })).toBeVisible();
  await page.setInputFiles("#add-file", fixture);
  await expect(page.locator("#grid .tile")).toHaveCount(7);
}

test("imports a list, filters and searches channels", async ({ page }) => {
  await importFixture(page);
  // Opening "En vivo" never focuses the search box (that would pop up the keyboard).
  await expect(page.getByLabel("Buscar canal")).not.toBeFocused();
  await page.locator(".cats").getByRole("button", { name: /^Chile/ }).click();
  await expect(page.locator("#grid .tile")).toHaveCount(2);
  await page.locator(".cats").getByRole("button", { name: /^Todos/ }).click();
  await page.getByLabel("Buscar canal").fill("nino");
  await expect(page.locator("#grid .tile")).toHaveCount(1);
  await expect(page.locator("#grid .tile")).toContainText("Película: El Niño & Co.");
  await page.getByLabel("Buscar canal").fill("zzz");
  await expect(page.getByText("Nada con «zzz»")).toBeVisible();
});

test("remote control: arrows move focus, OK plays, Back closes", async ({ page }, info) => {
  test.skip(info.project.name !== "tv", "D-pad flow is for the TV layout");
  // Streams are fake in the fixture; stub them so the player shows its error state quickly.
  await page.route("http://example.com/**", (r) => r.abort());
  await page.route("https://example.com/**", (r) => r.abort());
  await importFixture(page);
  await page.locator("#grid .tile").first().focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#grid .tile").nth(1)).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("#grid .tile").nth(4)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#player")).toBeVisible();
  await expect(page.locator("#zap-name")).toHaveText("Duplicado A");
  // Zap to the next channel with the OSD hidden.
  await page.locator("#player").evaluate((el) => el.classList.remove("osd-on"));
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("#zap-name")).toHaveText("Película: El Niño & Co.");
  await expect(page.getByText("No se pudo reproducir este canal")).toBeVisible({ timeout: 20000 });
  // Quick list inside the player: opens on Left with the categories, the one on screen focused.
  await page.locator("#player").evaluate((el) => el.classList.remove("osd-on"));
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("#drawer")).toBeVisible();
  await expect(page.locator("#drawer-cats .dcat.live")).toBeFocused();
  await expect(page.locator("#drawer-cats .dcat.live")).toContainText("Películas");
  // Right opens it, the channel on screen is marked; Left goes back to the categories.
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#drawer .tile.is-playing")).toContainText("Película: El Niño & Co.");
  await expect(page.locator("#drawer-title")).toHaveText("Películas");
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("#drawer-cats")).toBeVisible();
  await page.locator("#drawer-cats").getByRole("button", { name: /^Chile/ }).click();
  await expect(page.locator("#drawer .tile")).toHaveCount(2);
  await page.locator("#drawer .tile").first().click();
  await expect(page.locator("#zap-name")).toHaveText("Canal Nacional");
  await expect(page.locator("#drawer")).toBeVisible();
  // Back steps out one level at a time: channels, categories, closed.
  await page.keyboard.press("Escape");
  await expect(page.locator("#drawer-cats")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#drawer")).toBeHidden();
  await expect(page.getByText("No se pudo reproducir este canal")).toBeVisible({ timeout: 20000 });
  await page.getByRole("button", { name: "Agregar a favoritos" }).click();
  await expect(page.getByRole("button", { name: "Quitar de favoritos" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(page.locator("#player")).toBeHidden();
  await page.getByRole("button", { name: "Favoritos", exact: true }).click();
  await expect(page.locator("#grid .tile")).toHaveCount(1);
});

test("data survives a reload and lists can be deleted", async ({ page }) => {
  await importFixture(page);
  await page.reload();
  await expect(page.getByRole("heading", { name: "¿Qué vemos hoy?" })).toBeVisible();
  await page.getByRole("button", { name: "Listas" }).click();
  const del = page.getByRole("button", { name: "Mantén presionado para eliminar sample" });
  await del.click(); // a tap is not enough
  await expect(page.locator(".pl")).toHaveCount(1);
  await del.focus();
  await page.keyboard.down("Enter"); // hold OK on the remote
  await page.waitForTimeout(1400);
  await page.keyboard.up("Enter");
  await expect(page.getByText("No tienes listas todavía.")).toBeVisible();
});

test("channel list opens from its own button, also after turning the phone", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "Rotation is a phone concern");
  await page.route("http://example.com/**", (r) => r.abort());
  await page.route("https://example.com/**", (r) => r.abort());
  await importFixture(page);
  await page.locator("#grid .tile").first().click();
  await expect(page.getByText("No se pudo reproducir este canal")).toBeVisible({ timeout: 20000 });
  // The list button sits in the transport bar; the favourite took its place up top.
  const list = page.locator("#osd-bar").getByRole("button", { name: "Lista de canales" });
  await expect(page.locator(".osd-top").getByRole("button", { name: "Agregar a favoritos" })).toBeVisible();
  // Upright the panel also comes from the left; then turn sideways: it must land on screen.
  await list.click();
  await expect(page.locator("#drawer")).toBeInViewport({ ratio: 0.9 });
  await page.locator("#drawer-cats").getByRole("button", { name: /^Chile/ }).click();
  await expect(page.locator("#drawer .tile")).toHaveCount(2);
  await page.getByRole("button", { name: "Volver a categorías" }).click();
  await expect(page.locator("#drawer-cats")).toBeVisible();
  await page.getByRole("button", { name: "Cerrar lista de canales" }).click();
  await expect(page.locator("#drawer")).toBeHidden();
  await page.setViewportSize({ width: 863, height: 360 });
  await list.click();
  await expect(page.locator("#drawer")).toBeInViewport({ ratio: 0.9 });
  await expect(list).toHaveAttribute("aria-expanded", "true");
});

test("desktop player: back arrow up top, wheel volume, keyboard shortcuts", async ({ page }, info) => {
  test.skip(info.project.name !== "tv", "Mouse and keyboard flow");
  await page.route("http://example.com/**", (r) => r.abort());
  await page.route("https://example.com/**", (r) => r.abort());
  await importFixture(page);
  await page.locator("#grid .tile").first().click();
  await expect(page.getByText("No se pudo reproducir este canal")).toBeVisible({ timeout: 20000 });
  // No close button in the bar; the way back is the arrow before the channel sticker.
  await expect(page.locator("#osd-bar [data-act=close]")).toHaveCount(0);
  await expect(page.locator(".osd-top").getByRole("button", { name: "Volver" })).toBeVisible();
  const slider = page.getByLabel("Volumen");
  const before = Number(await slider.inputValue());
  await page.mouse.move(480, 270);
  await page.mouse.wheel(0, 100);
  await expect(slider).toHaveValue(String(Math.max(0, before - 5)));
  await expect(page.locator("#hud")).toBeVisible();
  await page.keyboard.press("+");
  await expect(slider).toHaveValue(String(before));
  await page.keyboard.press("m");
  await expect(page.getByRole("button", { name: "Activar sonido" })).toBeVisible();
  await page.locator(".osd-top").getByRole("button", { name: "Volver" }).click();
  await expect(page.locator("#player")).toBeHidden();
});

test("home: the stage shows the last channel and the tabs switch the row", async ({ page }) => {
  await page.route("http://example.com/**", (r) => r.abort());
  await page.route("https://example.com/**", (r) => r.abort());
  await importFixture(page);
  await page.locator("#grid .tile").first().click();
  await expect(page.locator("#player")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Inicio" }).click();
  await expect(page.getByRole("heading", { name: "¿Qué vemos hoy?" })).toBeVisible();
  await expect(page.locator("#stage-plate")).toContainText("Canal Deportes HD");
  await page.getByRole("tab", { name: /^Categorías/ }).click();
  await expect(page.locator("#dock-row .tile")).toHaveCount(6);
  await page.locator("#dock-row .tile", { hasText: "Chile" }).hover();
  await expect(page.locator("#stage-plate")).toContainText("2 canales en esta categoría");
  await page.getByRole("button", { name: "Ver canales Chile" }).click();
  await expect(page.locator("#grid .tile")).toHaveCount(2);
});
