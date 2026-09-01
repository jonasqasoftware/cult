import { NextResponse, type NextRequest } from "next/server";
import { CultApiError, discoverEvents } from "../../../lib/api/client";
import { searchParamsToFilters } from "../../../lib/url/discovery-query";

// Small BFF, not a generic open proxy (M8 section 26): only the known public discovery
// filters are ever read from the incoming request (via the same whitelist-parsing
// searchParamsToFilters uses for the page itself) — arbitrary query params are silently
// dropped, never forwarded. Calls CULT_API_BASE_URL server-side; the private API base URL is
// never exposed to the browser. Adds no business rules of its own — used only by
// ResultsView's "Carregar mais" to append a further page of results client-side.
export async function GET(request: NextRequest) {
  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  const filters = searchParamsToFilters(raw);

  try {
    const result = await discoverEvents(filters);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CultApiError && error.problem) {
      return NextResponse.json(error.problem, { status: error.status ?? 502 });
    }
    return NextResponse.json(
      { type: "/problems/internal-error", title: "Internal server error", status: 502, detail: "An unexpected error occurred" },
      { status: 502 },
    );
  }
}
