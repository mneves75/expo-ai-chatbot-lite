const SABIN_MARKERS: RegExp[] = [
  /sabin/i,
  /www\.sabin\.com\.br/i,
  /CRF\/DF\s+sob\s+o\s+n[úu]mero\s+03\/000054/i,
];

export function looksLikeSabinReport(text: string): boolean {
  return SABIN_MARKERS.some((re) => re.test(text));
}

