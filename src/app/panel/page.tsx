import { redirect } from "next/navigation";
import { sesionActual } from "@/lib/api";
import { rutaInicio } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Panel() {
  const s = await sesionActual();
  redirect(s ? rutaInicio(s.rol) : "/ingreso");
}
