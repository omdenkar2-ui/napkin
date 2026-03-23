import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  // Auth disabled for testing — pass through all requests
  return NextResponse.next({ request });
}
