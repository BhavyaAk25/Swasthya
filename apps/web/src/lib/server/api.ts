import { NextResponse } from "next/server";

import type { ApiResponse } from "@/lib/types";

export function apiOk<T>(data: T) {
  return NextResponse.json<ApiResponse<T>>({
    ok: true,
    data,
    error: null,
  });
}

export function apiError(message: string, status = 500) {
  return NextResponse.json<ApiResponse<null>>(
    {
      ok: false,
      data: null,
      error: message,
    },
    { status },
  );
}
