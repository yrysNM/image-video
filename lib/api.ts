import type { NextResponse } from "next/server";
import { NextResponse as NR } from "next/server";
import type { ApiErrorBody } from "./types";

export function jsonError(
  error: string,
  status: number,
  code: ApiErrorBody["code"] = "INTERNAL"
): NextResponse<ApiErrorBody> {
  return NR.json({ error, code }, { status });
}
