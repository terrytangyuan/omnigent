"""Browser e2e for session search via the sidebar inline search input.

The sidebar has an inline search input that debounces keystrokes and
forwards the query to the server as ``GET /v1/sessions?search_query=…``
— filtering is server-side, a case-insensitive substring match on the
session title or conversation content.
"""

from __future__ import annotations

import uuid

import httpx
from playwright.sync_api import Page, expect


def test_search_lists_matching_sessions_inline(
    page: Page,
    seeded_session: tuple[str, str],
) -> None:
    """The inline search filters sessions matching the query.

    Sets a unique title on the seeded session, types into the sidebar's
    inline search input, then asserts the round-trip both ways:

    - A query matching the title keeps the session row visible.
    - A query that matches nothing hides the session row.
    """
    base_url, session_id = seeded_session
    marker = uuid.uuid4().hex[:12]
    title = f"e2e-search-{marker}"
    resp = httpx.patch(
        f"{base_url}/v1/sessions/{session_id}",
        json={"title": title},
        timeout=10.0,
    )
    resp.raise_for_status()

    page.goto(f"{base_url}/c/{session_id}")

    search_input = page.get_by_role("searchbox", name="Search sessions")
    expect(search_input).to_be_visible(timeout=30_000)

    # A query matching the title keeps the session visible.
    search_input.fill(marker)
    sidebar = page.locator(".conversations-sidebar")
    expect(sidebar.get_by_text(title)).to_be_visible()

    # A query that matches nothing hides the session.
    no_match = f"zzz-no-match-{uuid.uuid4().hex[:12]}"
    search_input.fill(no_match)
    expect(sidebar.get_by_text(title)).to_have_count(0)
