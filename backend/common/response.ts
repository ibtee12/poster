import { NextResponse } from "next/server";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, { status: 200, ...init });
}

export function created<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, { status: 201, ...init });
}

export function accepted<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, { status: 202, ...init });
}

export function noContent(init?: ResponseInit) {
  return new NextResponse(null, { status: 204, ...init });
}
