import * as React from "react";

interface UsePaginationStateOptions {
  initialPage?: number;
  initialPageSize?: number;
}

/** Local pagination + search state for a list page; resets to page 1 whenever the search term changes. */
export function usePaginationState({ initialPage = 1, initialPageSize = 10 }: UsePaginationStateOptions = {}) {
  const [page, setPage] = React.useState(initialPage);
  const [pageSize, setPageSize] = React.useState(initialPageSize);
  const [search, setSearchState] = React.useState("");

  const setSearch = React.useCallback((value: string) => {
    setSearchState(value);
    setPage(1);
  }, []);

  const setPageSizeAndReset = React.useCallback((size: number) => {
    setPageSize(size);
    setPage(1);
  }, []);

  return { page, pageSize, search, setPage, setPageSize: setPageSizeAndReset, setSearch };
}
