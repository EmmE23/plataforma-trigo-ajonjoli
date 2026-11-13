import { NextResponse } from "next/server";
import { COOKIE_SESION } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  const res = NextResponse.json({ ok: true, datos: null });
  res.cookies.set(COOKIE_SESION, "", { httpOnly: true, sameSite: "strict", path: "/", maxAge: 0 });
  return res;
}
