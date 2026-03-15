import { NextResponse } from "next/server";

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function successResponse<T>(data: T, meta?: Omit<PaginationMeta, "totalPages">) {
  const response: { success: true; data: T; meta?: PaginationMeta } = {
    success: true,
    data,
  };

  if (meta) {
    response.meta = {
      ...meta,
      totalPages: Math.ceil(meta.total / meta.limit),
    };
  }

  return NextResponse.json(response, { status: 200 });
}

export function createdResponse<T>(data: T) {
  return NextResponse.json({ success: true, data }, { status: 201 });
}

export function errorResponse(message: string, status: number = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}
